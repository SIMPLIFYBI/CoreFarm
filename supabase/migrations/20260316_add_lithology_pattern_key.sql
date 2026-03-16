ALTER TABLE public.drillhole_lithology_types
ADD COLUMN IF NOT EXISTS pattern_key text NOT NULL DEFAULT 'solid';

UPDATE public.drillhole_lithology_types
SET pattern_key = 'solid'
WHERE pattern_key IS NULL OR btrim(pattern_key) = '';