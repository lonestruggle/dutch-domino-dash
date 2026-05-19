
DROP POLICY IF EXISTS "Players can update their lobby games" ON public.games;

DROP POLICY IF EXISTS "Authenticated can read game_results" ON public.game_results;
CREATE POLICY "Participants and moderators can read game_results"
ON public.game_results
FOR SELECT
TO authenticated
USING (
  can_moderate(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.lobby_players lp
    WHERE lp.lobby_id = game_results.lobby_id
      AND lp.user_id = (auth.uid())::text
  )
  OR winner_user_id = auth.uid()
);

DROP POLICY IF EXISTS "Authenticated can read game_player_stats" ON public.game_player_stats;
CREATE POLICY "Participants and moderators can read game_player_stats"
ON public.game_player_stats
FOR SELECT
TO authenticated
USING (
  can_moderate(auth.uid())
  OR user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.game_results gr
    JOIN public.lobby_players lp ON lp.lobby_id = gr.lobby_id
    WHERE gr.game_id = game_player_stats.game_id
      AND lp.user_id = (auth.uid())::text
  )
);

CREATE OR REPLACE FUNCTION public.lock_invitation_immutable_cols()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF NEW.invited_email IS DISTINCT FROM OLD.invited_email
     OR NEW.invited_by   IS DISTINCT FROM OLD.invited_by
     OR NEW.code         IS DISTINCT FROM OLD.code
     OR NEW.expires_at   IS DISTINCT FROM OLD.expires_at
     OR NEW.created_at   IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Cannot modify immutable invitation fields';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lock_invitation_immutable_cols_trg ON public.invitations;
CREATE TRIGGER lock_invitation_immutable_cols_trg
BEFORE UPDATE ON public.invitations
FOR EACH ROW EXECUTE FUNCTION public.lock_invitation_immutable_cols();

DROP POLICY IF EXISTS "Users can view profiles in same lobby" ON public.profiles;

CREATE OR REPLACE FUNCTION public.get_lobby_co_players(p_lobby_id uuid)
RETURNS TABLE (
  user_id uuid,
  username text,
  avatar_url text,
  status text,
  coins integer,
  selected_glove_skin_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.username, p.avatar_url, p.status, p.coins, p.selected_glove_skin_id
  FROM public.profiles p
  WHERE EXISTS (
    SELECT 1 FROM public.lobby_players lp_me
    WHERE lp_me.lobby_id = p_lobby_id
      AND lp_me.user_id = (auth.uid())::text
  )
  AND EXISTS (
    SELECT 1 FROM public.lobby_players lp_other
    WHERE lp_other.lobby_id = p_lobby_id
      AND lp_other.user_id = (p.user_id)::text
  );
$$;
GRANT EXECUTE ON FUNCTION public.get_lobby_co_players(uuid) TO authenticated;

ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lobby members can read realtime topics" ON realtime.messages;
CREATE POLICY "Lobby members can read realtime topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.lobby_players lp
    WHERE lp.user_id = (auth.uid())::text
      AND (
        realtime.messages.topic = 'lobby-' || lp.lobby_id::text
        OR realtime.messages.topic = 'game-' || lp.lobby_id::text
      )
  )
);

DROP POLICY IF EXISTS "Lobby members can write realtime topics" ON realtime.messages;
CREATE POLICY "Lobby members can write realtime topics"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.lobby_players lp
    WHERE lp.user_id = (auth.uid())::text
      AND (
        realtime.messages.topic = 'lobby-' || lp.lobby_id::text
        OR realtime.messages.topic = 'game-' || lp.lobby_id::text
      )
  )
);
