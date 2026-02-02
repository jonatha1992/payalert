'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function EditBusinessPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [name, setName] = useState('');
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
                    setName(data.name);
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
        e.preventDefault();
        setSaving(true);
        setError(null);

        try {
            const { error } = await supabase
                .from('businesses')
                .update({ name })
                .eq('id', id);

            if (error) throw error;

            router.push('/admin/businesses');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin inline text-blue-600" /></div>;

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Editar Negocio</h1>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre del Negocio</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            required
                        />
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
                            disabled={saving}
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
