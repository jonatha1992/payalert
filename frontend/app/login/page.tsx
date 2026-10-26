'use client';





import { useCallback, useEffect, useRef, useState, Suspense } from 'react';


import Script from 'next/script';


import { useSearchParams } from 'next/navigation';


import { supabase } from '@/lib/supabaseClient';


import { Loader2, Mail, Lock } from 'lucide-react';


import { useFormValidation } from '@/hooks/useFormValidation';


import { validationSchemas } from '@/lib/validation';


import { FormField } from '@/components/FormField';
import AppVersion from '@/components/AppVersion';


import { generateNonce, googleLoginError, sha256Hex, shouldUseGoogleIdentity, type GoogleIdentityWindow } from '@/lib/googleIdentity';





const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;


const useGoogleIdentity = shouldUseGoogleIdentity(googleClientId);





const loginErrors: Record<string, string> = {


    signup_not_allowed: 'Tu correo no está habilitado para crear una cuenta. Consultá con tu administrador.',


    oauth_callback_failed: 'No pudimos completar el ingreso con Google. Probá de nuevo.',


    password_reset: 'Tu contraseña se actualizó. Ya podés ingresar.',


};





export default function LoginPage() {


    return <Suspense fallback={<div className="min-h-screen bg-gray-100 dark:bg-gray-900" />}><LoginForm /></Suspense>;


}





function LoginForm() {


    const searchParams = useSearchParams();


    const loginForm = useFormValidation(validationSchemas.login, { email: '', password: '' });


    const { values, change, errorFor, submit, isValid, submitting } = loginForm;


    const [loading, setLoading] = useState(false);


    const [googleLoading, setGoogleLoading] = useState(false);


    const [gisReady, setGisReady] = useState(false);


    const [gisFailed, setGisFailed] = useState(false);


    const googleButtonRef = useRef<HTMLDivElement>(null);


    const [error, setError] = useState<string | null>(null);





    useEffect(() => {


        // Al volver atrás desde Google el navegador restaura la página con el spinner colgado.


        const reset = (e: PageTransitionEvent) => { if (e.persisted) setGoogleLoading(false); };


        window.addEventListener('pageshow', reset);


        return () => window.removeEventListener('pageshow', reset);


    }, []);





    const handleLogin = async (e: React.FormEvent) => {


        await submit(e, async (normalized) => {


        setLoading(true);


        setError(null);





        try {


            const { error } = await supabase.auth.signInWithPassword({


                email: normalized.email,


                password: normalized.password,


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


            setError(err instanceof Error ? err.message : 'No pudimos iniciar sesión. Revisá tus datos e intentá de nuevo.');


        } finally {


            setLoading(false);


        }


        });


    };





    const handleGoogleFailure = useCallback(() => {


        setError(googleLoginError());


        setGoogleLoading(false);


    }, []);





    const completeGoogleLogin = useCallback(async (credential: string, nonce: string) => {


        try {


            const { error: authError } = await supabase.auth.signInWithIdToken({ provider: 'google', token: credential, nonce });


            if (authError) { handleGoogleFailure(); return; }


            window.location.href = '/dashboard';


        } catch {


            handleGoogleFailure();


        }


    }, [handleGoogleFailure]);





    useEffect(() => {


        const gisWindow = window as GoogleIdentityWindow;


        if (!useGoogleIdentity || !gisReady || !googleButtonRef.current || !gisWindow.google?.accounts.id) return;


        let active = true;


        const initialize = async () => {


            const nonce = generateNonce();


            const hashedNonce = await sha256Hex(nonce);


            if (!active || !googleClientId || !googleButtonRef.current || !gisWindow.google?.accounts.id) return;


            gisWindow.google.accounts.id.initialize({


                client_id: googleClientId,


                nonce: hashedNonce,


                use_fedcm_for_prompt: true,


                callback: (response) => {


                    if (!response.credential) { handleGoogleFailure(); return; }


                    setGoogleLoading(true);


                    setError(null);


                    void completeGoogleLogin(response.credential, nonce);


                },


            });


            gisWindow.google.accounts.id.renderButton(googleButtonRef.current, {


                type: 'standard', theme: 'outline', size: 'large', text: 'continue_with',


                shape: 'rectangular', width: Math.min(googleButtonRef.current.clientWidth, 400), locale: 'es',


            });


        };


        void initialize().catch(handleGoogleFailure);


        return () => { active = false; };


    }, [completeGoogleLogin, gisReady, handleGoogleFailure]);





    const handleOAuthFallback = async () => {


        setGoogleLoading(true);


        setError(null);


        try {


            const { error: authError } = await supabase.auth.signInWithOAuth({


                provider: 'google',


                options: { redirectTo: `${window.location.origin}/auth/callback` },


            });


            if (authError) handleGoogleFailure();


        } catch {


            handleGoogleFailure();


        }


    };





    return (


        <>


            {useGoogleIdentity && <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={() => setGisReady(true)} onError={() => setGisFailed(true)} />}


            <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col items-center justify-center p-4">


            <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700">


                <div className="p-8">


                    <div className="flex flex-col items-center mb-8">


                        {/* eslint-disable-next-line @next/next/no-img-element */}


                        <img src="/icon-512x512.png" alt="" width={56} height={56} className="h-14 w-14 rounded-2xl shadow-md mb-4" />


                        <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white">Ingresá a PayAlert</h1>


                        <p className="mt-1 text-sm text-center text-gray-500 dark:text-gray-400">Controlá los cobros de tu negocio en tiempo real</p>


                    </div>


                    {searchParams.get('password_reset') === 'success' && (


                        <div role="status" className="bg-green-50 text-green-700 text-sm p-3 rounded-lg mb-4 dark:bg-green-900/30 dark:text-green-300">Tu contraseña se actualizó. Ya podés ingresar.</div>


                    )}


                    {loginErrors[searchParams.get('error') ?? ''] && (


                        <div role="alert" className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{loginErrors[searchParams.get('error') ?? '']}</div>


                    )}





                    {useGoogleIdentity && !gisFailed && <div ref={googleButtonRef} aria-busy={googleLoading} className="w-full min-h-11 flex justify-center overflow-hidden" />}


                    {(!useGoogleIdentity || gisFailed) && <button


                        type="button"


                        onClick={handleOAuthFallback}


                        disabled={googleLoading || loading}


                        aria-label="Continuar con Google"


                        className="w-full min-h-11 flex justify-center items-center gap-3 py-3 px-4 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"


                    >


                        {googleLoading ? <Loader2 aria-hidden="true" className="animate-spin h-5 w-5" /> : (


                            <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5 shrink-0">


                                <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z" />


                                <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4 1.9-6.9 1.9-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z" />


                                <path fill="#FBBC05" d="M12.6 27.5a12 12 0 0 1 0-7v-5.3H5.8a20 20 0 0 0 0 17.6l6.8-5.3Z" />


                                <path fill="#EA4335" d="M24 12.1c3 0 5.7 1 7.8 3.1l5.9-5.9C34.1 6.1 29.5 4 24 4A20 20 0 0 0 5.8 15.2l6.8 5.3c1.6-4.8 6.1-8.4 11.4-8.4Z" />


                            </svg>


                        )}


                        {googleLoading ? 'Conectando con Google…' : 'Continuar con Google'}


                    </button>}


                    {useGoogleIdentity && !gisReady && !gisFailed && <div aria-live="polite" className="sr-only">Cargando Google…</div>}


                    <div aria-hidden="true" className="my-6 flex items-center gap-4 text-xs font-medium text-gray-500 dark:text-gray-400">


                        <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />


                        <span>o</span>


                        <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />


                    </div>


                    <form onSubmit={handleLogin} className="space-y-6">


                        <FormField label="Correo Electrónico" name="email" type="email" autoComplete="email" value={values.email} onChange={value => change('email', value)} onBlur={() => loginForm.blur('email')} error={errorFor('email')} placeholder="usuario@ejemplo.com" required icon={<Mail className="h-5 w-5" />} />





                        <FormField label="Contraseña" name="password" type="password" autoComplete="current-password" value={values.password} onChange={value => change('password', value)} onBlur={() => loginForm.blur('password')} error={errorFor('password')} placeholder="••••••••" required icon={<Lock className="h-5 w-5" />} />



                        <div className="-mt-4 text-right"><a href="/forgot-password" className="text-sm font-medium text-blue-600 underline underline-offset-4 hover:text-blue-700 dark:text-blue-400">¿Olvidaste tu contraseña?</a></div>





                        {error && (


                            <div role="alert" className="bg-red-50 text-red-700 text-sm p-3 rounded-lg flex items-start">


                                <span className="font-medium mr-1">Error:</span> {error}


                            </div>


                        )}





                        <button


                            type="submit"


                            disabled={!isValid || submitting || loading || googleLoading}


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


                        ¿Necesitás acceso? Escribinos a tecnofusion.it@gmail.com


                    </p>


                </div>


            </div>


            <nav aria-label="Páginas legales" className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-medium">


                <a href="/privacidad" className="text-gray-500 underline underline-offset-4 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white">Privacidad</a>


                <a href="/terminos" className="text-gray-500 underline underline-offset-4 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white">Términos del servicio</a>


            </nav>
            <AppVersion />


            </div>


        </>


    );


}


