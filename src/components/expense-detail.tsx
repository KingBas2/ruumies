import { formatEuro } from '@/lib/money';
import { colors } from '@/lib/theme';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export type Split = {
  expense_id: string;
  user_id: string;
  amount_cents: number;
  paid_at: string | null;
};

type Props = {
  visible: boolean;
  title: string;
  amountCents: number;
  paidBy: string;
  splits: Split[];
  userId: string | null;
  nameOf: (id: string) => string;
  onToggle: (split: Split) => void;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
};

export function ExpenseDetail({
  visible, title, amountCents, paidBy, splits, userId, nameOf, onToggle, onEdit, onDelete, onClose,
}: Props) {
  const isPayer = userId === paidBy;

  // Zahler zuerst, danach die anderen
  const sorted = [...splits].sort((a, b) => Number(b.user_id === paidBy) - Number(a.user_id === paidBy));

  // Nach dem Schließen kurz warten, damit das nächste Fenster sauber aufgeht
  function closeThen(action: () => void) {
    onClose();
    setTimeout(action, 300);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>
            {formatEuro(amountCents)} · bezahlt von {nameOf(paidBy)}
          </Text>

          <ScrollView style={styles.list} bounces={false}>
            <View style={styles.card}>
              {sorted.map((s, i) => {
                const isOwnShare = s.user_id === paidBy;
                const paid = s.paid_at !== null;
                const canToggle = !isOwnShare && (isPayer || userId === s.user_id);

                return (
                  <Pressable
                    key={s.user_id}
                    style={[styles.row, i > 0 && styles.rowBorder]}
                    onPress={() => canToggle && onToggle(s)}
                    disabled={!canToggle}
                  >
                    {isOwnShare ? (
                      <View style={styles.payerIcon}>
                        <Text style={styles.payerIconText}>💳</Text>
                      </View>
                    ) : (
                      <View style={[styles.checkbox, paid && styles.checkboxChecked, !canToggle && styles.checkboxDisabled]}>
                        {paid && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                    )}

                    <View style={styles.rowInfo}>
                      <Text style={[styles.rowName, paid && styles.struck]}>{nameOf(s.user_id)}</Text>
                      <Text style={styles.rowMeta}>
                        {isOwnShare ? 'eigener Anteil' : paid ? 'zurückgezahlt' : 'noch offen'}
                      </Text>
                    </View>

                    <Text style={[styles.rowAmount, paid && styles.struck]}>{formatEuro(s.amount_cents)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {isPayer && (
            <View style={styles.actions}>
              <Pressable style={styles.actionButton} onPress={() => closeThen(onEdit)}>
                <Text style={styles.actionText}>✏️ Bearbeiten</Text>
              </Pressable>
              <Pressable style={[styles.actionButton, styles.actionSpacing]} onPress={() => closeThen(onDelete)}>
                <Text style={[styles.actionText, styles.destructive]}>🗑️ Löschen</Text>
              </Pressable>
            </View>
          )}

          <Pressable style={styles.close} onPress={onClose}>
            <Text style={styles.closeText}>Schließen</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(60, 40, 30, 0.35)',
  },
  sheet: {
    backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 40, maxHeight: '80%',
  },
  handle: {
    width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border,
    alignSelf: 'center', marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 4 },

  list: { marginTop: 20 },
  card: { backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.surfaceMuted },
  checkbox: {
    width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: colors.border,
    marginRight: 12, alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.success, borderColor: colors.success },
  checkboxDisabled: { opacity: 0.5 },
  checkmark: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  payerIcon: { width: 24, height: 24, marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  payerIconText: { fontSize: 18 },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 16, color: colors.text, fontWeight: '500' },
  rowMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  rowAmount: { fontSize: 16, color: colors.text, fontWeight: '600', marginLeft: 8 },
  struck: { textDecorationLine: 'line-through', color: colors.textFaint },

  actions: { flexDirection: 'row', marginTop: 16 },
  actionButton: {
    flex: 1, backgroundColor: colors.surface, borderRadius: 14, paddingVertical: 14, alignItems: 'center',
  },
  actionSpacing: { marginLeft: 10 },
  actionText: { fontSize: 16, color: colors.text, fontWeight: '600' },
  destructive: { color: colors.danger },
  close: { padding: 16, alignItems: 'center', marginTop: 4 },
  closeText: { fontSize: 16, color: colors.textMuted, fontWeight: '600' },
});