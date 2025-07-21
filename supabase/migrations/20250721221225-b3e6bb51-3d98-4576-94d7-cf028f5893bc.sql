-- Fix validation function to work with invitations without email initially
CREATE OR REPLACE FUNCTION public.validate_invitation_code(_code text, _email text DEFAULT NULL)
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
    RETURN jsonb_build_object('valid', false, 'error', 'Ongeldige uitnodigingscode');
  END IF;
  
  -- Check if invitation has expired
  IF invitation_record.expires_at < NOW() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Uitnodiging is verlopen');
  END IF;
  
  -- Check if invitation is already used
  IF invitation_record.status != 'pending' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Uitnodiging is al gebruikt');
  END IF;
  
  -- Only check email match if both invitation has email and email parameter is provided
  IF invitation_record.invited_email IS NOT NULL 
     AND invitation_record.invited_email != '' 
     AND _email IS NOT NULL 
     AND _email != '' 
     AND invitation_record.invited_email != _email THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Email komt niet overeen met uitnodiging');
  END IF;
  
  -- Return valid invitation data
  RETURN jsonb_build_object(
    'valid', true, 
    'invitation_id', invitation_record.id,
    'invited_email', COALESCE(invitation_record.invited_email, ''),
    'invited_by', invitation_record.invited_by,
    'code', invitation_record.code
  );
END;
$function$;