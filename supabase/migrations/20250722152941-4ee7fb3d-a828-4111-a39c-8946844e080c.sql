-- Add hard slam settings to lobbies table
ALTER TABLE public.lobbies 
ADD COLUMN hard_slam_enabled BOOLEAN DEFAULT true,
ADD COLUMN hard_slam_uses_per_player INTEGER DEFAULT -1; -- -1 means unlimited

-- Add hard slam usage tracking to lobby_players table  
ALTER TABLE public.lobby_players
ADD COLUMN hard_slam_uses_remaining INTEGER DEFAULT -1; -- -1 means unlimited

-- Create trigger to initialize hard slam uses when player joins lobby
CREATE OR REPLACE FUNCTION initialize_hard_slam_uses()
RETURNS TRIGGER AS $$
BEGIN
  -- Set hard slam uses from lobby settings when player joins
  SELECT COALESCE(hard_slam_uses_per_player, -1) 
  INTO NEW.hard_slam_uses_remaining
  FROM lobbies 
  WHERE id = NEW.lobby_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_hard_slam_uses_on_join
  BEFORE INSERT ON public.lobby_players
  FOR EACH ROW
  EXECUTE FUNCTION initialize_hard_slam_uses();