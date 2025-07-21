-- Update the check constraint to allow the new Curaçao flag background option
ALTER TABLE public.games 
DROP CONSTRAINT IF EXISTS games_background_choice_check;

ALTER TABLE public.games 
ADD CONSTRAINT games_background_choice_check 
CHECK (background_choice IN ('domino-table-1', 'domino-table-2', 'domino-table-3', 'curacao-flag-table'));