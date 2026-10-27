import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Abstand oben für Screens: Höhe der Statusleiste + etwas Luft
export function useScreenTopPadding() {
  const insets = useSafeAreaInsets();
  return insets.top + 20;
}