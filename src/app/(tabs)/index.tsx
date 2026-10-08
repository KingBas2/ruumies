import { useHousehold } from '@/lib/household';
import { supabase } from '@/lib/supabase';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

type Member = {
  id: string;
  display_name: string | null;
  is_home: boolean;
};

export default function Home() {
  const { household } = useHousehold();
  const [userId, setUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);

  const loadMembers = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, is_home')
      .order('display_name');
    if (error) console.error(error);
    else setMembers(data ?? []);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    loadMembers();

    // Echtzeit: Änderungen an Profilen sofort übernehmen
    const channel = supabase
      .channel('profiles-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
        const updated = payload.new as Member;
        setMembers((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadMembers]);

  const me = members.find((m) => m.id === userId);
  const homeCount = members.filter((m) => m.is_home).length;

  async function toggleHome() {
    if (!me) return;
    const newValue = !me.is_home;

    // Sofort in der App umschalten, dann speichern
    setMembers((prev) => prev.map((m) => (m.id === me.id ? { ...m, is_home: newValue } : m)));
    const { error } = await supabase.from('profiles').update({ is_home: newValue }).eq('id', me.id);

    if (error) {
      // Speichern fehlgeschlagen → zurückdrehen
      setMembers((prev) => prev.map((m) => (m.id === me.id ? { ...m, is_home: !newValue } : m)));
      Alert.alert('Das hat nicht geklappt', error.message);
    }
  }

  function shareCode() {
    if (!household) return;
    Share.share({
      message: `Komm in unsere WG „${household.name}“ auf ruumies! Einladungscode: ${household.invite_code}`,
    });
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.wgName}>{household?.name}</Text>
      <Text style={styles.summary}>
        {homeCount} von {members.length} zuhause
      </Text>

      <Pressable style={[styles.toggle, me?.is_home ? styles.toggleHome : styles.toggleAway]} onPress={toggleHome}>
        <Text style={styles.toggleEmoji}>{me?.is_home ? '🏠' : '🚶'}</Text>
        <Text style={styles.toggleText}>{me?.is_home ? 'Ich bin zuhause' : 'Ich bin unterwegs'}</Text>
        <Text style={styles.toggleHint}>Tippen zum Umschalten</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Mitbewohner</Text>
      <View style={styles.card}>
        {members.map((m) => (
          <View key={m.id} style={styles.memberRow}>
            <View style={[styles.dot, m.is_home ? styles.dotHome : styles.dotAway]} />
            <Text style={styles.memberName}>
              {m.display_name}
              {m.id === userId ? ' (du)' : ''}
            </Text>
            <Text style={styles.memberStatus}>{m.is_home ? 'zuhause' : 'unterwegs'}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Mitbewohner einladen</Text>
      <View style={styles.card}>
        <Text style={styles.code}>{household?.invite_code}</Text>
        <Pressable style={styles.shareButton} onPress={shareCode}>
          <Text style={styles.shareButtonText}>Code teilen</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFF8F0' },
  container: { padding: 24, paddingTop: 72 },
  wgName: { fontSize: 32, fontWeight: 'bold', color: '#5C4033' },
  summary: { fontSize: 16, color: '#8B6F5E', marginTop: 4, marginBottom: 24 },
  toggle: { borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 32 },
  toggleHome: { backgroundColor: '#81B29A' },
  toggleAway: { backgroundColor: '#D9C7B8' },
  toggleEmoji: { fontSize: 48 },
  toggleText: { fontSize: 22, fontWeight: 'bold', color: 'white', marginTop: 8 },
  toggleHint: { fontSize: 13, color: 'white', opacity: 0.85, marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#5C4033', marginBottom: 12 },
  card: { backgroundColor: 'white', borderRadius: 16, padding: 16, marginBottom: 32 },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  dotHome: { backgroundColor: '#81B29A' },
  dotAway: { backgroundColor: '#D9C7B8' },
  memberName: { flex: 1, fontSize: 16, color: '#5C4033' },
  memberStatus: { fontSize: 14, color: '#8B6F5E' },
  code: { fontSize: 32, fontWeight: 'bold', letterSpacing: 6, color: '#5C4033', textAlign: 'center', marginBottom: 12 },
  shareButton: { backgroundColor: '#E07A5F', borderRadius: 12, padding: 12, alignItems: 'center' },
  shareButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
});