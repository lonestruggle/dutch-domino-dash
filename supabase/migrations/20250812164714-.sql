-- SECURITY HARDENING MIGRATION
-- 1) Add player_count to lobbies and keep it in sync
ALTER TABLE public.lobbies
  ADD COLUMN IF NOT EXISTS player_count integer NOT NULL DEFAULT 0;

-- Backfill current counts
UPDATE public.lobbies l
SET player_count = COALESCE(sub.cnt, 0)
FROM (
  SELECT lobby_id, COUNT(*)::int AS cnt
  FROM public.lobby_players
  GROUP BY lobby_id
) sub
WHERE l.id = sub.lobby_id;

-- Helper to recalc player_count for a lobby
CREATE OR REPLACE FUNCTION public.recalc_lobby_player_count(_lobby_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.lobbies
  SET player_count = (
    SELECT COUNT(*) FROM public.lobby_players WHERE lobby_id = _lobby_id
  )
  WHERE id = _lobby_id;
END;
$$;

-- Trigger for insert/delete on lobby_players
CREATE OR REPLACE FUNCTION public.trigger_update_lobby_player_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.recalc_lobby_player_count(COALESCE(NEW.lobby_id, OLD.lobby_id));
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS lobby_players_player_count_ai ON public.lobby_players;
DROP TRIGGER IF EXISTS lobby_players_player_count_ad ON public.lobby_players;
DROP TRIGGER IF EXISTS lobby_players_player_count_au ON public.lobby_players;

CREATE TRIGGER lobby_players_player_count_ai
AFTER INSERT ON public.lobby_players
FOR EACH ROW EXECUTE FUNCTION public.trigger_update_lobby_player_count();

CREATE TRIGGER lobby_players_player_count_ad
AFTER DELETE ON public.lobby_players
FOR EACH ROW EXECUTE FUNCTION public.trigger_update_lobby_player_count();

-- Update trigger to handle lobby_id changes (defensive)
CREATE OR REPLACE FUNCTION public.trigger_update_lobby_player_count_ud()
RETURNS trigger
LANGUAGE plpgsql
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

CREATE TRIGGER lobby_players_player_count_au
AFTER UPDATE OF lobby_id ON public.lobby_players
FOR EACH ROW EXECUTE FUNCTION public.trigger_update_lobby_player_count_ud();

-- Capacity validation to prevent overfilling lobbies
CREATE OR REPLACE FUNCTION public.validate_lobby_capacity()
RETURNS trigger
LANGUAGE plpgsql
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

DROP TRIGGER IF EXISTS lobby_players_capacity_check ON public.lobby_players;
CREATE TRIGGER lobby_players_capacity_check
BEFORE INSERT ON public.lobby_players
FOR EACH ROW EXECUTE FUNCTION public.validate_lobby_capacity();

-- 2) Tighten RLS policies
-- LOBBIES: restrict to authenticated users and require creator on insert
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'lobbies' AND policyname = 'Anyone can view lobbies'
  ) THEN
    DROP POLICY "Anyone can view lobbies" ON public.lobbies;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'lobbies' AND policyname = 'Anyone can create lobbies'
  ) THEN
    DROP POLICY "Anyone can create lobbies" ON public.lobbies;
  END IF;
END $$;

CREATE POLICY "Authenticated users can view lobbies"
ON public.lobbies
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users create own lobbies"
ON public.lobbies
FOR INSERT
WITH CHECK ((created_by = (auth.uid())::text));

-- LOBBY_PLAYERS: restrict join/leave and visibility
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'lobby_players' AND policyname = 'Anyone can join lobbies'
  ) THEN
    DROP POLICY "Anyone can join lobbies" ON public.lobby_players;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'lobby_players' AND policyname = 'Anyone can leave lobbies'
  ) THEN
    DROP POLICY "Anyone can leave lobbies" ON public.lobby_players;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'lobby_players' AND policyname = 'Anyone can view lobby players'
  ) THEN
    DROP POLICY "Anyone can view lobby players" ON public.lobby_players;
  END IF;
END $$;

-- Only see players for lobbies you're part of, or if moderator
CREATE POLICY "Players can view players in their lobbies"
ON public.lobby_players
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.lobby_players lp_me 
    WHERE lp_me.lobby_id = lobby_players.lobby_id 
      AND lp_me.user_id = (auth.uid())::text
  )
);

CREATE POLICY "Moderators can view all lobby players"
ON public.lobby_players
FOR SELECT
USING (can_moderate(auth.uid()));

-- Controlled join rules: self join or creator adding bot
CREATE POLICY "Users can join lobbies (self or creator adding bot)"
ON public.lobby_players
FOR INSERT
WITH CHECK (
  (NOT COALESCE(is_bot, false) AND user_id = (auth.uid())::text)
  OR
  (COALESCE(is_bot, false) AND EXISTS (
    SELECT 1 FROM public.lobbies l 
    WHERE l.id = lobby_players.lobby_id 
      AND l.created_by = (auth.uid())::text
  ))
);

-- Controlled removal: self, lobby creator, or moderator
CREATE POLICY "Users or creators can remove lobby players"
ON public.lobby_players
FOR DELETE
USING (
  (user_id = (auth.uid())::text)
  OR can_moderate(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.lobbies l 
    WHERE l.id = lobby_players.lobby_id 
      AND l.created_by = (auth.uid())::text
  )
);

-- USER_ROLES: hide roles from public, allow self and admins
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'user_roles' AND policyname = 'Anyone can view user roles'
  ) THEN
    DROP POLICY "Anyone can view user roles" ON public.user_roles;
  END IF;
END $$;

CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (is_admin(auth.uid()));
