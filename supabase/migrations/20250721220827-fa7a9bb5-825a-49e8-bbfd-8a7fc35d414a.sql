-- Add invitation security improvements
-- Prevent invitation code reuse and add expiration validation

-- Add trigger to automatically update invitation status when used
CREATE OR REPLACE FUNCTION public.mark_invitation_used()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- When invitation is accepted, mark it as used and set accepted timestamp
  IF NEW.status = 'accepted' AND OLD.status != 'accepted' THEN
    NEW.accepted_at = NOW();
    NEW.accepted_by = auth.uid();
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for invitation status updates
DROP TRIGGER IF EXISTS trigger_mark_invitation_used ON public.invitations;
CREATE TRIGGER trigger_mark_invitation_used
  BEFORE UPDATE ON public.invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_invitation_used();

-- Add validation function for invitation codes
CREATE OR REPLACE FUNCTION public.validate_invitation_code(_code text, _email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  invitation_record public.invitations;
  result jsonb;
BEGIN
  -- Get invitation by code
  SELECT * INTO invitation_record 
  FROM public.invitations 
  WHERE code = _code;
  
  -- Check if invitation exists
  IF invitation_record IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid invitation code');
  END IF;
  
  -- Check if invitation has expired
  IF invitation_record.expires_at < NOW() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invitation has expired');
  END IF;
  
  -- Check if invitation is already used
  IF invitation_record.status != 'pending' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invitation has already been used');
  END IF;
  
  -- Check if email matches
  IF invitation_record.invited_email != _email THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Email does not match invitation');
  END IF;
  
  -- Return valid invitation data
  RETURN jsonb_build_object(
    'valid', true, 
    'invitation_id', invitation_record.id,
    'invited_email', invitation_record.invited_email,
    'invited_by', invitation_record.invited_by
  );
END;
$function$;

-- Improve RLS policies for invitations to prevent enumeration attacks
DROP POLICY IF EXISTS "Users can view their own invitations" ON public.invitations;
CREATE POLICY "Users can view their own sent invitations" 
ON public.invitations 
FOR SELECT 
USING (
  auth.uid() = invited_by OR 
  (invited_email = (
    SELECT email FROM auth.users WHERE id = auth.uid()
  ) AND status = 'pending')
);

-- Add rate limiting table for security
CREATE TABLE IF NOT EXISTS public.auth_attempts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address inet NOT NULL,
  email text,
  attempt_type text NOT NULL, -- 'login', 'signup', 'invitation'
  success boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on auth_attempts
ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;

-- Only admins can view auth attempts
CREATE POLICY "Only admins can view auth attempts" 
ON public.auth_attempts 
FOR ALL 
USING (is_admin(auth.uid()));

-- Anyone can insert auth attempts for logging
CREATE POLICY "Anyone can log auth attempts" 
ON public.auth_attempts 
FOR INSERT 
WITH CHECK (true);