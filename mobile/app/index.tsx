import { useEffect, useState } from 'react';
import { ActivityIndicator, Button, ScrollView, Text, View } from 'react-native';
import { supabase } from '../src/auth';
import { createApiClient } from '../src/api/client';
import type { ExpectedPaymentsResponse, IntegrationsResponse, MovementsResponse } from '../src/api/types';

const request = createApiClient(process.env.EXPO_PUBLIC_API_BASE_URL ?? '', async () => (await supabase.auth.getSession()).data.session?.access_token ?? null);

type Snapshot = { movements: MovementsResponse; expected: ExpectedPaymentsResponse; integrations: IntegrationsResponse };
export default function HomeScreen() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const refresh = async () => {
    setBusy(true); setError(null);
    try {
      const [movements, expected, integrations] = await Promise.all([
        request<MovementsResponse>('/api/reports/movements?page=1&pageSize=5'),
        request<ExpectedPaymentsResponse>('/api/expected-payments'),
        request<IntegrationsResponse>('/api/integrations'),
      ]);
      setSnapshot({ movements, expected, integrations });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudieron cargar los datos.'); }
    finally { setBusy(false); }
  };
  useEffect(() => { void refresh(); }, []);
  return <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
    <Text style={{ fontSize: 24, fontWeight: '700' }}>Inicio</Text>
    <Text>Datos consultados a la API autenticada; el alcance y los valores los determina el servidor.</Text>
    <Button title="Actualizar" onPress={() => void refresh()} />
    {busy && <ActivityIndicator />}{error && <Text accessibilityRole="alert">{error}</Text>}
    {snapshot && <View style={{ gap: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: '600' }}>Movimientos recientes</Text>
      {snapshot.movements.transactions.length === 0 ? <Text>Sin movimientos.</Text> : snapshot.movements.transactions.map((item) => <Text key={item.id}>{item.description} · {item.amount} {item.currency} · {item.created_at}</Text>)}
      <Text style={{ fontSize: 18, fontWeight: '600' }}>Cobros esperados</Text>
      {snapshot.expected.expectedPayments.length === 0 ? <Text>Sin cobros esperados.</Text> : snapshot.expected.expectedPayments.map((item) => <Text key={item.id}>{item.reference ?? 'Cobro'} · {item.status}</Text>)}
      <Text style={{ fontSize: 18, fontWeight: '600' }}>Integraciones</Text>
      {snapshot.integrations.connections.length === 0 ? <Text>Sin integraciones.</Text> : snapshot.integrations.connections.map((item) => <Text key={item.id}>{item.label ?? item.provider} · {item.status}</Text>)}
    </View>}
    <Button title="Cerrar sesión" onPress={() => { void supabase.auth.signOut(); }} />
  </ScrollView>;
}
