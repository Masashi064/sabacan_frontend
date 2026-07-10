-- ============================================================
-- Fix: 20260711_coin_rewards_breakdown.sql re-declared award_quiz_coins()
-- starting from the 20260625_coin_rewards.sql body, which predates
-- 20260625_coin_transactions.sql's addition of granular coin_transactions
-- inserts (one row per correct answer + one for the perfect bonus). That
-- regressed the account page's "Recent Activity" feed: quiz completions
-- stopped writing rows there, so the only rows left were achievement
-- unlocks (reason = 'achievement'), making the feed look achievement-only.
--
-- This re-declares the function once more, keeping both the
-- coin_transactions inserts and the base_amount/correct_count/
-- total_questions fields added for the results-screen breakdown.
-- ============================================================

CREATE OR REPLACE FUNCTION public.award_quiz_coins(
  p_slug text,
  p_correct_count int,
  p_total_questions int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_first boolean;
  v_correct int;
  v_total int;
  v_base int;
  v_bonus int;
  v_amount int;
  v_balance int;
  v_per_correct int;
  v_correct_reason text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_slug IS NULL OR btrim(p_slug) = '' THEN
    RAISE EXCEPTION 'slug is required';
  END IF;

  -- Defensive clamping only (client-submitted counts are not
  -- otherwise server-validated in this app today; mirrors the
  -- existing trust level of quiz_attempts.correct_count).
  v_total := GREATEST(p_total_questions, 1);
  v_correct := LEAST(GREATEST(p_correct_count, 0), v_total);

  -- Serialize concurrent calls for the same (user, slug) so two
  -- tabs completing the same quiz at once can't both win "first".
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || p_slug, 0));

  SELECT NOT EXISTS (
    SELECT 1 FROM public.coin_ledger
    WHERE user_id = v_user_id AND slug = p_slug
  ) INTO v_is_first;

  IF v_is_first THEN
    v_base := v_correct * 10;
    v_bonus := CASE WHEN v_correct = v_total THEN 30 ELSE 0 END;
    v_per_correct := 10;
    v_correct_reason := 'quiz_correct';
  ELSE
    v_base := v_correct * 2;
    v_bonus := 0;
    v_per_correct := 2;
    v_correct_reason := 'quiz_correct_repeat';
  END IF;

  v_amount := v_base + v_bonus;

  INSERT INTO public.coin_ledger (
    user_id, slug, is_first_completion, correct_count, total_questions,
    base_amount, bonus_amount, amount
  ) VALUES (
    v_user_id, p_slug, v_is_first, v_correct, v_total, v_base, v_bonus, v_amount
  );

  -- Granular line items for the activity feed: one row per correct
  -- answer, plus a separate row for the perfect-score bonus.
  IF v_correct > 0 THEN
    INSERT INTO public.coin_transactions (user_id, amount, reason)
    SELECT v_user_id, v_per_correct, v_correct_reason
    FROM generate_series(1, v_correct);
  END IF;

  IF v_bonus > 0 THEN
    INSERT INTO public.coin_transactions (user_id, amount, reason)
    VALUES (v_user_id, v_bonus, 'perfect_bonus');
  END IF;

  SELECT balance INTO v_balance FROM public.v_coin_balance WHERE user_id = v_user_id;

  RETURN jsonb_build_object(
    'awarded', v_amount,
    'is_first_completion', v_is_first,
    'bonus_amount', v_bonus,
    'base_amount', v_base,
    'correct_count', v_correct,
    'total_questions', v_total,
    'balance', COALESCE(v_balance, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_quiz_coins(text, int, int) TO authenticated;
-- Deliberately NOT granted to anon — requires login.
