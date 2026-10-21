'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { FormField } from '@/components/FormField';
import { useFormValidation } from '@/hooks/useFormValidation';
import { validationSchemas } from '@/lib/validation';

export default function EditBusinessPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const form = useFormValidation(validationSchemas.settings, { name: '' });
    const { values, change, errorFor, submit, isValid, submitting } = form;
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        const fetchBusiness = async () => {
            try {
                const { data, error } = await supabase
                    .from('businesses')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) throw error;
                if (data) {
                    change('name', data.name);
                }
            } catch (err: any) {
                setError("Error al cargar el negocio: " + err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchBusiness();
    }, [id]);

    const handleSubmit = async (e: React.FormEvent) => {
        setError(null);
        await submit(e, async (normalized) => {
            setSaving(true);
            try {
                const { error } = await supabase
                    .from('businesses')
                    .update({ name: normalized.name })
                    .eq('id', id);

                if (error) throw error;

                router.push('/admin/businesses');
            } catch (err: any) {
                setError(err.message);
            } finally {
                setSaving(false);
            }
        });
    };

    if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin inline text-blue-600" /></div>;

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Editar Negocio</h1>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <FormField label="Nombre del Negocio" name="business-name" value={values.name} onChange={value => change('name', value)} onBlur={() => form.blur('name')} error={errorFor('name')} maxLength={160} required />
                    </div>

                    <div className="text-xs text-gray-500 dark:text-gray-400">
                        ID: <span className="font-mono">{id}</span>
                    </div>

                    {error && (
                        <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                            {error}
                        </div>
                    )}

                    <div className="flex justify-end space-x-3 pt-4">
                        <Link
                            href="/admin/businesses"
                            className="px-4 py-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                            Cancelar
                        </Link>
                        <button
                            type="submit"
                            disabled={!isValid || saving || submitting}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving && <Loader2 className="animate-spin" size={18} />}
                            <span>Guardar Cambios</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
