-- Create invitations table
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL DEFAULT substring(gen_random_uuid()::text, 1, 8),
  invited_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better performance
CREATE INDEX idx_invitations_code ON public.invitations(code);
CREATE INDEX idx_invitations_invited_by ON public.invitations(invited_by);
CREATE INDEX idx_invitations_invited_email ON public.invitations(invited_email);
CREATE INDEX idx_invitations_status ON public.invitations(status);

-- Enable Row-Level Security
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Users can view invitations they sent
CREATE POLICY "Users can view their own invitations" 
ON public.invitations 
FOR SELECT 
USING (auth.uid() = invited_by);

-- Users can create invitations
CREATE POLICY "Users can create invitations" 
ON public.invitations 
FOR INSERT 
WITH CHECK (auth.uid() = invited_by);

-- Users can update status of invitations for their email
CREATE POLICY "Users can accept invitations for their email" 
ON public.invitations 
FOR UPDATE 
USING (invited_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Admins can view all invitations
CREATE POLICY "Admins can view all invitations" 
ON public.invitations 
FOR SELECT 
USING (is_admin(auth.uid()));

-- Add invitation tracking to profiles table
ALTER TABLE public.profiles 
ADD COLUMN invited_by UUID REFERENCES auth.users(id),
ADD COLUMN invitation_code TEXT;