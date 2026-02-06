import { ReactNode } from 'react';
import { 
  Inbox, 
  CreditCard, 
  Users, 
  Store, 
  FileText,
  Search,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Plus
} from 'lucide-react';

interface EmptyStateProps {
  icon?: 'inbox' | 'credit-card' | 'users' | 'store' | 'file-text' | 'search' | 'trending' | 'alert' | 'success';
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  children?: ReactNode;
}

const iconMap = {
  'inbox': Inbox,
  'credit-card': CreditCard,
  'users': Users,
  'store': Store,
  'file-text': FileText,
  'search': Search,
  'trending': TrendingUp,
  'alert': AlertCircle,
  'success': CheckCircle2,
};

export function EmptyState({
  icon = 'inbox',
  title,
  description,
  action,
  secondaryAction,
  children,
}: EmptyStateProps) {
  const Icon = iconMap[icon];

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {/* Icono/Ilustración */}
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-blue-500/10 rounded-full blur-xl"></div>
        <div className="relative bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 w-24 h-24 rounded-2xl flex items-center justify-center shadow-sm">
          <Icon className="w-10 h-10 text-blue-600 dark:text-blue-400" />
        </div>
      </div>

      {/* Título */}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {title}
      </h3>

      {/* Descripción */}
      {description && (
        <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-6">
          {description}
        </p>
      )}

      {/* Contenido personalizado */}
      {children}

      {/* Acciones */}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row items-center gap-3 mt-6">
          {action && (
            <button
              onClick={action.onClick}
              className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-5 rounded-xl transition-all shadow-lg shadow-blue-600/20 hover:scale-105 active:scale-95"
            >
              <Plus size={18} />
              <span>{action.label}</span>
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium text-sm hover:underline"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Variantes específicas
export function EmptyStores({ onCreate }: { onCreate: () => void }) {
  return (
    <EmptyState
      icon="store"
      title="No tienes sucursales registradas"
      description="Comienza agregando tu primera sucursal para poder recibir pagos y gestionar tus empleados."
      action={{ label: 'Crear sucursal', onClick: onCreate }}
    />
  );
}

export function EmptyEmployees({ onInvite }: { onInvite: () => void }) {
  return (
    <EmptyState
      icon="users"
      title="No tienes empleados registrados"
      description="Agrega empleados para que puedan gestionar tus sucursales y ver las alertas de pago."
      action={{ label: 'Invitar empleado', onClick: onInvite }}
    />
  );
}

export function EmptyExpenses({ onCreate }: { onCreate: () => void }) {
  return (
    <EmptyState
      icon="credit-card"
      title="No hay gastos registrados"
      description="Registra los gastos operativos de tus sucursales para llevar un control financiero completo."
      action={{ label: 'Registrar gasto', onClick: onCreate }}
    />
  );
}

export function EmptyTransactions({ onConfigure }: { onConfigure: () => void }) {
  return (
    <EmptyState
      icon="trending"
      title="No hay transacciones registradas"
      description="Cuando conectes tus pagos o registres gastos, aparecerán aquí automáticamente."
      action={{ label: 'Configurar pagos', onClick: onConfigure }}
    />
  );
}

export function EmptySearch({ onClear }: { onClear: () => void }) {
  return (
    <EmptyState
      icon="search"
      title="No se encontraron resultados"
      description="Intenta con otros términos de búsqueda o filtros diferentes."
      action={{ label: 'Limpiar filtros', onClick: onClear }}
    />
  );
}

export function EmptyReports({ onCreate }: { onCreate: () => void }) {
  return (
    <EmptyState
      icon="file-text"
      title="No hay datos para el período seleccionado"
      description="Selecciona otro rango de fechas o registra transacciones para generar reportes."
      secondaryAction={{ label: 'Ver todas las transacciones', onClick: onCreate }}
    />
  );
}
