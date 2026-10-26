import { DateTimeField } from '@/components/date-time-field';
import { formatEuro, parseAmount } from '@/lib/money';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

export type Member = {
  id: string;
  display_name: string | null;
};

type Props = {
  visible: boolean;
  members: Member[];
  userId: string | null;
  onClose: () => void;
  onSaved: () => void;
};

// Datum als "2026-10-11" (lokale Zeit, nicht UTC)
function toDateString(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function ExpenseForm({ visible, members, userId, onClose, onSaved }: Props) {
  const [title, setTitle] = useState('');
  const [amountText, setAmountText] = useState('');
  const [paidBy, setPaidBy] = useState<string | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [date, setDate] = useState(new Date());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Beim Öffnen: ich habe bezahlt, alle teilen, heute
  useEffect(() => {
    if (!visible) return;
    setTitle('');
    setAmountText('');
    setPaidBy(userId);
    setParticipants(members.map((m) => m.id));
    setDate(new Date());
    setError(null);
  }, [visible, userId, members]);

  function nameOf(m: Member) {
    return m.id === userId ? 'Ich' : m.display_name ?? '?';
  }

  function toggleParticipant(id: string) {
    setParticipants((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  const amountCents = parseAmount(amountText);
  const perPerson = amountCents && participants.length > 0 ? amountCents / participants.length : null;

  async function save() {
    if (!title.trim()) {
      setError('Wofür war die Ausgabe?');
      return;
    }
    if (!amountCents) {
      setError('Bitte gib einen gültigen Betrag ein, z. B. 12,50.');
      return;
    }
    if (!paidBy) {
      setError('Wer hat bezahlt?');
      return;
    }
    if (participants.length === 0) {
      setError('Bitte wähle mindestens eine Person, auf die aufgeteilt wird.');
      return;
    }

    setSaving(true);
    const { error } = await supabase.rpc('create_expense', {
      p_title: title.trim(),
      p_amount_cents: amountCents,
      p_paid_by: paidBy,
      p_participants: participants,
      p_spent_on: toDateString(date),
    });
    setSaving(false);

    if (error) {
      setError(`Das hat nicht geklappt: ${error.message}`);
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.screen}>
        {/* Kopfzeile */}
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.headerCancel}>Abbrechen</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Neue Ausgabe</Text>
          <Pressable onPress={save} disabled={saving} hitSlop={10}>
            <Text style={[styles.headerSave, saving && styles.disabled]}>Sichern</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          {/* Betrag */}
          <View style={styles.amountBox}>
            <TextInput
              style={styles.amountInput}
              placeholder="0,00"
              placeholderTextColor="#D9C7B8"
              value={amountText}
              onChangeText={setAmountText}
              keyboardType="decimal-pad"
              autoFocus
            />
            <Text style={styles.amountCurrency}>€</Text>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Wofür? z. B. Wocheneinkauf"
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />

          {/* Datum */}
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>Datum</Text>
              <DateTimeField value={date} mode="date" onChange={setDate} />
            </View>
          </View>

          {/* Wer hat bezahlt */}
          <Text style={styles.sectionLabel}>Wer hat bezahlt?</Text>
          <View style={styles.chipWrap}>
            {members.map((m) => (
              <Pressable
                key={m.id}
                style={[styles.chip, paidBy === m.id && styles.chipActive]}
                onPress={() => setPaidBy(m.id)}
              >
                <Text style={[styles.chipText, paidBy === m.id && styles.chipTextActive]}>{nameOf(m)}</Text>
              </Pressable>
            ))}
          </View>

          {/* Auf wen aufteilen */}
          <Text style={styles.sectionLabel}>Aufteilen auf</Text>
          <View style={styles.chipWrap}>
            {members.map((m) => {
              const active = participants.includes(m.id);
              return (
                <Pressable
                  key={m.id}
                  style={[styles.chip, active && styles.chipActiveGreen]}
                  onPress={() => toggleParticipant(m.id)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {active ? '✓ ' : ''}
                    {nameOf(m)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {perPerson !== null && (
            <Text style={styles.preview}>
              {participants.length === 1
                ? `Geht komplett auf eine Person: ${formatEuro(amountCents!)}`
                : `${formatEuro(Math.floor(perPerson))} pro Person`}
            </Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFF8F0' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#F2E6DA',
  },
  headerCancel: { fontSize: 16, color: '#8B6F5E' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#5C4033' },
  headerSave: { fontSize: 16, color: '#E07A5F', fontWeight: '700' },
  disabled: { opacity: 0.4 },
  content: { padding: 20 },

  amountBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 16 },
  amountInput: { fontSize: 48, fontWeight: '700', color: '#5C4033', minWidth: 120, textAlign: 'center' },
  amountCurrency: { fontSize: 36, fontWeight: '600', color: '#8B6F5E', marginLeft: 6 },

  input: { backgroundColor: 'white', borderRadius: 14, padding: 16, fontSize: 16, color: '#5C4033', marginBottom: 16 },
  card: { backgroundColor: 'white', borderRadius: 14, paddingHorizontal: 16, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 52 },
  label: { fontSize: 16, color: '#5C4033' },

  sectionLabel: { fontSize: 15, fontWeight: '700', color: '#5C4033', marginTop: 20, marginBottom: 10 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: {
    backgroundColor: '#F2E6DA', borderRadius: 20, paddingVertical: 9, paddingHorizontal: 15,
    marginRight: 8, marginBottom: 8,
  },
  chipActive: { backgroundColor: '#E07A5F' },
  chipActiveGreen: { backgroundColor: '#81B29A' },
  chipText: { color: '#5C4033', fontSize: 15, fontWeight: '500' },
  chipTextActive: { color: 'white' },

  preview: { textAlign: 'center', color: '#8B6F5E', fontSize: 15, marginTop: 16 },
  errorBox: { backgroundColor: '#FBE3DC', borderRadius: 12, padding: 12, marginBottom: 8 },
  errorText: { color: '#C0503A', fontSize: 15, fontWeight: '500', textAlign: 'center' },
});