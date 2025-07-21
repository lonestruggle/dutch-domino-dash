-- Set up automatic cleanup cron job to run every hour
SELECT cron.schedule(
  'cleanup-expired-invitations',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT net.http_post(
    url := 'https://zefmabelixpuaelpivjx.supabase.co/functions/v1/cleanup-invitations',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);