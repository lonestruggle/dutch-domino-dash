-- Add the premium wood table background to custom_backgrounds with correct permission level
INSERT INTO public.custom_backgrounds (name, description, image_url, permission_level, uploaded_by, is_active)
VALUES (
  'Premium Hout Tafel',
  'Elegante houtstructuur tafel achtergrond',
  '/lovable-uploads/06c1799a-c59e-44f8-8d9c-3cc8d671f4c2.png',
  'user',
  (SELECT id FROM auth.users LIMIT 1),
  true
);