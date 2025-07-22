-- Create function to check if user is moderator
CREATE OR REPLACE FUNCTION public.is_moderator(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT public.has_role(_user_id, 'moderator')
$function$;

-- Create function to check if user has moderation privileges (admin or moderator)
CREATE OR REPLACE FUNCTION public.can_moderate(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT public.is_admin(_user_id) OR public.is_moderator(_user_id)
$function$;