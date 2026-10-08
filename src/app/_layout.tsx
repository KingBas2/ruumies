import { HouseholdProvider, useHousehold } from '@/lib/household';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return null;

  const userId = session?.user.id ?? null;

  return (
    <HouseholdProvider key={userId ?? 'logged-out'} userId={userId}>
      <RootNavigator isLoggedIn={!!session} />
    </HouseholdProvider>
  );
}

function RootNavigator({ isLoggedIn }: { isLoggedIn: boolean }) {
  const { household, loading } = useHousehold();

  if (isLoggedIn && loading) return null;

  const hasHousehold = !!household;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={isLoggedIn && hasHousehold}>
        <Stack.Screen name="index" />
      </Stack.Protected>
      <Stack.Protected guard={isLoggedIn && !hasHousehold}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={!isLoggedIn}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}