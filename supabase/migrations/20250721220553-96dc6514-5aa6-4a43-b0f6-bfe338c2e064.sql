-- CRITICAL SECURITY FIX: Replace overly permissive RLS policies on games table
-- Current policies allow anyone to view/update ANY game, which is a major security risk

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Anyone can view games" ON public.games;
DROP POLICY IF EXISTS "Anyone can update games" ON public.games;
DROP POLICY IF EXISTS "Anyone can create games" ON public.games;

-- Create secure policies that restrict access to lobby players only
CREATE POLICY "Players can view their lobby games" 
ON public.games 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.lobby_players 
    WHERE lobby_players.lobby_id = games.lobby_id 
    AND lobby_players.user_id = (auth.uid())::text
  )
);

CREATE POLICY "Players can update their lobby games" 
ON public.games 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.lobby_players 
    WHERE lobby_players.lobby_id = games.lobby_id 
    AND lobby_players.user_id = (auth.uid())::text
  )
);

CREATE POLICY "Lobby creators can create games" 
ON public.games 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.lobbies 
    WHERE lobbies.id = games.lobby_id 
    AND lobbies.created_by = (auth.uid())::text
  )
);

-- CRITICAL SECURITY FIX: Add search_path to security definer functions
-- This prevents SQL injection attacks through search_path manipulation

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = _user_id AND role = _role
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT public.has_role(_user_id, 'admin')
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Create profile for new user
  INSERT INTO public.profiles (user_id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', 'User' || substring(NEW.id::text, 1, 8)));
  
  -- Assign default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  -- Track user registration in analytics
  INSERT INTO public.analytics (user_id, event_type, event_data)
  VALUES (NEW.id, 'user_registered', jsonb_build_object('email', NEW.email));
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_profile_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Add server-side game move validation function
CREATE OR REPLACE FUNCTION public.validate_game_move(
  _game_id uuid,
  _player_position integer,
  _move_data jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  game_record public.games;
  is_player_in_lobby boolean;
BEGIN
  -- Get game record
  SELECT * INTO game_record FROM public.games WHERE id = _game_id;
  
  -- Check if game exists
  IF game_record IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if it's the player's turn
  IF game_record.current_player_turn != _player_position THEN
    RETURN false;
  END IF;
  
  -- Check if player is in the lobby
  SELECT EXISTS (
    SELECT 1 FROM public.lobby_players 
    WHERE lobby_id = game_record.lobby_id 
    AND user_id = (auth.uid())::text
    AND player_position = _player_position
  ) INTO is_player_in_lobby;
  
  IF NOT is_player_in_lobby THEN
    RETURN false;
  END IF;
  
  -- Additional move validation can be added here
  RETURN true;
END;
$function$;