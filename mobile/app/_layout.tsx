import { Tabs, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { currentSession, supabase } from '../src/auth';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let alive = true;
    currentSession().then((session) => { if (alive) { setSignedIn(Boolean(session)); setReady(true); } });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session)));
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const authRoute = segments[0] === '(auth)';
    if (!signedIn && !authRoute) router.replace('/login');
    if (signedIn && authRoute) router.replace('/');
  }, [ready, signedIn, segments, router]);
  if (!ready) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>;
  return <SafeAreaProvider><StatusBar style="auto" /><Tabs screenOptions={{ headerShown: true }}><Tabs.Screen name="(tabs)" options={{ href: null }} /><Tabs.Screen name="index" options={{ title: 'Inicio' }} /><Tabs.Screen name="notifications" options={{ title: 'Notificaciones' }} /><Tabs.Screen name="(auth)" options={{ href: null }} /></Tabs></SafeAreaProvider>;
}
