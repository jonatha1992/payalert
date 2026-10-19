'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

interface Profile {
    id: string;
    role: 'admin' | 'owner' | 'employee';
    business_id: string;
    first_name: string;
    last_name: string;
    email?: string;
    assigned_store_id?: string;
}

interface AuthContextType {
    user: User | null;
    session: Session | null;
    profile: Profile | null;
    loading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    session: null,
    profile: null,
    loading: true,
    signOut: async () => { },
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        let inFlightFor: string | null = null;
        const fetchProfile = async (userId: string, email?: string) => {
            // getSession() e INITIAL_SESSION disparan esto a la vez; una sola consulta por usuario.
            if (inFlightFor === userId) return;
            inFlightFor = userId;
            console.log('[Auth] Fetching profile for:', userId);
            try {
                const { data, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', userId)
                    .single();

                if (error) {
                    setProfile(null);
                    return;
                }
                setProfile({ ...data, email: email ?? '' });
            } catch (err: unknown) {
                console.error('[Auth] Catch error fetching profile:', err);
                
                // If it's a critical RLS or schema error (like recursion), force logout to break the loop
                if (err instanceof Error && (err.message.includes('infinite recursion') || err.message.includes('policy'))) {
                    console.error('[Auth] Critical DB error detected. Forcing logout.');
                    await supabase.auth.signOut();
                    router.push('/login');
                }
                
                setProfile(null);
            } finally {
                inFlightFor = null;
                setLoading(false);
            }
        };

        const initializeAuth = async () => {
            const { data: { session: initialSession } } = await supabase.auth.getSession();
            setSession(initialSession);
            setUser(initialSession?.user ?? null);
            
            if (initialSession?.user) {
                await fetchProfile(initialSession.user.id, initialSession.user.email);
            } else {
                setLoading(false);
            }
        };

        initializeAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                setSession(session);
                setUser(session?.user ?? null);
                
                if (session?.user) {
                    // No esperar dentro del callback: supabase-js retiene un lock y la consulta se auto-bloquea.
                    setTimeout(() => { void fetchProfile(session.user.id, session.user.email); }, 0);
                } else {
                    setProfile(null);
                    setLoading(false);
                }
            }
        );

        return () => subscription.unsubscribe();
    }, [router]);

    const signOut = async () => {
        setProfile(null);
        await supabase.auth.signOut();
        router.push('/');
    };

    return (
        <AuthContext.Provider value={{ user, session, profile, loading, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
