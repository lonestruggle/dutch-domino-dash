-- Fix missing function can_moderate used by policies and RPCs
-- Create or replace required helper functions to ensure availability

-- Ensure has_role exists (already present, but keep for completeness)
-- Note: Using CREATE OR REPLACE is safe and idempotent
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Ensure is_admin exists
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT public.has_role(_user_id, 'admin');
$$;

-- Ensure is_moderator exists
CREATE OR REPLACE FUNCTION public.is_moderator(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT public.has_role(_user_id, 'moderator');
$$;

-- Create the missing can_moderate function
CREATE OR REPLACE FUNCTION public.can_moderate(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT public.is_admin(_user_id) OR public.is_moderator(_user_id);
$$;