import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  category: string;
  storeId: string;
  createdAt: string;
}

interface StoreBreakdown {
  id: string;
  name: string;
  income: number;
  expenses: number;
  balance: number;
  transactionCount: number;
}

interface DashboardStats {
  summary: {
    income: number;
    expenses: number;
    balance: number;
    incomeCount: number;
    expenseCount: number;
    totalTransactions: number;
    activeStores: number;
  };
  trends: {
    incomeChange: number;
    expensesChange: number;
    period: {
      start: string;
      end: string;
    };
  };
  recentTransactions: Transaction[];
  storeBreakdown: StoreBreakdown[];
}

interface UseDashboardStatsOptions {
  businessId?: string;
  storeId?: string;
  startDate?: string;
  endDate?: string;
  refetchInterval?: number;
}

const fetchDashboardStats = async ({
  businessId,
  storeId,
  startDate,
  endDate,
}: UseDashboardStatsOptions): Promise<DashboardStats> => {
  if (!businessId) {
    throw new Error('businessId es requerido');
  }

  const params = new URLSearchParams();
  params.append('businessId', businessId);
  if (storeId) params.append('storeId', storeId);
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  const response = await fetch(`/api/stats/dashboard?${params.toString()}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al cargar estadísticas');
  }

  return response.json();
};

export function useDashboardStats({
  businessId,
  storeId,
  startDate,
  endDate,
  refetchInterval = 30000, // 30 segundos por defecto
}: UseDashboardStatsOptions) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['dashboard-stats', businessId, storeId, startDate, endDate],
    queryFn: () => fetchDashboardStats({ businessId, storeId, startDate, endDate }),
    enabled: !!businessId,
    refetchInterval,
    staleTime: 1000 * 60 * 5, // 5 minutos
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Función para invalidar el cache y refrescar datos
  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: ['dashboard-stats', businessId, storeId, startDate, endDate],
    });
  };

    // Refetch automático cuando cambian los parámetros
    useEffect(() => {
        if (businessId) {
            queryClient.invalidateQueries({
                queryKey: ['dashboard-stats', businessId, storeId, startDate, endDate],
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [businessId, storeId, startDate, endDate]);

  return {
    ...query,
    refresh,
    // Datos formateados para fácil consumo
    stats: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}

// Hook para obtener solo el resumen (más ligero)
export function useDashboardSummary(options: UseDashboardStatsOptions) {
  const { stats, isLoading, isError, error, refresh } = useDashboardStats(options);

  return {
    summary: stats?.summary,
    trends: stats?.trends,
    isLoading,
    isError,
    error,
    refresh,
  };
}

// Hook para obtener transacciones recientes
export function useRecentTransactions(options: UseDashboardStatsOptions) {
  const { stats, isLoading, isError, error, refresh } = useDashboardStats(options);

  return {
    transactions: stats?.recentTransactions || [],
    isLoading,
    isError,
    error,
    refresh,
  };
}
