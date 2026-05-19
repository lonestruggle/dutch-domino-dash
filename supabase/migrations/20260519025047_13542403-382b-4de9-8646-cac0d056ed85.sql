
DROP POLICY IF EXISTS "Only admins can manage glove skins" ON public.glove_skins;

CREATE POLICY "Admins and devs can manage glove skins"
ON public.glove_skins
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin'::app_role, 'dev'::app_role)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin'::app_role, 'dev'::app_role)
  )
);

DROP POLICY IF EXISTS "Anyone can read active glove skins" ON public.glove_skins;

CREATE POLICY "Anyone can read active glove skins"
ON public.glove_skins
FOR SELECT
USING (
  is_active = true
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin'::app_role, 'moderator'::app_role, 'dev'::app_role)
  )
);
