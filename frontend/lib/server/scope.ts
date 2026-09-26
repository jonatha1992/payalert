/**
 * Tenant scoping for server routes. Pure: callers pass the authenticated profile
 * (loaded server-side from the session) and whatever the client asked for.
 * The client's businessId/storeId are hints, never authority.
 */

export type Role = 'admin' | 'owner' | 'employee';

export interface SessionProfile {
  userId: string;
  role: Role;
  businessId: string | null;
  assignedStoreId: string | null;
}

export interface RequestedScope {
  businessId?: string | null;
  storeId?: string | null;
}

export interface ResolvedScope {
  businessId: string;
  storeId: string | null;
}

export class ScopeError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403 | 400,
  ) {
    super(message);
    this.name = 'ScopeError';
  }
}

/**
 * - admin: may read any business, must say which one.
 * - owner: always their own business; any store inside it (store ownership is
 *   checked by the caller with `storeBelongsTo`).
 * - employee: their own business and ONLY their assigned store.
 */
export function resolveScope(profile: SessionProfile | null, requested: RequestedScope): ResolvedScope {
  if (!profile) throw new ScopeError('No autenticado', 401);

  const requestedBusiness = requested.businessId || null;
  const requestedStore = requested.storeId || null;

  if (profile.role === 'admin') {
    const businessId = requestedBusiness ?? profile.businessId;
    if (!businessId) throw new ScopeError('businessId es requerido', 400);
    return { businessId, storeId: requestedStore };
  }

  if (!profile.businessId) throw new ScopeError('Usuario sin negocio asignado', 403);
  if (requestedBusiness && requestedBusiness !== profile.businessId) {
    throw new ScopeError('Acceso denegado a este negocio', 403);
  }

  if (profile.role === 'owner') {
    return { businessId: profile.businessId, storeId: requestedStore };
  }

  if (!profile.assignedStoreId) throw new ScopeError('Empleado sin tienda asignada', 403);
  if (requestedStore && requestedStore !== profile.assignedStoreId) {
    throw new ScopeError('Acceso denegado a esta tienda', 403);
  }
  return { businessId: profile.businessId, storeId: profile.assignedStoreId };
}

export function requireRole(profile: SessionProfile | null, roles: Role[]): SessionProfile {
  if (!profile) throw new ScopeError('No autenticado', 401);
  if (!roles.includes(profile.role)) throw new ScopeError('Permiso insuficiente', 403);
  return profile;
}
