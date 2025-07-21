-- Add delete policy for invitations so users can delete their own invitations
CREATE POLICY "Users can delete their own invitations" 
ON public.invitations 
FOR DELETE 
USING (auth.uid()::text = invited_by::text);

-- Update expires_at default to 24 hours instead of 7 days for faster cleanup
ALTER TABLE public.invitations 
ALTER COLUMN expires_at SET DEFAULT (now() + interval '24 hours');

-- Create function to clean up expired invitations
CREATE OR REPLACE FUNCTION public.cleanup_expired_invitations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  deleted_count integer;
BEGIN
  -- Delete invitations that are expired and not accepted
  DELETE FROM public.invitations
  WHERE expires_at < NOW() 
  AND status = 'pending';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Log cleanup action
  INSERT INTO public.analytics (event_type, event_data)
  VALUES ('cleanup_expired_invitations', jsonb_build_object('deleted_count', deleted_count));
  
  RETURN deleted_count;
END;
$function$;