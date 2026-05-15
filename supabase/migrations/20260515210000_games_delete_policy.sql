-- Sta lobby-spelers toe oude games te verwijderen zodat host opnieuw kan starten
CREATE POLICY "Players can delete their lobby games"
ON public.games
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.lobby_players
    WHERE lobby_players.lobby_id = games.lobby_id
      AND lobby_players.user_id = (auth.uid())::text
  )
);
