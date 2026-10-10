import { useHousehold } from '@/lib/household';
import { supabase } from '@/lib/supabase';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

type Member = {
  id: string;
  display_name: string | null;
  is_home: boolean;
  guest_count: number;
};

function guestLabel(n: number) {
  return n === 1 ? '1 Gast' : `${n} Gäste`;
}

export default function Home() {
  const { household } = useHousehold();
  const [userId, setUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);

  const loadMembers = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, is_home, guest_count')
      .order('display_name');
    if (error) console.error(error);
    else setMembers(data ?? []);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    loadMembers();

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
  const totalGuests = members.reduce((sum, m) => sum + (m.is_home ? m.guest_count : 0), 0);

  // Ändert mein Profil: sofort in der App, dann speichern
  async function updateMe(changes: Partial<Member>) {
    if (!me) return;
    const previous = { is_home: me.is_home, guest_count: me.guest_count };

    setMembers((prev) => prev.map((m) => (m.id === me.id ? { ...m, ...changes } : m)));
    const { error } = await supabase.from('profiles').update(changes).eq('id', me.id);

    if (error) {
      setMembers((prev) => prev.map((m) => (m.id === me.id ? { ...m, ...previous } : m)));
      Alert.alert('Das hat nicht geklappt', error.message);
    }
  }

  function toggleHome() {
    if (!me) return;
    // Wer geht, nimmt seine Gäste mit
    updateMe(me.is_home ? { is_home: false, guest_count: 0 } : { is_home: true });
  }

  function changeGuests(delta: number) {
    if (!me) return;
    const next = Math.min(20, Math.max(0, me.guest_count + delta));
    if (next !== me.guest_count) updateMe({ guest_count: next });
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
        {totalGuests > 0 ? ` · ${guestLabel(totalGuests)}` : ''}
      </Text>

      <Pressable style={[styles.toggle, me?.is_home ? styles.toggleHome : styles.toggleAway]} onPress={toggleHome}>
        <Text style={styles.toggleEmoji}>{me?.is_home ? '🏠' : '🚶'}</Text>
        <Text style={styles.toggleText}>{me?.is_home ? 'Ich bin zuhause' : 'Ich bin unterwegs'}</Text>
        <Text style={styles.toggleHint}>Tippen zum Umschalten</Text>
      </Pressable>

      {me?.is_home && (
        <View style={styles.guestCard}>
          <Text style={styles.guestLabel}>Gäste dabei?</Text>
          <View style={styles.stepper}>
            <Pressable style={styles.stepperButton} onPress={() => changeGuests(-1)}>
              <Text style={styles.stepperButtonText}>−</Text>
            </Pressable>
            <Text style={styles.stepperValue}>{me.guest_count}</Text>
            <Pressable style={styles.stepperButton} onPress={() => changeGuests(1)}>
              <Text style={styles.stepperButtonText}>+</Text>
            </Pressable>
          </View>
        </View>
      )}

      <Text style={styles.sectionTitle}>Mitbewohner</Text>
      <View style={styles.card}>
        {members.map((m) => (
          <View key={m.id} style={styles.memberRow}>
            <View style={[styles.dot, m.is_home ? styles.dotHome : styles.dotAway]} />
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>
                {m.display_name}
                {m.id === userId ? ' (du)' : ''}
              </Text>
              {m.is_home && m.guest_count > 0 && (
                <Text style={styles.memberGuests}>mit {guestLabel(m.guest_count)}</Text>
              )}
            </View>
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
  toggle: { borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 12 },
  toggleHome: { backgroundColor: '#81B29A' },
  toggleAway: { backgroundColor: '#D9C7B8' },
  toggleEmoji: { fontSize: 48 },
  toggleText: { fontSize: 22, fontWeight: 'bold', color: 'white', marginTop: 8 },
  toggleHint: { fontSize: 13, color: 'white', opacity: 0.85, marginTop: 4 },
  guestCard: {
    backgroundColor: 'white', borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  guestLabel: { fontSize: 16, color: '#5C4033', fontWeight: '500' },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  stepperButton: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#F2E6DA',
    alignItems: 'center', justifyContent: 'center',
  },
  stepperButtonText: { fontSize: 20, color: '#5C4033', fontWeight: '600' },
  stepperValue: { fontSize: 18, fontWeight: '700', color: '#5C4033', minWidth: 36, textAlign: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#5C4033', marginBottom: 12, marginTop: 32 },
  card: { backgroundColor: 'white', borderRadius: 16, padding: 16 },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  dotHome: { backgroundColor: '#81B29A' },
  dotAway: { backgroundColor: '#D9C7B8' },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 16, color: '#5C4033' },
  memberGuests: { fontSize: 13, color: '#8B6F5E', marginTop: 2 },
  memberStatus: { fontSize: 14, color: '#8B6F5E' },
  code: { fontSize: 32, fontWeight: 'bold', letterSpacing: 6, color: '#5C4033', textAlign: 'center', marginBottom: 12 },
  shareButton: { backgroundColor: '#E07A5F', borderRadius: 12, padding: 12, alignItems: 'center' },
  shareButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
});