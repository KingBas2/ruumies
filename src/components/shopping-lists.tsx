import { ActionSheet } from '@/components/action-sheet';
import { supabase } from '@/lib/supabase';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

type List = {
  id: string;
  name: string;
  emoji: string;
  is_default: boolean;
};

type ShoppingItem = {
  id: string;
  name: string;
  quantity: string | null;
  is_checked: boolean;
  list_id: string;
};

export function ShoppingLists() {
  const [lists, setLists] = useState<List[]>([]);
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [selectedList, setSelectedList] = useState<List | null>(null);
  const [selectedItem, setSelectedItem] = useState<ShoppingItem | null>(null);

  // Neuer Eintrag
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');

  // Neue Liste
  const [showNewList, setShowNewList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListEmoji, setNewListEmoji] = useState('');

  const loadLists = useCallback(async () => {
    const { data, error } = await supabase
      .from('shopping_lists')
      .select('id, name, emoji, is_default')
      .order('is_default', { ascending: false })
      .order('created_at');
    if (error) console.error(error);
    else setLists(data ?? []);
  }, []);

  const loadItems = useCallback(async () => {
    const { data, error } = await supabase
      .from('shopping_items')
      .select('id, name, quantity, is_checked, list_id')
      .order('created_at');
    if (error) console.error(error);
    else setItems(data ?? []);
  }, []);

  useEffect(() => {
    loadLists();
    loadItems();

    const channel = supabase
      .channel('shopping-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_items' }, () => loadItems())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_lists' }, () => loadLists())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadLists, loadItems]);

  // Wenn keine (gültige) Liste ausgewählt ist → Standardliste nehmen
  useEffect(() => {
    if (lists.length === 0) return;
    if (!activeListId || !lists.some((l) => l.id === activeListId)) {
      setActiveListId((lists.find((l) => l.is_default) ?? lists[0]).id);
    }
  }, [lists, activeListId]);

  const listItems = items.filter((i) => i.list_id === activeListId);
  const openItems = listItems.filter((i) => !i.is_checked);
  const checkedItems = listItems.filter((i) => i.is_checked);

  function openCount(listId: string) {
    return items.filter((i) => i.list_id === listId && !i.is_checked).length;
  }

  // ---------- Einträge ----------

  async function addItem() {
    const trimmed = name.trim();
    if (!trimmed || !activeListId) return;

    setName('');
    setQuantity('');
    const { error } = await supabase
      .from('shopping_items')
      .insert({ name: trimmed, quantity: quantity.trim() || null, list_id: activeListId });

    if (error) Alert.alert('Das hat nicht geklappt', error.message);
    else loadItems();
  }

  async function toggleItem(item: ShoppingItem) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_checked: !i.is_checked } : i)));
    const { error } = await supabase
      .from('shopping_items')
      .update({ is_checked: !item.is_checked })
      .eq('id', item.id);

    if (error) {
      loadItems();
      Alert.alert('Das hat nicht geklappt', error.message);
    }
  }

  async function deleteItem(item: ShoppingItem) {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    const { error } = await supabase.from('shopping_items').delete().eq('id', item.id);
    if (error) {
      loadItems();
      Alert.alert('Das hat nicht geklappt', error.message);
    }
  }

  function clearChecked() {
    Alert.alert('Erledigte löschen?', 'Alle abgehakten Einträge dieser Liste werden entfernt.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          const ids = checkedItems.map((i) => i.id);
          setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
          const { error } = await supabase.from('shopping_items').delete().in('id', ids);
          if (error) {
            loadItems();
            Alert.alert('Das hat nicht geklappt', error.message);
          }
        },
      },
    ]);
  }

  // ---------- Listen ----------

  async function addList() {
    const trimmed = newListName.trim();
    if (!trimmed) {
      Alert.alert('Hoppla', 'Bitte gib der Liste einen Namen.');
      return;
    }

    const { data, error } = await supabase
      .from('shopping_lists')
      .insert({ name: trimmed, emoji: newListEmoji.trim() || '📝' })
      .select('id')
      .single();

    if (error) {
      Alert.alert('Das hat nicht geklappt', error.message);
      return;
    }

    cancelNewList();
    setActiveListId(data.id); // neue Liste direkt öffnen
    loadLists();
  }

  function cancelNewList() {
    setNewListName('');
    setNewListEmoji('');
    setShowNewList(false);
  }

  function confirmDeleteList(list: List) {
    const count = items.filter((i) => i.list_id === list.id).length;
    Alert.alert(
      `„${list.name}“ löschen?`,
      count > 0 ? `Die ${count} Einträge auf dieser Liste werden ebenfalls gelöscht.` : undefined,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('shopping_lists').delete().eq('id', list.id);
            if (error) {
              Alert.alert('Das hat nicht geklappt', error.message);
              return;
            }
            loadLists();
            loadItems();
          },
        },
      ]
    );
  }

  // ---------- Anzeige ----------

  function renderItem(item: ShoppingItem) {
    return (
      <Pressable
        key={item.id}
        style={styles.itemRow}
        onPress={() => toggleItem(item)}
        onLongPress={() => setSelectedItem(item)}
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
      {/* Listen-Chips (gedrückt halten = Liste verwalten) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipScrollContent}
      >
        {lists.map((l) => {
          const active = l.id === activeListId;
          const count = openCount(l.id);
          return (
            <Pressable
              key={l.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setActiveListId(l.id)}
              onLongPress={() => setSelectedList(l)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {l.emoji} {l.name}
                {count > 0 ? `  ${count}` : ''}
              </Text>
            </Pressable>
          );
        })}
        <Pressable style={[styles.chip, styles.chipNew, styles.chipPlus]} onPress={() => setShowNewList(true)}>
          <Text style={styles.chipPlusText}>+</Text>
        </Pressable>
      </ScrollView>

      {/* Neue Liste */}
      {showNewList && (
        <View style={styles.formCard}>
          <Text style={styles.formLabel}>Neue Liste</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.emojiInput]}
              placeholder="📝"
              value={newListEmoji}
              onChangeText={setNewListEmoji}
            />
            <TextInput
              style={[styles.input, styles.flex]}
              placeholder="z. B. Party"
              value={newListName}
              onChangeText={setNewListName}
              autoFocus
            />
          </View>
          <View style={styles.formButtons}>
            <Pressable style={styles.cancelButton} onPress={cancelNewList}>
              <Text style={styles.cancelText}>Abbrechen</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={addList}>
              <Text style={styles.primaryButtonText}>Liste anlegen</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Neuer Eintrag */}
      <View style={styles.addRow}>
        <TextInput
          style={[styles.input, styles.flex, styles.inputSpacing]}
          placeholder="Was fehlt?"
          value={name}
          onChangeText={setName}
          onSubmitEditing={addItem}
          returnKeyType="done"
        />
        <TextInput
          style={[styles.input, styles.inputQuantity, styles.inputSpacing]}
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

      {/* Einträge */}
      {listItems.length === 0 ? (
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

      <Text style={styles.hint}>
        Tippen zum Abhaken · Gedrückt halten für mehr · Liste oben gedrückt halten zum Verwalten
      </Text>

      {/* Menü für einen Eintrag */}
      <ActionSheet
        visible={selectedItem !== null}
        title={selectedItem?.name}
        subtitle={selectedItem?.quantity ?? undefined}
        actions={
          selectedItem
            ? [{ label: 'Löschen', emoji: '🗑️', destructive: true, onPress: () => deleteItem(selectedItem) }]
            : []
        }
        onClose={() => setSelectedItem(null)}
      />

      {/* Menü für eine Liste */}
      <ActionSheet
        visible={selectedList !== null}
        title={selectedList ? `${selectedList.emoji} ${selectedList.name}` : undefined}
        subtitle={
          selectedList?.is_default
            ? 'Standardliste: Hier landet alles, was im Bestand verbraucht wird. Sie kann nicht gelöscht werden.'
            : undefined
        }
        actions={
          selectedList && !selectedList.is_default
            ? [{ label: 'Liste löschen', emoji: '🗑️', destructive: true, onPress: () => confirmDeleteList(selectedList) }]
            : []
        }
        onClose={() => setSelectedList(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingTop: 16 },
  flex: { flex: 1 },
  row: { flexDirection: 'row' },

  chipScroll: { marginBottom: 16, marginHorizontal: -24 },
  chipScrollContent: { paddingHorizontal: 24 },
  chip: {
    backgroundColor: '#F2E6DA', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14,
    marginRight: 8, marginBottom: 8,
  },
  chipActive: { backgroundColor: '#E07A5F' },
  chipNew: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#D9C7B8', borderStyle: 'dashed' },
  chipPlus: { marginRight: 0, paddingHorizontal: 16 },
  chipText: { color: '#5C4033', fontSize: 14, fontWeight: '500' },
  chipTextActive: { color: 'white' },
  chipPlusText: { color: '#8B6F5E', fontSize: 16, fontWeight: '700' },

  formCard: { backgroundColor: 'white', borderRadius: 16, padding: 16, marginBottom: 16 },
  formLabel: { fontSize: 15, fontWeight: '600', color: '#5C4033', marginBottom: 8 },
  formButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  cancelButton: { paddingVertical: 12, paddingHorizontal: 16, marginRight: 8 },
  cancelText: { color: '#8B6F5E', fontSize: 16 },
  primaryButton: { backgroundColor: '#E07A5F', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20 },
  primaryButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  emojiInput: { width: 56, textAlign: 'center', marginRight: 8, backgroundColor: '#FFF8F0' },

  addRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  input: { backgroundColor: 'white', borderRadius: 12, padding: 14, fontSize: 16 },
  inputSpacing: { marginRight: 8 },
  inputQuantity: { width: 90 },
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