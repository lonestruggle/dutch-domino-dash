-- Remove the restrictive check constraint on background_choice
ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_background_choice_check;

-- Add a more flexible constraint that allows any valid background ID
-- We'll validate this in the application logic instead of the database
-- This allows for dynamic custom backgrounds to be used