-- ============================================================
-- Migration: Achievement system MVP
-- Apply via: Supabase Dashboard > SQL Editor > Run
-- ============================================================

-- ============================================================
-- 1. achievements — master table of all achievement definitions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.achievements (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text        UNIQUE NOT NULL,
  name        text        NOT NULL,
  description text        NOT NULL,
  category    text        NOT NULL,
  coin_reward integer     NOT NULL DEFAULT 0,
  icon        text,
  is_hidden   boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. user_achievements — one row per user per unlock
--    context: optional qualifier (e.g. category name for
--    "Practice Makes Perfect: Reading")
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_achievements (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id uuid        NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  context        text,
  unlocked_at    timestamptz NOT NULL DEFAULT now()
);

-- Unique per (user, achievement, context).
-- COALESCE so that NULL context still prevents duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS user_achievements_uniq
  ON public.user_achievements (user_id, achievement_id, COALESCE(context, ''));

CREATE INDEX IF NOT EXISTS idx_user_achievements_user
  ON public.user_achievements (user_id);

ALTER TABLE public.achievements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- Everyone can read achievement definitions
DROP POLICY IF EXISTS achievements_select_all ON public.achievements;
CREATE POLICY achievements_select_all
  ON public.achievements FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS user_achievements_select_own ON public.user_achievements;
CREATE POLICY user_achievements_select_own
  ON public.user_achievements FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- No client INSERT/UPDATE/DELETE — all writes go through
-- check_and_unlock_achievements() (SECURITY DEFINER).

-- ============================================================
-- 3. Achievement master data (seed)
-- ============================================================

INSERT INTO public.achievements (code, name, description, category, coin_reward, icon, is_hidden)
VALUES
  -- Behavior: getting started
  ('first_step',       'First Step',       'Complete your very first quiz.',                          'discovery', 30,  '👣', false),
  ('new_horizons',     'New Horizons',     'Try a quiz in a second different category.',              'discovery', 50,  '🌐', false),
  ('change_of_pace',   'A Change of Pace', 'Explore three different categories.',                     'discovery', 50,  '🔄', false),
  ('tune_in',          'Tune In',          'Complete a quiz from a new YouTube channel.',             'discovery', 50,  '📺', false),
  ('level_up',         'Level Up',         'Try a quiz at a new difficulty level.',                   'discovery', 50,  '⬆️', false),
  ('brave_new_world',  'Brave New World',  'Complete your first Reading quiz.',                       'discovery', 80,  '📖', false),
  ('word_by_word',     'Word by Word',     'Complete your first Vocabulary quiz.',                    'discovery', 50,  '📝', false),
  ('number_cruncher',  'Number Cruncher',  'Complete your first Math quiz.',                          'discovery', 50,  '🔢', false),
  ('fresh_start',      'Fresh Start',      'Complete the first quiz of the day.',                     'discovery', 20,  '🌄', false),

  -- Time-based
  ('early_bird',                'Early Bird',               'Study between 5:00 and 8:59 in the morning.',    'time', 50,  '🌅', true),
  ('rise_and_shine',            'Rise and Shine',           'Study between 6:00 and 6:59 — an early riser!',  'time', 80,  '☀️', true),
  ('night_owl',                 'Night Owl',                'Study after 10 PM or before 4 AM.',              'time', 50,  '🦉', true),
  ('burning_the_midnight_oil',  'Burning the Midnight Oil', 'Study between midnight and 2:59 AM.',            'time', 100, '🕯️', true),
  ('after_hours',               'After Hours',              'Study outside typical work or school hours.',     'time', 50,  '🌆', true),

  -- Date events
  ('merry_christmas', 'Merry Christmas', 'Study on December 25th.',  'event', 150, '🎄', true),
  ('happy_new_year',  'Happy New Year',  'Study on January 1st.',    'event', 150, '🎍', true),
  ('april_fool',      'April Fool',      'Study on April 1st.',      'event', 100, '🃏', true),
  ('lucky_seven',     'Lucky Seven',     'Study on July 7th.',       'event', 150, '⭐', true),
  ('leap_of_faith',   'Leap of Faith',   'Study on February 29th — a rare day!', 'event', 500, '🐸', true),

  -- Category count (per-category; context = category name)
  ('getting_the_hang_of_it',  'Getting the Hang of It', 'Answer 5 questions in one category.',    'mastery', 30,  '💪', false),
  ('on_a_roll',               'On a Roll',              'Answer 10 questions in one category.',   'mastery', 50,  '🎯', false),
  ('practice_makes_perfect',  'Practice Makes Perfect', 'Answer 20 questions in one category.',  'mastery', 100, '🏅', false),
  ('slow_and_steady',         'Slow and Steady',        'Answer 50 questions in one category.',  'mastery', 200, '🐢', false),
  ('mastery_in_motion',       'Mastery in Motion',      'Answer 100 questions in one category.', 'mastery', 500, '🏆', false)

ON CONFLICT (code) DO UPDATE
  SET name        = EXCLUDED.name,
      description = EXCLUDED.description,
      category    = EXCLUDED.category,
      coin_reward = EXCLUDED.coin_reward,
      icon        = EXCLUDED.icon,
      is_hidden   = EXCLUDED.is_hidden;

-- ============================================================
-- 4. _ach_unlock() — internal helper
--    Tries to insert a user_achievement row.
--    If newly inserted: grants coin_reward → coin_ledger +
--    coin_transactions, returns the achievement as jsonb.
--    If already unlocked: returns NULL.
-- ============================================================

CREATE OR REPLACE FUNCTION public._ach_unlock(
  p_uid     uuid,
  p_code    text,
  p_context text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ach  achievements%ROWTYPE;
  v_rows int;
BEGIN
  SELECT * INTO v_ach FROM achievements WHERE code = p_code;
  IF NOT FOUND THEN RETURN NULL; END IF;

  INSERT INTO user_achievements (user_id, achievement_id, context)
  VALUES (p_uid, v_ach.id, p_context)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN RETURN NULL; END IF;

  -- Grant bonus coins
  INSERT INTO coin_ledger (
    user_id, slug, is_first_completion,
    correct_count, total_questions, base_amount, bonus_amount, amount
  ) VALUES (
    p_uid,
    'ach:' || p_code || COALESCE(':' || p_context, ''),
    true, 0, 0, v_ach.coin_reward, 0, v_ach.coin_reward
  );

  INSERT INTO coin_transactions (user_id, amount, reason)
  VALUES (p_uid, v_ach.coin_reward, 'achievement');

  RETURN jsonb_build_object(
    'code',        v_ach.code,
    'name',        v_ach.name,
    'description', v_ach.description,
    'icon',        COALESCE(v_ach.icon, '🏆'),
    'coin_reward', v_ach.coin_reward,
    'context',     p_context
  );
END;
$$;

-- ============================================================
-- 5. check_and_unlock_achievements() — main RPC
--    Called from the client after quiz_attempts is saved.
--    Looks up article metadata from categories table (trusted
--    server side), evaluates all conditions, unlocks new
--    achievements, and returns the list of newly unlocked ones.
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_and_unlock_achievements(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();

  -- Article metadata (looked up server-side)
  v_cat     text;
  v_level   text;
  v_channel text;

  -- Time/date in JST
  v_jst   timestamptz := NOW() AT TIME ZONE 'Asia/Tokyo';
  v_hour  int := EXTRACT(HOUR  FROM (NOW() AT TIME ZONE 'Asia/Tokyo'))::int;
  v_month int := EXTRACT(MONTH FROM (NOW() AT TIME ZONE 'Asia/Tokyo'))::int;
  v_day   int := EXTRACT(DAY   FROM (NOW() AT TIME ZONE 'Asia/Tokyo'))::int;

  -- User stats (all include the current quiz_attempt, already saved)
  v_total_attempts  bigint := 0;
  v_distinct_cats   bigint := 0;
  v_distinct_chs    bigint := 0;
  v_distinct_levels bigint := 0;
  v_cat_questions   bigint := 0;
  v_today_attempts  bigint := 0;
  v_cat_first_count bigint := 0;  -- how many times user has done this category

  -- Result accumulator
  v_unlocked jsonb := '[]'::jsonb;
  v_entry    jsonb;

  -- Category-count achievement pairs
  v_cat_codes text[] := ARRAY['getting_the_hang_of_it','on_a_roll','practice_makes_perfect','slow_and_steady','mastery_in_motion'];
  v_cat_mins  int[]  := ARRAY[5, 10, 20, 50, 100];
  v_i int;
BEGIN
  IF v_uid IS NULL THEN RETURN '[]'::jsonb; END IF;

  -- ── Article metadata ──────────────────────────────────────────
  SELECT assigned_category, assigned_level, channel_name
  INTO   v_cat, v_level, v_channel
  FROM   categories WHERE slug = p_slug;

  -- ── User stats ───────────────────────────────────────────────
  SELECT COUNT(*) INTO v_total_attempts
  FROM   quiz_attempts WHERE user_id = v_uid;

  SELECT COUNT(DISTINCT c.assigned_category) INTO v_distinct_cats
  FROM   quiz_attempts qa
  JOIN   categories    c  ON c.slug = qa.slug
  WHERE  qa.user_id = v_uid AND c.assigned_category IS NOT NULL;

  SELECT COUNT(DISTINCT c.channel_name) INTO v_distinct_chs
  FROM   quiz_attempts qa
  JOIN   categories    c  ON c.slug = qa.slug
  WHERE  qa.user_id = v_uid AND c.channel_name IS NOT NULL;

  SELECT COUNT(DISTINCT c.assigned_level) INTO v_distinct_levels
  FROM   quiz_attempts qa
  JOIN   categories    c  ON c.slug = qa.slug
  WHERE  qa.user_id = v_uid AND c.assigned_level IS NOT NULL;

  IF v_cat IS NOT NULL THEN
    SELECT COALESCE(SUM(qa.total_questions), 0) INTO v_cat_questions
    FROM   quiz_attempts qa
    JOIN   categories    c  ON c.slug = qa.slug
    WHERE  qa.user_id = v_uid AND c.assigned_category = v_cat;

    SELECT COUNT(*) INTO v_cat_first_count
    FROM   quiz_attempts qa
    JOIN   categories    c  ON c.slug = qa.slug
    WHERE  qa.user_id = v_uid AND c.assigned_category = v_cat;
  END IF;

  SELECT COUNT(*) INTO v_today_attempts
  FROM   quiz_attempts
  WHERE  user_id = v_uid
    AND  (completed_at AT TIME ZONE 'Asia/Tokyo')::date = v_jst::date;

  -- ── Behavior achievements ────────────────────────────────────

  -- first_step: first quiz ever
  IF v_total_attempts = 1 THEN
    v_entry := _ach_unlock(v_uid, 'first_step', NULL);
    IF v_entry IS NOT NULL THEN v_unlocked := v_unlocked || jsonb_build_array(v_entry); END IF;
  END IF;

  -- fresh_start: first quiz of today
  IF v_today_attempts = 1 THEN
    v_entry := _ach_unlock(v_uid, 'fresh_start', NULL);
    IF v_entry IS NOT NULL THEN v_unlocked := v_unlocked || jsonb_build_array(v_entry); END IF;
  END IF;

  -- new_horizons: tried a 2nd distinct category
  IF v_distinct_cats = 2 THEN
    v_entry := _ach_unlock(v_uid, 'new_horizons', NULL);
    IF v_entry IS NOT NULL THEN v_unlocked := v_unlocked || jsonb_build_array(v_entry); END IF;
  END IF;

  -- change_of_pace: tried a 3rd distinct category
  IF v_distinct_cats = 3 THEN
    v_entry := _ach_unlock(v_uid, 'change_of_pace', NULL);
    IF v_entry IS NOT NULL THEN v_unlocked := v_unlocked || jsonb_build_array(v_entry); END IF;
  END IF;

  -- tune_in: completed a quiz from a 2nd distinct channel
  IF v_distinct_chs = 2 THEN
    v_entry := _ach_unlock(v_uid, 'tune_in', NULL);
    IF v_entry IS NOT NULL THEN v_unlocked := v_unlocked || jsonb_build_array(v_entry); END IF;
  END IF;

  -- level_up: tried a 2nd distinct difficulty level
  IF v_distinct_levels = 2 THEN
    v_entry := _ach_unlock(v_uid, 'level_up', NULL);
    IF v_entry IS NOT NULL THEN v_unlocked := v_unlocked || jsonb_build_array(v_entry); END IF;
  END IF;

  -- brave_new_world / word_by_word / number_cruncher: first attempt in specific category
  IF v_cat IS NOT NULL AND v_cat_first_count = 1 THEN
    CASE v_cat
      WHEN 'Reading'    THEN
        v_entry := _ach_unlock(v_uid, 'brave_new_world', NULL);
        IF v_entry IS NOT NULL THEN v_unlocked := v_unlocked || jsonb_build_array(v_entry); END IF;
      WHEN 'Vocabulary' THEN
        v_entry := _ach_unlock(v_uid, 'word_by_word', NULL);
        IF v_entry IS NOT NULL THEN v_unlocked := v_unlocked || jsonb_build_array(v_entry); END IF;
      WHEN 'Math'       THEN
        v_entry := _ach_unlock(v_uid, 'number_cruncher', NULL);
        IF v_entry IS NOT NULL THEN v_unlocked := v_unlocked || jsonb_build_array(v_entry); END IF;
      ELSE NULL;
    END CASE;
  END IF;

  -- ── Time-based achievements ─────────────────────────────────

  -- early_bird: 5:00 – 8:59
  IF v_hour BETWEEN 5 AND 8 THEN
    v_entry := _ach_unlock(v_uid, 'early_bird', NULL);
    IF v_entry IS NOT NULL THEN v_unlocked := v_unlocked || jsonb_build_array(v_entry); END IF;
  END IF;

  -- rise_and_shine: 6:00 – 6:59
  IF v_hour = 6 THEN
    v_entry := _ach_unlock(v_uid, 'rise_and_shine', NULL);
    IF v_entry IS NOT NULL THEN v_unlocked := v_unlocked || jsonb_build_array(v_entry); END IF;
  END IF;

  -- night_owl: 22:00 – 3:59
  IF v_hour >= 22 OR v_hour <= 3 THEN
    v_entry := _ach_unlock(v_uid, 'night_owl', NULL);
    IF v_entry IS NOT NULL THEN v_unlocked := v_unlocked || jsonb_build_array(v_entry); END IF;
  END IF;

  -- burning_the_midnight_oil: 0:00 – 2:59
  IF v_hour <= 2 THEN
    v_entry := _ach_unlock(v_uid, 'burning_the_midnight_oil', NULL);
    IF v_entry IS NOT NULL THEN v_unlocked := v_unlocked || jsonb_build_array(v_entry); END IF;
  END IF;

  -- after_hours: before 9:00 or after 18:00
  IF v_hour < 9 OR v_hour >= 18 THEN
    v_entry := _ach_unlock(v_uid, 'after_hours', NULL);
    IF v_entry IS NOT NULL THEN v_unlocked := v_unlocked || jsonb_build_array(v_entry); END IF;
  END IF;

  -- ── Date-event achievements ──────────────────────────────────

  IF v_month = 12 AND v_day = 25 THEN
    v_entry := _ach_unlock(v_uid, 'merry_christmas', NULL);
    IF v_entry IS NOT NULL THEN v_unlocked := v_unlocked || jsonb_build_array(v_entry); END IF;
  END IF;

  IF v_month = 1 AND v_day = 1 THEN
    v_entry := _ach_unlock(v_uid, 'happy_new_year', NULL);
    IF v_entry IS NOT NULL THEN v_unlocked := v_unlocked || jsonb_build_array(v_entry); END IF;
  END IF;

  IF v_month = 4 AND v_day = 1 THEN
    v_entry := _ach_unlock(v_uid, 'april_fool', NULL);
    IF v_entry IS NOT NULL THEN v_unlocked := v_unlocked || jsonb_build_array(v_entry); END IF;
  END IF;

  IF v_month = 7 AND v_day = 7 THEN
    v_entry := _ach_unlock(v_uid, 'lucky_seven', NULL);
    IF v_entry IS NOT NULL THEN v_unlocked := v_unlocked || jsonb_build_array(v_entry); END IF;
  END IF;

  IF v_month = 2 AND v_day = 29 THEN
    v_entry := _ach_unlock(v_uid, 'leap_of_faith', NULL);
    IF v_entry IS NOT NULL THEN v_unlocked := v_unlocked || jsonb_build_array(v_entry); END IF;
  END IF;

  -- ── Category-count achievements (per-category) ───────────────

  IF v_cat IS NOT NULL AND v_cat_questions > 0 THEN
    FOR v_i IN 1..array_length(v_cat_codes, 1) LOOP
      IF v_cat_questions >= v_cat_mins[v_i] THEN
        v_entry := _ach_unlock(v_uid, v_cat_codes[v_i], v_cat);
        IF v_entry IS NOT NULL THEN v_unlocked := v_unlocked || jsonb_build_array(v_entry); END IF;
      END IF;
    END LOOP;
  END IF;

  -- Refresh balance view is not needed: coin_ledger is the live source.
  RETURN v_unlocked;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_and_unlock_achievements(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public._ach_unlock(uuid, text, text) TO authenticated;
-- Note: _ach_unlock is called only from check_and_unlock_achievements (SECURITY DEFINER),
-- but granting to authenticated keeps Supabase schema-introspection happy.
