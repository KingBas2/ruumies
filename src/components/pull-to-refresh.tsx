import { colors } from '@/lib/theme';
import { useCallback, useState } from 'react';
import { RefreshControl } from 'react-native';

// Liefert ein fertiges "Zum Neuladen ziehen" für eine ScrollView
export function usePullToRefresh(load: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={colors.accent} // Farbe des Kreisels auf dem iPhone
      colors={[colors.accent]} // Farbe des Kreisels auf Android
    />
  );
}