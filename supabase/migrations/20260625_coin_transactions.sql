-- ============================================================
-- Migration: coin transaction history (for the Coin Wallet modal)
-- Apply via: Supabase Dashboard > SQL Editor > Run
-- ============================================================

-- ============================================================
-- 1. coin_transactions: a generic, line-item ledger of coin
--    earning events, for display purposes (Recent Activity,
--    Today's Earnings). This is separate from coin_ledger (which
--    remains the source of truth for the current balance via
--    v_coin_balance, and for the per-slug "first completion"
--    anti-farming check) — coin_ledger records ONE row per quiz
--    completion with a combined amount, while coin_transactions
--    records each earning as its own line (e.g. five "+10 quiz_correct"
--    rows plus one "+30 perfect_bonus" row for a perfect first
--    attempt), which is what a human-readable activity feed needs.
--    Generic enough to also support future non-quiz reasons
--    (daily_bonus, manual_adjustment, ...) that don't fit
--    coin_ledger's quiz-specific columns.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.coin_transactions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  amount int NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coin_transactions_user_created
  ON public.coin_transactions (user_id, created_at DESC);

ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coin_transactions_select_own ON public.coin_transactions;
CREATE POLICY coin_transactions_select_own
  ON public.coin_transactions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- No INSERT/UPDATE/DELETE policy for any client role — written only
-- through award_quiz_coins() (SECURITY DEFINER), same security model
-- as coin_ledger.

-- ============================================================
-- 2. award_quiz_coins(): re-declared (same signature, same balance/
--    anti-farming logic) to additionally write granular
--    coin_transactions rows for the same award.
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
    'balance', COALESCE(v_balance, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_quiz_coins(text, int, int) TO authenticated;
-- Deliberately NOT granted to anon — requires login.
