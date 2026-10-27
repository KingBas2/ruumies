import { useDialog } from '@/lib/dialog';
import { useHousehold } from '@/lib/household';
import { unregisterPushNotifications } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

type PrefKey = 'notify_news' | 'notify_rotation' | 'notify_expenses' | 'notify_events';

const PREF_OPTIONS: { key: PrefKey; label: string; hint: string }[] = [
  { key: 'notify_news', label: '📌 Pinnwand', hint: 'Neue Beiträge deiner Mitbewohner' },
  { key: 'notify_rotation', label: '🧹 Putzplan', hint: 'Am Vorabend, wenn du dran bist' },
  { key: 'notify_expenses', label: '💸 Ausgaben', hint: 'Wenn jemand etwas für dich mit eingetragen hat' },
  { key: 'notify_events', label: '📅 Termine', hint: 'Neue gemeinsame Termine' },
];

export default function Profil() {
  const { household } = useHousehold();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | undefined>();
  const [name, setName] = useState('');
  const [savedName, setSavedName] = useState('');
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<Record<PrefKey, boolean> | null>(null);
  const dialog = useDialog();

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      setUserId(user.id);
      setEmail(user.email);

      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, notify_news, notify_rotation, notify_expenses, notify_events')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error(error);
        return;
      }
      setName(data.display_name ?? '');
      setSavedName(data.display_name ?? '');
      setPrefs({
        notify_news: data.notify_news,
        notify_rotation: data.notify_rotation,
        notify_expenses: data.notify_expenses,
        notify_events: data.notify_events,
      });
    }
    load();
  }, []);

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed) {
      dialog.alert('Hoppla', 'Dein Name darf nicht leer sein.');
      return;
    }
    if (!userId) return;

    setSaving(true);
    const { error } = await supabase.from('profiles').update({ display_name: trimmed }).eq('id', userId);
    setSaving(false);

    if (error) {
      dialog.alert('Das hat nicht geklappt', error.message);
      return;
    }
    setName(trimmed);
    setSavedName(trimmed);
    dialog.alert('Gespeichert', 'Dein Name wurde aktualisiert.');
  }

    function shareCode() {
    if (!household) return;
    Share.share({
      message: `Komm in unsere WG „${household.name}“ auf ruumies! Einladungscode: ${household.invite_code}`,
    });
  }

  async function togglePref(key: PrefKey, value: boolean) {
    if (!userId || !prefs) return;
    setPrefs({ ...prefs, [key]: value }); // sofort umschalten
    const { error } = await supabase.from('profiles').update({ [key]: value }).eq('id', userId);
    if (error) {
      setPrefs({ ...prefs, [key]: !value }); // zurückdrehen
      dialog.alert('Das hat nicht geklappt', error.message);
    }
  }

  function confirmLogout() {
    dialog.confirm({
      title: 'Abmelden?',
      message: 'Du kannst dich jederzeit wieder anmelden.',
      confirmLabel: 'Abmelden',
      onConfirm: async () => {
        await unregisterPushNotifications();
        await supabase.auth.signOut();
      },
    });
  }

  const hasChanges = name.trim() !== savedName;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Profil</Text>

      <Text style={styles.sectionTitle}>Benachrichtigungen</Text>
      <View style={styles.card}>
        {PREF_OPTIONS.map((option, i) => (
          <View key={option.key} style={[styles.prefRow, i > 0 && styles.prefRowBorder]}>
            <View style={styles.prefText}>
              <Text style={styles.prefLabel}>{option.label}</Text>
              <Text style={styles.prefHint}>{option.hint}</Text>
            </View>
            <Switch
              value={prefs?.[option.key] ?? true}
              onValueChange={(value) => togglePref(option.key, value)}
              disabled={!prefs}
              trackColor={{ true: colors.accent, false: colors.border }}
            />
          </View>
        ))}
      </View>

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

      <Text style={styles.sectionTitle}>Deine WG</Text>
      <View style={styles.card}>
        <Text style={styles.wgName}>{household?.name}</Text>
        <Text style={styles.codeLabel}>Einladungscode</Text>
        <Text style={styles.code}>{household?.invite_code}</Text>
        <Pressable style={styles.button} onPress={shareCode}>
          <Text style={styles.buttonText}>Mitbewohner einladen</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Account</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>E-Mail</Text>
          <Text style={styles.value}>{email}</Text>
        </View>
      </View>

      <Pressable style={styles.logout} onPress={confirmLogout}>
        <Text style={styles.logoutText}>Abmelden</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { padding: 24, paddingTop: 72 },
  title: { fontSize: 32, fontWeight: 'bold', color: colors.text, marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 12 },
  card: { backgroundColor: 'white', borderRadius: 16, padding: 16, marginBottom: 32 },
  input: { backgroundColor: colors.background, borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 12 },
  button: { backgroundColor: colors.accent, borderRadius: 12, padding: 14, alignItems: 'center' },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  label: { fontSize: 15, color: colors.textMuted },
  value: { fontSize: 15, color: colors.text, fontWeight: '500', flexShrink: 1, textAlign: 'right' },
  logout: { padding: 16, alignItems: 'center' },
  logoutText: { color: colors.accent, fontSize: 16, fontWeight: '600' },
  wgName: { fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center' },
  codeLabel: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 16 },
  code: { fontSize: 32, fontWeight: 'bold', letterSpacing: 6, color: colors.text, textAlign: 'center', marginVertical: 8 },
  prefRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  prefRowBorder: { borderTopWidth: 1, borderTopColor: colors.surfaceMuted },
  prefText: { flex: 1, marginRight: 12 },
  prefLabel: { fontSize: 16, color: colors.text, fontWeight: '500' },
  prefHint: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
});