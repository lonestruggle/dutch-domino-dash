-- Restrict profile visibility to own profile, same lobby players, or moderators
-- 1) Ensure RLS is enabled (already enabled, but safe to include)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2) Remove overly permissive policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'profiles' 
      AND policyname = 'Users can view all profiles'
  ) THEN
    DROP POLICY "Users can view all profiles" ON public.profiles;
  END IF;
END $$;

-- 3) Allow users to view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
 FOR SELECT
USING (profiles.user_id = auth.uid());

-- 4) Allow users to view profiles of players in the same lobby
CREATE POLICY "Users can view profiles in same lobby"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.lobby_players lp_me
    JOIN public.lobby_players lp_other
      ON lp_other.lobby_id = lp_me.lobby_id
    WHERE lp_me.user_id = (auth.uid())::text
      AND lp_other.user_id = (profiles.user_id)::text
  )
);

-- 5) Moderators can view all profiles
CREATE POLICY "Moderators can view all profiles"
ON public.profiles
FOR SELECT
USING (public.can_moderate(auth.uid()));