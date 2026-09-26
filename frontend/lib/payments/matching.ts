import type { ExpectedPayment, MatchDecision, NormalizedTransaction } from './types';

export interface MatchOptions {
  earlyToleranceMs?: number;
}

export interface MatchCandidate {
  id: string;
  score: number;
  amount: number;
  currency: string;
  reference: string | null;
  createdAt: string;
  expiresAt: string;
  provider: string | null;
}

export interface MatchResult {
  decision: MatchDecision;
  expectedPaymentId?: string;
  candidates: MatchCandidate[];
}

export function scoreCandidate(
  tx: NormalizedTransaction, expected: ExpectedPayment, opts: MatchOptions = {},
): number {
  if (expected.status !== 'WAITING') return 0;
  let score = 0;
  if (Math.abs(tx.amount - expected.amount) < 0.005) score += 60;
  if (tx.currency === expected.currency) score += 10;
  const occurredAt = Date.parse(tx.occurredAt);
  if (occurredAt >= Date.parse(expected.createdAt) - (opts.earlyToleranceMs ?? 120_000)
    && occurredAt <= Date.parse(expected.expiresAt)) score += 20;
  if (tx.externalReference === expected.id) score += 10;
  if (expected.provider === tx.provider) score += 20;
  return score;
}

export function matchTransaction(
  tx: NormalizedTransaction, candidates: readonly ExpectedPayment[], opts: MatchOptions = {},
): MatchResult {
  const waiting = candidates.filter((candidate) => candidate.status === 'WAITING');
  const scores = waiting.map((candidate) => ({
    id: candidate.id,
    score: scoreCandidate(tx, candidate, opts),
    amount: candidate.amount,
    currency: candidate.currency,
    reference: candidate.reference,
    createdAt: candidate.createdAt,
    expiresAt: candidate.expiresAt,
    provider: candidate.provider,
  }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const reference = waiting.find((candidate) => candidate.id === tx.externalReference);
  if (reference) return { decision: 'AUTO', expectedPaymentId: reference.id, candidates: scores };
  const eligible = scores.filter((candidate) => candidate.score >= 70);
  if (eligible.length > 1) return { decision: 'MANUAL_REVIEW', candidates: scores };
  if (!eligible.length) return { decision: 'NO_MATCH', candidates: scores };
  return { decision: eligible[0].score >= 90 ? 'AUTO' : 'SUGGESTED',
    expectedPaymentId: eligible[0].id, candidates: scores };
}
