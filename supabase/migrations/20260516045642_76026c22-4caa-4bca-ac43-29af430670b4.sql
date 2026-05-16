
-- 1. Add columns to lobbies
ALTER TABLE public.lobbies
  ADD COLUMN IF NOT EXISTS game_mode text NOT NULL DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS wega_stake integer NOT NULL DEFAULT 10;

-- 2. Add coins to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS coins integer NOT NULL DEFAULT 1000;

-- 3. Transfer coins atomically
CREATE OR REPLACE FUNCTION public.transfer_coins(_from_user uuid, _to_user uuid, _amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF _amount <= 0 OR _from_user IS NULL OR _to_user IS NULL OR _from_user = _to_user THEN
    RETURN;
  END IF;
  UPDATE public.profiles SET coins = GREATEST(coins - _amount, 0), updated_at = now()
    WHERE user_id = _from_user;
  UPDATE public.profiles SET coins = coins + _amount, updated_at = now()
    WHERE user_id = _to_user;
END;
$$;

-- 4. Helper: settle wega outcome with arbitrary transfers
-- payload format: { "transfers": [ { "from": uuid, "to": uuid, "amount": int }, ... ] }
CREATE OR REPLACE FUNCTION public.wega_settle(_lobby_id uuid, _payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  t jsonb;
  in_lobby boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT EXISTS (SELECT 1 FROM public.lobby_players
                 WHERE lobby_id = _lobby_id AND user_id = (auth.uid())::text)
    INTO in_lobby;
  IF NOT in_lobby AND NOT public.can_moderate(auth.uid()) THEN
    RAISE EXCEPTION 'Not in lobby';
  END IF;

  FOR t IN SELECT * FROM jsonb_array_elements(COALESCE(_payload->'transfers','[]'::jsonb))
  LOOP
    PERFORM public.transfer_coins(
      (t->>'from')::uuid,
      (t->>'to')::uuid,
      COALESCE((t->>'amount')::int, 0)
    );
  END LOOP;
END;
$$;
