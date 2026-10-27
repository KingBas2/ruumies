import { Inventory } from '@/components/inventory';
import { ShoppingLists } from '@/components/shopping-lists';
import { useScreenTopPadding } from '@/lib/layout';
import { colors } from '@/lib/theme';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function Haushalt() {
  const topPadding = useScreenTopPadding();
  const [section, setSection] = useState<'list' | 'stock'>('list');

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: topPadding }]}>
        <Text style={styles.title}>Haushalt</Text>
        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, section === 'list' && styles.tabActive]}
            onPress={() => setSection('list')}
          >
            <Text style={[styles.tabText, section === 'list' && styles.tabTextActive]}>Einkaufslisten</Text>
          </Pressable>
          <Pressable
            style={[styles.tab, section === 'stock' && styles.tabActive]}
            onPress={() => setSection('stock')}
          >
            <Text style={[styles.tabText, section === 'stock' && styles.tabTextActive]}>Bestand</Text>
          </Pressable>
        </View>
      </View>

      {section === 'list' ? <ShoppingLists /> : <Inventory />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { padding: 24, paddingTop: 72, paddingBottom: 8 },
  title: { fontSize: 32, fontWeight: 'bold', color: colors.text, marginBottom: 16 },
  tabs: { flexDirection: 'row', backgroundColor: colors.surfaceMuted, borderRadius: 12, padding: 4 },
  tab: { flex: 1, padding: 10, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: 'white' },
  tabText: { color: colors.textMuted, fontWeight: '500' },
  tabTextActive: { color: colors.text, fontWeight: '700' },
});