import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface ReportFilters {
  businessId: string;
  storeId?: string;
  startDate: string;
  endDate: string;
  type?: 'income' | 'expense' | 'all';
  category?: string;
  groupBy?: 'day' | 'week' | 'month' | 'store' | 'category';
}

interface TransactionRecord {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  category: string;
  store_id: string;
  created_at: string;
  stores?: { name: string };
}

interface GroupedData {
  label: string;
  income: number;
  expenses: number;
  balance: number;
  count: number;
  date?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parsear filtros
    const filters: ReportFilters = {
      businessId: searchParams.get('businessId') || '',
      storeId: searchParams.get('storeId') || undefined,
      startDate: searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: searchParams.get('endDate') || new Date().toISOString().split('T')[0],
      type: (searchParams.get('type') as 'income' | 'expense' | 'all') || 'all',
      category: searchParams.get('category') || undefined,
      groupBy: (searchParams.get('groupBy') as ReportFilters['groupBy']) || 'day',
    };

    if (!filters.businessId) {
      return NextResponse.json(
        { error: 'businessId es requerido' },
        { status: 400 }
      );
    }

    // Construir query base
    let query = supabase
      .from('transactions')
      .select(`
        id,
        type,
        amount,
        description,
        category,
        store_id,
        created_at,
        stores (name)
      `)
      .eq('business_id', filters.businessId)
      .gte('created_at', `${filters.startDate}T00:00:00`)
      .lte('created_at', `${filters.endDate}T23:59:59`)
      .order('created_at', { ascending: false });

    // Aplicar filtros opcionales
    if (filters.storeId) {
      query = query.eq('store_id', filters.storeId);
    }

    if (filters.type && filters.type !== 'all') {
      query = query.eq('type', filters.type);
    }

    if (filters.category) {
      query = query.eq('category', filters.category);
    }

    const { data: transactions, error } = await query;

    if (error) {
      console.error('[Reports API] Error fetching transactions:', error);
      return NextResponse.json(
        { error: 'Error al obtener transacciones' },
        { status: 500 }
      );
    }

    const typedTransactions = (transactions || []) as unknown as TransactionRecord[];

    // Calcular totales
    const totals = typedTransactions.reduce(
      (acc, t) => {
        if (t.type === 'income') {
          acc.income += t.amount;
          acc.incomeCount++;
        } else {
          acc.expenses += t.amount;
          acc.expenseCount++;
        }
        return acc;
      },
      { income: 0, expenses: 0, incomeCount: 0, expenseCount: 0 }
    );

    // Agrupar datos según el parámetro groupBy
    let groupedData: GroupedData[] = [];

    switch (filters.groupBy) {
      case 'day':
        groupedData = groupByDay(typedTransactions);
        break;
      case 'week':
        groupedData = groupByWeek(typedTransactions);
        break;
      case 'month':
        groupedData = groupByMonth(typedTransactions);
        break;
      case 'store':
        groupedData = groupByStore(typedTransactions);
        break;
      case 'category':
        groupedData = groupByCategory(typedTransactions);
        break;
      default:
        groupedData = groupByDay(typedTransactions);
    }

    // Calcular métricas adicionales
    const metrics = {
      avgTransaction: typedTransactions.length > 0 
        ? (totals.income + totals.expenses) / typedTransactions.length 
        : 0,
      avgIncome: totals.incomeCount > 0 
        ? totals.income / totals.incomeCount 
        : 0,
      avgExpense: totals.expenseCount > 0 
        ? totals.expenses / totals.expenseCount 
        : 0,
      profitMargin: totals.income > 0 
        ? ((totals.income - totals.expenses) / totals.income) * 100 
        : 0,
    };

    // Top categorías
    const categoriesBreakdown = getCategoriesBreakdown(typedTransactions);

    // Top tiendas
    const storesBreakdown = getStoresBreakdown(typedTransactions);

    const report = {
      filters,
      summary: {
        income: Math.round(totals.income * 100) / 100,
        expenses: Math.round(totals.expenses * 100) / 100,
        balance: Math.round((totals.income - totals.expenses) * 100) / 100,
        incomeCount: totals.incomeCount,
        expenseCount: totals.expenseCount,
        totalTransactions: typedTransactions.length,
      },
      metrics: {
        avgTransaction: Math.round(metrics.avgTransaction * 100) / 100,
        avgIncome: Math.round(metrics.avgIncome * 100) / 100,
        avgExpense: Math.round(metrics.avgExpense * 100) / 100,
        profitMargin: Math.round(metrics.profitMargin * 100) / 100,
      },
      groupedData,
      categoriesBreakdown,
      storesBreakdown,
      transactions: typedTransactions.slice(0, 100), // Limitar a 100 para performance
    };

    return NextResponse.json(report, { status: 200 });

  } catch (error) {
    console.error('[Reports API] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// Funciones de agrupación
function groupByDay(transactions: TransactionRecord[]): GroupedData[] {
  const groups = new Map<string, { income: number; expenses: number; count: number }>();

  transactions.forEach((t) => {
    const date = t.created_at.split('T')[0];
    const existing = groups.get(date) || { income: 0, expenses: 0, count: 0 };
    
    if (t.type === 'income') {
      existing.income += t.amount;
    } else {
      existing.expenses += t.amount;
    }
    existing.count++;
    
    groups.set(date, existing);
  });

  return Array.from(groups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, data]) => ({
      label: formatDateLabel(date),
      date,
      income: Math.round(data.income * 100) / 100,
      expenses: Math.round(data.expenses * 100) / 100,
      balance: Math.round((data.income - data.expenses) * 100) / 100,
      count: data.count,
    }));
}

function groupByWeek(transactions: TransactionRecord[]): GroupedData[] {
  const groups = new Map<string, { income: number; expenses: number; count: number }>();

  transactions.forEach((t) => {
    const date = new Date(t.created_at);
    const weekStart = getWeekStart(date);
    const weekKey = weekStart.toISOString().split('T')[0];
    
    const existing = groups.get(weekKey) || { income: 0, expenses: 0, count: 0 };
    
    if (t.type === 'income') {
      existing.income += t.amount;
    } else {
      existing.expenses += t.amount;
    }
    existing.count++;
    
    groups.set(weekKey, existing);
  });

  return Array.from(groups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([weekKey, data]) => ({
      label: `Semana del ${formatDateLabel(weekKey)}`,
      date: weekKey,
      income: Math.round(data.income * 100) / 100,
      expenses: Math.round(data.expenses * 100) / 100,
      balance: Math.round((data.income - data.expenses) * 100) / 100,
      count: data.count,
    }));
}

function groupByMonth(transactions: TransactionRecord[]): GroupedData[] {
  const groups = new Map<string, { income: number; expenses: number; count: number }>();

  transactions.forEach((t) => {
    const date = new Date(t.created_at);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    const existing = groups.get(monthKey) || { income: 0, expenses: 0, count: 0 };
    
    if (t.type === 'income') {
      existing.income += t.amount;
    } else {
      existing.expenses += t.amount;
    }
    existing.count++;
    
    groups.set(monthKey, existing);
  });

  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  return Array.from(groups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([monthKey, data]) => {
      const [year, month] = monthKey.split('-');
      return {
        label: `${monthNames[parseInt(month) - 1]} ${year}`,
        date: monthKey,
        income: Math.round(data.income * 100) / 100,
        expenses: Math.round(data.expenses * 100) / 100,
        balance: Math.round((data.income - data.expenses) * 100) / 100,
        count: data.count,
      };
    });
}

function groupByStore(transactions: TransactionRecord[]): GroupedData[] {
  const groups = new Map<string, { name: string; income: number; expenses: number; count: number }>();

  transactions.forEach((t) => {
    const storeName = t.stores?.name || 'Sin tienda';
    const existing = groups.get(t.store_id) || { name: storeName, income: 0, expenses: 0, count: 0 };
    
    if (t.type === 'income') {
      existing.income += t.amount;
    } else {
      existing.expenses += t.amount;
    }
    existing.count++;
    
    groups.set(t.store_id, existing);
  });

  return Array.from(groups.entries())
    .sort((a, b) => b[1].income - a[1].income)
    .map(([, data]) => ({
      label: data.name,
      income: Math.round(data.income * 100) / 100,
      expenses: Math.round(data.expenses * 100) / 100,
      balance: Math.round((data.income - data.expenses) * 100) / 100,
      count: data.count,
    }));
}

function groupByCategory(transactions: TransactionRecord[]): GroupedData[] {
  const groups = new Map<string, { income: number; expenses: number; count: number }>();

  transactions.forEach((t) => {
    const category = t.category || 'Sin categoría';
    const existing = groups.get(category) || { income: 0, expenses: 0, count: 0 };
    
    if (t.type === 'income') {
      existing.income += t.amount;
    } else {
      existing.expenses += t.amount;
    }
    existing.count++;
    
    groups.set(category, existing);
  });

  return Array.from(groups.entries())
    .sort((a, b) => b[1].expenses - a[1].expenses)
    .map(([category, data]) => ({
      label: category,
      income: Math.round(data.income * 100) / 100,
      expenses: Math.round(data.expenses * 100) / 100,
      balance: Math.round((data.income - data.expenses) * 100) / 100,
      count: data.count,
    }));
}

function getCategoriesBreakdown(transactions: TransactionRecord[]) {
  const categories = new Map<string, { amount: number; count: number; type: 'income' | 'expense' }>();

  transactions.forEach((t) => {
    const key = `${t.category || 'Sin categoría'}-${t.type}`;
    const existing = categories.get(key) || { amount: 0, count: 0, type: t.type };
    existing.amount += t.amount;
    existing.count++;
    categories.set(key, existing);
  });

  return Array.from(categories.entries())
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, 10)
    .map(([key, data]) => ({
      category: key.split('-')[0],
      type: data.type,
      amount: Math.round(data.amount * 100) / 100,
      count: data.count,
    }));
}

function getStoresBreakdown(transactions: TransactionRecord[]) {
  const stores = new Map<string, { name: string; income: number; expenses: number; count: number }>();

  transactions.forEach((t) => {
    const storeName = t.stores?.name || 'Sin tienda';
    const existing = stores.get(t.store_id) || { name: storeName, income: 0, expenses: 0, count: 0 };
    
    if (t.type === 'income') {
      existing.income += t.amount;
    } else {
      existing.expenses += t.amount;
    }
    existing.count++;
    
    stores.set(t.store_id, existing);
  });

  return Array.from(stores.entries())
    .sort((a, b) => (b[1].income + b[1].expenses) - (a[1].income + a[1].expenses))
    .slice(0, 10)
    .map(([storeId, data]) => ({
      id: storeId,
      name: data.name,
      income: Math.round(data.income * 100) / 100,
      expenses: Math.round(data.expenses * 100) / 100,
      balance: Math.round((data.income - data.expenses) * 100) / 100,
      count: data.count,
    }));
}

function formatDateLabel(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Hoy';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Ayer';
  } else {
    return date.toLocaleDateString('es-AR', { 
      day: '2-digit', 
      month: 'short' 
    });
  }
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
}
