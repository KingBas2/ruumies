import { Tabs } from 'expo-router';
import { Text } from 'react-native';

function TabIcon({ emoji, focused, size = 22 }: { emoji: string; focused: boolean; size?: number }) {
  return <Text style={{ fontSize: size, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#E07A5F',
        tabBarInactiveTintColor: '#8B6F5E',
        tabBarStyle: { backgroundColor: '#FFF8F0', borderTopColor: '#F2E6DA' },
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