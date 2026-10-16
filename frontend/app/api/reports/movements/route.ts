import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/server/rbac';
import { resolveScope } from '@/lib/server/scope';
import { assertStoreInBusiness, getServiceClient, getSessionProfile, scopeErrorResponse } from '@/lib/server/session';
import { parseReportQuery } from '@/lib/reports/query';

const COLUMNS = 'id, type, amount, description, category, store_id, created_at, status, provider, currency, connection_id, stores (name)';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const profile = requirePermission(await getSessionProfile(request), 'movement', 'read');
    const scope = resolveScope(profile, {
      businessId: searchParams.get('businessId'),
      storeId: searchParams.get('storeId'),
    });
    await assertStoreInBusiness(scope.storeId, scope.businessId);
    const filters = parseReportQuery(searchParams);
    const supabase = getServiceClient();
    let query = supabase.from('transactions').select(COLUMNS, { count: 'exact' })
      .eq('business_id', scope.businessId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });

    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    if (startDate) query = query.gte('created_at', `${startDate}T00:00:00`);
    if (endDate) query = query.lte('created_at', `${endDate}T23:59:59`);
    if (scope.storeId) query = query.eq('store_id', scope.storeId);
    if (filters.search) query = query.or(`description.ilike.%${filters.search}%,category.ilike.%${filters.search}%`);
    if (filters.minAmount !== undefined) query = query.gte('amount', filters.minAmount);
    if (filters.maxAmount !== undefined) query = query.lte('amount', filters.maxAmount);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.accountId) query = query.eq('connection_id', filters.accountId);
    if (filters.direction) query = query.eq('type', filters.direction === 'inbound' ? 'income' : 'expense');
    if (searchParams.get('type') && searchParams.get('type') !== 'all') query = query.eq('type', searchParams.get('type'));
    if (searchParams.get('category')) query = query.eq('category', searchParams.get('category'));

    const exportCsv = searchParams.get('format') === 'csv';
    if (!exportCsv) {
      const from = (filters.page - 1) * filters.pageSize;
      query = query.range(from, from + filters.pageSize - 1);
    }
    const { data, error, count } = await query;
    if (error) {
      console.error('[Reports API] Error fetching transactions:', error);
      return NextResponse.json({ error: 'Error al obtener transacciones' }, { status: 500 });
    }
    if (exportCsv) {
      const columns = ['id', 'created_at', 'type', 'amount', 'currency', 'status', 'provider', 'connection_id', 'category', 'description', 'store_id'];
      const csv = [columns.join(','), ...(data ?? []).map((row) => columns.map((key) => csvCell(row[key as keyof typeof row])).join(','))].join('\r\n');
      return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="movimientos.csv"' } });
    }
    return NextResponse.json({ transactions: data ?? [], pagination: { page: filters.page, pageSize: filters.pageSize, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / filters.pageSize) } });
  } catch (error) {
    if (error instanceof Error && /inválido|rango|superar|largo/.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const denied = scopeErrorResponse(error);
    if (denied) return denied;
    console.error('[Reports API] Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}
