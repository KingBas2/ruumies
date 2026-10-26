import { ActionSheet } from '@/components/action-sheet';
import { ExpenseForm, Member } from '@/components/expense-form';
import { useDialog } from '@/lib/dialog';
import { formatEuro } from '@/lib/money';
import { supabase } from '@/lib/supabase';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Balance = { user_id: string; balance_cents: number };

type Expense = {
  id: string;
  title: string;
  amount_cents: number;
  paid_by: string;
  created_by: string | null;
  spent_on: string;
  created_at: string;
};

type Settlement = {
  id: string;
  from_user: string;
  to_user: string;
  amount_cents: number;
  created_by: string | null;
  created_at: string;
};

type Transfer = { from: string; to: string; amount: number };

// Verlauf: Ausgaben und Rückzahlungen gemischt
type HistoryEntry =
  | { kind: 'expense'; date: string; data: Expense }
  | { kind: 'settlement'; date: string; data: Settlement };

// Aus den Salden möglichst wenige Überweisungen berechnen
function simplifyDebts(balances: Balance[]): Transfer[] {
  const creditors = balances
    .filter((b) => b.balance_cents > 0)
    .map((b) => ({ id: b.user_id, amount: b.balance_cents }))
    .sort((a, b) => b.amount - a.amount);
  const debtors = balances
    .filter((b) => b.balance_cents < 0)
    .map((b) => ({ id: b.user_id, amount: -b.balance_cents }))
    .sort((a, b) => b.amount - a.amount);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].amount, creditors[j].amount);
    transfers.push({ from: debtors[i].id, to: creditors[j].id, amount });
    debtors[i].amount -= amount;
    creditors[j].amount -= amount;
    if (debtors[i].amount === 0) i++;
    if (creditors[j].amount === 0) j++;
  }
  return transfers;
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-AT', { day: 'numeric', month: 'short' });
}

export default function Finanzen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
  const dialog = useDialog();

  const loadAll = useCallback(async () => {
    const [balanceRes, expenseRes, settlementRes] = await Promise.all([
      supabase.rpc('household_balances'),
      supabase
        .from('expenses')
        .select('id, title, amount_cents, paid_by, created_by, spent_on, created_at')
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('settlements')
        .select('id, from_user, to_user, amount_cents, created_by, created_at')
        .order('created_at', { ascending: false })
        .limit(30),
    ]);

    if (balanceRes.error) console.error(balanceRes.error);
    else setBalances((balanceRes.data ?? []).map((b: Balance) => ({ ...b, balance_cents: Number(b.balance_cents) })));

    if (expenseRes.error) console.error(expenseRes.error);
    else setExpenses(expenseRes.data ?? []);

    if (settlementRes.error) console.error(settlementRes.error);
    else setSettlements(settlementRes.data ?? []);
  }, []);

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

    loadAll();

    const channel = supabase
      .channel('finance-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settlements' }, () => loadAll())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadAll]);

  function name(id: string, form: 'nominativ' | 'dativ' = 'nominativ') {
    if (id === userId) return form === 'dativ' ? 'dir' : 'Du';
    return members.find((m) => m.id === id)?.display_name ?? 'Ehemalig';
  }

    // Löschen darf nur, wer bezahlt bzw. überwiesen hat
  function canDelete(entry: HistoryEntry) {
    return entry.kind === 'expense' ? entry.data.paid_by === userId : entry.data.from_user === userId;
  }

  // ---------- Aktionen ----------

  function confirmSettle(t: Transfer) {
    dialog.confirm({
      title: 'Als bezahlt markieren?',
      message: `${name(t.from)} ${t.from === userId ? 'hast' : 'hat'} ${name(t.to, 'dativ')} ${formatEuro(t.amount)} überwiesen.`,
      confirmLabel: 'Ja, erledigt',
      onConfirm: async () => {
        const { error } = await supabase
          .from('settlements')
          .insert({ from_user: t.from, to_user: t.to, amount_cents: t.amount });
        if (error) dialog.alert('Das hat nicht geklappt', error.message);
        else loadAll();
      },
    });
  }

  function deleteEntry(entry: HistoryEntry) {
    dialog.confirm({
      title: entry.kind === 'expense' ? `„${entry.data.title}“ löschen?` : 'Rückzahlung löschen?',
      message: 'Die Salden werden danach neu berechnet.',
      confirmLabel: 'Löschen',
      destructive: true,
      onConfirm: async () => {
        const table = entry.kind === 'expense' ? 'expenses' : 'settlements';
        const { error } = await supabase.from(table).delete().eq('id', entry.data.id);
        if (error) dialog.alert('Das hat nicht geklappt', error.message);
        else loadAll();
      },
    });
  }

  // ---------- Berechnungen ----------

  const myBalance = balances.find((b) => b.user_id === userId)?.balance_cents ?? 0;
  const transfers = simplifyDebts(balances);

  const history: HistoryEntry[] = [
    ...expenses.map((e) => ({ kind: 'expense' as const, date: e.created_at, data: e })),
    ...settlements.map((s) => ({ kind: 'settlement' as const, date: s.created_at, data: s })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Finanzen</Text>

        {/* Mein Saldo */}
        <View
          style={[
            styles.balanceCard,
            myBalance > 0 && styles.balancePositive,
            myBalance < 0 && styles.balanceNegative,
          ]}
        >
          {myBalance === 0 ? (
            <>
              <Text style={styles.balanceEmoji}>🎉</Text>
              <Text style={styles.balanceLabel}>Alles ausgeglichen</Text>
            </>
          ) : (
            <>
              <Text style={styles.balanceLabel}>{myBalance > 0 ? 'Du bekommst' : 'Du schuldest'}</Text>
              <Text style={styles.balanceAmount}>{formatEuro(Math.abs(myBalance))}</Text>
            </>
          )}
        </View>

        {/* Wer zahlt wem */}
        {transfers.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Wer zahlt wem</Text>
            <View style={styles.card}>
              {transfers.map((t, i) => {
                const involvesMe = t.from === userId || t.to === userId;
                return (
                  <View key={`${t.from}-${t.to}`} style={[styles.transferRow, i > 0 && styles.rowBorder]}>
                    <View style={styles.transferInfo}>
                      <Text style={[styles.transferNames, involvesMe && styles.bold]}>
                        {name(t.from)} → {name(t.to)}
                      </Text>
                      <Text style={styles.transferAmount}>{formatEuro(t.amount)}</Text>
                    </View>
                    <Pressable style={styles.settleButton} onPress={() => confirmSettle(t)}>
                      <Text style={styles.settleButtonText}>Bezahlt</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Verlauf */}
        <Text style={styles.sectionTitle}>Verlauf</Text>
        {history.length === 0 ? (
          <Text style={styles.empty}>Noch keine Ausgaben. Tippe auf +, um die erste einzutragen.</Text>
        ) : (
          <View style={styles.card}>
            {history.map((entry, i) => (
              <Pressable
                key={`${entry.kind}-${entry.data.id}`}
                style={[styles.historyRow, i > 0 && styles.rowBorder]}
                onPress={() => canDelete(entry) && setSelectedEntry(entry)}
              >
                <Text style={styles.historyEmoji}>{entry.kind === 'expense' ? '🧾' : '💸'}</Text>
                <View style={styles.historyInfo}>
                  {entry.kind === 'expense' ? (
                    <>
                      <Text style={styles.historyTitle}>{entry.data.title}</Text>
                      <Text style={styles.historyMeta}>
                        {name(entry.data.paid_by)} {entry.data.paid_by === userId ? 'hast' : 'hat'} bezahlt ·{' '}
                        {shortDate(entry.data.spent_on)}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.historyTitle}>Rückzahlung</Text>
                      <Text style={styles.historyMeta}>
                        {name(entry.data.from_user)} → {name(entry.data.to_user)} · {shortDate(entry.data.created_at)}
                      </Text>
                    </>
                  )}
                </View>
                <Text style={styles.historyAmount}>{formatEuro(entry.data.amount_cents)}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Schwebender Plus-Button */}
      <Pressable style={styles.fab} onPress={() => setShowForm(true)}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>

      <ExpenseForm
        visible={showForm}
        members={members}
        userId={userId}
        onClose={() => setShowForm(false)}
        onSaved={loadAll}
      />

      <ActionSheet
        visible={selectedEntry !== null}
        title={
          selectedEntry?.kind === 'expense'
            ? selectedEntry.data.title
            : selectedEntry
              ? 'Rückzahlung'
              : undefined
        }
        subtitle={selectedEntry ? formatEuro(selectedEntry.data.amount_cents) : undefined}
        actions={
          selectedEntry
            ? [{ label: 'Löschen', emoji: '🗑️', destructive: true, onPress: () => deleteEntry(selectedEntry) }]
            : []
        }
        onClose={() => setSelectedEntry(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFF8F0' },
  content: { padding: 24, paddingTop: 72, paddingBottom: 120 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#5C4033', marginBottom: 16 },
  bold: { fontWeight: '700' },

  balanceCard: { borderRadius: 20, padding: 24, alignItems: 'center', backgroundColor: '#D9C7B8' },
  balancePositive: { backgroundColor: '#81B29A' },
  balanceNegative: { backgroundColor: '#E07A5F' },
  balanceEmoji: { fontSize: 40 },
  balanceLabel: { fontSize: 16, color: 'white', fontWeight: '600', marginTop: 4 },
  balanceAmount: { fontSize: 40, color: 'white', fontWeight: '800', marginTop: 4 },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#5C4033', marginTop: 28, marginBottom: 12 },
  card: { backgroundColor: 'white', borderRadius: 16, paddingHorizontal: 16 },
  rowBorder: { borderTopWidth: 1, borderTopColor: '#F2E6DA' },
  empty: { textAlign: 'center', color: '#8B6F5E', fontSize: 15, marginTop: 8 },

  transferRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  transferInfo: { flex: 1 },
  transferNames: { fontSize: 16, color: '#5C4033' },
  transferAmount: { fontSize: 14, color: '#8B6F5E', marginTop: 2 },
  settleButton: { backgroundColor: '#F2E6DA', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 },
  settleButtonText: { color: '#5C4033', fontSize: 14, fontWeight: '600' },

  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  historyEmoji: { fontSize: 22, marginRight: 12 },
  historyInfo: { flex: 1 },
  historyTitle: { fontSize: 16, color: '#5C4033', fontWeight: '600' },
  historyMeta: { fontSize: 13, color: '#8B6F5E', marginTop: 2 },
  historyAmount: { fontSize: 16, color: '#5C4033', fontWeight: '600', marginLeft: 8 },

  fab: {
    position: 'absolute', right: 24, bottom: 24, width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#E07A5F', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#5C4033', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  fabText: { color: 'white', fontSize: 30, fontWeight: '500', marginTop: -2 },
});