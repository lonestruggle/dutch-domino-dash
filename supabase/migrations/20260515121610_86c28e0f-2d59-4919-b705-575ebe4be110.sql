
CREATE TABLE IF NOT EXISTS public.domino_skins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  image_url text,
  css_background text,
  is_builtin boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.domino_skins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active domino skins"
ON public.domino_skins FOR SELECT
USING (
  is_active = true
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin'::app_role, 'moderator'::app_role)
  )
);

CREATE POLICY "Only admins manage domino skins"
ON public.domino_skins FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'::app_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'::app_role
  )
);

CREATE TRIGGER trg_domino_skins_updated_at
BEFORE UPDATE ON public.domino_skins
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.domino_skins (name, css_background, is_builtin) VALUES
('Klassiek Hout', 'linear-gradient(135deg,#8b5a2b 0%,#5d3a1a 50%,#3e2510 100%)', true),
('Marmer', 'linear-gradient(135deg,#f5f5f5 0%,#c9c9c9 50%,#8a8a8a 100%)', true),
('Neon', 'linear-gradient(135deg,#ff006e 0%,#8338ec 50%,#3a86ff 100%)', true),
('Leer', 'linear-gradient(135deg,#4a2c1a 0%,#2c1810 100%)', true),
('Curaçao Vlag', 'linear-gradient(180deg,#002d72 0%,#002d72 45%,#ffd700 45%,#ffd700 55%,#002d72 55%,#002d72 100%)', true);

ALTER TABLE public.lobbies ADD COLUMN IF NOT EXISTS domino_skin_id uuid REFERENCES public.domino_skins(id) ON DELETE SET NULL;
ALTER TABLE public.games   ADD COLUMN IF NOT EXISTS domino_skin_url text;
ALTER TABLE public.games   ADD COLUMN IF NOT EXISTS domino_skin_css text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('domino-skins', 'domino-skins', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read domino-skins bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'domino-skins');

CREATE POLICY "Admins upload domino-skins"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'domino-skins'
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'::app_role
  )
);

CREATE POLICY "Admins update domino-skins"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'domino-skins'
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'::app_role
  )
);

CREATE POLICY "Admins delete domino-skins"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'domino-skins'
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'::app_role
  )
);
