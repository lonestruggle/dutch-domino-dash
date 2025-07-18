-- First, drop all existing policies
DROP POLICY IF EXISTS "Anyone can view lobbies" ON public.lobbies;
DROP POLICY IF EXISTS "Authenticated users can create lobbies" ON public.lobbies;
DROP POLICY IF EXISTS "Lobby creators can update their lobbies" ON public.lobbies;
DROP POLICY IF EXISTS "Anyone can view lobby players" ON public.lobby_players;
DROP POLICY IF EXISTS "Authenticated users can join lobbies" ON public.lobby_players;
DROP POLICY IF EXISTS "Players can leave their own lobby" ON public.lobby_players;
DROP POLICY IF EXISTS "Lobby players can view games" ON public.games;
DROP POLICY IF EXISTS "Lobby creators can create games" ON public.games;
DROP POLICY IF EXISTS "Lobby players can update games" ON public.games;

-- Now update the table structures
ALTER TABLE public.lobbies 
DROP CONSTRAINT IF EXISTS lobbies_created_by_fkey,
ALTER COLUMN created_by TYPE TEXT,
ADD COLUMN IF NOT EXISTS created_by_username TEXT;

-- Update lobby_players table to work with usernames
ALTER TABLE public.lobby_players 
DROP CONSTRAINT IF EXISTS lobby_players_user_id_fkey,
ALTER COLUMN user_id TYPE TEXT,
ADD COLUMN IF NOT EXISTS username TEXT;

-- Create new simplified policies that allow all operations
CREATE POLICY "Anyone can view lobbies" 
ON public.lobbies 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create lobbies" 
ON public.lobbies 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update lobbies" 
ON public.lobbies 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can view lobby players" 
ON public.lobby_players 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can join lobbies" 
ON public.lobby_players 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can leave lobbies" 
ON public.lobby_players 
FOR DELETE 
USING (true);

CREATE POLICY "Anyone can view games" 
ON public.games 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create games" 
ON public.games 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update games" 
ON public.games 
FOR UPDATE 
USING (true);