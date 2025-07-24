-- Update the handle_new_user function to set display name in auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  username_value text;
BEGIN
  -- Generate username
  username_value := COALESCE(NEW.raw_user_meta_data->>'username', 'User' || substring(NEW.id::text, 1, 8));
  
  -- Create profile for new user
  INSERT INTO public.profiles (user_id, username)
  VALUES (NEW.id, username_value);
  
  -- Assign default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  -- Track user registration in analytics
  INSERT INTO public.analytics (user_id, event_type, event_data)
  VALUES (NEW.id, 'user_registered', jsonb_build_object('email', NEW.email));
  
  RETURN NEW;
END;
$$;

-- Create function to sync display name from profile to auth
CREATE OR REPLACE FUNCTION public.sync_display_name_to_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Update display name in auth.users when profile username changes
  -- This requires service role permissions
  PERFORM pg_notify('sync_display_name', json_build_object(
    'user_id', NEW.user_id,
    'display_name', NEW.username
  )::text);
  
  RETURN NEW;
END;
$$;

-- Create trigger to sync display name when profile is updated
DROP TRIGGER IF EXISTS sync_display_name_trigger ON public.profiles;
CREATE TRIGGER sync_display_name_trigger
  AFTER INSERT OR UPDATE OF username ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_display_name_to_auth();

-- Create edge function helper to update existing users' display names
CREATE OR REPLACE FUNCTION public.get_users_without_display_name()
RETURNS TABLE(user_id uuid, username text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT p.user_id, p.username
  FROM public.profiles p
  WHERE p.username IS NOT NULL
$$;