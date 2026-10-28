import { DateTimeField } from '@/components/date-time-field';
import { formatEuro, parseAmount, parseShare } from '@/lib/money';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { ComponentRef, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type Member = {
  id: string;
  display_name: string | null;
};

// Eine bestehende Ausgabe, die bearbeitet wird
export type EditableExpense = {
  id: string;
  title: string;
  amount_cents: number;
  paid_by: string;
  spent_on: string;
};

type Props = {
  visible: boolean;
  members: Member[];
  userId: string | null;
  editExpense?: EditableExpense | null;
  onClose: () => void;
  onSaved: () => void;
};

type SplitMode = 'equal' | 'amounts';

// Datum als "2026-10-11" (lokale Zeit, nicht UTC)
function toDateString(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 1250 → "12,50" (für Eingabefelder)
function centsToInput(cents: number) {
  return (cents / 100).toFixed(2).replace('.', ',');
}

// Gleichmäßige Aufteilung in Cent, übrige Cents an die ersten
function equalSplit(total: number, count: number) {
  const base = Math.floor(total / count);
  const rest = total % count;
  return Array.from({ length: count }, (_, i) => base + (i < rest ? 1 : 0));
}

export function ExpenseForm({ visible, members, userId, editExpense, onClose, onSaved }: Props) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  // Bei den Feldern ganz unten: nach unten scrollen, sobald die Tastatur da ist
  function scrollToBottom() {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
  }
  const [title, setTitle] = useState('');
  const [amountText, setAmountText] = useState('');
  const [paidBy, setPaidBy] = useState<string | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [date, setDate] = useState(new Date());
  const [splitMode, setSplitMode] = useState<SplitMode>('equal');
  const [shareTexts, setShareTexts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Beim Öffnen: Werte der Ausgabe übernehmen (Bearbeiten) oder zurücksetzen (Neu)
  useEffect(() => {
    if (!visible) return;
    setError(null);

    if (editExpense) {
      setTitle(editExpense.title);
      setAmountText(centsToInput(editExpense.amount_cents));
      setPaidBy(editExpense.paid_by);
      const [y, m, d] = editExpense.spent_on.split('-').map(Number);
      setDate(new Date(y, m - 1, d));

      // Bisherige Aufteilung laden
      setParticipants([]);
      setSplitMode('equal');
      setShareTexts({});
      supabase
        .from('expense_splits')
        .select('user_id, amount_cents')
        .eq('expense_id', editExpense.id)
        .then(({ data, error }) => {
          if (error) {
            console.error(error);
            return;
          }
          const splits = data ?? [];
          setParticipants(splits.map((s) => s.user_id));

          // Weichen die Anteile um mehr als 1 Cent ab? Dann war es eine ungleiche Aufteilung
          const amounts = splits.map((s) => s.amount_cents);
          if (amounts.length > 0 && Math.max(...amounts) - Math.min(...amounts) > 1) {
            setSplitMode('amounts');
            setShareTexts(Object.fromEntries(splits.map((s) => [s.user_id, centsToInput(s.amount_cents)])));
          }
        });
      return;
    }

    setTitle('');
    setAmountText('');
    setPaidBy(userId);
    setParticipants(members.map((m) => m.id));
    setDate(new Date());
    setSplitMode('equal');
    setShareTexts({});
  }, [visible, userId, members, editExpense]);

  function nameOf(m: Member) {
    return m.id === userId ? 'Ich' : m.display_name ?? '?';
  }

  function toggleParticipant(id: string) {
    setParticipants((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  const amountCents = parseAmount(amountText);

  // Ausgewählte Personen in der Reihenfolge der Mitbewohner-Liste
  const selected = members.filter((m) => participants.includes(m.id));

  function switchMode(mode: SplitMode) {
    // Beim Wechsel zu "Beträge": mit der gleichmäßigen Aufteilung vorbelegen
    if (mode === 'amounts' && amountCents && selected.length > 0) {
      const split = equalSplit(amountCents, selected.length);
      setShareTexts(Object.fromEntries(selected.map((m, i) => [m.id, centsToInput(split[i])])));
    }
    setSplitMode(mode);
  }

  // Summe der eingegebenen Anteile (null, wenn ein Feld ungültig ist)
  const shareValues = selected.map((m) => parseShare(shareTexts[m.id] ?? ''));
  const sharesValid = shareValues.every((v) => v !== null);
  const sharesSum = sharesValid ? (shareValues as number[]).reduce((a, b) => a + b, 0) : null;
  const sharesDiff = amountCents !== null && sharesSum !== null ? amountCents - sharesSum : null;

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
    if (selected.length === 0) {
      setError('Bitte wähle mindestens eine Person, auf die aufgeteilt wird.');
      return;
    }

    let amounts: number[] | null = null;
    if (splitMode === 'amounts') {
      if (!sharesValid) {
        setError('Mindestens ein Betrag ist ungültig, z. B. 12,50.');
        return;
      }
      if (sharesDiff !== 0) {
        setError('Die einzelnen Beträge müssen genau die Gesamtsumme ergeben.');
        return;
      }
      amounts = shareValues as number[];
    }

    setSaving(true);
    const params = {
      p_title: title.trim(),
      p_amount_cents: amountCents,
      p_paid_by: paidBy,
      p_participants: selected.map((m) => m.id),
      p_spent_on: toDateString(date),
      p_amounts: amounts,
    };

    const { error } = editExpense
      ? await supabase.rpc('update_expense', { p_expense_id: editExpense.id, ...params })
      : await supabase.rpc('create_expense', params);
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
        <View style={[styles.header, Platform.OS === 'android' && { paddingTop: insets.top + 12 }]}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.headerCancel}>Abbrechen</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{editExpense ? 'Ausgabe bearbeiten' : 'Neue Ausgabe'}</Text>
          <Pressable onPress={save} disabled={saving} hitSlop={10}>
            <Text style={[styles.headerSave, saving && styles.disabled]}>Sichern</Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
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
              placeholderTextColor={colors.border}
              value={amountText}
              onChangeText={setAmountText}
              keyboardType="decimal-pad"
              autoFocus={!editExpense}
            />
            <Text style={styles.amountCurrency}>€</Text>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Wofür? z. B. Wocheneinkauf"
            placeholderTextColor={colors.textFaint}
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

          {/* Gleichmäßig oder eigene Beträge */}
          {selected.length > 1 && (
            <View style={styles.modeTabs}>
              <Pressable
                style={[styles.modeTab, splitMode === 'equal' && styles.modeTabActive]}
                onPress={() => switchMode('equal')}
              >
                <Text style={[styles.modeTabText, splitMode === 'equal' && styles.modeTabTextActive]}>
                  Gleichmäßig
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modeTab, splitMode === 'amounts' && styles.modeTabActive]}
                onPress={() => switchMode('amounts')}
              >
                <Text style={[styles.modeTabText, splitMode === 'amounts' && styles.modeTabTextActive]}>
                  Beträge
                </Text>
              </Pressable>
            </View>
          )}

          {splitMode === 'amounts' && selected.length > 1 ? (
            <>
              <View style={styles.card}>
                {selected.map((m, i) => (
                  <View key={m.id} style={[styles.shareRow, i > 0 && styles.shareRowBorder]}>
                    <Text style={styles.label}>{nameOf(m)}</Text>
                    <View style={styles.shareInputBox}>
                      <TextInput
                        style={styles.shareInput}
                        placeholder="0,00"
                        placeholderTextColor={colors.textFaint}
                        value={shareTexts[m.id] ?? ''}
                        onChangeText={(text) => setShareTexts((prev) => ({ ...prev, [m.id]: text }))}
                        keyboardType="decimal-pad"
                      />
                      <Text style={styles.shareCurrency}>€</Text>
                    </View>
                  </View>
                ))}
              </View>

              <Text
                style={[
                  styles.preview,
                  sharesDiff === 0 && styles.previewOk,
                  sharesDiff !== null && sharesDiff !== 0 && styles.previewWarn,
                ]}
              >
                {amountCents === null
                  ? 'Gib oben zuerst den Gesamtbetrag ein.'
                  : !sharesValid
                    ? 'Mindestens ein Betrag ist ungültig.'
                    : sharesDiff === 0
                      ? '✓ Passt genau'
                      : sharesDiff! > 0
                        ? `Noch ${formatEuro(sharesDiff!)} offen`
                        : `${formatEuro(-sharesDiff!)} zu viel`}
              </Text>
            </>
          ) : (
            amountCents !== null &&
            selected.length > 0 && (
              <Text style={styles.preview}>
                {selected.length === 1
                  ? `Geht komplett auf eine Person: ${formatEuro(amountCents)}`
                  : `${formatEuro(Math.floor(amountCents / selected.length))} pro Person`}
              </Text>
            )
          )}
        </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: colors.surfaceMuted,
  },
  headerCancel: { fontSize: 16, color: colors.textMuted },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  headerSave: { fontSize: 16, color: colors.accent, fontWeight: '700' },
  disabled: { opacity: 0.4 },
  content: { padding: 20, paddingBottom: 60 },
  errorBox: { backgroundColor: colors.dangerSoft, borderRadius: 12, padding: 12, marginBottom: 8 },
  errorText: { color: colors.danger, fontSize: 15, fontWeight: '500', textAlign: 'center' },

  amountBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 16 },
  amountInput: { fontSize: 48, fontWeight: '700', color: colors.text, minWidth: 120, textAlign: 'center' },
  amountCurrency: { fontSize: 36, fontWeight: '600', color: colors.textMuted, marginLeft: 6 },

  input: {
    backgroundColor: colors.surface, borderRadius: 14, padding: 16, fontSize: 16,
    color: colors.text, marginBottom: 16,
  },
  card: { backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 16, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 52 },
  label: { fontSize: 16, color: colors.text },

  sectionLabel: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 20, marginBottom: 10 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: {
    backgroundColor: colors.surfaceMuted, borderRadius: 20, paddingVertical: 9, paddingHorizontal: 15,
    marginRight: 8, marginBottom: 8,
  },
  chipActive: { backgroundColor: colors.accent },
  chipActiveGreen: { backgroundColor: colors.success },
  chipText: { color: colors.text, fontSize: 15, fontWeight: '500' },
  chipTextActive: { color: 'white' },

  modeTabs: {
    flexDirection: 'row', backgroundColor: colors.surfaceMuted, borderRadius: 12,
    padding: 4, marginTop: 8, marginBottom: 12,
  },
  modeTab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  modeTabActive: { backgroundColor: colors.surface },
  modeTabText: { color: colors.textMuted, fontWeight: '500' },
  modeTabTextActive: { color: colors.text, fontWeight: '700' },

  shareRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 56 },
  shareRowBorder: { borderTopWidth: 1, borderTopColor: colors.surfaceMuted },
  shareInputBox: { flexDirection: 'row', alignItems: 'center' },
  shareInput: {
    backgroundColor: colors.background, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12,
    fontSize: 16, color: colors.text, minWidth: 90, textAlign: 'right',
  },
  shareCurrency: { fontSize: 16, color: colors.textMuted, marginLeft: 6 },

  preview: { textAlign: 'center', color: colors.textMuted, fontSize: 15, marginTop: 16 },
  previewOk: { color: colors.success, fontWeight: '600' },
  previewWarn: { color: colors.danger, fontWeight: '600' },
  flex: { flex: 1 },
});