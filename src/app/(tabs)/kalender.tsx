import { ActionSheet } from '@/components/action-sheet';
import { formatDate, formatTime } from '@/components/date-time-field';
import { EventForm } from '@/components/event-form';
import { useDialog } from '@/lib/dialog';
import {
  expandOccurrences,
  Occurrence,
  Recurrence,
  RECURRENCE_LABELS,
  toDateKey,
} from '@/lib/recurrence';
import { supabase } from '@/lib/supabase';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type CalendarEvent = {
  id: string;
  title: string;
  notes: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  is_private: boolean;
  created_by: string | null;
  recurrence: Recurrence;
  recurrence_until: string | null;
  rotation: string[] | null;
  excluded_dates: string[];
};

type Member = {
  id: string;
  display_name: string | null;
};

type Occ = Occurrence<CalendarEvent>;

const FIELDS =
  'id, title, notes, starts_at, ends_at, all_day, is_private, created_by, recurrence, recurrence_until, rotation, excluded_dates';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

// ---------- Datums-Helfer ----------

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfWeek(date: Date) {
  const d = startOfDay(date);
  const dayIndex = (d.getDay() + 6) % 7; // Montag = 0
  d.setDate(d.getDate() - dayIndex);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

// Einmalige Termine im Zeitraum + alle Serien, die in den Zeitraum hineinreichen
async function fetchEvents(from: Date, to: Date): Promise<CalendarEvent[]> {
  const [single, recurring] = await Promise.all([
    supabase
      .from('calendar_events')
      .select(FIELDS)
      .eq('recurrence', 'none')
      .gte('starts_at', from.toISOString())
      .lt('starts_at', to.toISOString()),
    supabase
      .from('calendar_events')
      .select(FIELDS)
      .neq('recurrence', 'none')
      .lt('starts_at', to.toISOString())
      .or(`recurrence_until.is.null,recurrence_until.gte.${toDateKey(from)}`),
  ]);

  if (single.error) console.error(single.error);
  if (recurring.error) console.error(recurring.error);
  return [...(single.data ?? []), ...(recurring.data ?? [])];
}

// Aus Terminen die einzelnen Auftreten im Zeitraum berechnen, sortiert
function toOccurrences(events: CalendarEvent[], from: Date, to: Date): Occ[] {
  return events
    .flatMap((e) => expandOccurrences(e, from, to))
    .sort((a, b) => {
      if (a.event.all_day !== b.event.all_day) return a.event.all_day ? -1 : 1;
      return a.start.getTime() - b.start.getTime();
    });
}

// ---------- Screen ----------

export default function Kalender() {
  const dialog = useDialog();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [occurrences, setOccurrences] = useState<Occ[]>([]);
  const [upcoming, setUpcoming] = useState<Occ[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedOcc, setSelectedOcc] = useState<Occ | null>(null);

  const today = new Date();

  // Raster: beginnt am Montag vor dem 1., so viele Wochen wie nötig
  const gridStart = startOfWeek(month);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const offset = (month.getDay() + 6) % 7;
  const weekCount = Math.ceil((offset + daysInMonth) / 7);
  const gridDays = Array.from({ length: weekCount * 7 }, (_, i) => addDays(gridStart, i));

  const gridStartMs = gridStart.getTime();
  const gridLength = gridDays.length;

  const loadMonth = useCallback(async () => {
    const from = new Date(gridStartMs);
    const to = addDays(from, gridLength);
    const events = await fetchEvents(from, to);
    setOccurrences(toOccurrences(events, from, to));
  }, [gridStartMs, gridLength]);

  // Die nächsten 3 Termine ab jetzt (Serien werden 90 Tage vorausberechnet)
  const loadUpcoming = useCallback(async () => {
    const now = new Date();
    const from = startOfDay(now);
    const to = addDays(from, 90);
    const events = await fetchEvents(from, to);
    const next = toOccurrences(events, from, to)
      .filter((o) => (o.event.all_day ? true : (o.end ?? o.start) >= now))
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    setUpcoming(next.slice(0, 3));
  }, []);

  const reload = useCallback(() => {
    loadMonth();
    loadUpcoming();
  }, [loadMonth, loadUpcoming]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    supabase
      .from('profiles')
      .select('id, display_name')
      .order('display_name')
      .then(({ data, error }) => {
        if (error) console.error(error);
        else setMembers(data ?? []);
      });
  }, []);

  useEffect(() => {
    reload();

    const channel = supabase
      .channel('calendar-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, () => reload())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [reload]);

  // ---------- Navigation ----------

  function changeMonth(delta: number) {
    const newMonth = new Date(month.getFullYear(), month.getMonth() + delta, 1);
    setMonth(newMonth);
    setSelectedDate(isSameMonth(newMonth, today) ? startOfDay(today) : newMonth);
  }

  function selectDay(day: Date) {
    setSelectedDate(day);
    if (!isSameMonth(day, month)) setMonth(startOfMonth(day));
  }

  function goToToday() {
    setMonth(startOfMonth(today));
    setSelectedDate(startOfDay(today));
  }

  // ---------- Anzeige-Helfer ----------

  function occurrencesOn(day: Date) {
    return occurrences.filter((o) => isSameDay(o.start, day));
  }

  function memberName(id: string | null) {
    return members.find((m) => m.id === id)?.display_name ?? 'jemand';
  }

  function creatorName(id: string | null) {
    return id === userId ? 'dir' : memberName(id);
  }

  function assigneeLabel(id: string) {
    return id === userId ? 'Du bist dran' : `${memberName(id)} ist dran`;
  }

  function timeLabel(o: Occ) {
    if (o.event.all_day) return 'Ganztägig';
    const start = formatTime(o.start);
    return o.end ? `${start} – ${formatTime(o.end)}` : start;
  }

  function dayLabel(d: Date) {
    if (isSameDay(d, today)) return 'Heute';
    if (isSameDay(d, addDays(today, 1))) return 'Morgen';
    return formatDate(d);
  }

  // ---------- Löschen ----------

  async function deleteSeries(e: CalendarEvent) {
    const { error } = await supabase.from('calendar_events').delete().eq('id', e.id);
    if (error) dialog.alert('Das hat nicht geklappt', error.message);
    else reload();
  }

  async function skipOccurrence(o: Occ) {
    const { error } = await supabase
      .from('calendar_events')
      .update({ excluded_dates: [...o.event.excluded_dates, o.dateKey] })
      .eq('id', o.event.id);
    if (error) dialog.alert('Das hat nicht geklappt', error.message);
    else reload();
  }

  function confirmDelete(o: Occ) {
    const isSeries = o.event.recurrence !== 'none';
    dialog.confirm({
      title: isSeries ? 'Ganze Serie löschen?' : `„${o.event.title}“ löschen?`,
      message: isSeries
        ? 'Alle Termine dieser Serie verschwinden, auch die zukünftigen.'
        : o.event.is_private
          ? undefined
          : 'Der Termin verschwindet für die ganze WG.',
      confirmLabel: 'Löschen',
      destructive: true,
      onConfirm: () => deleteSeries(o.event),
    });
  }

  function sheetActions(o: Occ) {
    if (o.event.created_by !== userId) return [];
    if (o.event.recurrence === 'none') {
      return [{ label: 'Termin löschen', emoji: '🗑️', destructive: true, onPress: () => confirmDelete(o) }];
    }
    return [
      { label: 'Nur diesen Termin auslassen', emoji: '⏭️', onPress: () => skipOccurrence(o) },
      { label: 'Ganze Serie löschen', emoji: '🗑️', destructive: true, onPress: () => confirmDelete(o) },
    ];
  }

  function sheetSubtitle(o: Occ) {
    return [
      `${dayLabel(o.start)} · ${timeLabel(o)}`,
      o.event.recurrence !== 'none' && `🔁 ${RECURRENCE_LABELS[o.event.recurrence]}`,
      o.assignee && assigneeLabel(o.assignee),
      o.event.is_private ? 'privat' : `eingetragen von ${creatorName(o.event.created_by)}`,
      o.event.notes,
    ]
      .filter(Boolean)
      .join('\n');
  }

  // ---------- Eine Zeile in der Terminliste ----------

  function renderRow(o: Occ, i: number, showDay: boolean) {
    return (
      <Pressable
        key={`${o.event.id}-${o.dateKey}`}
        style={[styles.eventRow, i > 0 && styles.eventRowBorder]}
        onPress={() => setSelectedOcc(o)}
      >
        {showDay ? (
          <View style={styles.upcomingDate}>
            <Text style={styles.upcomingDay}>{dayLabel(o.start)}</Text>
            <Text style={styles.upcomingTime}>{o.event.all_day ? 'ganztägig' : formatTime(o.start)}</Text>
          </View>
        ) : (
          <View style={[styles.eventBar, o.event.is_private && styles.eventBarPrivate]} />
        )}
        <View style={styles.eventInfo}>
          <Text style={styles.eventTitle}>
            {o.event.is_private ? '🔒 ' : ''}
            {o.event.title}
            {o.event.recurrence !== 'none' ? ' 🔁' : ''}
          </Text>
          {!showDay && <Text style={styles.eventMeta}>{timeLabel(o)}</Text>}
          {o.assignee && (
            <Text style={[styles.assignee, o.assignee === userId && styles.assigneeMe]}>
              {assigneeLabel(o.assignee)}
            </Text>
          )}
        </View>
      </Pressable>
    );
  }

  const dayOccurrences = occurrencesOn(selectedDate);
  const monthLabel = month.toLocaleDateString('de-AT', { month: 'long', year: 'numeric' });
  const selectedLabel = selectedDate.toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long' });
  const showTodayButton = !isSameDay(selectedDate, today) || !isSameMonth(month, today);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Kalender</Text>

        {/* Monats-Navigation */}
        <View style={styles.monthNav}>
          <Pressable style={styles.navButton} onPress={() => changeMonth(-1)} hitSlop={8}>
            <Text style={styles.navButtonText}>‹</Text>
          </Pressable>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <Pressable style={styles.navButton} onPress={() => changeMonth(1)} hitSlop={8}>
            <Text style={styles.navButtonText}>›</Text>
          </Pressable>
        </View>

        {/* Monatsraster */}
        <View style={styles.calendarCard}>
          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((d) => (
              <Text key={d} style={styles.weekdayLabel}>
                {d}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {gridDays.map((day) => {
              const inMonth = isSameMonth(day, month);
              const selected = isSameDay(day, selectedDate);
              const isToday = isSameDay(day, today);
              const count = occurrencesOn(day).length;

              return (
                <Pressable key={day.toISOString()} style={styles.dayCell} onPress={() => selectDay(day)}>
                  <View
                    style={[
                      styles.dayCircle,
                      isToday && !selected && styles.dayCircleToday,
                      selected && styles.dayCircleSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNumber,
                        !inMonth && styles.dayNumberOutside,
                        isToday && !selected && styles.dayNumberToday,
                        selected && styles.dayNumberSelected,
                      ]}
                    >
                      {day.getDate()}
                    </Text>
                  </View>
                  <View style={styles.dotRow}>
                    {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                      <View key={i} style={[styles.dot, !inMonth && styles.dotOutside]} />
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {showTodayButton && (
          <Pressable style={styles.todayButton} onPress={goToToday}>
            <Text style={styles.todayButtonText}>Zurück zu heute</Text>
          </Pressable>
        )}

        {/* Termine des ausgewählten Tages */}
        <Text style={styles.sectionTitle}>{selectedLabel}</Text>
        {dayOccurrences.length === 0 ? (
          <Text style={styles.empty}>Nichts geplant. ☕</Text>
        ) : (
          <View style={styles.card}>{dayOccurrences.map((o, i) => renderRow(o, i, false))}</View>
        )}

        {/* Was steht an */}
        <Text style={styles.sectionTitle}>Was steht an</Text>
        {upcoming.length === 0 ? (
          <Text style={styles.empty}>Keine anstehenden Termine.</Text>
        ) : (
          <View style={styles.card}>{upcoming.map((o, i) => renderRow(o, i, true))}</View>
        )}
      </ScrollView>

      {/* Schwebender Plus-Button */}
      <Pressable style={styles.fab} onPress={() => setShowForm(true)}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>

      <EventForm
        visible={showForm}
        initialDate={selectedDate}
        members={members}
        userId={userId}
        onClose={() => setShowForm(false)}
        onSaved={reload}
      />

      <ActionSheet
        visible={selectedOcc !== null}
        title={selectedOcc?.event.title}
        subtitle={selectedOcc ? sheetSubtitle(selectedOcc) : undefined}
        actions={selectedOcc ? sheetActions(selectedOcc) : []}
        onClose={() => setSelectedOcc(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFF8F0' },
  content: { padding: 24, paddingTop: 72, paddingBottom: 120 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#5C4033', marginBottom: 16 },

  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navButton: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#F2E6DA',
    alignItems: 'center', justifyContent: 'center',
  },
  navButtonText: { fontSize: 22, color: '#5C4033', fontWeight: '600', marginTop: -2 },
  monthLabel: { fontSize: 18, fontWeight: '700', color: '#5C4033' },

  calendarCard: { backgroundColor: 'white', borderRadius: 18, paddingVertical: 12, paddingHorizontal: 6 },
  weekdayRow: { flexDirection: 'row', marginBottom: 6 },
  weekdayLabel: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, color: '#B5A397', fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 4 },
  dayCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dayCircleToday: { borderWidth: 1.5, borderColor: '#E07A5F' },
  dayCircleSelected: { backgroundColor: '#E07A5F' },
  dayNumber: { fontSize: 16, color: '#5C4033', fontWeight: '500' },
  dayNumberOutside: { color: '#D9C7B8' },
  dayNumberToday: { color: '#E07A5F', fontWeight: '700' },
  dayNumberSelected: { color: 'white', fontWeight: '700' },
  dotRow: { flexDirection: 'row', height: 6, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#81B29A', marginHorizontal: 1 },
  dotOutside: { opacity: 0.4 },

  todayButton: { alignSelf: 'center', marginTop: 12, paddingVertical: 6, paddingHorizontal: 14 },
  todayButtonText: { color: '#E07A5F', fontSize: 14, fontWeight: '600' },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#5C4033', marginTop: 24, marginBottom: 12 },
  empty: { textAlign: 'center', color: '#8B6F5E', fontSize: 16, marginTop: 16 },
  card: { backgroundColor: 'white', borderRadius: 16, paddingHorizontal: 16 },
  eventRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  eventRowBorder: { borderTopWidth: 1, borderTopColor: '#F2E6DA' },
  eventBar: { width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: '#81B29A', marginRight: 12 },
  eventBarPrivate: { backgroundColor: '#D9C7B8' },
  eventInfo: { flex: 1 },
  eventTitle: { fontSize: 16, color: '#5C4033', fontWeight: '600' },
  eventMeta: { fontSize: 14, color: '#8B6F5E', marginTop: 2 },
  assignee: { fontSize: 13, color: '#81B29A', fontWeight: '600', marginTop: 3 },
  assigneeMe: { color: '#E07A5F' },

  upcomingDate: { width: 92, marginRight: 12 },
  upcomingDay: { fontSize: 14, fontWeight: '700', color: '#E07A5F' },
  upcomingTime: { fontSize: 13, color: '#8B6F5E', marginTop: 2 },

  fab: {
    position: 'absolute', right: 24, bottom: 24, width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#E07A5F', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#5C4033', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  fabText: { color: 'white', fontSize: 30, fontWeight: '500', marginTop: -2 },
});