import { describe, expect, it } from 'vitest';
import { requireRole, resolveScope, ScopeError, type SessionProfile } from '@/lib/server/scope';

const owner: SessionProfile = { userId: 'u1', role: 'owner', businessId: 'bizA', assignedStoreId: null };
const employee: SessionProfile = { userId: 'u2', role: 'employee', businessId: 'bizA', assignedStoreId: 'storeA1' };
const admin: SessionProfile = { userId: 'u0', role: 'admin', businessId: null, assignedStoreId: null };

function expectScopeError(fn: () => unknown, status: number) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(ScopeError);
    expect((error as ScopeError).status).toBe(status);
    return;
  }
  throw new Error('expected ScopeError');
}

describe('resolveScope', () => {
  it('rejects anonymous callers', () => {
    expectScopeError(() => resolveScope(null, { businessId: 'bizA' }), 401);
  });

  it('pins owners to their own business even when the client omits it', () => {
    expect(resolveScope(owner, {})).toEqual({ userId: 'u1', businessId: 'bizA', storeId: null });
  });

  it('blocks an owner asking for another business (IDOR)', () => {
    expectScopeError(() => resolveScope(owner, { businessId: 'bizB' }), 403);
  });

  it('forces employees onto their assigned store', () => {
    expect(resolveScope(employee, { businessId: 'bizA' })).toEqual({ userId: 'u2', businessId: 'bizA', storeId: 'storeA1' });
  });

  it('blocks employees from other stores', () => {
    expectScopeError(() => resolveScope(employee, { storeId: 'storeA2' }), 403);
  });

  it('blocks employees without an assigned store', () => {
    expectScopeError(() => resolveScope({ ...employee, assignedStoreId: null }, {}), 403);
  });

  it('lets admins pick a business but requires one', () => {
    expect(resolveScope(admin, { businessId: 'bizB', storeId: 's' })).toEqual({ userId: 'u0', businessId: 'bizB', storeId: 's' });
    expectScopeError(() => resolveScope(admin, {}), 400);
  });
});

describe('requireRole', () => {
  it('allows listed roles and rejects others', () => {
    expect(requireRole(owner, ['owner', 'admin'])).toBe(owner);
    expectScopeError(() => requireRole(employee, ['owner']), 403);
    expectScopeError(() => requireRole(null, ['owner']), 401);
  });
});
