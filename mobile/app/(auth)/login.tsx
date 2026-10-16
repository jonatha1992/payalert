import { useState } from 'react';
import { Alert, Button, Text, TextInput, View } from 'react-native';
import { supabase } from '../../src/auth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const signIn = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
    } catch (error) { Alert.alert('No se pudo iniciar sesión', error instanceof Error ? error.message : 'Error desconocido.'); }
    finally { setBusy(false); }
  };
  return <View style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 16 }}>
    <Text style={{ fontSize: 28, fontWeight: '700' }}>PayAlert</Text>
    <Text>Inicia sesión con tu cuenta.</Text>
    <TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="Correo electrónico" value={email} onChangeText={setEmail} style={{ borderWidth: 1, borderColor: '#aaa', borderRadius: 8, padding: 12 }} />
    <TextInput secureTextEntry autoComplete="password" placeholder="Contraseña" value={password} onChangeText={setPassword} style={{ borderWidth: 1, borderColor: '#aaa', borderRadius: 8, padding: 12 }} />
    <Button title={busy ? 'Ingresando…' : 'Iniciar sesión'} disabled={busy || !email || !password} onPress={() => void signIn()} />
  </View>;
}
