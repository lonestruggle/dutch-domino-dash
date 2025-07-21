-- Add background choice to games table
ALTER TABLE public.games 
ADD COLUMN background_choice text DEFAULT 'domino-table-2' CHECK (background_choice IN ('domino-table-1', 'domino-table-2', 'domino-table-3'));