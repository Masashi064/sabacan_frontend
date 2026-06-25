-- ============================================================
-- Migration: "Today's Recommendations" — favorite channels +
--             scored article recommendations
-- Apply via: Supabase Dashboard > SQL Editor > Run
-- ============================================================

-- ============================================================
-- 1. favorite_channels: lets a user follow a channel, mirroring
--    the favorite_words table/pattern (simple per-user join
--    table, direct client upsert/delete, no SECURITY DEFINER
--    needed since there's no anti-abuse/atomicity concern here).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.favorite_channels (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  channel_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, channel_name)
);

-- No separate index on (user_id): the UNIQUE(user_id, channel_name)
-- constraint above already creates a composite btree index whose
-- leading column is user_id, which Postgres can use directly for
-- "WHERE user_id = auth.uid()" lookups. Adding idx_favorite_channels_user_id
-- would be redundant.

ALTER TABLE public.favorite_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS favorite_channels_select_own ON public.favorite_channels;
CREATE POLICY favorite_channels_select_own
  ON public.favorite_channels FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS favorite_channels_insert_own ON public.favorite_channels;
CREATE POLICY favorite_channels_insert_own
  ON public.favorite_channels FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS favorite_channels_delete_own ON public.favorite_channels;
CREATE POLICY favorite_channels_delete_own
  ON public.favorite_channels FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- 2. get_recommended_articles(): top N articles for the current
--    user, scored by favorite-channel match + unread + recency.
--    Runs with the caller's own RLS-scoped privileges (no
--    SECURITY DEFINER needed — only reads the public categories
--    table and the caller's own quiz_attempts/favorite_channels).
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
  -- Anonymous visitor: no read-history / favorites to score against,
  -- fall back to plain "most recent" with a simple New/Editor's Pick label.
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

  -- Logged-in: exclude completed articles, score by favorite channel +
  -- unread + recency. Each scoring term is named separately so future
  -- factors (popularity, continue-reading, learning-history, review
  -- reminders, ...) can be added as additional terms without restructuring.
  RETURN QUERY
  WITH scored AS (
    SELECT
      c.slug, c.video_id, c.assigned_category, c.assigned_level,
      c.published_date, c.thumbnail_url, c.channel_name, c.video_title,
      c.video_length,
      CASE
        WHEN EXISTS (
          SELECT 1 FROM public.favorite_channels fc
          WHERE fc.user_id = v_user_id AND fc.channel_name = c.channel_name
        ) THEN 50 ELSE 0
      END AS channel_score,
      -- Every remaining row is unread by construction (completed slugs
      -- are excluded below) — kept as its own named term for when a
      -- future partial-progress signal makes this non-constant.
      50 AS unread_score,
      CASE
        WHEN c.published_date ~ '^\d{4}-\d{2}-\d{2}$'
        THEN GREATEST(0, 40 - (CURRENT_DATE - c.published_date::date))
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
      WHEN s.channel_score > 0 THEN '⭐ Recommended for You'
      WHEN s.days_since_published <= 1 THEN '🆕 New'
      ELSE '✨ Editor''s Pick'
    END AS reason,
    (s.channel_score + s.unread_score + s.recency_score)::numeric AS score
  FROM scored s
  ORDER BY (s.channel_score + s.unread_score + s.recency_score) DESC, s.published_date DESC NULLS LAST
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_recommended_articles(int) TO anon, authenticated;
