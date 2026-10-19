import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/server/rbac';
import { resolveScope } from '@/lib/server/scope';
import {
  assertStoreInBusiness,
  getServiceClient,
  getSessionProfile,
  scopeErrorResponse,
} from '@/lib/server/session';

export async function GET(request: NextRequest) {
  try {
    // Obtener parámetros de query
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // El negocio y la tienda salen de la sesión; los parámetros del cliente son solo pistas.
    const profile = requirePermission(await getSessionProfile(request), 'report', 'read');
    const { businessId, storeId } = resolveScope(profile, {
      businessId: searchParams.get('businessId'),
      storeId: searchParams.get('storeId'),
    });
    await assertStoreInBusiness(storeId, businessId);
    const supabase = getServiceClient();

    // Fechas por defecto: hoy
    const today = new Date().toISOString().split('T')[0];
    const start = startDate || today;
    const end = endDate || today;

    // Query base para transacciones
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('business_id', businessId)
      .neq('status', 'pending')
      .gte('created_at', `${start}T00:00:00`)
      .lte('created_at', `${end}T23:59:59`);

    // Filtrar por tienda si se especifica
    if (storeId) {
      query = query.eq('store_id', storeId);
    }

    const { data: transactions, error } = await query;

    if (error) {
      console.error('[Stats API] Error fetching transactions:', error);
      return NextResponse.json(
        { error: 'Error al obtener transacciones' },
        { status: 500 }
      );
    }

    // Calcular estadísticas
    const income = transactions
      ?.filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

    const expenses = transactions
      ?.filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

    const balance = income - expenses;

    // Conteos
    const incomeCount = transactions?.filter((t) => t.type === 'income').length || 0;
    const expenseCount = transactions?.filter((t) => t.type === 'expense').length || 0;

    // Obtener últimas transacciones (últimas 10)
    const recentTransactions = transactions
      ?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10) || [];

    // Calcular tendencias (comparar con período anterior)
    const prevStartDate = new Date(start);
    prevStartDate.setDate(prevStartDate.getDate() - 1);
    const prevEndDate = new Date(end);
    prevEndDate.setDate(prevEndDate.getDate() - 1);

    const prevQuery = supabase
      .from('transactions')
      .select('type, amount')
      .eq('business_id', businessId)
      .neq('status', 'pending')
      .gte('created_at', `${prevStartDate.toISOString().split('T')[0]}T00:00:00`)
      .lte('created_at', `${prevEndDate.toISOString().split('T')[0]}T23:59:59`);

    if (storeId) {
      prevQuery.eq('store_id', storeId);
    }

    const { data: prevTransactions } = await prevQuery;

    const prevIncome = prevTransactions
      ?.filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

    const prevExpenses = prevTransactions
      ?.filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

    // Calcular porcentajes de cambio
    const incomeChange = prevIncome > 0 
      ? ((income - prevIncome) / prevIncome) * 100 
      : (income > 0 ? 100 : 0);
    
    const expensesChange = prevExpenses > 0 
      ? ((expenses - prevExpenses) / prevExpenses) * 100 
      : (expenses > 0 ? 100 : 0);

    // Obtener datos de tiendas para el desglose
    const { data: stores } = await supabase
      .from('stores')
      .select('id, name')
      .eq('business_id', businessId);

    // Calcular totales por tienda
    const storeBreakdown = stores?.map((store) => {
      const storeTransactions = transactions?.filter((t) => t.store_id === store.id) || [];
      const storeIncome = storeTransactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      const storeExpenses = storeTransactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      
      return {
        id: store.id,
        name: store.name,
        income: storeIncome,
        expenses: storeExpenses,
        balance: storeIncome - storeExpenses,
        transactionCount: storeTransactions.length,
      };
    }).sort((a, b) => b.income - a.income) || [];

    // Obtener conteo de sucursales activas
    const activeStores = stores?.length || 0;

    const stats = {
      summary: {
        income: Math.round(income * 100) / 100,
        expenses: Math.round(expenses * 100) / 100,
        balance: Math.round(balance * 100) / 100,
        incomeCount,
        expenseCount,
        totalTransactions: transactions?.length || 0,
        activeStores,
      },
      trends: {
        incomeChange: Math.round(incomeChange * 100) / 100,
        expensesChange: Math.round(expensesChange * 100) / 100,
        period: {
          start,
          end,
        },
      },
      recentTransactions: recentTransactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        description: t.description,
        category: t.category,
        storeId: t.store_id,
        createdAt: t.created_at,
      })),
      storeBreakdown,
    };

    return NextResponse.json(stats, { status: 200 });

  } catch (error) {
    const denied = scopeErrorResponse(error);
    if (denied) return denied;
    console.error('[Stats API] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
