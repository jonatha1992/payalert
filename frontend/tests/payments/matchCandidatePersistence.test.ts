import { describe, expect, it } from 'vitest';
import { SupabasePaymentsRepository } from '@/lib/server/paymentsRepository';

describe('suggested match persistence', () => {
  it('stores ranked evidence and leaves the expected payment open for manual resolution', async () => {
    const updates: Record<string, unknown>[] = [];
    const db = { from: (table: string) => {
      if (table === 'transactions') return {
        select: () => ({ eq: () => ({ single: async () => ({ data: { id: 'tx1', business_id: 'biz1' }, error: null }) }) }),
        update: (value: Record<string, unknown>) => { updates.push(value); return { eq: () => Promise.resolve({ error: null }) }; },
      };
      return { update: (value: Record<string, unknown>) => { updates.push(value); return {
        eq: () => ({ eq: () => ({ eq: () => ({ select: async () => ({ data: [{ id: 'ep1' }], error: null }) }) }) }),
      }; } };
    } };
    const repository = new SupabasePaymentsRepository(db as never);
    await repository.markExpectedPayment('ep1', 'MANUAL_REVIEW', 'tx1', {
      decision: 'SUGGESTED', score: 80, amount: 1250, currency: 'ARS', reference: 'pedido A',
      createdAt: '2026-02-01T10:00:00.000Z', expiresAt: '2026-02-01T10:15:00.000Z', provider: 'uala',
    });
    expect(updates).toContainEqual({
      status: 'MANUAL_REVIEW', match_score: 80,
      match_candidates: [{ transaction_id: 'tx1', score: 80, decision: 'SUGGESTED', amount: 1250,
        currency: 'ARS', reference: 'pedido A', created_at: '2026-02-01T10:00:00.000Z',
        expires_at: '2026-02-01T10:15:00.000Z', provider: 'uala' }],
    });
  });
});
