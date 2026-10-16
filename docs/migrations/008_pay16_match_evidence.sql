-- PAY-16: persist safe matching evidence and prevent multiple assignments.
-- Apply manually; this migration is deliberately rerunnable and is never executed by tests.
ALTER TABLE public.expected_payments
  ADD COLUMN IF NOT EXISTS match_score integer NULL;
ALTER TABLE public.expected_payments
  ADD COLUMN IF NOT EXISTS match_candidates jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_expected_payment_id_unique
  ON public.transactions (expected_payment_id)
  WHERE expected_payment_id IS NOT NULL;

DROP POLICY IF EXISTS pay16_charge_manual_resolution ON public.expected_payments;
CREATE POLICY pay16_charge_manual_resolution ON public.expected_payments
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND (u.role = 'admin' OR (u.business_id = expected_payments.business_id AND u.role IN ('owner', 'employee')))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND (u.role = 'admin' OR (u.business_id = expected_payments.business_id AND u.role IN ('owner', 'employee')))
  ));
