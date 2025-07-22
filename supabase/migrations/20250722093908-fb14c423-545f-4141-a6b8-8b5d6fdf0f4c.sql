-- Create function to get email by username for login
CREATE OR REPLACE FUNCTION public.get_email_by_username(_username text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT u.email
  FROM auth.users u
  INNER JOIN public.profiles p ON p.user_id = u.id
  WHERE p.username = _username
  LIMIT 1
$function$;