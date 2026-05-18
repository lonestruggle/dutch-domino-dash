INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES ('wega_bot_error_chance', '0.05'::jsonb, 'Kans (0-1) dat een bot in Wega di sen een steen bewust verkeerd legt. 0 = nooit, 1 = altijd.')
ON CONFLICT (setting_key) DO NOTHING;