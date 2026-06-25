-- ============================================================
-- Migration: article quiz coin rewards
-- Apply via: Supabase Dashboard > SQL Editor > Run
-- ============================================================

-- ============================================================
-- 1. Ledger table (append-only, one row per quiz completion)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.coin_ledger (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  slug text NOT NULL,
  is_first_completion boolean NOT NULL,
  correct_count int NOT NULL,
  total_questions int NOT NULL,
  base_amount int NOT NULL,
  bonus_amount int NOT NULL DEFAULT 0,
  amount int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coin_ledger_user_id
  ON public.coin_ledger (user_id);

CREATE INDEX IF NOT EXISTS idx_coin_ledger_user_slug
  ON public.coin_ledger (user_id, slug);

ALTER TABLE public.coin_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coin_ledger_select_own ON public.coin_ledger;
CREATE POLICY coin_ledger_select_own
  ON public.coin_ledger FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- No INSERT/UPDATE/DELETE policy for any client role.
-- All writes happen exclusively through award_quiz_coins() below,
-- a SECURITY DEFINER function that derives user_id from auth.uid()
-- server-side (never trusts a client-supplied user_id).

-- ============================================================
-- 2. Balance view
-- ============================================================

CREATE OR REPLACE VIEW public.v_coin_balance AS
SELECT
  user_id,
  COALESCE(SUM(amount), 0)::int AS balance
FROM public.coin_ledger
GROUP BY user_id;

-- ============================================================
-- 3. award_quiz_coins(): grants coins for a completed article
--    quiz. First completion of a given slug by a given user is
--    full reward (+10/correct, +30 perfect bonus). Every repeat
--    completion of the same slug is reduced (+2/correct, no
--    bonus) to discourage farming via re-attempts.
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
    'balance', COALESCE(v_balance, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_quiz_coins(text, int, int) TO authenticated;
-- Deliberately NOT granted to anon — requires login.
