import { DateTimeField } from '@/components/date-time-field';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

type Props = {
  visible: boolean;
  initialDate: Date;
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

export function EventForm({ visible, initialDate, onClose, onSaved }: Props) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [start, setStart] = useState(new Date());
  const [end, setEnd] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    setSaving(true);
    const { error } = await supabase.from('calendar_events').insert({
      title: trimmed,
      notes: notes.trim() || null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt?.toISOString() ?? null,
      all_day: allDay,
      is_private: isPrivate,
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

          {/* Privat */}
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.labelBlock}>
                <Text style={styles.label}>🔒 Privat</Text>
                <Text style={styles.sublabel}>
                  {isPrivate ? 'Nur du siehst diesen Termin.' : 'Die ganze WG sieht diesen Termin.'}
                </Text>
              </View>
              <Switch
                value={isPrivate}
                onValueChange={setIsPrivate}
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
});