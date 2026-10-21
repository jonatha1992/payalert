'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Loader2, RefreshCw, Shield, User, X } from 'lucide-react';

type UserRow = {
  id: string; email: string | null; first_name: string | null; last_name: string | null;
  role: 'admin' | 'owner' | 'employee'; business_id: string | null; assigned_store_id: string | null;
  businesses: { name: string } | null; stores: { name: string } | null;
};
type Store = { id: string; name: string; business_id: string };
type Business = { id: string; name: string };

const ROLE_LABEL: Record<string, string> = { admin: 'Administrador del sistema', owner: 'Dueño', employee: 'Empleado' };
const ROLE_STYLE: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
  owner: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  employee: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
};
const fullName = (u: UserRow) => [u.first_name, u.last_name].filter(Boolean).join(' ') || 'Sin nombre';

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showRoles, setShowRoles] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [systemRole, setSystemRole] = useState<'admin' | 'user'>('user');
  const [businessRole, setBusinessRole] = useState<'owner' | 'employee'>('employee');
  const [businessId, setBusinessId] = useState('');
  const [storeId, setStoreId] = useState('');
  const [confirmAdmin, setConfirmAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [u, o] = await Promise.all([fetch('/api/admin/users'), fetch('/api/admin/users/options')]);
      const [ud, od] = await Promise.all([u.json(), o.json()]);
      if (!u.ok) throw new Error(ud.error || 'No pudimos cargar los usuarios.');
      if (!o.ok) throw new Error(od.error || 'No pudimos cargar los negocios.');
      setUsers(ud.users ?? []); setStores(od.stores ?? []); setBusinesses(od.businesses ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos cargar los usuarios.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(u => (roleFilter === 'all' || u.role === roleFilter) && (!q || `${u.email ?? ''} ${fullName(u)}`.toLowerCase().includes(q)));
  }, [users, search, roleFilter]);

  const storesOfBusiness = stores.filter(s => s.business_id === businessId);

  function open(user: UserRow) {
    setEditing(user); setFormError(null); setTouched(false); setConfirmAdmin(false);
    setSystemRole(user.role === 'admin' ? 'admin' : 'user');
    setBusinessRole(user.role === 'owner' ? 'owner' : 'employee');
    setBusinessId(user.business_id ?? ''); setStoreId(user.assigned_store_id ?? '');
  }

  const errors: Record<string, string> = {};
  if (systemRole === 'admin' && !confirmAdmin) errors.confirm = 'Confirmá que querés dar acceso total al sistema.';
  if (systemRole === 'user') {
    if (!businessId) errors.business = 'Elegí un negocio.';
    if (businessRole === 'employee' && !storeId) errors.store = 'El empleado necesita una sucursal.';
  }
  const valid = Object.keys(errors).length === 0;

  async function save(event: { preventDefault(): void }) {
    event.preventDefault(); setTouched(true);
    if (!valid || !editing || saving) return;
    setSaving(true); setFormError(null);
    try {
      const body = systemRole === 'admin'
        ? { systemRole, confirmAdmin: true }
        : { systemRole, businessRole, business_id: businessId, ...(businessRole === 'employee' ? { assigned_store_id: storeId } : {}) };
      const response = await fetch(`/api/admin/users/${editing.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No pudimos guardar el cambio.');
      setEditing(null); await load();
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'No pudimos guardar el cambio.');
    } finally { setSaving(false); }
  }

  const input = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white';

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Usuarios globales</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Asigná el rol en PayAlert y el rol dentro del negocio.</p>
        </div>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:text-gray-200">
          <RefreshCw className="h-4 w-4" /> Actualizar
        </button>
      </header>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700">
        <button type="button" onClick={() => setShowRoles(v => !v)} aria-expanded={showRoles} className="flex w-full items-center justify-between p-4 text-left font-medium text-gray-900 dark:text-white">
          Roles disponibles <ChevronDown className={`h-4 w-4 transition-transform ${showRoles ? 'rotate-180' : ''}`} />
        </button>
        {showRoles && (
          <div className="space-y-3 border-t border-gray-200 p-4 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300">
            <p><strong>Administrador del sistema:</strong> rol de PayAlert. Entra al panel /admin, ve y administra negocios, usuarios y apps vinculadas. No pertenece a un negocio.</p>
            <p><strong>Dueño:</strong> rol de negocio. Administra su negocio: sucursales, empleados, integraciones, movimientos y configuración.</p>
            <p><strong>Empleado:</strong> rol de negocio. Está asignado a una sucursal y trabaja solo con los datos de esa sucursal.</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Roles que se podrían agregar (NO implementados): Encargado de sucursal, Contador de solo lectura.</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Limitación actual: el rol vive en una sola columna, así que un administrador del sistema no puede ser a la vez dueño o empleado.</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <input aria-label="Buscar usuario" placeholder="Buscar por email o nombre" value={search} onChange={e => setSearch(e.target.value)} className={`${input} sm:max-w-xs`} />
        <select aria-label="Filtrar por rol" value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className={`${input} sm:max-w-[14rem]`}>
          <option value="all">Todos los roles</option>
          <option value="admin">Administrador del sistema</option>
          <option value="owner">Dueño</option>
          <option value="employee">Empleado</option>
        </select>
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div>}

      {loading ? (
        <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">No hay usuarios para mostrar.</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
          {filtered.map(u => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 items-center gap-3">
                {u.role === 'admin' ? <Shield className="h-5 w-5 shrink-0 text-purple-500" /> : <User className="h-5 w-5 shrink-0 text-gray-400" />}
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900 dark:text-white">{fullName(u)}</p>
                  <p className="truncate text-sm text-gray-500 dark:text-gray-400">{u.email ?? 'Sin email'}{u.businesses?.name ? ` · ${u.businesses.name}` : ''}{u.stores?.name ? ` · ${u.stores.name}` : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_STYLE[u.role]}`}>{ROLE_LABEL[u.role]}</span>
                <button type="button" onClick={() => open(u)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">Cambiar rol</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <div role="dialog" aria-modal="true" aria-label="Cambiar rol" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={save} noValidate className="max-h-[90vh] w-full max-w-lg space-y-5 overflow-y-auto rounded-xl bg-white p-6 dark:bg-gray-800">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Cambiar rol</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{fullName(editing)} · {editing.email ?? 'Sin email'}</p>
              </div>
              <button type="button" aria-label="Cerrar" onClick={() => setEditing(null)}><X className="h-5 w-5 text-gray-500" /></button>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-gray-900 dark:text-white">Rol en PayAlert</legend>
              <select aria-label="Rol en PayAlert" value={systemRole} onChange={e => setSystemRole(e.target.value as 'admin' | 'user')} className={input}>
                <option value="user">Usuario (pertenece a un negocio)</option>
                <option value="admin">Administrador del sistema</option>
              </select>
              {systemRole === 'admin' && (
                <label className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
                  <input type="checkbox" checked={confirmAdmin} onChange={e => setConfirmAdmin(e.target.checked)} className="mt-1" />
                  <span>Va a tener acceso total al sistema y dejará de ser dueño o empleado de un negocio.</span>
                </label>
              )}
              {touched && errors.confirm && <p role="alert" className="text-xs text-red-600">{errors.confirm}</p>}
            </fieldset>

            {systemRole === 'user' && (
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium text-gray-900 dark:text-white">Rol en el negocio</legend>
                <select aria-label="Rol en el negocio" value={businessRole} onChange={e => setBusinessRole(e.target.value as 'owner' | 'employee')} className={input}>
                  <option value="owner">Dueño</option>
                  <option value="employee">Empleado</option>
                </select>
                <select aria-label="Negocio" value={businessId} onChange={e => { setBusinessId(e.target.value); setStoreId(''); }} className={input}>
                  <option value="">Elegí un negocio</option>
                  {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                {touched && errors.business && <p role="alert" className="text-xs text-red-600">{errors.business}</p>}
                {businessRole === 'employee' && (
                  <>
                    <select aria-label="Sucursal" value={storeId} onChange={e => setStoreId(e.target.value)} disabled={!businessId} className={input}>
                      <option value="">Elegí una sucursal</option>
                      {storesOfBusiness.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    {touched && errors.store && <p role="alert" className="text-xs text-red-600">{errors.store}</p>}
                  </>
                )}
              </fieldset>
            )}

            {formError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{formError}</p>}

            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-600 dark:text-gray-200">Cancelar</button>
              <button type="submit" disabled={!valid || saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
