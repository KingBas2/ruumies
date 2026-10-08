import { useHousehold } from '@/lib/household';
import { supabase } from '@/lib/supabase';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export default function Onboarding() {
  const { refresh } = useHousehold();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!input.trim()) {
      Alert.alert('Hoppla', mode === 'create' ? 'Bitte gib einen WG-Namen ein.' : 'Bitte gib einen Code ein.');
      return;
    }

    setLoading(true);
    const { error } =
      mode === 'create'
        ? await supabase.rpc('create_household', { household_name: input })
        : await supabase.rpc('join_household', { code: input });
    setLoading(false);

    if (error) {
      Alert.alert('Das hat nicht geklappt', error.message);
      return;
    }

    await refresh(); // WG neu laden → Layout zeigt automatisch die Startseite
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Willkommen bei ruumies 🏠</Text>
      <Text style={styles.subtitle}>Lass uns deine WG einrichten.</Text>

      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, mode === 'create' && styles.tabActive]}
          onPress={() => { setMode('create'); setInput(''); }}
        >
          <Text style={[styles.tabText, mode === 'create' && styles.tabTextActive]}>WG erstellen</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, mode === 'join' && styles.tabActive]}
          onPress={() => { setMode('join'); setInput(''); }}
        >
          <Text style={[styles.tabText, mode === 'join' && styles.tabTextActive]}>WG beitreten</Text>
        </Pressable>
      </View>

      <TextInput
        style={styles.input}
        placeholder={mode === 'create' ? 'Name eurer WG, z. B. „Sonnenhof“' : 'Einladungscode, z. B. A3F9C1'}
        autoCapitalize={mode === 'join' ? 'characters' : 'sentences'}
        value={input}
        onChangeText={setInput}
      />

      <Pressable style={styles.button} onPress={submit} disabled={loading}>
        <Text style={styles.buttonText}>
          {loading ? 'Einen Moment…' : mode === 'create' ? 'WG erstellen' : 'Beitreten'}
        </Text>
      </Pressable>

      <Pressable style={styles.logout} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.logoutText}>Abmelden</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#FFF8F0' },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', color: '#5C4033' },
  subtitle: { fontSize: 16, textAlign: 'center', color: '#8B6F5E', marginTop: 8, marginBottom: 32 },
  tabs: { flexDirection: 'row', backgroundColor: '#F2E6DA', borderRadius: 12, padding: 4, marginBottom: 16 },
  tab: { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: 'white' },
  tabText: { color: '#8B6F5E', fontWeight: '500' },
  tabTextActive: { color: '#5C4033', fontWeight: '700' },
  input: { backgroundColor: 'white', borderRadius: 12, padding: 14, marginBottom: 12, fontSize: 16 },
  button: { backgroundColor: '#E07A5F', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  logout: { padding: 16, alignItems: 'center', marginTop: 8 },
  logoutText: { color: '#8B6F5E', fontSize: 15 },
});