'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabaseClient';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  FileText,
  Download,
  Filter,
  Store,
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart as PieChartIcon,
  BarChart3,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  FileSpreadsheet,
} from 'lucide-react';
import { toast } from 'sonner';
import { useReportMovements, type Movement } from '@/hooks/useReportMovements';

// Formato de moneda
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

// Colores para gráficos
const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

interface Store {
  id: string;
  name: string;
}

interface ReportFilters {
  startDate: string;
  endDate: string;
  storeId: string;
  type: 'all' | 'income' | 'expense';
  groupBy: 'day' | 'week' | 'month' | 'store' | 'category';
}

interface ReportData {
  filters: ReportFilters;
  summary: {
    income: number;
    expenses: number;
    balance: number;
    incomeCount: number;
    expenseCount: number;
    totalTransactions: number;
  };
  metrics: {
    avgTransaction: number;
    avgIncome: number;
    avgExpense: number;
    profitMargin: number;
  };
  groupedData: Array<{
    label: string;
    income: number;
    expenses: number;
    balance: number;
    count: number;
    date?: string;
  }>;
  categoriesBreakdown: Array<{
    category: string;
    type: 'income' | 'expense';
    amount: number;
    count: number;
  }>;
  storesBreakdown: Array<{
    id: string;
    name: string;
    income: number;
    expenses: number;
    balance: number;
    count: number;
  }>;
  transactions: Movement[];
}

export default function ReportsPage() {
  const { profile } = useAuth();
  const { filters: movementFilters, setFilters: setMovementFilters, searchDraft, setSearchDraft, data: movementData, loading: movementsLoading, load: loadMovements, exportCsv, exportExcel } = useReportMovements(profile?.business_id);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'charts'>('overview');

  // Filtros
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [filters, setFilters] = useState<ReportFilters>({
    startDate: thirtyDaysAgo,
    endDate: today,
    storeId: '',
    type: 'all',
    groupBy: 'day',
  });

  // Cargar tiendas
  useEffect(() => {
    const fetchStoresData = async () => {
      if (!profile?.business_id) return;
      const { data } = await supabase
        .from('stores')
        .select('id, name')
        .eq('business_id', profile.business_id);
      if (data) setStores(data);
    };
    fetchStoresData();
  }, [profile]);

  // Cargar reporte
  const fetchReport = async () => {
    if (!profile?.business_id) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        businessId: profile.business_id,
        startDate: filters.startDate,
        endDate: filters.endDate,
        groupBy: filters.groupBy,
        ...(filters.storeId && { storeId: filters.storeId }),
        ...(filters.type !== 'all' && { type: filters.type }),
      });

      const response = await fetch(`/api/reports?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Error al cargar el reporte');
      }

      const data = await response.json();
      setReportData(data);
    } catch (error) {
      console.error('Error fetching report:', error);
      toast.error('Error al cargar el reporte');
    } finally {
      setLoading(false);
    }
  };

  // Cargar reporte inicial
  useEffect(() => {
    if (profile?.business_id) {
      fetchReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // Preparar datos para gráfico de torta
  const pieData = reportData?.categoriesBreakdown
    ?.filter((c) => c.type === 'expense')
    .map((c) => ({
      name: c.category,
      value: c.amount,
    })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <FileText className="text-blue-600" size={32} />
            Reportes Financieros
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            Analiza el rendimiento de tu negocio con reportes detallados.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchReport}
            disabled={loading}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            <span>Actualizar</span>
          </button>
          <button
            onClick={exportCsv}
            disabled={!reportData || loading}
            className="flex items-center space-x-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 px-4 py-2 rounded-lg transition-colors"
          >
            <Download size={18} />
            <span>Exportar CSV</span>
          </button>
          <button
            onClick={exportExcel}
            disabled={!movementData || movementsLoading}
            className="flex items-center space-x-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 px-4 py-2 rounded-lg transition-colors"
          >
            <Download size={18} />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Filter size={20} className="text-gray-500" />
            <span className="font-medium text-gray-900 dark:text-white">Filtros</span>
          </div>
          {showFilters ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>

        {showFilters && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Fecha inicio */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Desde
                </label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>

              {/* Fecha fin */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Hasta
                </label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>

              {/* Tienda */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Sucursal
                </label>
                <select
                  value={filters.storeId}
                  onChange={(e) => setFilters({ ...filters, storeId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  <option value="">Todas las sucursales</option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tipo
                </label>
                <select
                  value={filters.type}
                  onChange={(e) => setFilters({ ...filters, type: e.target.value as ReportFilters['type'] })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  <option value="all">Todos</option>
                  <option value="income">Solo ingresos</option>
                  <option value="expense">Solo gastos</option>
                </select>
              </div>

              {/* Agrupar por */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Agrupar por
                </label>
                <select
                  value={filters.groupBy}
                  onChange={(e) => setFilters({ ...filters, groupBy: e.target.value as ReportFilters['groupBy'] })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  <option value="day">Día</option>
                  <option value="week">Semana</option>
                  <option value="month">Mes</option>
                  <option value="store">Sucursal</option>
                  <option value="category">Categoría</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={fetchReport}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                {loading ? 'Generando...' : 'Generar Reporte'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          {[
            { id: 'overview', label: 'Resumen', icon: FileText },
            { id: 'charts', label: 'Gráficos', icon: BarChart3 },
            { id: 'transactions', label: 'Transacciones', icon: FileSpreadsheet },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <tab.icon size={18} />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Contenido según tab */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : !reportData ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No hay datos disponibles</p>
        </div>
      ) : (
        <>
          {activeTab === 'overview' && (
            <OverviewTab data={reportData} />
          )}

          {activeTab === 'charts' && (
            <ChartsTab data={reportData} pieData={pieData} />
          )}

          {activeTab === 'transactions' && (
          <TransactionsTab data={{ transactions: movementData?.transactions ?? [], pagination: movementData?.pagination }} loading={movementsLoading} searchTerm={searchDraft} setSearchTerm={setSearchDraft} page={movementData?.pagination.page ?? 1} onPage={loadMovements} filters={movementFilters} setFilters={setMovementFilters} onApply={() => void loadMovements(1)} />
          )}
        </>
      )}
    </div>
  );
}

// Componente de Resumen
function OverviewTab({ data }: { data: ReportData }) {
  return (
    <div className="space-y-6">
      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <SummaryCard
          title="Ingresos Totales"
          value={formatCurrency(data.summary.income)}
          subtitle={`${data.summary.incomeCount} transacciones`}
          icon={TrendingUp}
          color="emerald"
        />
        <SummaryCard
          title="Gastos Totales"
          value={formatCurrency(data.summary.expenses)}
          subtitle={`${data.summary.expenseCount} transacciones`}
          icon={TrendingDown}
          color="rose"
        />
        <SummaryCard
          title="Balance Neto"
          value={formatCurrency(data.summary.balance)}
          subtitle={`Margen: ${data.metrics.profitMargin.toFixed(1)}%`}
          icon={DollarSign}
          color={data.summary.balance >= 0 ? 'emerald' : 'rose'}
        />
        <SummaryCard
          title="Promedio por Transacción"
          value={formatCurrency(data.metrics.avgTransaction)}
          subtitle={`${data.summary.totalTransactions} totales`}
          icon={BarChart3}
          color="blue"
        />
      </div>

      {/* Desglose por tienda */}
      {data.storesBreakdown.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Store size={20} className="text-blue-600" />
              Desglose por Sucursal
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sucursal
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ingresos
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gastos
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Balance
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transacciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {data.storesBreakdown.map((store) => (
                  <tr key={store.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {store.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-emerald-600">
                      {formatCurrency(store.income)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-rose-600">
                      {formatCurrency(store.expenses)}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                      store.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {formatCurrency(store.balance)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">
                      {store.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top categorías */}
      {data.categoriesBreakdown.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <PieChartIcon size={20} className="text-purple-600" />
              Top Categorías
            </h3>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              {data.categoriesBreakdown.slice(0, 5).map((cat, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        cat.type === 'income' ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                    />
                    <span className="text-sm text-gray-900 dark:text-white">{cat.category}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      cat.type === 'income' 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'bg-rose-100 text-rose-700'
                    }`}>
                      {cat.type === 'income' ? 'Ingreso' : 'Gasto'}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${
                      cat.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {formatCurrency(cat.amount)}
                    </p>
                    <p className="text-xs text-gray-500">{cat.count} trans.</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Componente de Gráficos
function ChartsTab({ data, pieData }: { data: ReportData; pieData: Array<{ name: string; value: number }> }) {
  return (
    <div className="space-y-6">
      {/* Gráfico de barras - Evolución temporal */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
          Evolución Temporal
        </h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.groupedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis tickFormatter={(value: number) => `$${value}`} />
              <Tooltip
                formatter={(value) => formatCurrency(value as number)}
                contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb' }}
              />
              <Legend />
              <Bar dataKey="income" name="Ingresos" fill="#10B981" />
              <Bar dataKey="expenses" name="Gastos" fill="#EF4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de líneas - Balance */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            Balance Acumulado
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.groupedData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis tickFormatter={(value: number) => `$${value}`} />
                <Tooltip
                  formatter={(value) => formatCurrency(value as number)}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <Line
                  type="monotone"
                  dataKey="balance"
                  name="Balance"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ fill: '#3B82F6' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico de torta - Gastos por categoría */}
        {pieData.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Distribución de Gastos
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                   <Tooltip formatter={(value) => formatCurrency(value as number)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Componente de Transacciones
function TransactionsTab({ data, loading, searchTerm, setSearchTerm, page, onPage, filters, setFilters, onApply }: { data: { transactions: Movement[]; pagination?: { total: number; totalPages: number } }; loading: boolean; searchTerm: string; setSearchTerm: (value: string) => void; page: number; onPage: (page: number) => void; filters: ReturnType<typeof useReportMovements>['filters']; setFilters: ReturnType<typeof useReportMovements>['setFilters']; onApply: () => void }) {
  const movementFilters = filters;
  const setMovementFilters = setFilters;
  const loadMovements = (requestedPage: number) => { void onPage(requestedPage); };
  const filteredTransactions = data.transactions;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="grid grid-cols-1 gap-3 border-b p-4 md:grid-cols-3">
        <input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        <select value={movementFilters.status ?? ""} onChange={(e) => setMovementFilters({ ...movementFilters, status: e.target.value || undefined })}><option value="">Estado</option><option value="completed">Completado</option><option value="pending">Pendiente</option><option value="failed">Fallido</option></select>
        <select value={movementFilters.direction ?? ""} onChange={(e) => setMovementFilters({ ...movementFilters, direction: (e.target.value || undefined) as "inbound" | "outbound" | undefined })}><option value="">Dirección</option><option value="inbound">Entrante</option><option value="outbound">Saliente</option></select>
        <input placeholder="Proveedor" value={movementFilters.provider ?? ""} onChange={(e) => setMovementFilters({ ...movementFilters, provider: e.target.value || undefined })} />
        <input placeholder="Conexión" value={movementFilters.accountId ?? ""} onChange={(e) => setMovementFilters({ ...movementFilters, accountId: e.target.value || undefined })} />
        <input aria-label="Monto mínimo" type="number" value={movementFilters.minAmount ?? ""} onChange={(e) => setMovementFilters({ ...movementFilters, minAmount: e.target.value ? Number(e.target.value) : undefined })} />
        <input aria-label="Monto máximo" type="number" value={movementFilters.maxAmount ?? ""} onChange={(e) => setMovementFilters({ ...movementFilters, maxAmount: e.target.value ? Number(e.target.value) : undefined })} />
        <input placeholder="Moneda" value={movementFilters.currency ?? ""} onChange={(e) => setMovementFilters({ ...movementFilters, currency: e.target.value || undefined })} />
        <input aria-label="Desde" type="date" value={movementFilters.startDate} onChange={(e) => setMovementFilters({ ...movementFilters, startDate: e.target.value })} />
        <input aria-label="Hasta" type="date" value={movementFilters.endDate} onChange={(e) => setMovementFilters({ ...movementFilters, endDate: e.target.value })} />
        <button type="button" onClick={() => void loadMovements(1)}>Aplicar filtros</button><span>{data.pagination?.total ?? 0} resultados</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tipo
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Descripción
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Categoría
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tienda
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Monto
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredTransactions.map((transaction) => (
              <tr key={transaction.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(transaction.created_at).toLocaleDateString('es-AR')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    transaction.type === 'income'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {transaction.type === 'income' ? (
                      <ArrowUpRight size={12} className="mr-1" />
                    ) : (
                      <ArrowDownRight size={12} className="mr-1" />
                    )}
                    {transaction.type === 'income' ? 'Ingreso' : 'Gasto'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {transaction.description || 'Sin descripción'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {transaction.category || 'Sin categoría'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {transaction.stores?.name || 'Sin tienda'}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                  transaction.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {transaction.type === 'income' ? '+' : '-'}
                  {formatCurrency(transaction.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredTransactions.length === 0 && (
        <div className="p-8 text-center text-gray-500">No se encontraron transacciones</div>
      )}
      <div className="flex justify-between p-4"><button disabled={loading || page <= 1} onClick={() => void onPage(page - 1)}>Anterior</button><span>Página {page} de {data.pagination?.totalPages ?? 0}</span><button disabled={loading || page >= (data.pagination?.totalPages ?? 0)} onClick={() => void onPage(page + 1)}>Siguiente</button></div>
    </div>
  );
}

// Componente de tarjeta de resumen
function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  color: 'emerald' | 'rose' | 'blue';
}) {
  const colorClasses = {
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
    rose: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
          <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}
