import { colors } from '@/lib/theme';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';

function TabIcon({ emoji, focused, size = 22 }: { emoji: string; focused: boolean; size?: number }) {
  return <Text style={{ fontSize: size, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
}

// Beim Öffnen der App immer mit Home starten
export const unstable_settings = {
  anchor: 'index',
};

export default function TabsLayout() {
  return (
    <Tabs
      backBehavior="initialRoute"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.surfaceMuted },
      }}
    >
      <Tabs.Screen
        name="kalender"
        options={{
          title: 'Kalender',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📅" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="haushalt"
        options={{
          title: 'Haushalt',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🧺" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} size={26} />,
        }}
      />
      <Tabs.Screen
        name="finanzen"
        options={{
          title: 'Finanzen',
          tabBarIcon: ({ focused }) => <TabIcon emoji="💸" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: 'Profil',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🙂" focused={focused} />,
        }}
      />
    </Tabs>
  );
}