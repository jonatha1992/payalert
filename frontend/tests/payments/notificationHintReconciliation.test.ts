import { describe, expect, it, vi } from 'vitest';
import { deterministicHintId, findHintReconciliation, reconcileDeviceNotificationHint } from '@/lib/payments/notificationHintReconciliation';

const hint = (id: string, at: string, amount = 100, status = 'PENDING') => ({ id, occurredAt: at, amount, status });
const payment = (at: string, options: { amount?: number; status?: string; paymentTypeId?: string | null } = {}) => ({ id: 'mp', occurredAt: at, amount: options.amount ?? 100, status: options.status ?? 'CONFIRMED', paymentTypeId: options.paymentTypeId ?? 'bank_transfer' });

describe('device notification reconciliation', () => {
  it('derives stable tenant-scoped ids without exposing notification keys', () => {
    expect(deterministicHintId('biz', 'key')).toBe(deterministicHintId('biz', 'key'));
    expect(deterministicHintId('biz', 'key')).not.toBe(deterministicHintId('other', 'key'));
    expect(deterministicHintId('biz', 'key')).not.toContain('key');
  });
  it('matches one pending hint by exact amount within the inclusive ten-minute window', () => {
    expect(findHintReconciliation([hint('h', '2026-10-18T10:00:00Z')], payment('2026-10-18T10:10:00Z'))?.id).toBe('h');
  });
  it('rejects amount/time mismatch, non-confirmed/non-bank-transfer, and ambiguous hints', () => {
    const at = '2026-10-18T10:00:00Z';
    expect(findHintReconciliation([hint('h', at)], payment('2026-10-18T10:10:00.001Z'))).toBeNull();
    expect(findHintReconciliation([hint('h', at)], payment(at, { amount: 101 }))).toBeNull();
    expect(findHintReconciliation([hint('h', at)], payment(at, { status: 'PENDING' }))).toBeNull();
    expect(findHintReconciliation([hint('h', at)], payment(at, { paymentTypeId: 'credit_card' }))).toBeNull();
    expect(findHintReconciliation([hint('h', at), hint('h2', at)], payment(at))).toBeNull();
  });
  it('replaces a matched hint with the confirmed payment instead of adding a second transaction', async () => {
    let reads = 0;
    const builder: Record<string, any> = {};
    for (const method of ['eq', 'gte', 'lte']) builder[method] = vi.fn(() => builder);
    builder.select = vi.fn((columns: string) => {
      reads += 1;
      const result = columns === 'id, amount, occurred_at, provider_status'
        ? { data: [{ id: 'hint_a', amount: 100, occurred_at: '2026-10-18T10:00:00Z', provider_status: 'PENDING' }], error: null }
        : { data: [{ id: 'hint_a' }], error: null };
      Object.defineProperty(builder, 'then', { configurable: true, value: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve) });
      return builder;
    });
    builder.update = vi.fn(() => builder);
    const db = { from: vi.fn(() => builder) } as never;
    await reconcileDeviceNotificationHint(db, 'biz', { provider: 'mercado_pago', externalId: 'mp', providerAccountId: null,
      direction: 'IN', amount: 100, currency: 'ARS', status: 'CONFIRMED', occurredAt: '2026-10-18T10:02:00Z',
      payerName: null, payerIdentifier: null, description: null, externalReference: null, raw: { payment_type_id: 'bank_transfer' } });
    expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({ provider_status: 'CONFIRMED', status: 'completed', external_id: 'mp' }));
    expect(builder.eq).toHaveBeenCalledWith('id', 'hint_a');
  });
});
