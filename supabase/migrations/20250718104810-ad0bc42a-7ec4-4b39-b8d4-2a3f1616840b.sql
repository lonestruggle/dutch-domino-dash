-- Create lobbies table
CREATE TABLE public.lobbies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_by UUID NOT NULL,
  max_players INTEGER NOT NULL DEFAULT 4 CHECK (max_players >= 1 AND max_players <= 4),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create lobby_players table
CREATE TABLE public.lobby_players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lobby_id UUID NOT NULL REFERENCES public.lobbies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  player_position INTEGER NOT NULL CHECK (player_position >= 0 AND player_position <= 3),
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lobby_id, user_id),
  UNIQUE(lobby_id, player_position)
);

-- Create games table
CREATE TABLE public.games (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lobby_id UUID NOT NULL REFERENCES public.lobbies(id) ON DELETE CASCADE,
  current_player_turn INTEGER NOT NULL DEFAULT 0,
  game_state JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'finished')),
  winner_position INTEGER NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.lobbies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lobby_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

-- Create policies for lobbies (public read, authenticated users can create)
CREATE POLICY "Anyone can view lobbies" 
ON public.lobbies 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create lobbies" 
ON public.lobbies 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Lobby creators can update their lobbies" 
ON public.lobbies 
FOR UPDATE 
USING (auth.uid() = created_by);

-- Create policies for lobby_players
CREATE POLICY "Anyone can view lobby players" 
ON public.lobby_players 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can join lobbies" 
ON public.lobby_players 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Players can leave their own lobby" 
ON public.lobby_players 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create policies for games
CREATE POLICY "Lobby players can view games" 
ON public.games 
FOR SELECT 
USING (
  lobby_id IN (
    SELECT lobby_id FROM public.lobby_players WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Lobby creators can create games" 
ON public.games 
FOR INSERT 
WITH CHECK (
  lobby_id IN (
    SELECT id FROM public.lobbies WHERE created_by = auth.uid()
  )
);

CREATE POLICY "Lobby players can update games" 
ON public.games 
FOR UPDATE 
USING (
  lobby_id IN (
    SELECT lobby_id FROM public.lobby_players WHERE user_id = auth.uid()
  )
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_lobbies_updated_at
  BEFORE UPDATE ON public.lobbies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_games_updated_at
  BEFORE UPDATE ON public.games
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for all tables
ALTER TABLE public.lobbies REPLICA IDENTITY FULL;
ALTER TABLE public.lobby_players REPLICA IDENTITY FULL;
ALTER TABLE public.games REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.lobbies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lobby_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;