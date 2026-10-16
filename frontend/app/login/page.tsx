'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, Mail, Lock } from 'lucide-react';

const loginErrors: Record<string, string> = {
    signup_not_allowed: 'No autorizado: tu correo no está habilitado para crear una cuenta.',
    oauth_callback_failed: 'No se pudo completar el inicio de sesión con Google. Inténtalo de nuevo.',
};

export default function LoginPage() {
    return <Suspense fallback={<div className="min-h-screen bg-gray-100 dark:bg-gray-900" />}><LoginForm /></Suspense>;
}

function LoginForm() {
    const searchParams = useSearchParams();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            // Obtenemos el perfil para saber a dónde redirigir
            const { data: profile } = await supabase
                .from('users')
                .select('role')
                .eq('id', (await supabase.auth.getUser()).data.user?.id)
                .single();

            if (profile?.role === 'admin') {
                window.location.href = '/admin';
            } else {
                window.location.href = '/dashboard';
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setGoogleLoading(true);
        setError(null);
        const { error: authError } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${window.location.origin}/auth/callback` },
        });
        if (authError) {
            setError('No se pudo iniciar sesión con Google. Inténtalo de nuevo.');
            setGoogleLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                <div className="p-8">
                    <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-2">Bienvenido</h2>
                    <p className="text-center text-gray-500 dark:text-gray-400 mb-8">Inicia sesión para gestionar tu negocio</p>
                    {loginErrors[searchParams.get('error') ?? ''] && (
                        <div role="alert" className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{loginErrors[searchParams.get('error') ?? '']}</div>
                    )}

                    <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={googleLoading || loading}
                        className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                    >
                        {googleLoading ? <Loader2 className="animate-spin h-5 w-5" /> : 'G'}
                        Entrar con Google
                    </button>
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Correo Electrónico</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                                    placeholder="usuario@ejemplo.com"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contraseña</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-start">
                                <span className="font-medium mr-1">Error:</span> {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || googleLoading}
                            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading || googleLoading ? (
                                <Loader2 className="animate-spin h-5 w-5" />
                            ) : (
                                'Ingresar'
                            )}
                        </button>
                    </form>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 px-8 py-4 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                        ¿No tienes una cuenta? Contacta a tu administrador.
                    </p>
                </div>
            </div>
        </div>
    );
}
