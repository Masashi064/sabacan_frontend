-- ============================================================
-- award_quiz_coins(): also return base_amount/correct_count/total_questions
-- so the client can render a coin breakdown (base vs. perfect bonus)
-- on the quiz results screen instead of a transient toast.
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
  ELSE
    v_base := v_correct * 2;
    v_bonus := 0;
  END IF;

  v_amount := v_base + v_bonus;

  INSERT INTO public.coin_ledger (
    user_id, slug, is_first_completion, correct_count, total_questions,
    base_amount, bonus_amount, amount
  ) VALUES (
    v_user_id, p_slug, v_is_first, v_correct, v_total, v_base, v_bonus, v_amount
  );

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
