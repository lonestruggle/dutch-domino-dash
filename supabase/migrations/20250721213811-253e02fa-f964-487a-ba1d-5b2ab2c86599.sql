-- Add DELETE policy for lobbies table
-- Allow admins and lobby creators to delete lobbies
CREATE POLICY "Admins and creators can delete lobbies" 
ON public.lobbies 
FOR DELETE 
USING (
  is_admin(auth.uid()) OR 
  created_by = auth.uid()::text
);