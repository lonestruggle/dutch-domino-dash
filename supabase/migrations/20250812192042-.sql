-- Seasons table for scoreboard periods
CREATE TABLE IF NOT EXISTS public.seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

-- Only one active season at a time
CREATE UNIQUE INDEX IF NOT EXISTS uq_seasons_single_active
ON public.seasons ((is_active))
WHERE is_active = true;

ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;

-- View seasons publicly (scoreboard visibility)
DROP POLICY IF EXISTS "Anyone can view seasons" ON public.seasons;
CREATE POLICY "Anyone can view seasons"
ON public.seasons FOR SELECT
USING (true);

-- Admins and moderators manage seasons
DROP POLICY IF EXISTS "Admins manage seasons" ON public.seasons;
CREATE POLICY "Admins manage seasons"
ON public.seasons
FOR ALL
USING (can_moderate(auth.uid()) OR has_role(auth.uid(), 'admin'))
WITH CHECK (can_moderate(auth.uid()) OR has_role(auth.uid(), 'admin'));

-- Updated at trigger
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_seasons_updated_at'
  ) THEN
    CREATE TRIGGER trg_seasons_updated_at
    BEFORE UPDATE ON public.seasons
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Game results table (one row per finished game)
CREATE TABLE IF NOT EXISTS public.game_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL UNIQUE,
  lobby_id UUID NOT NULL,
  season_id UUID REFERENCES public.seasons(id) ON DELETE SET NULL,
  winner_user_id UUID,
  is_blocked_game BOOLEAN NOT NULL DEFAULT false,
  played_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.game_results ENABLE ROW LEVEL SECURITY;

-- Read access for authenticated users (for leaderboards)
DROP POLICY IF EXISTS "Authenticated can read game_results" ON public.game_results;
CREATE POLICY "Authenticated can read game_results"
ON public.game_results FOR SELECT
USING (auth.uid() IS NOT NULL);

-- No direct INSERT/UPDATE/DELETE policies on game_results (use definer function)

-- Per-player stats for a game
CREATE TABLE IF NOT EXISTS public.game_player_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.game_results(game_id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  username TEXT,
  player_position INTEGER NOT NULL,
  points_scored INTEGER NOT NULL DEFAULT 0,
  pips_remaining INTEGER NOT NULL DEFAULT 0,
  won BOOLEAN NOT NULL DEFAULT false,
  hard_slams_used INTEGER NOT NULL DEFAULT 0,
  turns_played INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (game_id, user_id)
);

ALTER TABLE public.game_player_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read game_player_stats" ON public.game_player_stats;
CREATE POLICY "Authenticated can read game_player_stats"
ON public.game_player_stats FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Helper: get active season id
CREATE OR REPLACE FUNCTION public.get_active_season_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT id FROM public.seasons WHERE is_active = true ORDER BY created_at DESC LIMIT 1;
$$;

-- Record a finished game outcome with all player stats in one secure call
CREATE OR REPLACE FUNCTION public.record_game_outcome(
  _game_id uuid,
  _lobby_id uuid,
  _winner_user_id uuid,
  _is_blocked boolean,
  _players jsonb
) RETURNS boolean
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
  SELECT can_moderate(auth.uid()) OR EXISTS (
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

-- Admin utilities: reset stats for a season
CREATE OR REPLACE FUNCTION public.reset_season_stats(_season_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  deleted_games int;
BEGIN
  IF NOT (can_moderate(auth.uid()) OR has_role(auth.uid(), 'admin')) THEN
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

-- Admin utility: start a new season (auto-deactivate current)
CREATE OR REPLACE FUNCTION public.start_new_season(_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF NOT (can_moderate(auth.uid()) OR has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Only moderators/admins can manage seasons';
  END IF;

  UPDATE public.seasons SET is_active = false WHERE is_active = true;
  INSERT INTO public.seasons (name, is_active, created_by) VALUES (_name, true, auth.uid()) RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

-- Leaderboard view for current season (no joins to profiles needed thanks to username snapshot)
CREATE OR REPLACE VIEW public.leaderboard_current_season AS
SELECT 
  gps.user_id,
  COALESCE(MAX(gps.username), '') AS username,
  COUNT(*) AS games_played,
  SUM(CASE WHEN gps.won THEN 1 ELSE 0 END) AS wins,
  SUM(gps.points_scored) AS total_points,
  SUM(gps.hard_slams_used) AS hard_slams,
  SUM(gps.turns_played) AS turns
FROM public.game_player_stats gps
JOIN public.game_results gr ON gr.game_id = gps.game_id
JOIN public.seasons s ON s.id = gr.season_id AND s.is_active = true
GROUP BY gps.user_id
ORDER BY wins DESC, total_points DESC;

-- Allow authenticated users to read the leaderboard view
GRANT SELECT ON public.leaderboard_current_season TO anon, authenticated;