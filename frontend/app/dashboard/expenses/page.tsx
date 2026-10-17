'use client';

import { useState, useEffect } from 'react';
import { DollarSign, Plus, X, Calendar, MapPin, Tag } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import { useFormValidation } from '@/hooks/useFormValidation';
import { validationSchemas } from '@/lib/validation';
import { FormField } from '@/components/FormField';

interface Transaction {
    id: string;
    amount: number;
    category: string;
    description: string;
    created_at: string;
    store_id: string;
    store?: { name: string };
}

interface Store {
    id: string;
    name: string;
}

export default function ExpensesPage() {
    const { profile } = useAuth();
    const [expenses, setExpenses] = useState<Transaction[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const expenseForm = useFormValidation(validationSchemas.expense, { amount: '', category: 'Insumos', description: '', store_id: '' });
    const { values: newExpense, change, errorFor, submit, isValid, submitting: createLoading } = expenseForm;

    const CATEGORIES = ['Insumos', 'Mantenimiento', 'Salarios', 'Alquiler', 'Servicios', 'Otros'];

    useEffect(() => {
        if (profile?.business_id) {
            fetchData();
        }
    }, [profile]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [expensesRes, storesRes] = await Promise.all([
                supabase
                    .from('transactions')
                    .select('*, store:stores(name)')
                    .eq('business_id', profile?.business_id)
                    .eq('type', 'expense')
                    .order('created_at', { ascending: false }),
                supabase
                    .from('stores')
                    .select('id, name')
                    .eq('business_id', profile?.business_id)
            ]);

            if (expensesRes.error) throw expensesRes.error;
            if (storesRes.error) throw storesRes.error;

            setExpenses(expensesRes.data || []);
            setStores(storesRes.data || []);
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Error al cargar gastos');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateExpense = async (e: React.FormEvent) => {
        await submit(e, async (normalized) => {
        try {
            const { error } = await supabase
                .from('transactions')
                .insert([{
                    business_id: profile?.business_id,
                    store_id: normalized.store_id || null, // Optional if generic expense
                    type: 'expense',
                    category: normalized.category,
                    description: normalized.description,
                    amount: normalized.amount,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }]);

            if (error) throw error;

            toast.success('Gasto registrado exitosamente');
            setIsModalOpen(false);
            change('amount', ''); change('category', 'Insumos'); change('description', ''); change('store_id', '');
            fetchData();
        } catch (error: unknown) {
            console.error('Error creating expense:', error);
            toast.error('Error al registrar gasto: ' + (error instanceof Error ? error.message : 'Error desconocido'));
        }
        });
    };

    const handleDeleteExpense = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este gasto?')) return;

        try {
            const { error } = await supabase.from('transactions').delete().eq('id', id);
            if (error) throw error;
            toast.success('Gasto eliminado');
            fetchData();
        } catch (error: unknown) {
            console.error(error);
            toast.error('Error al eliminar gasto');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Gastos</h1>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors shadow-lg shadow-red-600/20 active:scale-95"
                >
                    <Plus size={20} />
                    <span>Registrar Gasto</span>
                </button>
            </div>

            {loading ? (
                <div className="text-center py-10">Cargando...</div>
            ) : expenses.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="bg-red-100 dark:bg-red-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                        <DollarSign size={32} />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No hay gastos registrados</h3>
                    <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                        Registra los gastos operativos de tus sucursales para llevar un control financiero.
                    </p>
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-900/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sucursal</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {expenses.map((expense) => (
                                <tr key={expense.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                        <div className="flex items-center">
                                            <Calendar size={16} className="mr-2 text-gray-400" />
                                            {new Date(expense.created_at).toLocaleDateString()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-medium">
                                        {expense.description}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                        {expense.store?.name ? (
                                            <span className="flex items-center">
                                                <MapPin size={14} className="mr-1 text-gray-400" />
                                                {expense.store.name}
                                            </span>
                                        ) : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                                            {expense.category}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-red-600 dark:text-red-400">
                                        -${expense.amount.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button 
                                            onClick={() => handleDeleteExpense(expense.id)}
                                            className="text-red-600 hover:text-red-900 dark:hover:text-red-400 transition-colors"
                                        >
                                            Eliminar
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create Expense Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 relative shadow-xl">
                        <button 
                            onClick={() => setIsModalOpen(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                            <X size={24} />
                        </button>
                        
                        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
                            Registrar Nuevo Gasto
                        </h2>
                        
                        <form onSubmit={handleCreateExpense} className="space-y-4">
                            <FormField label="Monto" name="amount" type="number" value={newExpense.amount} onChange={value => change('amount', value)} onBlur={() => expenseForm.blur('amount')} error={errorFor('amount')} step="0.01" placeholder="0.00" required />
                            <FormField label="Descripción" name="description" value={newExpense.description} onChange={value => change('description', value)} onBlur={() => expenseForm.blur('description')} error={errorFor('description')} maxLength={500} placeholder="Ej: Compra de insumos limpieza" required />

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categoría</label>
                                    <div className="relative">
                                        <Tag size={18} className="absolute left-3 top-2.5 text-gray-400" />
                                        <select
                                            className="pl-10 w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-red-500 appearance-none"
                                            value={newExpense.category}
                                            onChange={e => change('category', e.target.value)}
                                        >
                                            {CATEGORIES.map(cat => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sucursal</label>
                                    <div className="relative">
                                        <MapPin size={18} className="absolute left-3 top-2.5 text-gray-400" />
                                        <select
                                            className="pl-10 w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-red-500 appearance-none"
                                            value={newExpense.store_id}
                                            onChange={e => change('store_id', e.target.value)}
                                        >
                                            <option value="">General</option>
                                            {stores.map(store => (
                                                <option key={store.id} value={store.id}>{store.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <button 
                                type="submit"
                                disabled={!isValid || createLoading}
                                className="w-full mt-6 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center shadow-lg shadow-red-600/20"
                            >
                                {createLoading ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" /> : 'Registrar Gasto'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
