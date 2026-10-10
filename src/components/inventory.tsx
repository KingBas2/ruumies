import { supabase } from '@/lib/supabase';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

type Location = 'fridge' | 'pantry' | 'bathroom' | 'cleaning' | 'other';

const LOCATIONS: { key: Location; label: string; emoji: string }[] = [
  { key: 'fridge', label: 'Kühlschrank', emoji: '🧊' },
  { key: 'pantry', label: 'Vorratsschrank', emoji: '🥫' },
  { key: 'bathroom', label: 'Bad', emoji: '🧴' },
  { key: 'cleaning', label: 'Putzmittel', emoji: '🧽' },
  { key: 'other', label: 'Sonstiges', emoji: '📦' },
];

type InventoryItem = {
  id: string;
  name: string;
  quantity: string | null;
  location: Location;
  owner_id: string | null;
};

type Member = {
  id: string;
  display_name: string | null;
};

export function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Location | 'all'>('all');

  // Formular zum Hinzufügen
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [location, setLocation] = useState<Location>('fridge');
  const [ownerId, setOwnerId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('id, name, quantity, location, owner_id')
      .order('name');
    if (error) console.error(error);
    else setItems(data ?? []);
  }, []);

  useEffect(() => {
    load();
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    supabase
      .from('profiles')
      .select('id, display_name')
      .order('display_name')
      .then(({ data, error }) => {
        if (error) console.error(error);
        else setMembers(data ?? []);
      });

    const channel = supabase
      .channel('inventory-items-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  function ownerLabel(id: string | null) {
    if (!id) return 'gemeinsam';
    if (id === userId) return 'du';
    return members.find((m) => m.id === id)?.display_name ?? 'ehemalig';
  }

  function openForm() {
    // Ort vorauswählen, wenn gerade gefiltert wird
    setLocation(filter === 'all' ? 'fridge' : filter);
    setOwnerId(null);
    setShowForm(true);
  }

  function closeForm() {
    setName('');
    setQuantity('');
    setShowForm(false);
  }

  async function addItem() {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Hoppla', 'Bitte gib einen Namen ein.');
      return;
    }

    const { error } = await supabase.from('inventory_items').insert({
      name: trimmed,
      quantity: quantity.trim() || null,
      location,
      owner_id: ownerId,
    });

    if (error) {
      Alert.alert('Das hat nicht geklappt', error.message);
      return;
    }
    closeForm();
    load();
  }

  async function removeItem(item: InventoryItem, addToShoppingList: boolean) {
    setItems((prev) => prev.filter((i) => i.id !== item.id));

    if (addToShoppingList) {
      const { error } = await supabase.from('shopping_items').insert({ name: item.name });
      if (error) {
        load();
        Alert.alert('Das hat nicht geklappt', error.message);
        return;
      }
    }

    const { error } = await supabase.from('inventory_items').delete().eq('id', item.id);
    if (error) {
      load();
      Alert.alert('Das hat nicht geklappt', error.message);
    }
  }

  function showActions(item: InventoryItem) {
    Alert.alert(item.name, 'Was möchtest du tun?', [
      { text: 'Verbraucht', onPress: () => removeItem(item, false) },
      { text: 'Verbraucht + auf Einkaufsliste', onPress: () => removeItem(item, true) },
      { text: 'Abbrechen', style: 'cancel' },
    ]);
  }

  function renderItem(item: InventoryItem) {
    return (
      <Pressable key={item.id} style={styles.itemRow} onPress={() => showActions(item)}>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.name}</Text>
          {item.quantity && <Text style={styles.itemQuantity}>{item.quantity}</Text>}
        </View>
        <View style={[styles.ownerBadge, !item.owner_id && styles.ownerBadgeShared]}>
          <Text style={styles.ownerText}>{ownerLabel(item.owner_id)}</Text>
        </View>
      </Pressable>
    );
  }

  // Welche Orte werden angezeigt?
  const visibleLocations = filter === 'all' ? LOCATIONS : LOCATIONS.filter((l) => l.key === filter);
  const visibleCount = items.filter((i) => filter === 'all' || i.location === filter).length;

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Filter-Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        <Pressable style={[styles.chip, filter === 'all' && styles.chipActive]} onPress={() => setFilter('all')}>
          <Text style={[styles.chipText, filter === 'all' && styles.chipTextActive]}>Alle</Text>
        </Pressable>
        {LOCATIONS.map((l) => (
          <Pressable
            key={l.key}
            style={[styles.chip, filter === l.key && styles.chipActive]}
            onPress={() => setFilter(l.key)}
          >
            <Text style={[styles.chipText, filter === l.key && styles.chipTextActive]}>
              {l.emoji} {l.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Hinzufügen */}
      {showForm ? (
        <View style={styles.formCard}>
          <TextInput style={styles.input} placeholder="Was ist neu da?" value={name} onChangeText={setName} />
          <TextInput
            style={styles.input}
            placeholder="Menge (optional)"
            value={quantity}
            onChangeText={setQuantity}
          />

          <Text style={styles.formLabel}>Wo?</Text>
          <View style={styles.chipWrap}>
            {LOCATIONS.map((l) => (
              <Pressable
                key={l.key}
                style={[styles.chip, location === l.key && styles.chipActive]}
                onPress={() => setLocation(l.key)}
              >
                <Text style={[styles.chipText, location === l.key && styles.chipTextActive]}>
                  {l.emoji} {l.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.formLabel}>Wem gehört's?</Text>
          <View style={styles.chipWrap}>
            <Pressable
              style={[styles.chip, ownerId === null && styles.chipActive]}
              onPress={() => setOwnerId(null)}
            >
              <Text style={[styles.chipText, ownerId === null && styles.chipTextActive]}>Gemeinsam</Text>
            </Pressable>
            {members.map((m) => (
              <Pressable
                key={m.id}
                style={[styles.chip, ownerId === m.id && styles.chipActive]}
                onPress={() => setOwnerId(m.id)}
              >
                <Text style={[styles.chipText, ownerId === m.id && styles.chipTextActive]}>
                  {m.id === userId ? 'Ich' : m.display_name}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.formButtons}>
            <Pressable style={styles.cancelButton} onPress={closeForm}>
              <Text style={styles.cancelText}>Abbrechen</Text>
            </Pressable>
            <Pressable style={styles.addButton} onPress={addItem}>
              <Text style={styles.addButtonText}>Hinzufügen</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={styles.openFormButton} onPress={openForm}>
          <Text style={styles.addButtonText}>+ Etwas hinzufügen</Text>
        </Pressable>
      )}

      {/* Liste, nach Orten gruppiert */}
      {visibleCount === 0 ? (
        <Text style={styles.empty}>Hier ist noch nichts eingetragen.</Text>
      ) : (
        visibleLocations.map((l) => {
          const locationItems = items.filter((i) => i.location === l.key);
          if (locationItems.length === 0) return null;
          return (
            <View key={l.key}>
              <Text style={styles.sectionTitle}>
                {l.emoji} {l.label}
              </Text>
              <View style={styles.card}>{locationItems.map(renderItem)}</View>
            </View>
          );
        })
      )}

      {visibleCount > 0 && <Text style={styles.hint}>Tippen, wenn etwas verbraucht ist</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingTop: 16 },
  chipScroll: { marginBottom: 16, marginHorizontal: -24, paddingHorizontal: 24 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  chip: {
    backgroundColor: '#F2E6DA', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14,
    marginRight: 8, marginBottom: 8,
  },
  chipActive: { backgroundColor: '#E07A5F' },
  chipText: { color: '#5C4033', fontSize: 14, fontWeight: '500' },
  chipTextActive: { color: 'white' },
  openFormButton: {
    backgroundColor: '#E07A5F', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 8,
  },
  formCard: { backgroundColor: 'white', borderRadius: 16, padding: 16, marginBottom: 8 },
  input: { backgroundColor: '#FFF8F0', borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 10 },
  formLabel: { fontSize: 15, fontWeight: '600', color: '#5C4033', marginTop: 6, marginBottom: 8 },
  formButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  cancelButton: { paddingVertical: 12, paddingHorizontal: 16, marginRight: 8 },
  cancelText: { color: '#8B6F5E', fontSize: 16 },
  addButton: { backgroundColor: '#E07A5F', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20 },
  addButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#5C4033', marginTop: 24, marginBottom: 12 },
  card: { backgroundColor: 'white', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 16, color: '#5C4033' },
  itemQuantity: { fontSize: 13,color: '#8B6F5E', marginTop: 2 },
  ownerBadge: { backgroundColor: '#F2E6DA', borderRadius: 10, paddingVertical: 4, paddingHorizontal: 10 },
  ownerBadgeShared: { backgroundColor: '#DCEBE3' },
  ownerText: { fontSize: 13, color: '#5C4033' },
  empty: { textAlign: 'center', color: '#8B6F5E', fontSize: 16, marginTop: 32 },
  hint: { textAlign: 'center', color: '#B5A397', fontSize: 13, marginTop: 24 },
});