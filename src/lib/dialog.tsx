import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type DialogButton = {
  label: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

type DialogOptions = {
  title: string;
  message?: string;
  buttons?: DialogButton[];
};

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
};

const DialogContext = createContext<{ show: (options: DialogOptions) => void } | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogOptions | null>(null);
  const show = useCallback((options: DialogOptions) => setDialog(options), []);

  const buttons = dialog?.buttons ?? [{ label: 'OK' }];

  function press(button: DialogButton) {
    setDialog(null);
    button.onPress?.();
  }

  return (
    <DialogContext.Provider value={{ show }}>
      {children}

      <Modal visible={dialog !== null} transparent animationType="fade" onRequestClose={() => setDialog(null)}>
        <View style={styles.backdrop}>
          <View style={styles.box}>
            <Text style={styles.title}>{dialog?.title}</Text>
            {dialog?.message && <Text style={styles.message}>{dialog.message}</Text>}

            <View style={styles.buttons}>
              {buttons.map((button, i) => (
                <Pressable
                  key={button.label}
                  style={({ pressed }) => [
                    styles.button,
                    i > 0 && styles.buttonSpacing,
                    button.style === 'cancel' && styles.buttonCancel,
                    button.style === 'destructive' && styles.buttonDestructive,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => press(button)}
                >
                  <Text style={[styles.buttonText, button.style === 'cancel' && styles.buttonTextCancel]}>
                    {button.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog muss innerhalb von DialogProvider verwendet werden');
  }

  return useMemo(
    () => ({
      // Einfacher Hinweis mit einem OK-Button
      alert: (title: string, message?: string) => context.show({ title, message }),

      // Sicherheitsabfrage mit Abbrechen + Bestätigen
      confirm: ({ title, message, confirmLabel = 'OK', destructive = false, onConfirm }: ConfirmOptions) =>
        context.show({
          title,
          message,
          buttons: [
            { label: 'Abbrechen', style: 'cancel' },
            { label: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
          ],
        }),
    }),
    [context]
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(60, 40, 30, 0.35)',
    alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  box: { backgroundColor: '#FFF8F0', borderRadius: 24, padding: 24, width: '100%', maxWidth: 360 },
  title: { fontSize: 19, fontWeight: '700', color: '#5C4033', textAlign: 'center' },
  message: { fontSize: 15, color: '#8B6F5E', textAlign: 'center', marginTop: 8, lineHeight: 21 },
  buttons: { flexDirection: 'row', marginTop: 22 },
  button: {
    flex: 1, backgroundColor: '#E07A5F', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  buttonSpacing: { marginLeft: 10 },
  buttonCancel: { backgroundColor: '#F2E6DA' },
  buttonDestructive: { backgroundColor: '#C0503A' },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  buttonTextCancel: { color: '#5C4033' },
});