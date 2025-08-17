-- Harden function search_path for new trigger/helper functions
CREATE OR REPLACE FUNCTION public.recalc_lobby_player_count(_lobby_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  UPDATE public.lobbies
  SET player_count = (
    SELECT COUNT(*) FROM public.lobby_players WHERE lobby_id = _lobby_id
  )
  WHERE id = _lobby_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_update_lobby_player_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  PERFORM public.recalc_lobby_player_count(COALESCE(NEW.lobby_id, OLD.lobby_id));
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_update_lobby_player_count_ud()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF OLD.lobby_id IS NOT NULL THEN
    PERFORM public.recalc_lobby_player_count(OLD.lobby_id);
  END IF;
  IF NEW.lobby_id IS NOT NULL THEN
    PERFORM public.recalc_lobby_player_count(NEW.lobby_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_lobby_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  current_count integer;
  maxp integer;
BEGIN
  SELECT COUNT(*) INTO current_count FROM public.lobby_players WHERE lobby_id = NEW.lobby_id;
  SELECT max_players INTO maxp FROM public.lobbies WHERE id = NEW.lobby_id;
  IF current_count >= maxp THEN
    RAISE EXCEPTION 'Lobby is full';
  END IF;
  RETURN NEW;
END;
$$;