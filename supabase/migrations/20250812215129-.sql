-- Qualify role-check helpers inside SECURITY DEFINER functions to work with empty search_path

-- Fix start_new_season to use schema-qualified helpers
CREATE OR REPLACE FUNCTION public.start_new_season(_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF NOT (public.can_moderate(auth.uid()) OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Only moderators/admins can manage seasons';
  END IF;

  UPDATE public.seasons SET is_active = false WHERE is_active = true;
  INSERT INTO public.seasons (name, is_active, created_by) VALUES (_name, true, auth.uid()) RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

-- Fix reset_season_stats to use schema-qualified helpers
CREATE OR REPLACE FUNCTION public.reset_season_stats(_season_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  deleted_games int;
BEGIN
  IF NOT (public.can_moderate(auth.uid()) OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Only moderators/admins can reset stats';
  END IF;

  DELETE FROM public.game_player_stats gps
  USING public.game_results gr
  WHERE gps.game_id = gr.game_id AND gr.season_id = _season_id;

  GET DIAGNOSTICS deleted_games = ROW_COUNT;

  DELETE FROM public.game_results WHERE season_id = _season_id;

  RETURN deleted_games;
END;
$$;

-- Fix record_game_outcome to use schema-qualified can_moderate
CREATE OR REPLACE FUNCTION public.record_game_outcome(_game_id uuid, _lobby_id uuid, _winner_user_id uuid, _is_blocked boolean, _players jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  active_season uuid;
  me_in_lobby boolean;
  rec jsonb;
  uid uuid;
  pos int;
  pts int;
  pips int;
  won bool;
  slams int;
  turns int;
  uname text;
BEGIN
  -- allow only moderators or players of the lobby to record results
  SELECT public.can_moderate(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.lobby_players lp
    WHERE lp.lobby_id = _lobby_id AND lp.user_id = (auth.uid())::text
  ) INTO me_in_lobby;

  IF NOT me_in_lobby THEN
    RAISE EXCEPTION 'Not authorized to record this game outcome';
  END IF;

  -- prevent duplicates
  IF EXISTS (SELECT 1 FROM public.game_results WHERE game_id = _game_id) THEN
    RETURN true; -- idempotent
  END IF;

  active_season := public.get_active_season_id();

  INSERT INTO public.game_results (game_id, lobby_id, season_id, winner_user_id, is_blocked_game)
  VALUES (_game_id, _lobby_id, active_season, _winner_user_id, COALESCE(_is_blocked,false));

  -- loop players array and insert stats
  FOR rec IN SELECT * FROM jsonb_array_elements(_players)
  LOOP
    uid   := (rec->>'user_id')::uuid;
    pos   := COALESCE((rec->>'player_position')::int, 0);
    pts   := COALESCE((rec->>'points_scored')::int, 0);
    pips  := COALESCE((rec->>'pips_remaining')::int, 0);
    won   := COALESCE((rec->>'won')::boolean, false);
    slams := COALESCE((rec->>'hard_slams_used')::int, 0);
    turns := COALESCE((rec->>'turns_played')::int, 0);

    -- fetch username for display (bypass RLS via SECURITY DEFINER)
    SELECT username INTO uname FROM public.profiles WHERE user_id = uid LIMIT 1;

    INSERT INTO public.game_player_stats (
      game_id, user_id, username, player_position, points_scored, pips_remaining, won, hard_slams_used, turns_played
    ) VALUES (
      _game_id, uid, uname, pos, pts, pips, won, slams, turns
    );
  END LOOP;

  RETURN true;
END;
$$;