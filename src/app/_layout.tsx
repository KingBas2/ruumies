import { DialogProvider } from '@/lib/dialog';
import { HouseholdProvider, useHousehold } from '@/lib/household';
import { registerForPushNotifications, useNotificationNavigation } from '@/lib/notifications';
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

  // Sobald jemand eingeloggt ist: für Push-Benachrichtigungen anmelden
  const currentUserId = session?.user.id;
  useEffect(() => {
    if (currentUserId) registerForPushNotifications();
  }, [currentUserId]);

  if (loading) return null;

  const userId = session?.user.id ?? null;

  return (
    <DialogProvider>
      <HouseholdProvider key={userId ?? 'logged-out'} userId={userId}>
        <RootNavigator isLoggedIn={!!session} />
      </HouseholdProvider>
    </DialogProvider>
  );
}

function RootNavigator({ isLoggedIn }: { isLoggedIn: boolean }) {
  const { household, loading } = useHousehold();
  const hasHousehold = !!household;

  // Beim Antippen einer Benachrichtigung zur passenden Seite springen
  useNotificationNavigation(isLoggedIn && hasHousehold && !loading);

  if (isLoggedIn && loading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={isLoggedIn && hasHousehold}>
        <Stack.Screen name="(tabs)" />
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