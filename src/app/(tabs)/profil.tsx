import { useHousehold } from '@/lib/household';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

export default function Profil() {
  const { household } = useHousehold();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | undefined>();
  const [name, setName] = useState('');
  const [savedName, setSavedName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      setUserId(user.id);
      setEmail(user.email);

      const { data, error } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error(error);
        return;
      }
      setName(data.display_name ?? '');
      setSavedName(data.display_name ?? '');
    }
    load();
  }, []);

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Hoppla', 'Dein Name darf nicht leer sein.');
      return;
    }
    if (!userId) return;

    setSaving(true);
    const { error } = await supabase.from('profiles').update({ display_name: trimmed }).eq('id', userId);
    setSaving(false);

    if (error) {
      Alert.alert('Das hat nicht geklappt', error.message);
      return;
    }
    setName(trimmed);
    setSavedName(trimmed);
    Alert.alert('Gespeichert', 'Dein Name wurde aktualisiert.');
  }

  const hasChanges = name.trim() !== savedName;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Profil</Text>

      <Text style={styles.sectionTitle}>Dein Name</Text>
      <View style={styles.card}>
        <TextInput
          style={styles.input}
          placeholder="Wie sollen dich deine Mitbewohner sehen?"
          value={name}
          onChangeText={setName}
        />
        <Pressable
          style={[styles.button, (!hasChanges || saving) && styles.buttonDisabled]}
          onPress={saveName}
          disabled={!hasChanges || saving}
        >
          <Text style={styles.buttonText}>{saving ? 'Speichert…' : 'Speichern'}</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Account</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>E-Mail</Text>
          <Text style={styles.value}>{email}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>WG</Text>
          <Text style={styles.value}>{household?.name}</Text>
        </View>
      </View>

      <Pressable style={styles.logout} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.logoutText}>Abmelden</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFF8F0' },
  container: { padding: 24, paddingTop: 72 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#5C4033', marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#5C4033', marginBottom: 12 },
  card: { backgroundColor: 'white', borderRadius: 16, padding: 16, marginBottom: 32 },
  input: { backgroundColor: '#FFF8F0', borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 12 },
  button: { backgroundColor: '#E07A5F', borderRadius: 12, padding: 14, alignItems: 'center' },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  label: { fontSize: 15, color: '#8B6F5E' },
  value: { fontSize: 15, color: '#5C4033', fontWeight: '500', flexShrink: 1, textAlign: 'right' },
  logout: { padding: 16, alignItems: 'center' },
  logoutText: { color: '#E07A5F', fontSize: 16, fontWeight: '600' },
});