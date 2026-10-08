import { useHousehold } from '@/lib/household';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';

export default function Home() {
  const { household } = useHousehold();
  const [email, setEmail] = useState<string | undefined>();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email));
  }, []);

  function shareCode() {
    if (!household) return;
    Share.share({
      message: `Komm in unsere WG „${household.name}“ auf ruumies! Einladungscode: ${household.invite_code}`,
    });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>Hallo {email} 👋</Text>
      <Text style={styles.wgName}>{household?.name}</Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Einladungscode</Text>
        <Text style={styles.code}>{household?.invite_code}</Text>
        <Pressable style={styles.button} onPress={shareCode}>
          <Text style={styles.buttonText}>Code teilen</Text>
        </Pressable>
      </View>

      <Pressable style={styles.logout} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.logoutText}>Abmelden</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#FFF8F0' },
  greeting: { fontSize: 16, textAlign: 'center', color: '#8B6F5E' },
  wgName: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', color: '#5C4033', marginTop: 4, marginBottom: 32 },
  card: { backgroundColor: 'white', borderRadius: 16, padding: 24, alignItems: 'center' },
  cardLabel: { fontSize: 14, color: '#8B6F5E' },
  code: { fontSize: 36, fontWeight: 'bold', letterSpacing: 6, color: '#5C4033', marginVertical: 12 },
  button: { backgroundColor: '#E07A5F', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  logout: { padding: 16, alignItems: 'center', marginTop: 16 },
  logoutText: { color: '#8B6F5E', fontSize: 15 },
});