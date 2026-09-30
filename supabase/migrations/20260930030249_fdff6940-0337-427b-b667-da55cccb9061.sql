ALTER TABLE public.lobbies ADD COLUMN IF NOT EXISTS coin_reward integer NOT NULL DEFAULT 5;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS win_streak integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_daily_bonus date;

CREATE OR REPLACE FUNCTION public.validate_lobby_coin_reward() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.coin_reward < 0 OR NEW.coin_reward > 10 THEN
    RAISE EXCEPTION 'coin_reward must be between 0 and 10';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validate_lobby_coin_reward ON public.lobbies;
CREATE TRIGGER trg_validate_lobby_coin_reward BEFORE INSERT OR UPDATE ON public.lobbies
FOR EACH ROW EXECUTE FUNCTION public.validate_lobby_coin_reward();

CREATE OR REPLACE FUNCTION public.claim_daily_bonus() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _new int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.profiles SET coins = coins + 100, last_daily_bonus = current_date, updated_at = now()
  WHERE user_id = auth.uid() AND (last_daily_bonus IS NULL OR last_daily_bonus < current_date)
  RETURNING coins INTO _new;
  RETURN _new; -- NULL = already claimed today
END $$;
REVOKE ALL ON FUNCTION public.claim_daily_bonus() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_daily_bonus() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_adjust_coins(_target_user uuid, _amount integer, _mode text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n int;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _mode = 'set' THEN
    UPDATE public.profiles SET coins = GREATEST(_amount,0), updated_at = now()
    WHERE _target_user IS NULL OR user_id = _target_user;
  ELSIF _mode = 'add' THEN
    UPDATE public.profiles SET coins = GREATEST(coins + _amount,0), updated_at = now()
    WHERE _target_user IS NULL OR user_id = _target_user;
  ELSE RAISE EXCEPTION 'invalid mode'; END IF;
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END $$;
REVOKE ALL ON FUNCTION public.admin_adjust_coins(uuid,integer,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_coins(uuid,integer,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_game_outcome(_game_id uuid, _lobby_id uuid, _winner_user_id uuid, _is_blocked boolean, _players jsonb)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  active_season uuid; me_in_lobby boolean; rec jsonb; uid uuid; pos int; pts int; pips int;
  won bool; slams int; turns int; uname text; won_changa bool;
  _reward int; _streak int; _bonus int;
BEGIN
  SELECT public.can_moderate(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.lobby_players lp WHERE lp.lobby_id = _lobby_id AND lp.user_id = (auth.uid())::text
  ) INTO me_in_lobby;
  IF NOT me_in_lobby THEN RAISE EXCEPTION 'Not authorized to record this game outcome'; END IF;
  IF EXISTS (SELECT 1 FROM public.game_results WHERE game_id = _game_id) THEN RETURN true; END IF;

  active_season := public.get_active_season_id();
  INSERT INTO public.game_results (game_id, lobby_id, season_id, winner_user_id, is_blocked_game)
  VALUES (_game_id, _lobby_id, active_season, _winner_user_id, COALESCE(_is_blocked,false));

  FOR rec IN SELECT * FROM jsonb_array_elements(_players) LOOP
    uid := (rec->>'user_id')::uuid;
    pos := COALESCE((rec->>'player_position')::int, 0);
    pts := COALESCE((rec->>'points_scored')::int, 0);
    pips := COALESCE((rec->>'pips_remaining')::int, 0);
    won := COALESCE((rec->>'won')::boolean, false);
    slams := COALESCE((rec->>'hard_slams_used')::int, 0);
    turns := COALESCE((rec->>'turns_played')::int, 0);
    won_changa := COALESCE((rec->>'won_by_changa')::boolean, false);
    SELECT username INTO uname FROM public.profiles WHERE user_id = uid LIMIT 1;
    INSERT INTO public.game_player_stats (game_id, user_id, username, player_position, points_scored, pips_remaining, won, hard_slams_used, turns_played, won_by_changa)
    VALUES (_game_id, uid, uname, pos, pts, pips, won, slams, turns, won_changa);
    IF uid IS DISTINCT FROM _winner_user_id THEN
      UPDATE public.profiles SET win_streak = 0 WHERE user_id = uid;
    END IF;
  END LOOP;

  IF _winner_user_id IS NOT NULL THEN
    SELECT COALESCE(coin_reward, 0) INTO _reward FROM public.lobbies WHERE id = _lobby_id;
    UPDATE public.profiles SET win_streak = win_streak + 1 WHERE user_id = _winner_user_id
    RETURNING win_streak INTO _streak;
    _bonus := CASE _streak WHEN 3 THEN 25 WHEN 5 THEN 50 WHEN 10 THEN 100 ELSE 0 END;
    UPDATE public.profiles SET coins = coins + COALESCE(_reward,0) + _bonus, updated_at = now()
    WHERE user_id = _winner_user_id;
  END IF;
  RETURN true;
END;
$function$;