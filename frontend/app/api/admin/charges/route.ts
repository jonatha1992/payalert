import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/scope';
import { getServiceClient, getSessionProfile, scopeErrorResponse } from '@/lib/server/session';

export async function GET(request: NextRequest) {
  try {
    requireRole(await getSessionProfile(request), ['owner']);
    const { data, error } = await getServiceClient()
      .from('hub_charges')
      .select('amount,status,created_at,client_apps!inner(slug)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    const charges = (data ?? []).map((row) => {
      const app = Array.isArray(row.client_apps) ? row.client_apps[0] : row.client_apps;
      return { amount: row.amount, status: row.status, created_at: row.created_at, app: app.slug };
    });
    return NextResponse.json({ charges });
  } catch (error) {
    const denied = scopeErrorResponse(error);
    if (denied) return denied;
    console.error('[Admin charges] list failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'No pudimos cargar los cobros.' }, { status: 500 });
  }
}
