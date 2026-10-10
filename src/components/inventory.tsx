import { ActionSheet } from '@/components/action-sheet';
import { supabase } from '@/lib/supabase';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

type Location = {
  id: string;
  name: string;
  emoji: string;
};

type InventoryItem = {
  id: string;
  name: string;
  quantity: string | null;
  location_id: string;
  owner_id: string | null;
};

type Member = {
  id: string;
  display_name: string | null;
};

export function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);

  // Formular: neues Ding
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [locationId, setLocationId] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);

  // Formular: neuer Ort
  const [showNewLocation, setShowNewLocation] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationEmoji, setNewLocationEmoji] = useState('');

  const loadItems = useCallback(async () => {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('id, name, quantity, location_id, owner_id')
      .order('name');
    if (error) console.error(error);
    else setItems(data ?? []);
  }, []);

  const loadLocations = useCallback(async () => {
    const { data, error } = await supabase
      .from('inventory_locations')
      .select('id, name, emoji')
      .order('sort_order')
      .order('created_at');
    if (error) console.error(error);
    else setLocations(data ?? []);
  }, []);

  useEffect(() => {
    loadItems();
    loadLocations();
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
      .channel('inventory-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, () => loadItems())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_locations' }, () => loadLocations())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadItems, loadLocations]);

  function ownerLabel(id: string | null) {
    if (!id) return 'gemeinsam';
    if (id === userId) return 'du';
    return members.find((m) => m.id === id)?.display_name ?? 'ehemalig';
  }

  // ---------- Dinge ----------

  function openForm() {
    setLocationId(filter === 'all' ? locations[0]?.id ?? null : filter);
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
    if (!locationId) {
      Alert.alert('Hoppla', 'Bitte wähle einen Ort.');
      return;
    }

    const { error } = await supabase.from('inventory_items').insert({
      name: trimmed,
      quantity: quantity.trim() || null,
      location_id: locationId,
      owner_id: ownerId,
    });

    if (error) {
      Alert.alert('Das hat nicht geklappt', error.message);
      return;
    }
    closeForm();
    loadItems();
  }

  async function removeItem(item: InventoryItem, addToShoppingList: boolean) {
    setItems((prev) => prev.filter((i) => i.id !== item.id));

    if (addToShoppingList) {
      const { error } = await supabase.from('shopping_items').insert({ name: item.name });
      if (error) {
        loadItems();
        Alert.alert('Das hat nicht geklappt', error.message);
        return;
      }
    }

    const { error } = await supabase.from('inventory_items').delete().eq('id', item.id);
    if (error) {
      loadItems();
      Alert.alert('Das hat nicht geklappt', error.message);
    }
  }

  // ---------- Orte ----------

  async function addLocation() {
    const trimmed = newLocationName.trim();
    if (!trimmed) {
      Alert.alert('Hoppla', 'Bitte gib dem Ort einen Namen.');
      return;
    }

    const { data, error } = await supabase
      .from('inventory_locations')
      .insert({ name: trimmed, emoji: newLocationEmoji.trim() || '📦' })
      .select('id')
      .single();

    if (error) {
      Alert.alert('Das hat nicht geklappt', error.message);
      return;
    }

    setNewLocationName('');
    setNewLocationEmoji('');
    setShowNewLocation(false);
    setFilter(data.id); // neuen Ort direkt anzeigen
    if (showForm) setLocationId(data.id);
    loadLocations();
  }

  async function deleteLocation(location: Location) {
    if (items.some((i) => i.location_id === location.id)) {
      Alert.alert('Ort ist nicht leer', `In „${location.name}“ liegen noch Sachen. Entferne sie zuerst.`);
      return;
    }

    const { error } = await supabase.from('inventory_locations').delete().eq('id', location.id);
    if (error) {
      Alert.alert('Das hat nicht geklappt', error.message);
      return;
    }
    if (filter === location.id) setFilter('all');
    loadLocations();
  }

  // ---------- Anzeige ----------

  function renderItem(item: InventoryItem) {
    return (
      <Pressable key={item.id} style={styles.itemRow} onPress={() => setSelectedItem(item)}>
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

  const visibleLocations = filter === 'all' ? locations : locations.filter((l) => l.id === filter);
  const visibleCount = items.filter((i) => filter === 'all' || i.location_id === filter).length;

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Filter-Chips (gedrückt halten = Ort verwalten) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipScrollContent}
      >
        <Pressable style={[styles.chip, filter === 'all' && styles.chipActive]} onPress={() => setFilter('all')}>
          <Text style={[styles.chipText, filter === 'all' && styles.chipTextActive]}>Alle</Text>
        </Pressable>
        {locations.map((l) => (
          <Pressable
            key={l.id}
            style={[styles.chip, filter === l.id && styles.chipActive]}
            onPress={() => setFilter(l.id)}
            onLongPress={() => setSelectedLocation(l)}
          >
            <Text style={[styles.chipText, filter === l.id && styles.chipTextActive]}>
              {l.emoji} {l.name}
            </Text>
          </Pressable>
        ))}
        <Pressable style={[styles.chip, styles.chipNew, styles.chipPlus]} onPress={() => setShowNewLocation(true)}>
          <Text style={styles.chipPlusText}>+</Text>
        </Pressable>
      </ScrollView>

      {/* Neuer Ort */}
      {showNewLocation && (
        <View style={styles.newLocationCard}>
          <Text style={styles.formLabel}>Neuer Ort</Text>
          <View style={styles.newLocationRow}>
            <TextInput
              style={[styles.input, styles.emojiInput]}
              placeholder="📦"
              value={newLocationEmoji}
              onChangeText={setNewLocationEmoji}
            />
            <TextInput
              style={[styles.input, styles.newLocationInput]}
              placeholder="z. B. Balkon"
              value={newLocationName}
              onChangeText={setNewLocationName}
              autoFocus
            />
          </View>
          <View style={styles.formButtons}>
            <Pressable
              style={styles.cancelButton}
              onPress={() => {
                setNewLocationName('');
                setNewLocationEmoji('');
                setShowNewLocation(false);
              }}
            >
              <Text style={styles.cancelText}>Abbrechen</Text>
            </Pressable>
            <Pressable style={styles.addButton} onPress={addLocation}>
              <Text style={styles.addButtonText}>Ort anlegen</Text>
            </Pressable>
          </View>
        </View>
      )}

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
            {locations.map((l) => (
              <Pressable
                key={l.id}
                style={[styles.chip, locationId === l.id && styles.chipActive]}
                onPress={() => setLocationId(l.id)}
              >
                <Text style={[styles.chipText, locationId === l.id && styles.chipTextActive]}>
                  {l.emoji} {l.name}
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
          const locationItems = items.filter((i) => i.location_id === l.id);
          if (locationItems.length === 0) return null;
          return (
            <View key={l.id}>
              <Text style={styles.sectionTitle}>
                {l.emoji} {l.name}
              </Text>
              <View style={styles.card}>{locationItems.map(renderItem)}</View>
            </View>
          );
        })
      )}

      <Text style={styles.hint}>
        Ding antippen, wenn es verbraucht ist · Ort oben gedrückt halten zum Verwalten
      </Text>

      {/* Menü für ein Ding */}
      <ActionSheet
        visible={selectedItem !== null}
        title={selectedItem?.name}
        subtitle={
          selectedItem
            ? [
                selectedItem.quantity,
                `gehört ${ownerLabel(selectedItem.owner_id) === 'du' ? 'dir' : ownerLabel(selectedItem.owner_id)}`,
              ]
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
        actions={
          selectedItem
            ? [
                { label: 'Verbraucht', emoji: '✅', onPress: () => removeItem(selectedItem, false) },
                { label: 'Verbraucht + auf Einkaufsliste', emoji: '🛒', onPress: () => removeItem(selectedItem, true) },
              ]
            : []
        }
        onClose={() => setSelectedItem(null)}
      />

      {/* Menü für einen Ort */}
      <ActionSheet
        visible={selectedLocation !== null}
        title={selectedLocation ? `${selectedLocation.emoji} ${selectedLocation.name}` : undefined}
        actions={
          selectedLocation
            ? [{ label: 'Ort löschen', emoji: '🗑️', destructive: true, onPress: () => deleteLocation(selectedLocation) }]
            : []
        }
        onClose={() => setSelectedLocation(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingTop: 16 },
  chipScroll: { marginBottom: 16, marginHorizontal: -24 },
  chipScrollContent: { paddingHorizontal: 24 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  chip: {
    backgroundColor: '#F2E6DA', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14,
    marginRight: 8, marginBottom: 8,
  },
  chipActive: { backgroundColor: '#E07A5F' },
  chipNew: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#D9C7B8', borderStyle: 'dashed' },
  chipText: { color: '#5C4033', fontSize: 14, fontWeight: '500' },
  chipTextActive: { color: 'white' },
  openFormButton: {
    backgroundColor: '#E07A5F', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 8,
  },
  formCard: { backgroundColor: 'white', borderRadius: 16, padding: 16, marginBottom: 8 },
  input: { backgroundColor: '#FFF8F0', borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 10 },
  formLabel: { fontSize: 15, fontWeight: '600', color: '#5C4033', marginTop: 6, marginBottom: 8 },
  newLocationRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  emojiInput: { width: 56, textAlign: 'center', marginRight: 8 },
  newLocationInput: { flex: 1 },
  smallButton: {
    width: 48, height: 48, borderRadius: 12, backgroundColor: '#81B29A',
    alignItems: 'center', justifyContent: 'center',
  },
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
  itemQuantity: { fontSize: 13, color: '#8B6F5E', marginTop: 2 },
  ownerBadge: { backgroundColor: '#F2E6DA', borderRadius: 10, paddingVertical: 4, paddingHorizontal: 10 },
  ownerBadgeShared: { backgroundColor: '#DCEBE3' },
  ownerText: { fontSize: 13, color: '#5C4033' },
  empty: { textAlign: 'center', color: '#8B6F5E', fontSize: 16, marginTop: 32 },
  hint: { textAlign: 'center', color: '#B5A397', fontSize: 13, marginTop: 24 },
  chipPlus: { marginRight: 0, paddingHorizontal: 16 },
  chipPlusText: { color: '#8B6F5E', fontSize: 16, fontWeight: '700' },
  newLocationCard: { backgroundColor: 'white', borderRadius: 16, padding: 16, marginBottom: 16 },
});