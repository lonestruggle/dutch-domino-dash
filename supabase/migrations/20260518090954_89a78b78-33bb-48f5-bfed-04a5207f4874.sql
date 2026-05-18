CREATE OR REPLACE FUNCTION public.is_dev(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT public.has_role(_user_id, 'dev'::public.app_role);
$$;