import { DateTimeField } from '@/components/date-time-field';
import { Recurrence, RECURRENCE_LABELS, toDateKey } from '@/lib/recurrence';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

type Member = {
  id: string;
  display_name: string | null;
};

type Props = {
  visible: boolean;
  initialDate: Date;
  members: Member[];
  userId: string | null;
  onClose: () => void;
  onSaved: () => void;
};

// Datum von "picked" übernehmen, Uhrzeit von "base" behalten
function withDate(base: Date, picked: Date) {
  const d = new Date(base);
  d.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
  return d;
}

// Uhrzeit von "picked" übernehmen, Datum von "base" behalten
function withTime(base: Date, picked: Date) {
  const d = new Date(base);
  d.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
  return d;
}

export function EventForm({ visible, initialDate, members, userId, onClose, onSaved }: Props) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [start, setStart] = useState(new Date());
  const [end, setEnd] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recurrence, setRecurrence] = useState<Recurrence>('none');
  const [until, setUntil] = useState<Date | null>(null);
  const [rotation, setRotation] = useState<string[]>([]);

  // Beim Öffnen: alles zurücksetzen, Start = ausgewählter Tag zur nächsten vollen Stunde
  useEffect(() => {
    if (!visible) return;
    const nextHour = Math.min(new Date().getHours() + 1, 23);
    const s = new Date(initialDate);
    s.setHours(nextHour, 0, 0, 0);

    setTitle('');
    setNotes('');
    setAllDay(false);
    setIsPrivate(false);
    setStart(s);
    setEnd(null);
    setError(null);
    setRecurrence('none');
    setUntil(null);
    setRotation([]);
  }, [visible, initialDate]);

  function toggleEnd(on: boolean) {
    if (on) {
      const e = new Date(start);
      e.setHours(Math.min(start.getHours() + 1, 23), start.getMinutes(), 0, 0);
      setEnd(e);
    } else {
      setEnd(null);
    }
  }

    // Sobald jemand reihum dran ist, ist der Termin automatisch gemeinsam
  const rotationActive = recurrence !== 'none' && rotation.length > 0;

    function toggleUntil(on: boolean) {
    if (on) {
      const u = new Date(start);
      u.setMonth(u.getMonth() + 3); // Vorschlag: in 3 Monaten
      setUntil(u);
    } else {
      setUntil(null);
    }
  }

  // Antippen fügt hinten an, nochmal antippen entfernt
  function toggleRotation(id: string) {
    setRotation((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  }

  async function save() {
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Bitte gib dem Termin einen Titel.');
      return;
    }

    let startsAt = start;
    let endsAt: Date | null = null;

    if (allDay) {
      startsAt = new Date(start);
      startsAt.setHours(0, 0, 0, 0);
    } else if (end) {
      endsAt = withTime(start, end);
      if (endsAt < startsAt) {
        setError('Das Ende muss nach dem Beginn liegen.');
        return;
      }
    }

      if (recurrence !== 'none' && until && toDateKey(until) < toDateKey(startsAt)) {
      setError('Das Enddatum der Wiederholung muss nach dem ersten Termin liegen.');
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('calendar_events').insert({
      title: trimmed,
      notes: notes.trim() || null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt?.toISOString() ?? null,
      all_day: allDay,
      is_private: isPrivate && !rotationActive,
      recurrence,
      recurrence_until: recurrence !== 'none' && until ? toDateKey(until) : null,
      rotation: recurrence !== 'none' && rotation.length > 0 ? rotation : null,
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
          <Text style={styles.headerTitle}>Neuer Termin</Text>
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
          <TextInput
            style={styles.titleInput}
            placeholder="Was steht an?"
            value={title}
            onChangeText={setTitle}
            maxLength={100}
            autoFocus
          />

          {/* Zeit */}
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>Ganztägig</Text>
              <Switch
                value={allDay}
                onValueChange={setAllDay}
                trackColor={{ true: '#E07A5F', false: '#D9C7B8' }}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.row}>
              <Text style={styles.label}>Datum</Text>
              <DateTimeField value={start} mode="date" onChange={(d) => setStart(withDate(start, d))} />
            </View>

            {!allDay && (
              <>
                <View style={styles.divider} />
                <View style={styles.row}>
                  <Text style={styles.label}>Beginn</Text>
                  <DateTimeField value={start} mode="time" onChange={(d) => setStart(withTime(start, d))} />
                </View>

                <View style={styles.divider} />
                <View style={styles.row}>
                  <Text style={styles.label}>Endzeit</Text>
                  <Switch
                    value={end !== null}
                    onValueChange={toggleEnd}
                    trackColor={{ true: '#E07A5F', false: '#D9C7B8' }}
                  />
                </View>

                {end && (
                  <>
                    <View style={styles.divider} />
                    <View style={styles.row}>
                      <Text style={styles.label}>Ende</Text>
                      <DateTimeField value={end} mode="time" onChange={(d) => setEnd(withTime(end, d))} />
                    </View>
                  </>
                )}
              </>
            )}
          </View>

                    {/* Wiederholen */}
          <Text style={styles.sectionLabel}>Wiederholen</Text>
          <View style={styles.chipWrap}>
            {(Object.keys(RECURRENCE_LABELS) as Recurrence[]).map((r) => (
              <Pressable
                key={r}
                style={[styles.chip, recurrence === r && styles.chipActive]}
                onPress={() => setRecurrence(r)}
              >
                <Text style={[styles.chipText, recurrence === r && styles.chipTextActive]}>
                  {RECURRENCE_LABELS[r]}
                </Text>
              </Pressable>
            ))}
          </View>

          {recurrence !== 'none' && (
            <>
              <View style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.label}>Enddatum</Text>
                  <Switch
                    value={until !== null}
                    onValueChange={toggleUntil}
                    trackColor={{ true: '#E07A5F', false: '#D9C7B8' }}
                  />
                </View>
                {until && (
                  <>
                    <View style={styles.divider} />
                    <View style={styles.row}>
                      <Text style={styles.label}>Wiederholen bis</Text>
                      <DateTimeField value={until} mode="date" onChange={setUntil} minimumDate={start} />
                    </View>
                  </>
                )}
              </View>

              <Text style={styles.sectionLabel}>Reihum dran (optional)</Text>
              <Text style={styles.sectionHint}>
                Tippe die Personen in der Reihenfolge an, in der sie dran sein sollen.
              </Text>
              <View style={styles.chipWrap}>
                {members.map((m) => {
                  const position = rotation.indexOf(m.id);
                  const active = position !== -1;
                  return (
                    <Pressable
                      key={m.id}
                      style={[styles.chip, active && styles.chipActiveGreen]}
                      onPress={() => toggleRotation(m.id)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {active ? `${position + 1}. ` : ''}
                        {m.id === userId ? 'Ich' : m.display_name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {/* Privat */}
          <View style={[styles.card, rotationActive && styles.cardDisabled]}>
            <View style={styles.row}>
              <View style={styles.labelBlock}>
                <Text style={styles.label}>🔒 Privat</Text>
                <Text style={styles.sublabel}>
                  {rotationActive
                    ? 'Termine mit Rotation sieht immer die ganze WG.'
                    : isPrivate
                      ? 'Nur du siehst diesen Termin.'
                      : 'Die ganze WG sieht diesen Termin.'}
                </Text>
              </View>
              <Switch
                value={isPrivate && !rotationActive}
                onValueChange={setIsPrivate}
                disabled={rotationActive}
                trackColor={{ true: '#E07A5F', false: '#D9C7B8' }}
              />
            </View>
          </View>

          {/* Notizen */}
          <TextInput
            style={styles.notesInput}
            placeholder="Notizen (optional)"
            value={notes}
            onChangeText={setNotes}
            multiline
          />
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
  titleInput: {
    backgroundColor: 'white', borderRadius: 14, padding: 16, fontSize: 18,
    fontWeight: '600', color: '#5C4033', marginBottom: 16,
  },
  card: { backgroundColor: 'white', borderRadius: 14, paddingHorizontal: 16, marginBottom: 16 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    minHeight: 52, paddingVertical: 6,
  },
  divider: { height: 1, backgroundColor: '#F2E6DA' },
  label: { fontSize: 16, color: '#5C4033' },
  labelBlock: { flex: 1, marginRight: 12 },
  sublabel: { fontSize: 13, color: '#8B6F5E', marginTop: 2 },
  notesInput: {
    backgroundColor: 'white', borderRadius: 14, padding: 16, fontSize: 16,
    minHeight: 100, textAlignVertical: 'top', color: '#5C4033',
  },
  errorBox: { backgroundColor: '#FBE3DC', borderRadius: 12, padding: 12, marginBottom: 16 },
  errorText: { color: '#C0503A', fontSize: 15, fontWeight: '500', textAlign: 'center' },
  sectionLabel: { fontSize: 15, fontWeight: '700', color: '#5C4033', marginTop: 4, marginBottom: 10 },
  sectionHint: { fontSize: 13, color: '#8B6F5E', marginTop: -6, marginBottom: 10 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  chip: {
    backgroundColor: '#F2E6DA', borderRadius: 20, paddingVertical: 9, paddingHorizontal: 15,
    marginRight: 8, marginBottom: 8,
  },
  chipActive: { backgroundColor: '#E07A5F' },
  chipActiveGreen: { backgroundColor: '#81B29A' },
  chipText: { color: '#5C4033', fontSize: 15, fontWeight: '500' },
  chipTextActive: { color: 'white' },
    cardDisabled: { opacity: 0.6 },
});