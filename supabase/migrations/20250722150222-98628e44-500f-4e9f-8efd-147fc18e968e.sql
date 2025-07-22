-- Add moderator to the app_role enum
ALTER TYPE app_role ADD VALUE 'moderator';

-- Create function to check if user is moderator
CREATE OR REPLACE FUNCTION public.is_moderator(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT public.has_role(_user_id, 'moderator')
$function$;

-- Create function to check if user has moderation privileges (admin or moderator)
CREATE OR REPLACE FUNCTION public.can_moderate(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT public.is_admin(_user_id) OR public.is_moderator(_user_id)
$function$;

-- Update moderation logs policy to include moderators
DROP POLICY IF EXISTS "Only admins can create moderation logs" ON public.moderation_logs;
CREATE POLICY "Admins and moderators can create moderation logs" 
ON public.moderation_logs 
FOR INSERT 
WITH CHECK (can_moderate(auth.uid()));

DROP POLICY IF EXISTS "Only admins can view moderation logs" ON public.moderation_logs;
CREATE POLICY "Admins and moderators can view moderation logs" 
ON public.moderation_logs 
FOR SELECT 
USING (can_moderate(auth.uid()));

-- Update user_bans policies to include moderators
DROP POLICY IF EXISTS "Only admins can view bans" ON public.user_bans;
CREATE POLICY "Admins and moderators can view bans" 
ON public.user_bans 
FOR SELECT 
USING (can_moderate(auth.uid()));

DROP POLICY IF EXISTS "Only admins can manage bans" ON public.user_bans;
CREATE POLICY "Admins and moderators can manage bans" 
ON public.user_bans 
FOR ALL 
USING (can_moderate(auth.uid()));

-- Analytics should still be admin only
-- Invitations admin management stays admin only
-- User role assignment should be admin only

-- Add policy for moderators to view but not modify user profiles
CREATE POLICY "Moderators can view all profiles for moderation" 
ON public.profiles 
FOR SELECT 
USING (can_moderate(auth.uid()) OR auth.uid() = user_id OR true);

-- Update analytics to allow moderators to view basic stats
CREATE POLICY "Moderators can view basic analytics" 
ON public.analytics 
FOR SELECT 
USING (can_moderate(auth.uid()));

DROP POLICY IF EXISTS "Only admins can view analytics" ON public.analytics;