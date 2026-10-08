import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

export default function Home() {
  const [email, setEmail] = useState<string | undefined>();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email));
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF8F0' }}>
      <Text style={{ fontSize: 20, marginBottom: 24 }}>Hallo {email} 👋</Text>
      <Pressable onPress={() => supabase.auth.signOut()}>
        <Text style={{ color: '#E07A5F', fontSize: 16 }}>Abmelden</Text>
      </Pressable>
    </View>
  );
}