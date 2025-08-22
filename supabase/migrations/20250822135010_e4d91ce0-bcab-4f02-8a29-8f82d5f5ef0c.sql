-- Create user_favorite_backgrounds table for storing user's favorite game board backgrounds
CREATE TABLE public.user_favorite_backgrounds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  background_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_favorite_backgrounds ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own favorite backgrounds" 
ON public.user_favorite_backgrounds 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own favorite backgrounds" 
ON public.user_favorite_backgrounds 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own favorite backgrounds" 
ON public.user_favorite_backgrounds 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorite backgrounds" 
ON public.user_favorite_backgrounds 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic updated_at timestamp updates
CREATE TRIGGER update_user_favorite_backgrounds_updated_at
BEFORE UPDATE ON public.user_favorite_backgrounds
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();