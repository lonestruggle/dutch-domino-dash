-- Fix RLS policy that's causing permission denied error
-- The issue is that we're trying to access auth.users table in the policy

DROP POLICY IF EXISTS "Users can view their own sent invitations" ON public.invitations;

-- Create a simpler policy that doesn't access auth.users table
CREATE POLICY "Users can view their own sent invitations" 
ON public.invitations 
FOR SELECT 
USING (auth.uid()::text = invited_by::text);

-- Also ensure the INSERT policy is correct
DROP POLICY IF EXISTS "Users can create invitations" ON public.invitations;

CREATE POLICY "Users can create invitations" 
ON public.invitations 
FOR INSERT 
WITH CHECK (auth.uid()::text = invited_by::text);