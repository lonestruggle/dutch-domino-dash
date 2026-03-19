BEGIN;

CREATE TABLE IF NOT EXISTS public.glove_skins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  image_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_glove_skins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  skin_id UUID NOT NULL REFERENCES public.glove_skins(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'assigned',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, skin_id)
);

ALTER TABLE public.glove_skins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_glove_skins ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS selected_glove_skin_id UUID NULL REFERENCES public.glove_skins(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_glove_skins_user_id ON public.user_glove_skins(user_id);
CREATE INDEX IF NOT EXISTS idx_user_glove_skins_skin_id ON public.user_glove_skins(skin_id);
CREATE INDEX IF NOT EXISTS idx_glove_skins_active ON public.glove_skins(is_active);

DROP POLICY IF EXISTS "Anyone can read active glove skins" ON public.glove_skins;
CREATE POLICY "Anyone can read active glove skins"
ON public.glove_skins
FOR SELECT
USING (
  is_active = true
  OR EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
  )
);

DROP POLICY IF EXISTS "Only admins can manage glove skins" ON public.glove_skins;
CREATE POLICY "Only admins can manage glove skins"
ON public.glove_skins
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Users can read own glove assignments" ON public.user_glove_skins;
CREATE POLICY "Users can read own glove assignments"
ON public.user_glove_skins
FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
  )
);

DROP POLICY IF EXISTS "Only admins can manage glove assignments" ON public.user_glove_skins;
CREATE POLICY "Only admins can manage glove assignments"
ON public.user_glove_skins
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

DROP TRIGGER IF EXISTS update_glove_skins_updated_at ON public.glove_skins;
CREATE TRIGGER update_glove_skins_updated_at
BEFORE UPDATE ON public.glove_skins
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.glove_skins (name, image_url, is_active, created_by)
VALUES ('Standaard', '/glove-hand.svg', true, NULL)
ON CONFLICT (name) DO UPDATE
SET image_url = EXCLUDED.image_url,
    is_active = true;

INSERT INTO public.user_glove_skins (user_id, skin_id, source, is_enabled, created_by)
SELECT p.user_id, s.id, 'starter', true, NULL
FROM public.profiles p
CROSS JOIN public.glove_skins s
WHERE s.name = 'Standaard'
ON CONFLICT (user_id, skin_id) DO UPDATE
SET is_enabled = true;

UPDATE public.profiles p
SET selected_glove_skin_id = s.id
FROM public.glove_skins s
WHERE s.name = 'Standaard'
  AND p.selected_glove_skin_id IS NULL;

CREATE OR REPLACE FUNCTION public.assign_default_glove_skin_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_skin_id UUID;
BEGIN
  SELECT id
  INTO default_skin_id
  FROM public.glove_skins
  WHERE name = 'Standaard'
  ORDER BY created_at ASC
  LIMIT 1;

  IF default_skin_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.user_glove_skins (user_id, skin_id, source, is_enabled, created_by)
  VALUES (NEW.user_id, default_skin_id, 'starter', true, NULL)
  ON CONFLICT (user_id, skin_id) DO UPDATE
  SET is_enabled = true;

  IF NEW.selected_glove_skin_id IS NULL THEN
    NEW.selected_glove_skin_id = default_skin_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_default_glove_skin ON public.profiles;
CREATE TRIGGER trg_assign_default_glove_skin
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.assign_default_glove_skin_to_profile();

INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES
  ('global_min_placement_delay_ms', to_jsonb(950), 'Minimale vertraging (ms) tussen steen-plaatsingen voor animaties')
ON CONFLICT (setting_key) DO NOTHING;

COMMIT;
