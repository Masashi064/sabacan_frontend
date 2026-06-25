-- ============================================================
-- Migration: infer channel affinity from history instead of
--            requiring manual selection during onboarding
-- Apply via: Supabase Dashboard > SQL Editor > Run
-- ============================================================

-- ============================================================
-- get_recommended_articles(): re-declared (same signature) to add
-- a history-based channel affinity term. Onboarding no longer asks
-- the user to pick favorite channels — instead we infer "channels
-- this user engages with" from quiz_attempts (read/quiz history),
-- learning_events (browsing/view history), and favorite_words
-- (favorited vocabulary tied to an article). This is independent of
-- — and additive with — the explicit favorite_channels boost, which
-- remains available as a manual override/addition via the Account
-- page's Edit Preferences flow.
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
  -- category + favorite channel + inferred channel affinity +
  -- unread + recency. Each term is named separately so future
  -- factors (popularity, continue-reading, ...) can be added
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
      -- Inferred from history (quiz attempts, view events, favorited
      -- vocab) rather than an explicit choice — smaller weight than
      -- an explicit favorite, additive with it.
      CASE
        WHEN EXISTS (
          SELECT 1 FROM public.quiz_attempts qa
          JOIN public.categories hc ON hc.slug = qa.slug
          WHERE qa.user_id = v_user_id AND hc.channel_name = c.channel_name
          UNION ALL
          SELECT 1 FROM public.learning_events le
          JOIN public.categories hc ON hc.slug = le.slug
          WHERE le.user_id = v_user_id AND hc.channel_name = c.channel_name
          UNION ALL
          SELECT 1 FROM public.favorite_words fw
          JOIN public.categories hc ON hc.slug = fw.slug
          WHERE fw.user_id = v_user_id AND hc.channel_name = c.channel_name
        ) THEN 15 ELSE 0
      END AS history_channel_score,
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
      WHEN s.channel_score > 0 OR s.category_score > 0 OR s.history_channel_score > 0
      THEN '⭐ Recommended for You'
      WHEN s.days_since_published <= 1 THEN '🆕 New'
      ELSE '✨ Editor''s Pick'
    END AS reason,
    (s.category_score + s.channel_score + s.history_channel_score + s.unread_score + s.recency_score)::numeric AS score
  FROM scored s
  ORDER BY (s.category_score + s.channel_score + s.history_channel_score + s.unread_score + s.recency_score) DESC,
           s.published_date DESC NULLS LAST
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_recommended_articles(int) TO anon, authenticated;
