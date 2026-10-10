import { Inventory } from '@/components/inventory';
import { supabase } from '@/lib/supabase';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
type ShoppingItem = {
  id: string;
  name: string;
  quantity: string | null;
  is_checked: boolean;
};

export default function Haushalt() {
  const [section, setSection] = useState<'list' | 'stock'>('list');

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Haushalt</Text>
        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, section === 'list' && styles.tabActive]}
            onPress={() => setSection('list')}
          >
            <Text style={[styles.tabText, section === 'list' && styles.tabTextActive]}>Einkaufsliste</Text>
          </Pressable>
          <Pressable
            style={[styles.tab, section === 'stock' && styles.tabActive]}
            onPress={() => setSection('stock')}
          >
            <Text style={[styles.tabText, section === 'stock' && styles.tabTextActive]}>Bestand</Text>
          </Pressable>
        </View>
      </View>

      {section === 'list' ? <ShoppingList /> : <Inventory />}
    </View>
  );
}

function ShoppingList() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('shopping_items')
      .select('id, name, quantity, is_checked')
      .order('created_at', { ascending: true });
    if (error) console.error(error);
    else setItems(data ?? []);
  }, []);

  useEffect(() => {
    load();

    // Echtzeit: bei jeder Änderung (neu, abgehakt, gelöscht) neu laden
    const channel = supabase
      .channel('shopping-items-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_items' }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const openItems = items.filter((i) => !i.is_checked);
  const checkedItems = items.filter((i) => i.is_checked);

  async function addItem() {
    const trimmed = name.trim();
    if (!trimmed) return;

    setName('');
    setQuantity('');
    const { error } = await supabase
      .from('shopping_items')
      .insert({ name: trimmed, quantity: quantity.trim() || null });

    if (error) Alert.alert('Das hat nicht geklappt', error.message);
    else load();
  }

  async function toggleItem(item: ShoppingItem) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_checked: !i.is_checked } : i)));
    const { error } = await supabase
      .from('shopping_items')
      .update({ is_checked: !item.is_checked })
      .eq('id', item.id);

    if (error) {
      load();
      Alert.alert('Das hat nicht geklappt', error.message);
    }
  }

  function deleteItem(item: ShoppingItem) {
    Alert.alert(`„${item.name}“ löschen?`, undefined, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          setItems((prev) => prev.filter((i) => i.id !== item.id));
          const { error } = await supabase.from('shopping_items').delete().eq('id', item.id);
          if (error) {
            load();
            Alert.alert('Das hat nicht geklappt', error.message);
          }
        },
      },
    ]);
  }

  function clearChecked() {
    Alert.alert('Erledigte löschen?', 'Alle abgehakten Einträge werden entfernt.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          const ids = checkedItems.map((i) => i.id);
          setItems((prev) => prev.filter((i) => !i.is_checked));
          const { error } = await supabase.from('shopping_items').delete().in('id', ids);
          if (error) {
            load();
            Alert.alert('Das hat nicht geklappt', error.message);
          }
        },
      },
    ]);
  }

  function renderItem(item: ShoppingItem) {
    return (
      <Pressable
        key={item.id}
        style={styles.itemRow}
        onPress={() => toggleItem(item)}
        onLongPress={() => deleteItem(item)}
      >
        <View style={[styles.checkbox, item.is_checked && styles.checkboxChecked]}>
          {item.is_checked && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={[styles.itemName, item.is_checked && styles.itemNameChecked]}>{item.name}</Text>
        {item.quantity && <Text style={styles.itemQuantity}>{item.quantity}</Text>}
      </Pressable>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.addRow}>
        <TextInput
          style={[styles.input, styles.inputName]}
          placeholder="Was fehlt?"
          value={name}
          onChangeText={setName}
          onSubmitEditing={addItem}
          returnKeyType="done"
        />
        <TextInput
          style={[styles.input, styles.inputQuantity]}
          placeholder="Menge"
          value={quantity}
          onChangeText={setQuantity}
          onSubmitEditing={addItem}
          returnKeyType="done"
        />
        <Pressable style={styles.addButton} onPress={addItem}>
          <Text style={styles.addButtonText}>+</Text>
        </Pressable>
      </View>

      {openItems.length === 0 && checkedItems.length === 0 ? (
        <Text style={styles.empty}>Die Liste ist leer. Alles da! 🎉</Text>
      ) : (
        <View style={styles.card}>
          {openItems.length > 0 ? (
            openItems.map(renderItem)
          ) : (
            <Text style={styles.allDone}>Alles eingekauft 🎉</Text>
          )}
        </View>
      )}

      {checkedItems.length > 0 && (
        <>
          <View style={styles.checkedHeader}>
            <Text style={styles.sectionTitle}>Erledigt</Text>
            <Pressable onPress={clearChecked}>
              <Text style={styles.clearText}>Alle löschen</Text>
            </Pressable>
          </View>
          <View style={styles.card}>{checkedItems.map(renderItem)}</View>
        </>
      )}

      <Text style={styles.hint}>Tippen zum Abhaken · Gedrückt halten zum Löschen</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFF8F0' },
  header: { padding: 24, paddingTop: 72, paddingBottom: 8 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#5C4033', marginBottom: 16 },
  tabs: { flexDirection: 'row', backgroundColor: '#F2E6DA', borderRadius: 12, padding: 4 },
  tab: { flex: 1, padding: 10, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: 'white' },
  tabText: { color: '#8B6F5E', fontWeight: '500' },
  tabTextActive: { color: '#5C4033', fontWeight: '700' },
  content: { padding: 24, paddingTop: 16 },
  addRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  input: { backgroundColor: 'white', borderRadius: 12, padding: 14, fontSize: 16 },
  inputName: { flex: 1, marginRight: 8 },
  inputQuantity: { width: 90, marginRight: 8 },
  addButton: {
    width: 48, height: 48, borderRadius: 12, backgroundColor: '#E07A5F',
    alignItems: 'center', justifyContent: 'center',
  },
  addButtonText: { color: 'white', fontSize: 26, fontWeight: '600' },
  card: { backgroundColor: 'white', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  checkbox: {
    width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: '#D9C7B8',
    marginRight: 12, alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: '#81B29A', borderColor: '#81B29A' },
  checkmark: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  itemName: { flex: 1, fontSize: 16, color: '#5C4033' },
  itemNameChecked: { color: '#B5A397', textDecorationLine: 'line-through' },
  itemQuantity: { fontSize: 14, color: '#8B6F5E' },
  checkedHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 28, marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#5C4033' },
  clearText: { color: '#E07A5F', fontSize: 15, fontWeight: '600' },
  empty: { textAlign: 'center', color: '#8B6F5E', fontSize: 16, marginTop: 32 },
  allDone: { textAlign: 'center', color: '#8B6F5E', fontSize: 15, paddingVertical: 14 },
  hint: { textAlign: 'center', color: '#B5A397', fontSize: 13, marginTop: 24 },
});