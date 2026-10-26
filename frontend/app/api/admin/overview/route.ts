import { NextRequest, NextResponse } from 'next/server';
import { getSessionProfile, getServiceClient } from '@/lib/server/session';
import { ScopeError } from '@/lib/server/scope';

async function count(db: ReturnType<typeof getServiceClient>, table: string) {
  const { count: total, error } = await db.from(table).select('*', { count: 'exact', head: true });
  if (error) throw error;
  return total ?? 0;
}

export async function GET(request: NextRequest) {
  try {
    const profile = await getSessionProfile(request);
    if (!profile) throw new ScopeError('No autenticado', 401);
    if (profile.role !== 'admin') throw new ScopeError('Permiso insuficiente', 403);

    const db = getServiceClient();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const month = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const [businesses, users, appsResult, connectionsResult, todayResult, monthResult, auditResult] = await Promise.all([
      count(db, 'businesses'), count(db, 'users'),
      db.from('client_apps').select('id,connection_id'),
      db.from('payment_connections').select('id,provider,status'),
      db.from('hub_charges').select('status,created_at').gte('created_at', today),
      db.from('hub_charges').select('status,created_at').gte('created_at', month),
      db.from('audit_logs').select('action,created_at,user_id,users(email,first_name,last_name)').order('created_at', { ascending: false }).limit(8),
    ]);
    for (const result of [appsResult, connectionsResult, todayResult, monthResult, auditResult]) {
      if (result.error) throw result.error;
    }
    const apps = appsResult.data ?? [];
    const connections = connectionsResult.data ?? [];
    const summarize = (rows: { status: string }[]) => ({
      approved: rows.filter((row) => row.status === 'approved').length,
      pending: rows.filter((row) => row.status === 'pending').length,
    });
    const providerCounts = (provider: string) => {
      const matching = connections.filter((row) => row.provider === provider);
      return { total: matching.length, connected: matching.filter((row) => row.status === 'CONNECTED').length, disconnected: matching.filter((row) => row.status !== 'CONNECTED').length };
    };
    return NextResponse.json({
      businesses, users,
      apps: { total: apps.length, unconnected: apps.filter((app) => !app.connection_id).length },
      connections: { total: connections.length, mercado_pago: providerCounts('mercado_pago'), uala: providerCounts('uala') },
      charges: { today: summarize(todayResult.data ?? []), month: summarize(monthResult.data ?? []) },
      activity: (auditResult.data ?? []).map((event) => {
        const user = Array.isArray(event.users) ? event.users[0] : event.users;
        return { action: event.action, created_at: event.created_at, actor: user?.email || [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Usuario eliminado' };
      }),
    });
  } catch (error) {
    if (error instanceof ScopeError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[Admin overview] load failed');
    return NextResponse.json({ error: 'No pudimos cargar el resumen del sistema.' }, { status: 500 });
  }
}
