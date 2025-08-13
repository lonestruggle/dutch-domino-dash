
-- 1) Add a column to track Changa wins per player/game
ALTER TABLE public.game_player_stats
ADD COLUMN IF NOT EXISTS won_by_changa boolean NOT NULL DEFAULT false;

-- 2) Update record_game_outcome to accept and store won_by_changa from the _players JSON
CREATE OR REPLACE FUNCTION public.record_game_outcome(
  _game_id uuid,
  _lobby_id uuid,
  _winner_user_id uuid,
  _is_blocked boolean,
  _players jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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
  won_changa bool;
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
    won_changa := COALESCE((rec->>'won_by_changa')::boolean, false);

    -- fetch username for display (bypass RLS via SECURITY DEFINER)
    SELECT username INTO uname FROM public.profiles WHERE user_id = uid LIMIT 1;

    INSERT INTO public.game_player_stats (
      game_id, user_id, username, player_position, points_scored, pips_remaining, won, hard_slams_used, turns_played, won_by_changa
    ) VALUES (
      _game_id, uid, uname, pos, pts, pips, won, slams, turns, won_changa
    );
  END LOOP;

  RETURN true;
END;
$function$;

-- 3) Rebuild leaderboard_current_season to include Changa wins
-- This assumes the view already exists; we replace it to add changa_wins
CREATE OR REPLACE VIEW public.leaderboard_current_season AS
SELECT
  gps.user_id,
  COALESCE(gps.username, p.username) AS username,
  COUNT(DISTINCT gps.game_id) AS games_played,
  SUM(CASE WHEN gps.won THEN 1 ELSE 0 END) AS wins,
  SUM(gps.points_scored) AS total_points,
  SUM(gps.hard_slams_used) AS hard_slams,
  SUM(gps.turns_played) AS turns,
  SUM(CASE WHEN gps.won_by_changa THEN 1 ELSE 0 END) AS changa_wins
FROM public.game_player_stats gps
JOIN public.game_results gr ON gr.game_id = gps.game_id
JOIN public.seasons s ON s.id = gr.season_id AND s.is_active = true
LEFT JOIN public.profiles p ON p.user_id = gps.user_id
GROUP BY gps.user_id, COALESCE(gps.username, p.username);
