-- Create trigger function that automatically cleans up expired invitations
-- This will run on INSERT operations to periodically clean up
CREATE OR REPLACE FUNCTION public.auto_cleanup_expired_invitations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Only clean up occasionally (random chance) to avoid performance issues
  IF random() < 0.1 THEN  -- 10% chance to clean up
    DELETE FROM public.invitations
    WHERE expires_at < NOW() 
    AND status = 'pending';
  END IF;
  
  -- Return the new row for INSERT operations
  RETURN NEW;
END;
$function$;

-- Create trigger that runs after INSERT operations to occasionally cleanup expired invitations
DROP TRIGGER IF EXISTS trigger_auto_cleanup_invitations ON public.invitations;
CREATE TRIGGER trigger_auto_cleanup_invitations
  AFTER INSERT ON public.invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_cleanup_expired_invitations();