-- ============================================================
-- Migration: performance indexes + filter options RPC function
-- Apply via: Supabase Dashboard > SQL Editor > Run
-- ============================================================

-- ============================================================
-- 1. Indexes on public.categories
--    Covers all filter/sort columns used in homeService.ts.
--    IF NOT EXISTS → safe to re-run; no data is changed.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_categories_assigned_category
  ON public.categories (assigned_category);

CREATE INDEX IF NOT EXISTS idx_categories_assigned_level
  ON public.categories (assigned_level);

CREATE INDEX IF NOT EXISTS idx_categories_channel_name
  ON public.categories (channel_name);

-- published_date is stored as TEXT in YYYY-MM-DD format.
-- A plain B-tree index still speeds up equality/sort queries.
CREATE INDEX IF NOT EXISTS idx_categories_published_date
  ON public.categories (published_date);

CREATE INDEX IF NOT EXISTS idx_categories_created_at
  ON public.categories (created_at);


-- ============================================================
-- 2. Function: get_filter_options()
--
--    Returns all three sets of distinct filter values in a
--    single round-trip instead of paginating all 8000+ rows
--    in JavaScript.
--
--    STABLE  : result may be cached within a single query.
--    jsonb   : binary JSON — slightly faster than json for
--              repeated reads; PostgREST/Supabase JS parses
--              both identically on the client side.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_filter_options()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  WITH
    ch AS (
      SELECT DISTINCT channel_name AS val
      FROM public.categories
      WHERE channel_name IS NOT NULL
        AND btrim(channel_name) <> ''
    ),
    ca AS (
      SELECT DISTINCT assigned_category AS val
      FROM public.categories
      WHERE assigned_category IS NOT NULL
        AND btrim(assigned_category) <> ''
    ),
    lv AS (
      SELECT DISTINCT assigned_level AS val
      FROM public.categories
      WHERE assigned_level IS NOT NULL
        AND btrim(assigned_level) <> ''
    )
  SELECT jsonb_build_object(
    'channels',   COALESCE((SELECT jsonb_agg(val ORDER BY val) FROM ch), '[]'::jsonb),
    'categories', COALESCE((SELECT jsonb_agg(val ORDER BY val) FROM ca), '[]'::jsonb),
    'levels',     COALESCE((SELECT jsonb_agg(val ORDER BY val) FROM lv), '[]'::jsonb)
  );
$$;

-- Allow both anonymous and authenticated callers.
GRANT EXECUTE ON FUNCTION public.get_filter_options() TO anon, authenticated;
