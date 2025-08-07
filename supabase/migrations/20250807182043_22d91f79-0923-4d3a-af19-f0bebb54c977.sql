-- Add background settings for the main table area (admin only)
CREATE TABLE IF NOT EXISTS public.table_background_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  background_url TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.table_background_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can read table background settings
CREATE POLICY "Admins can read table background settings" 
ON public.table_background_settings 
FOR SELECT 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can insert table background settings
CREATE POLICY "Admins can insert table background settings" 
ON public.table_background_settings 
FOR INSERT 
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can update table background settings
CREATE POLICY "Admins can update table background settings" 
ON public.table_background_settings 
FOR UPDATE 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete table background settings
CREATE POLICY "Admins can delete table background settings" 
ON public.table_background_settings 
FOR DELETE 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Add table background choice to games table
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS table_background_url TEXT;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_table_background_settings_updated_at
BEFORE UPDATE ON public.table_background_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();