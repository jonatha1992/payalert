'use client';

import { useState, useEffect } from 'react';
import { Users, UserPlus, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import { useFormValidation } from '@/hooks/useFormValidation';
import { validationSchemas } from '@/lib/validation';
import { FormField } from '@/components/FormField';

    interface Employee {
        id: string;
        first_name: string;
        last_name: string;
        email: string;
        role: string;
        assigned_store_id?: string;
    }

    interface Store {
        id: string;
        name: string;
    }

    export default function EmployeesPage() {
        const { profile } = useAuth();
        const [employees, setEmployees] = useState<Employee[]>([]);
        const [stores, setStores] = useState<Store[]>([]);
        const [loading, setLoading] = useState(true);
        const [isModalOpen, setIsModalOpen] = useState(false);
        const employeeForm = useFormValidation(validationSchemas.employee, { first_name: '', last_name: '', email: '', password: '', assigned_store_id: '' });
        const { values: newEmployee, change, errorFor, submit, isValid, submitting: createLoading } = employeeForm;

        useEffect(() => {
            if (profile?.business_id) {
                fetchEmployees();
                fetchStores();
            }
        }, [profile]);

        const fetchStores = async () => {
            const { data } = await supabase.from('stores').select('id, name').eq('business_id', profile?.business_id);
            if (data) setStores(data);
        };

        const fetchEmployees = async () => {
            try {
                const { data, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('business_id', profile?.business_id)
                    .eq('role', 'employee');

                if (error) throw error;
                setEmployees(data || []);
            } catch (error) {
                console.error('Error fetching employees:', error);
            } finally {
                setLoading(false);
            }
        };

        const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);

        const openEditModal = (emp: Employee) => {
            change('first_name', emp.first_name); change('last_name', emp.last_name); change('email', emp.email);
            change('password', ''); change('assigned_store_id', emp.assigned_store_id || '');
            setEditingEmployeeId(emp.id);
            setIsModalOpen(true);
        };

        const handleSaveEmployee = async (e: React.FormEvent) => {
            await submit(e, async (normalized) => {
            try {
                if (editingEmployeeId) {
                    // Update
                    const { error } = await supabase
                        .from('users')
                        .update({
                            first_name: normalized.first_name,
                            last_name: normalized.last_name,
                            assigned_store_id: normalized.assigned_store_id || null
                        })
                        .eq('id', editingEmployeeId);

                    if (error) throw error;
                    toast.success('Empleado actualizado exitosamente');
                } else {
                    // Create
                    const { data: authData, error: authError } = await supabase.auth.signUp({
                        email: normalized.email,
                        password: normalized.password,
                        options: {
                            data: {
                                first_name: normalized.first_name,
                                last_name: normalized.last_name,
                                role: 'employee',
                                business_id: profile?.business_id
                            }
                        }
                    });

                    if (authError) throw authError;

                    if (authData.user) {
                        const { error: profileError } = await supabase
                            .from('users')
                            .insert([{
                                id: authData.user.id,
                                email: normalized.email,
                                first_name: normalized.first_name,
                                last_name: normalized.last_name,
                                role: 'employee',
                                business_id: profile?.business_id,
                                assigned_store_id: normalized.assigned_store_id || null, // New Field
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString()
                            }]);

                        if (profileError && profileError.code !== '23505') throw profileError;
                    }
                    toast.success('Empleado creado exitosamente');
                }

            await fetchEmployees();
            setIsModalOpen(false);
            change('first_name', ''); change('last_name', ''); change('email', ''); change('password', ''); change('assigned_store_id', '');
            setEditingEmployeeId(null);
        } catch (error: unknown) {
            console.error('Error saving employee:', error);
            toast.error(editingEmployeeId ? 'Error al actualizar: ' + (error instanceof Error ? error.message : 'Error desconocido') : 'Error al crear: ' + (error instanceof Error ? error.message : 'Error desconocido'));
        }
            });
        };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Empleados</h1>
                <button 
                    onClick={() => {
                        setEditingEmployeeId(null);
                        change('first_name', ''); change('last_name', ''); change('email', ''); change('password', ''); change('assigned_store_id', '');
                        setIsModalOpen(true);
                    }}
                    className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors shadow-lg shadow-blue-600/20 active:scale-95"
                >
                    <UserPlus size={20} />
                    <span>Agregar Empleado</span>
                </button>
            </div>
            
            {loading ? (
                 <div className="text-center py-10">Cargando...</div>
            ) : employees.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="bg-gray-100 dark:bg-gray-700 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                        <Users size={32} />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No tienes empleados registrados</h3>
                    <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                        Agrega empleados para que puedan gestionar tus sucursales y ver las alertas de pago.
                    </p>
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-900/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {employees.map((emp) => (
                                <tr key={emp.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold mr-3">
                                                {emp.first_name[0]}
                                            </div>
                                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                {emp.first_name} {emp.last_name}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                        {emp.email}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                            {emp.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                                        <button 
                                            className="text-blue-600 hover:text-blue-900 dark:hover:text-blue-400" 
                                            onClick={() => openEditModal(emp)}
                                        >
                                            Editar
                                        </button>
                                        <button 
                                            className="text-red-600 hover:text-red-900 dark:hover:text-red-400"
                                            onClick={async () => {
                                                if (confirm('¿Eliminar empleado? Perderá acceso inmediato.')) {
                                                    try {
                                                        const { error } = await supabase.from('users').delete().eq('id', emp.id);
                                                        if (error) throw error;
                                                        fetchEmployees();
                                                        toast.success('Empleado eliminado');
                                                    } catch (err: unknown) {
                                                        console.error(err);
                                                        toast.error('Error al eliminar: ' + (err instanceof Error ? err.message : 'Error desconocido'));
                                                    }
                                                }
                                            }}
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

            {/* Create/Edit Employee Modal */}
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
                            {editingEmployeeId ? 'Editar Empleado' : 'Nuevo Empleado'}
                        </h2>
                        
                        <form onSubmit={handleSaveEmployee} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <FormField label="Nombre" name="first_name" value={newEmployee.first_name} onChange={value => change('first_name', value)} onBlur={() => employeeForm.blur('first_name')} error={errorFor('first_name')} maxLength={100} required />
                                <FormField label="Apellido" name="last_name" value={newEmployee.last_name} onChange={value => change('last_name', value)} onBlur={() => employeeForm.blur('last_name')} error={errorFor('last_name')} maxLength={100} required />
                            </div>
                            <FormField label="Email" name="email" type="email" value={newEmployee.email} onChange={value => change('email', value)} onBlur={() => employeeForm.blur('email')} error={errorFor('email')} disabled={!!editingEmployeeId} required />
                            {!editingEmployeeId && <FormField label="Contraseña" name="password" type="password" value={newEmployee.password} onChange={value => change('password', value)} onBlur={() => employeeForm.blur('password')} error={errorFor('password')} autoComplete="new-password" required />}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sucursal Asignada</label>
                                <select
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
                                    value={newEmployee.assigned_store_id}
                                    onChange={e => change('assigned_store_id', e.target.value)}
                                >
                                    <option value="">-- Sin asignar --</option>
                                    {stores.map(store => (
                                        <option key={store.id} value={store.id}>{store.name}</option>
                                    ))}
                                </select>
                            </div>

                            <button 
                                type="submit"
                                disabled={!isValid || createLoading}
                                className="w-full mt-6 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
                            >
                                {createLoading ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" /> : (editingEmployeeId ? 'Guardar Cambios' : 'Crear Empleado')}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
