CREATE OR REPLACE FUNCTION public.record_game_outcome(_game_id uuid, _lobby_id uuid, _winner_user_id uuid, _is_blocked boolean, _players jsonb)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  active_season uuid; me_in_lobby boolean; rec jsonb; uid uuid; pos int; pts int; pips int;
  won bool; slams int; turns int; uname text; won_changa bool; is_tied bool;
  _stake int; _seats int; _pot int; _streak int; _bonus int; _tied_count int; _share int;
BEGIN
  SELECT public.can_moderate(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.lobby_players lp WHERE lp.lobby_id = _lobby_id AND lp.user_id = (auth.uid())::text
  ) INTO me_in_lobby;
  IF NOT me_in_lobby THEN RAISE EXCEPTION 'Not authorized to record this game outcome'; END IF;
  IF EXISTS (SELECT 1 FROM public.game_results WHERE game_id = _game_id) THEN RETURN true; END IF;

  SELECT COALESCE(coin_reward, 0) INTO _stake FROM public.lobbies WHERE id = _lobby_id;
  SELECT GREATEST(count(*),1) INTO _seats FROM public.lobby_players WHERE lobby_id = _lobby_id;
  _pot := COALESCE(_stake,0) * _seats;

  SELECT count(*) INTO _tied_count FROM jsonb_array_elements(_players) e
   WHERE COALESCE((e->>'tied')::boolean,false);

  active_season := public.get_active_season_id();
  INSERT INTO public.game_results (game_id, lobby_id, season_id, winner_user_id, is_blocked_game)
  VALUES (_game_id, _lobby_id, active_season, CASE WHEN _tied_count > 0 THEN NULL ELSE _winner_user_id END, COALESCE(_is_blocked,false));

  FOR rec IN SELECT * FROM jsonb_array_elements(_players) LOOP
    uid := (rec->>'user_id')::uuid;
    pos := COALESCE((rec->>'player_position')::int, 0);
    pts := COALESCE((rec->>'points_scored')::int, 0);
    pips := COALESCE((rec->>'pips_remaining')::int, 0);
    won := COALESCE((rec->>'won')::boolean, false) AND _tied_count = 0;
    slams := COALESCE((rec->>'hard_slams_used')::int, 0);
    turns := COALESCE((rec->>'turns_played')::int, 0);
    won_changa := COALESCE((rec->>'won_by_changa')::boolean, false);
    is_tied := COALESCE((rec->>'tied')::boolean, false);
    SELECT username INTO uname FROM public.profiles WHERE user_id = uid LIMIT 1;
    INSERT INTO public.game_player_stats (game_id, user_id, username, player_position, points_scored, pips_remaining, won, hard_slams_used, turns_played, won_by_changa)
    VALUES (_game_id, uid, uname, pos, pts, pips, won, slams, turns, won_changa);

    -- Iedere speler betaalt de inzet
    IF _stake > 0 THEN
      UPDATE public.profiles SET coins = GREATEST(coins - _stake, 0), updated_at = now() WHERE user_id = uid;
    END IF;

    IF _tied_count > 0 THEN
      IF is_tied THEN
        _share := _pot / _tied_count;
        UPDATE public.profiles SET coins = coins + _share, updated_at = now() WHERE user_id = uid;
      ELSE
        UPDATE public.profiles SET win_streak = 0 WHERE user_id = uid;
      END IF;
    ELSIF uid IS DISTINCT FROM _winner_user_id THEN
      UPDATE public.profiles SET win_streak = 0 WHERE user_id = uid;
    END IF;
  END LOOP;

  IF _tied_count = 0 AND _winner_user_id IS NOT NULL THEN
    UPDATE public.profiles SET win_streak = win_streak + 1 WHERE user_id = _winner_user_id
    RETURNING win_streak INTO _streak;
    _bonus := CASE _streak WHEN 3 THEN 25 WHEN 5 THEN 50 WHEN 10 THEN 100 ELSE 0 END;
    UPDATE public.profiles SET coins = coins + _pot + _bonus, updated_at = now()
    WHERE user_id = _winner_user_id;
  END IF;
  RETURN true;
END;
$function$;