-- Create app_settings table
CREATE TABLE public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Create policy for reading settings (everyone can read)
CREATE POLICY "Anyone can read app settings" 
ON public.app_settings 
FOR SELECT 
USING (true);

-- Create policy for updating settings (only admins can update)
CREATE POLICY "Only admins can update app settings" 
ON public.app_settings 
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Insert default setting for single player visibility
INSERT INTO public.app_settings (setting_key, setting_value, description) 
VALUES (
  'single_player_enabled', 
  'false', 
  'Controls whether single player mode is visible on the home page'
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();