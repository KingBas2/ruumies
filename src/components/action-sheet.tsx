import { colors } from '@/lib/theme';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export type SheetAction = {
  label: string;
  emoji?: string;
  onPress: () => void;
  destructive?: boolean;
};

type Props = {
  visible: boolean;
  title?: string;
  subtitle?: string;
  actions: SheetAction[];
  onClose: () => void;
};

export function ActionSheet({ visible, title, subtitle, actions, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Abgedunkelter Hintergrund: Tippen schließt das Menü */}
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.handle} />
          {title && <Text style={styles.title}>{title}</Text>}
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

          <View style={styles.actions}>
            {actions.map((action) => (
              <Pressable
                key={action.label}
                style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
                onPress={() => {
                  onClose();
                  action.onPress();
                  setTimeout(action.onPress, 300);
                }}
              >
                {action.emoji && <Text style={styles.actionEmoji}>{action.emoji}</Text>}
                <Text style={[styles.actionLabel, action.destructive && styles.destructive]}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Abbrechen</Text>
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
    padding: 20, paddingBottom: 40,
  },
  handle: {
    width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border,
    alignSelf: 'center', marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 4 },
  actions: { backgroundColor: 'white', borderRadius: 16, marginTop: 20, overflow: 'hidden' },
  action: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 18 },
  actionPressed: { backgroundColor: colors.surfaceMuted },
  actionEmoji: { fontSize: 22, marginRight: 14 },
  actionLabel: { fontSize: 16, color: colors.text, fontWeight: '500' },
  destructive: { color: colors.danger },
  cancel: { padding: 16, alignItems: 'center', marginTop: 8 },
  cancelText: { fontSize: 16, color: colors.textMuted, fontWeight: '600' },
});