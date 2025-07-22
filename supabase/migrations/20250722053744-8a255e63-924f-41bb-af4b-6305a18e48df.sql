-- Add bot support to lobby_players table
ALTER TABLE public.lobby_players 
ADD COLUMN is_bot BOOLEAN DEFAULT false;

-- Add bot_name column for bot identification
ALTER TABLE public.lobby_players 
ADD COLUMN bot_name TEXT;

-- Update the user_id constraint to allow nulls for bots
ALTER TABLE public.lobby_players 
ALTER COLUMN user_id DROP NOT NULL;

-- Add a check constraint to ensure either user_id OR is_bot is set
ALTER TABLE public.lobby_players
ADD CONSTRAINT check_user_or_bot 
CHECK (
  (user_id IS NOT NULL AND is_bot = false) OR 
  (user_id IS NULL AND is_bot = true AND bot_name IS NOT NULL)
);