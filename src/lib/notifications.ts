import { supabase } from '@/lib/supabase';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Wie Benachrichtigungen angezeigt werden, wenn die App gerade offen ist
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function getProjectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

// Erlaubnis erfragen, Token holen und in Supabase speichern
export async function registerForPushNotifications(): Promise<string | null> {
  // Push funktioniert nur auf echten Geräten
  if (!Device.isDevice) return null;

  // Android braucht einen "Kanal" für Benachrichtigungen
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Allgemein',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#E07A5F',
    });
  }

  // Erlaubnis prüfen und ggf. nachfragen
  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return null;

  const projectId = getProjectId();
  if (!projectId) {
    console.warn('Keine EAS-Projekt-ID gefunden');
    return null;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const { error } = await supabase.rpc('register_push_token', { p_token: token });
    if (error) console.error(error);
    return token;
  } catch (e) {
    console.error('Push-Token konnte nicht geholt werden', e);
    return null;
  }
}

// Beim Abmelden: Dieses Handy soll keine Benachrichtigungen mehr für den Account bekommen
export async function unregisterPushNotifications() {
  if (!Device.isDevice) return;
  const { status } = await Notifications.getPermissionsAsync();
  const projectId = getProjectId();
  if (status !== 'granted' || !projectId) return;

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase.rpc('unregister_push_token', { p_token: token });
  } catch (e) {
    console.error('Push-Token konnte nicht entfernt werden', e);
  }
}