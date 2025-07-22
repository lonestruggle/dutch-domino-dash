-- Update lobby policies to include moderators
DROP POLICY IF EXISTS "Admins and creators can delete lobbies" ON public.lobbies;
CREATE POLICY "Admins, moderators and creators can delete lobbies" 
ON public.lobbies 
FOR DELETE 
USING (can_moderate(auth.uid()) OR created_by = (auth.uid())::text);

-- Allow moderators to update any lobby (not just their own)
DROP POLICY IF EXISTS "Anyone can update lobbies" ON public.lobbies;
CREATE POLICY "Moderators can manage all lobbies, others can update own" 
ON public.lobbies 
FOR UPDATE 
USING (can_moderate(auth.uid()) OR created_by = (auth.uid())::text);

-- Allow moderators to manage lobby players
CREATE POLICY "Moderators can manage lobby players" 
ON public.lobby_players 
FOR DELETE 
USING (can_moderate(auth.uid()));

-- Allow moderators to view games for management
CREATE POLICY "Moderators can view all games" 
ON public.games 
FOR SELECT 
USING (can_moderate(auth.uid()) OR EXISTS ( SELECT 1 FROM lobby_players WHERE ((lobby_players.lobby_id = games.lobby_id) AND (lobby_players.user_id = (auth.uid())::text))));

-- Allow moderators to end/manage games
CREATE POLICY "Moderators can manage games" 
ON public.games 
FOR UPDATE 
USING (can_moderate(auth.uid()) OR EXISTS ( SELECT 1 FROM lobby_players WHERE ((lobby_players.lobby_id = games.lobby_id) AND (lobby_players.user_id = (auth.uid())::text))));