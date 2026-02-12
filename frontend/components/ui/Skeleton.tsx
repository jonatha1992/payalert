// Skeleton components for loading states
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ className, style }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-gray-200 dark:bg-gray-700",
        className
      )}
      style={style}
    />
  );
}

// Skeleton para tarjetas de estadísticas
export function StatCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-start">
        <Skeleton className="w-12 h-12 rounded-xl" />
        <Skeleton className="w-16 h-6 rounded-full" />
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="w-24 h-4" />
        <Skeleton className="w-32 h-8" />
      </div>
    </div>
  );
}

// Skeleton para tabla
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 dark:bg-gray-900/50 p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-4">
          <Skeleton className="w-1/4 h-4" />
          <Skeleton className="w-1/4 h-4" />
          <Skeleton className="w-1/4 h-4" />
          <Skeleton className="w-1/4 h-4" />
        </div>
      </div>
      
      {/* Rows */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-4 flex items-center gap-4">
            <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="w-3/4 h-4" />
              <Skeleton className="w-1/2 h-3" />
            </div>
            <Skeleton className="w-20 h-6 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Skeleton para lista de items
export function ListSkeleton({ items = 3 }: { items?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="w-3/4 h-5" />
            <Skeleton className="w-1/2 h-4" />
          </div>
          <Skeleton className="w-8 h-8 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

// Skeleton para formulario
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-6 p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="w-24 h-4" />
          <Skeleton className="w-full h-10 rounded-lg" />
        </div>
      ))}
      <Skeleton className="w-full h-12 rounded-xl" />
    </div>
  );
}

// Skeleton para gráfico
export function ChartSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
      <Skeleton className="w-48 h-6 mb-6" />
      <div className="h-64 flex items-end justify-between gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton
            key={i}
            className="w-full rounded-t-lg"
            style={{ height: `${(i % 3) * 20 + 20}%` }}
          />
        ))}
      </div>
    </div>
  );
}

// Skeleton para página de dashboard
export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="w-64 h-8" />
        <Skeleton className="w-96 h-4" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>

      {/* Table */}
      <TableSkeleton rows={5} />
    </div>
  );
}

// Skeleton para tarjeta de tienda
export function StoreCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-start mb-4">
        <Skeleton className="w-12 h-12 rounded-xl" />
        <div className="flex gap-1">
          <Skeleton className="w-8 h-8 rounded-lg" />
          <Skeleton className="w-8 h-8 rounded-lg" />
        </div>
      </div>
      <Skeleton className="w-3/4 h-6 mb-2" />
      <div className="space-y-2 mb-4">
        <Skeleton className="w-full h-4" />
        <Skeleton className="w-2/3 h-4" />
      </div>
      <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-gray-700">
        <Skeleton className="w-20 h-6 rounded-full" />
        <Skeleton className="w-24 h-4" />
      </div>
    </div>
  );
}

// Skeleton para terminal de cobros
export function TerminalSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="w-48 h-8" />
        <Skeleton className="w-64 h-4" />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 border border-gray-200 dark:border-gray-700 min-h-[400px]">
        <div className="flex flex-col items-center justify-center h-full space-y-6">
          <Skeleton className="w-24 h-24 rounded-full" />
          <Skeleton className="w-48 h-6" />
          <Skeleton className="w-64 h-4" />
        </div>
      </div>
    </div>
  );
}
