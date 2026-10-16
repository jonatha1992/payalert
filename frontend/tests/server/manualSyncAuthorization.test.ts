import { describe, expect, it } from 'vitest';
import { can, requirePermission } from '@/lib/server/rbac';
import { ScopeError, resolveScope } from '@/lib/server/scope';
import { syncConnectionPayments } from '@/lib/payments/manualSync';
import type { PaymentConnection } from '@/lib/payments/types';

const connection: PaymentConnection = { id: 'own', businessId: 'biz-session', storeId: null, provider: 'mercado_pago',
  providerAccountId: 'account', status: 'CONNECTED', credentials: {}, webhookSecret: null };

describe('manual sync permissions and tenant scope', () => {
  it('allows sync only to owner and manager, not cashier', () => {
    expect(can('owner', 'connection', 'update')).toBe(true);
    expect(can('admin', 'connection', 'update')).toBe(true);
    expect(can('employee', 'connection', 'update')).toBe(false);
    expect(() => requirePermission({ role: 'employee' }, 'connection', 'update')).toThrow(ScopeError);
  });

  it('keeps business ownership tied to session rather than a requested business id', () => {
    const scope = resolveScope({ userId: 'u1', role: 'owner', businessId: 'biz-session', assignedStoreId: null }, {});
    expect(scope.businessId).toBe(connection.businessId);
    expect(() => resolveScope({ userId: 'u1', role: 'owner', businessId: 'biz-session', assignedStoreId: null },
      { businessId: 'biz-attacker' })).toThrow(ScopeError);
  });

  it('never sends a connection from a different business to the provider', async () => {
    const listTransactions = async (selected: PaymentConnection) => {
      if (selected.businessId !== scopeBusiness) throw new Error('wrong business');
      return [];
    };
    const scopeBusiness = 'biz-session';
    const deps = { listTransactions, ingest: async () => 'duplicate' as const, recordFreshness: async () => undefined,
      audit: async () => undefined, log: () => undefined };
    await expect(syncConnectionPayments(connection, deps)).resolves.toMatchObject({ checked: 0 });
    await expect(syncConnectionPayments({ ...connection, businessId: 'biz-other' }, deps)).rejects.toThrow('provider_sync_failed');
  });
});
