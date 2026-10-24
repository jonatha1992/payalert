import { describe, expect, it } from 'vitest';
import { connectReturnUrlForAdmin } from '../../lib/server/connectInvites';
describe('admin invite return URL', () => {
  it('accepts the dashboard return path on PayAlert host', () => { expect(connectReturnUrlForAdmin('https://payalert.test')).toBe('https://payalert.test/dashboard/apps'); });
  it('rejects an external protocol origin', () => { expect(() => connectReturnUrlForAdmin('javascript:alert(1)')).toThrow(); });
});
