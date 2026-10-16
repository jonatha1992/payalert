import { ScopeError, type Role } from '@/lib/server/scope';

export function requireKnownRole(value: unknown): Role {
  if (value === 'admin' || value === 'owner' || value === 'employee') return value;
  throw new ScopeError('Rol de usuario inválido', 403);
}

export type ProductRole = 'owner' | 'manager' | 'cashier' | 'support';
export type Action = 'read' | 'create' | 'update' | 'delete' | 'resolve' | 'manage';
export type Resource = 'connection' | 'branch' | 'report' | 'movement' | 'charge' | 'support' | 'user' | 'configuration' | 'session' | 'push' | 'webhook';

const roleMap: Record<Role, ProductRole> = { owner: 'owner', admin: 'manager', employee: 'cashier' };
const permissions: Record<ProductRole, Partial<Record<Resource, readonly Action[]>>> = {
  owner: { connection: ['read', 'create', 'delete', 'update'], branch: ['read', 'create', 'update', 'delete'], report: ['read'], movement: ['read', 'create', 'update'], charge: ['read', 'create', 'update', 'resolve'], support: ['read', 'resolve'], user: ['read', 'create', 'update', 'delete', 'manage'], configuration: ['read', 'update', 'manage'], session: ['read'], push: ['create', 'delete'], webhook: ['create'] },
  manager: { connection: ['read', 'create', 'delete', 'update'], branch: ['read', 'create', 'update', 'delete'], report: ['read'], movement: ['read', 'create', 'update'], charge: ['read', 'create', 'update', 'resolve'], support: ['read', 'resolve'], user: ['read', 'create', 'update', 'delete', 'manage'], configuration: ['read', 'update', 'manage'], session: ['read'], push: ['create', 'delete'], webhook: ['create'] },
  cashier: { movement: ['read', 'create'], charge: ['read', 'create'], session: ['read'], push: ['create', 'delete'], webhook: ['create'] },
  support: { report: ['read'], movement: ['read'], charge: ['read', 'resolve'], support: ['read', 'resolve'], session: ['read'] },
};

export function normalizeRole(role: Role): ProductRole { return roleMap[role]; }
export function can(role: Role, resource: Resource, action: Action): boolean {
  return permissions[normalizeRole(role)][resource]?.includes(action) ?? false;
}
export function requirePermission<T extends { role: Role }>(profile: T | null, resource: Resource, action: Action): T {
  if (!profile) throw new ScopeError('No autenticado', 401);
  if (!can(profile.role, resource, action)) throw new ScopeError('Permiso insuficiente', 403);
  return profile;
}
