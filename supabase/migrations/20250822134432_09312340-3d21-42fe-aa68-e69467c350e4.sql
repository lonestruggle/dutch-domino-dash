-- Fix the search path for the trigger function to address security warning
CREATE OR REPLACE FUNCTION public.update_user_favorite_table_background_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';