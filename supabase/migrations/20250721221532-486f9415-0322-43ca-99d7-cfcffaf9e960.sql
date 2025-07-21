-- Fix invitation creation policy to handle UUID conversion properly
DROP POLICY IF EXISTS "Users can create invitations" ON public.invitations;

CREATE POLICY "Users can create invitations" 
ON public.invitations 
FOR INSERT 
WITH CHECK (auth.uid()::text = invited_by::text);

-- Also fix the SELECT policy for consistency  
DROP POLICY IF EXISTS "Users can view their own sent invitations" ON public.invitations;

CREATE POLICY "Users can view their own sent invitations" 
ON public.invitations 
FOR SELECT 
USING (
  auth.uid()::text = invited_by::text OR 
  (invited_email = (
    SELECT email FROM auth.users WHERE id = auth.uid()
  )::text AND status = 'pending')
);