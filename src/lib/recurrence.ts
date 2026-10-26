export type Recurrence = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  none: 'Nie',
  daily: 'Täglich',
  weekly: 'Wöchentlich',
  biweekly: 'Alle 2 Wochen',
  monthly: 'Monatlich',
};

// Mindestangaben, die ein Termin für die Berechnung braucht
export type RecurringEvent = {
  id: string;
  starts_at: string;
  ends_at: string | null;
  recurrence: Recurrence;
  recurrence_until: string | null;
  rotation: string[] | null;
  excluded_dates: string[];
};

// Ein einzelnes Auftreten eines (evtl. wiederkehrenden) Termins
export type Occurrence<T extends RecurringEvent> = {
  event: T;
  start: Date;
  end: Date | null;
  index: number; // das wievielte Auftreten (0, 1, 2 ...)
  assignee: string | null; // wer bei Rotation dran ist
  dateKey: string; // "2026-10-26"
};

// Datum als "2026-10-26" in lokaler Zeit
export function toDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// "2026-10-26" → Ende dieses Tages (lokal)
function endOfDateKey(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59);
}

// Das n-te Auftreten ab dem Start berechnen
function nthOccurrence(start: Date, recurrence: Recurrence, n: number) {
  const d = new Date(start);
  switch (recurrence) {
    case 'daily':
      d.setDate(d.getDate() + n);
      break;
    case 'weekly':
      d.setDate(d.getDate() + 7 * n);
      break;
    case 'biweekly':
      d.setDate(d.getDate() + 14 * n);
      break;
    case 'monthly': {
      // Am 31. gestartet? In kürzeren Monaten → letzter Tag des Monats
      const day = start.getDate();
      d.setDate(1);
      d.setMonth(start.getMonth() + n);
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(day, lastDay));
      break;
    }
  }
  return d;
}

// Grob schätzen, ab welchem Auftreten wir anfangen müssen (spart Rechenzeit)
function estimateStartIndex(start: Date, recurrence: Recurrence, rangeStart: Date) {
  if (rangeStart <= start) return 0;
  const dayMs = 24 * 60 * 60 * 1000;
  const diff = rangeStart.getTime() - start.getTime();
  let n = 0;
  switch (recurrence) {
    case 'daily':
      n = Math.floor(diff / dayMs);
      break;
    case 'weekly':
      n = Math.floor(diff / (7 * dayMs));
      break;
    case 'biweekly':
      n = Math.floor(diff / (14 * dayMs));
      break;
    case 'monthly':
      n = (rangeStart.getFullYear() - start.getFullYear()) * 12 + rangeStart.getMonth() - start.getMonth();
      break;
  }
  return Math.max(0, n - 1); // eins früher, zur Sicherheit (Sommerzeit usw.)
}

// Alle Auftreten eines Termins im Zeitraum [rangeStart, rangeEnd)
export function expandOccurrences<T extends RecurringEvent>(
  event: T,
  rangeStart: Date,
  rangeEnd: Date
): Occurrence<T>[] {
  const start = new Date(event.starts_at);
  const duration = event.ends_at ? new Date(event.ends_at).getTime() - start.getTime() : null;
  const rotation = event.rotation ?? [];

  function make(s: Date, index: number): Occurrence<T> {
    return {
      event,
      start: s,
      end: duration !== null ? new Date(s.getTime() + duration) : null,
      index,
      assignee: rotation.length > 0 ? rotation[index % rotation.length] : null,
      dateKey: toDateKey(s),
    };
  }

  // Einmaliger Termin
  if (event.recurrence === 'none') {
    return start >= rangeStart && start < rangeEnd ? [make(start, 0)] : [];
  }

  // Wiederkehrender Termin
  const until = event.recurrence_until ? endOfDateKey(event.recurrence_until) : null;
  const result: Occurrence<T>[] = [];
  let n = estimateStartIndex(start, event.recurrence, rangeStart);

  for (let guard = 0; guard < 1000; guard++, n++) {
    const s = nthOccurrence(start, event.recurrence, n);
    if (s >= rangeEnd) break;
    if (until && s > until) break;
    if (s >= rangeStart && !event.excluded_dates.includes(toDateKey(s))) {
      result.push(make(s, n));
    }
  }
  return result;
}