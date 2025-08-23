-- Create function to cleanup expired lobbies
CREATE OR REPLACE FUNCTION public.cleanup_expired_lobbies()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  deleted_count integer;
BEGIN
  -- Delete lobby players first (due to foreign key constraints)
  DELETE FROM public.lobby_players
  WHERE lobby_id IN (
    SELECT id FROM public.lobbies 
    WHERE status = 'waiting' 
    AND created_at < NOW() - INTERVAL '15 minutes'
  );

  -- Delete expired lobbies that haven't started (status = waiting) and are older than 15 minutes
  DELETE FROM public.lobbies
  WHERE status = 'waiting' 
  AND created_at < NOW() - INTERVAL '15 minutes';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Log cleanup action if any lobbies were deleted
  IF deleted_count > 0 THEN
    INSERT INTO public.analytics (event_type, event_data)
    VALUES ('cleanup_expired_lobbies', jsonb_build_object('deleted_count', deleted_count));
  END IF;
  
  RETURN deleted_count;
END;
$function$;

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create cron job to run cleanup every 5 minutes
SELECT cron.schedule(
  'cleanup-expired-lobbies',
  '*/5 * * * *', -- every 5 minutes
  $$
  SELECT public.cleanup_expired_lobbies();
  $$
);