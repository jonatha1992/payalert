import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/session', () => ({ getServiceClient: () => ({ from: () => ({ update: (patch: unknown) => ({ eq: (_key: string, value: string) => ({ eq: (_key2: string, from: string) => ({ select: () => ({ maybeSingle: async () => mock.query(patch, value, from) }) }) }) }) }) }) }));
import { transitionCharge } from '@/lib/server/hubCharges';
describe('hub charge transitions', () => {
  beforeEach(() => { vi.clearAllMocks(); mock.query.mockResolvedValue({ data: { id: 'c1', status: 'approved' }, error: null }); });
  it('allows only explicit transitions and filters update by the expected current state', async () => {
    await transitionCharge('c1', 'pending', 'approved', { payment_id: 'mp1' });
    expect(mock.query).toHaveBeenCalledWith(expect.objectContaining({ status: 'approved', payment_id: 'mp1' }), 'c1', 'pending');
    await expect(transitionCharge('c1', 'expired', 'approved')).rejects.toThrow('Invalid hub charge transition');
    await expect(transitionCharge('c1', 'rejected', 'approved')).rejects.toThrow('Invalid hub charge transition');
  });
});
