BEGIN;

INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES
  ('global_glove_skin_url', to_jsonb('/glove-hand.svg'::text), 'Globale handschoen skin URL voor alle spelers'),
  ('global_glove_always_visible', 'true'::jsonb, 'Toon de handschoen altijd voor alle spelers')
ON CONFLICT (setting_key) DO NOTHING;

COMMIT;
