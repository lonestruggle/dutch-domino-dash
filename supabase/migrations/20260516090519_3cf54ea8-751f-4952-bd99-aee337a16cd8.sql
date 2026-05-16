
-- 1. Verwijder gevoelige tabellen uit Realtime publicatie
ALTER PUBLICATION supabase_realtime DROP TABLE public.analytics;
ALTER PUBLICATION supabase_realtime DROP TABLE public.moderation_logs;
ALTER PUBLICATION supabase_realtime DROP TABLE public.user_bans;
ALTER PUBLICATION supabase_realtime DROP TABLE public.user_roles;

-- 2. games UPDATE policies: WITH CHECK toevoegen zodat spelers de lobby_id niet kunnen wijzigen
DROP POLICY IF EXISTS "Players can update their lobby games" ON public.games;
CREATE POLICY "Players can update their lobby games"
ON public.games
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM lobby_players
    WHERE lobby_players.lobby_id = games.lobby_id
      AND lobby_players.user_id = (auth.uid())::text
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM lobby_players
    WHERE lobby_players.lobby_id = games.lobby_id
      AND lobby_players.user_id = (auth.uid())::text
  )
);

DROP POLICY IF EXISTS "Moderators can manage games" ON public.games;
CREATE POLICY "Moderators can manage games"
ON public.games
FOR UPDATE
USING (
  can_moderate(auth.uid()) OR EXISTS (
    SELECT 1 FROM lobby_players
    WHERE lobby_players.lobby_id = games.lobby_id
      AND lobby_players.user_id = (auth.uid())::text
  )
)
WITH CHECK (
  can_moderate(auth.uid()) OR EXISTS (
    SELECT 1 FROM lobby_players
    WHERE lobby_players.lobby_id = games.lobby_id
      AND lobby_players.user_id = (auth.uid())::text
  )
);

-- 3. invitations: beperk UPDATE door uitgenodigde gebruiker tot enkel status='accepted' + accepted_by=self,
-- met onveranderlijke velden (code, invited_by, invited_email).
DROP POLICY IF EXISTS "Users can accept invitations for their email" ON public.invitations;
CREATE POLICY "Users can accept invitations for their email"
ON public.invitations
FOR UPDATE
USING (
  invited_email = ((SELECT users.email FROM auth.users WHERE users.id = auth.uid()))::text
)
WITH CHECK (
  invited_email = ((SELECT users.email FROM auth.users WHERE users.id = auth.uid()))::text
  AND status = 'accepted'
  AND accepted_by = auth.uid()
);
