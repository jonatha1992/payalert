import { describe, expect, it, vi } from 'vitest';
import { recordAuditEvent } from '@/lib/server/audit';

describe('manual resolution audit payload', () => {
  it('records outcome details through the shared audit writer', async () => {
    const insert = vi.fn(() => Promise.resolve({ error: null }));
    const db = { from: vi.fn(() => ({ insert })) } as never;
    await recordAuditEvent(db, { businessId: 'biz1', actorId: 'user1', action: 'MANUAL_RESOLUTION',
      entityType: 'expected_payment', entityId: 'ep1',
      newData: { transaction_id: 'tx1', resolution: 'matched', amount: 1250, currency: 'ARS', reference: null } });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      business_id: 'biz1', user_id: 'user1', action: 'MANUAL_RESOLUTION', entity_id: 'ep1',
      new_data: { transaction_id: 'tx1', resolution: 'matched', amount: 1250, currency: 'ARS', reference: null },
    }));
  });
});
