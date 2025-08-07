-- Create table for user-specific background permissions
CREATE TABLE IF NOT EXISTS public.background_user_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  background_id UUID NOT NULL REFERENCES public.custom_backgrounds(id) ON DELETE CASCADE,
  can_use BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(user_id, background_id)
);

-- Enable RLS
ALTER TABLE public.background_user_permissions ENABLE ROW LEVEL SECURITY;

-- Only admins can manage background permissions
CREATE POLICY "Admins can manage background permissions" 
ON public.background_user_permissions 
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Users can view their own permissions
CREATE POLICY "Users can view their own background permissions" 
ON public.background_user_permissions 
FOR SELECT
TO authenticated
USING (user_id = auth.uid());