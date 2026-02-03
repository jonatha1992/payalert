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
        const fetchProfile = async (userId: string) => {
            console.log('[Auth] Fetching profile for:', userId);
            try {
                const { data, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', userId)
                    .single();

                if (error) {
                    // Try to create profile if it doesn't exist
                    if (error.code === 'PGRST116') {
                        console.log('[Auth] Profile not found, creating new profile...');
                        const { data: { user } } = await supabase.auth.getUser();
                        
                        if (user) {
                            let role: 'admin' | 'owner' | 'employee' = 'owner';
                            
                            // Hardcode the specific admin email for now, or use a better heuristic/metadata
                            if (user.email === 'jonny.correa@gmail.com' || user.email === 'admin@payalert.com') {
                                role = 'admin';
                            } else if (user.user_metadata?.role) {
                                role = user.user_metadata.role;
                            }

                            const newProfile = {
                                id: userId,
                                email: user.email,
                                role: role, 
                                first_name: user.user_metadata?.first_name || '',
                                last_name: user.user_metadata?.last_name || '',
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString()
                            };

                            const { data: createdProfile, error: createError } = await supabase
                                .from('users')
                                .insert([newProfile])
                                .select()
                                .single();
                            
                            if (createError) {
                                console.error('[Auth] Error creating profile:', createError);
                                throw createError;
                            }
                            
                            console.log('[Auth] Profile created:', createdProfile);
                            setProfile(createdProfile);
                            return;
                        }
                    }
                    console.error('[Auth] Error fetching profile:', error.message, error.details);
                    throw error;
                }
                console.log('[Auth] Profile fetched:', data);
                setProfile(data);
            } catch (err: any) {
                console.error('[Auth] Catch error fetching profile:', err);
                
                // If it's a critical RLS or schema error (like recursion), force logout to break the loop
                if (err.message?.includes('infinite recursion') || err.message?.includes('policy')) {
                    console.error('[Auth] Critical DB error detected. Forcing logout.');
                    await supabase.auth.signOut();
                    router.push('/login');
                }
                
                setProfile(null);
            } finally {
                setLoading(false);
            }
        };

        const initializeAuth = async () => {
            const { data: { session: initialSession } } = await supabase.auth.getSession();
            setSession(initialSession);
            setUser(initialSession?.user ?? null);
            
            if (initialSession?.user) {
                await fetchProfile(initialSession.user.id);
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
                    await fetchProfile(session.user.id);
                } else {
                    setProfile(null);
                    setLoading(false);
                }
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    const signOut = async () => {
        setProfile(null);
        await supabase.auth.signOut();
        router.push('/login');
    };

    return (
        <AuthContext.Provider value={{ user, session, profile, loading, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
