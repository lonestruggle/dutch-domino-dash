-- Create table for user favorite table backgrounds
CREATE TABLE public.user_favorite_table_backgrounds (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  background_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_favorite_table_backgrounds ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own favorite table backgrounds"
ON public.user_favorite_table_backgrounds
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own favorite table background"
ON public.user_favorite_table_backgrounds
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own favorite table background"
ON public.user_favorite_table_backgrounds
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorite table background"
ON public.user_favorite_table_backgrounds
FOR DELETE
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_user_favorite_table_background_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_favorite_table_background_updated_at
BEFORE UPDATE ON public.user_favorite_table_backgrounds
FOR EACH ROW
EXECUTE FUNCTION public.update_user_favorite_table_background_updated_at();