import { useDialog } from '@/lib/dialog';
import { supabase } from '@/lib/supabase';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export default function Login() {
  const dialog = useDialog();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  function inputsValid() {
    if (!email.trim() || !password) {
      dialog.alert('Hoppla', 'Bitte gib deine E-Mail-Adresse und ein Passwort ein.');
      return false;
    }
    return true;
  }

  async function signIn() {
    if (!inputsValid()) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) dialog.alert('Anmeldung fehlgeschlagen', error.message);
  }

  async function signUp() {
    if (!inputsValid()) return;
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email: email.trim(), password });
    setLoading(false);
    if (error) dialog.alert('Registrierung fehlgeschlagen', error.message);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ruumies 🏠</Text>
      <TextInput
        style={styles.input}
        placeholder="E-Mail"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Passwort"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Pressable style={[styles.button, loading && styles.disabled]} onPress={signIn} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Einen Moment…' : 'Anmelden'}</Text>
      </Pressable>
      <Pressable style={styles.secondary} onPress={signUp} disabled={loading}>
        <Text style={styles.secondaryText}>Neu hier? Registrieren</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#FFF8F0' },
  title: { fontSize: 36, fontWeight: 'bold', textAlign: 'center', marginBottom: 32, color: '#5C4033' },
  input: { backgroundColor: 'white', borderRadius: 12, padding: 14, marginBottom: 12, fontSize: 16 },
  button: { backgroundColor: '#E07A5F', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  disabled: { opacity: 0.6 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  secondary: { padding: 16, alignItems: 'center' },
  secondaryText: { color: '#5C4033', fontSize: 15 },
});