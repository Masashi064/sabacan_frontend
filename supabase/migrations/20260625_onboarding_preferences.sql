-- ============================================================
-- Migration: onboarding preference setup (favorite categories +
--             onboarding state) and updated recommendation scoring
-- Apply via: Supabase Dashboard > SQL Editor > Run
-- ============================================================

-- ============================================================
-- 1. favorite_categories: mirrors favorite_channels exactly
--    (see 20260625_recommendations.sql) — simple per-user join
--    table, direct client upsert/delete, no SECURITY DEFINER.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.favorite_categories (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  category_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category_name)
);

-- No separate index on (user_id): the UNIQUE(user_id, category_name)
-- constraint already creates a composite btree index usable for
-- "WHERE user_id = auth.uid()" lookups (same reasoning as favorite_channels).

ALTER TABLE public.favorite_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS favorite_categories_select_own ON public.favorite_categories;
CREATE POLICY favorite_categories_select_own
  ON public.favorite_categories FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS favorite_categories_insert_own ON public.favorite_categories;
CREATE POLICY favorite_categories_insert_own
  ON public.favorite_categories FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS favorite_categories_delete_own ON public.favorite_categories;
CREATE POLICY favorite_categories_delete_own
  ON public.favorite_categories FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- 2. user_preferences: one row per user, tracks onboarding state.
--    No DELETE policy — rows live for the account's lifetime and
--    cascade-delete with the user. No trigger for updated_at;
--    callers set it explicitly on every upsert (matches this
--    codebase's no-trigger convention).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  onboarding_completed boolean NOT NULL DEFAULT false,
  onboarding_skipped boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_preferences_select_own ON public.user_preferences;
CREATE POLICY user_preferences_select_own
  ON public.user_preferences FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_preferences_insert_own ON public.user_preferences;
CREATE POLICY user_preferences_insert_own
  ON public.user_preferences FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_preferences_update_own ON public.user_preferences;
CREATE POLICY user_preferences_update_own
  ON public.user_preferences FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 3. get_recommended_articles(): re-declared (same signature) to
--    add a favorite-category score term alongside the existing
--    favorite-channel/unread/recency terms, and rescale weights
--    per the product's updated scoring example (category +30,
--    channel +30, unread +20, recency up to +10).
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_recommended_articles(p_limit int DEFAULT 3)
RETURNS TABLE (
  slug text,
  video_id text,
  assigned_category text,
  assigned_level text,
  published_date text,
  thumbnail_url text,
  channel_name text,
  video_title text,
  video_length text,
  reason text,
  score numeric
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  -- Anonymous visitor: unchanged — most-recent fallback, no
  -- favorites/read-history to score against.
  IF v_user_id IS NULL THEN
    RETURN QUERY
    SELECT
      c.slug, c.video_id, c.assigned_category, c.assigned_level,
      c.published_date, c.thumbnail_url, c.channel_name, c.video_title,
      c.video_length,
      CASE
        WHEN c.published_date ~ '^\d{4}-\d{2}-\d{2}$'
             AND CURRENT_DATE - c.published_date::date <= 1
        THEN '🆕 New'
        ELSE '✨ Editor''s Pick'
      END AS reason,
      0::numeric AS score
    FROM public.categories c
    ORDER BY c.published_date DESC NULLS LAST
    LIMIT p_limit;
    RETURN;
  END IF;

  -- Logged-in: exclude completed articles, score by favorite
  -- category + favorite channel + unread + recency. Each term is
  -- named separately so future factors (popularity, continue-
  -- reading, learning-history, review reminders, ...) can be added
  -- without restructuring.
  RETURN QUERY
  WITH scored AS (
    SELECT
      c.slug, c.video_id, c.assigned_category, c.assigned_level,
      c.published_date, c.thumbnail_url, c.channel_name, c.video_title,
      c.video_length,
      CASE
        WHEN EXISTS (
          SELECT 1 FROM public.favorite_categories fc
          WHERE fc.user_id = v_user_id AND fc.category_name = c.assigned_category
        ) THEN 30 ELSE 0
      END AS category_score,
      CASE
        WHEN EXISTS (
          SELECT 1 FROM public.favorite_channels fc
          WHERE fc.user_id = v_user_id AND fc.channel_name = c.channel_name
        ) THEN 30 ELSE 0
      END AS channel_score,
      -- Every remaining row is unread by construction (completed
      -- slugs are excluded below) — kept as its own named term for
      -- when a future partial-progress signal makes this non-constant.
      20 AS unread_score,
      CASE
        WHEN c.published_date ~ '^\d{4}-\d{2}-\d{2}$'
        THEN GREATEST(0, 10 - (CURRENT_DATE - c.published_date::date))
        ELSE 0 -- malformed/missing published_date: no recency boost, don't crash the cast
      END AS recency_score,
      CASE
        WHEN c.published_date ~ '^\d{4}-\d{2}-\d{2}$'
        THEN CURRENT_DATE - c.published_date::date
        ELSE 9999
      END AS days_since_published
    FROM public.categories c
    WHERE NOT EXISTS (
      SELECT 1 FROM public.quiz_attempts qa
      WHERE qa.user_id = v_user_id
        AND qa.slug = c.slug
        AND qa.completed_at IS NOT NULL
    )
  )
  SELECT
    s.slug, s.video_id, s.assigned_category, s.assigned_level,
    s.published_date, s.thumbnail_url, s.channel_name, s.video_title,
    s.video_length,
    CASE
      WHEN s.channel_score > 0 OR s.category_score > 0 THEN '⭐ Recommended for You'
      WHEN s.days_since_published <= 1 THEN '🆕 New'
      ELSE '✨ Editor''s Pick'
    END AS reason,
    (s.category_score + s.channel_score + s.unread_score + s.recency_score)::numeric AS score
  FROM scored s
  ORDER BY (s.category_score + s.channel_score + s.unread_score + s.recency_score) DESC,
           s.published_date DESC NULLS LAST
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_recommended_articles(int) TO anon, authenticated;
