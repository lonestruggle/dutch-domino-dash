-- Create trigger function that automatically cleans up expired invitations
-- This will run whenever someone accesses the invitations table
CREATE OR REPLACE FUNCTION public.auto_cleanup_expired_invitations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Clean up expired invitations in the background
  DELETE FROM public.invitations
  WHERE expires_at < NOW() 
  AND status = 'pending';
  
  -- Return the original row for the triggering operation
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Create trigger that runs after SELECT operations to cleanup expired invitations
DROP TRIGGER IF EXISTS trigger_auto_cleanup_invitations ON public.invitations;
CREATE TRIGGER trigger_auto_cleanup_invitations
  AFTER SELECT ON public.invitations
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.auto_cleanup_expired_invitations();