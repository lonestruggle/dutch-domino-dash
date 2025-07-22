-- Fix search path for hard slam function  
CREATE OR REPLACE FUNCTION public.initialize_hard_slam_uses()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Set hard slam uses from lobby settings when player joins
  SELECT COALESCE(hard_slam_uses_per_player, -1) 
  INTO NEW.hard_slam_uses_remaining
  FROM public.lobbies 
  WHERE id = NEW.lobby_id;
  
  RETURN NEW;
END;
$$;