BEGIN;

ALTER TABLE public.glove_skins
  ADD COLUMN IF NOT EXISTS overlay_offset_x DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overlay_offset_y DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overlay_scale DOUBLE PRECISION NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS overlay_rotation DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Keep legacy default skin harmless when using overlay mode.
-- The base glove remains visible, and this prevents double-rendering the same image as overlay.
UPDATE public.glove_skins
SET overlay_scale = 0
WHERE name = 'Standaard'
  AND image_url = '/glove-hand.svg'
  AND overlay_scale = 1;

COMMIT;
