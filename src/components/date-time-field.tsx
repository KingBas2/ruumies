import { colors } from '@/lib/theme';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';

export function formatDate(d: Date) {
  return d.toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatTime(d: Date) {
  return d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
}

type Props = {
  value: Date;
  onChange: (date: Date) => void;
  mode: 'date' | 'time';
  minimumDate?: Date;
};

export function DateTimeField({ value, onChange, mode, minimumDate }: Props) {
  // iPhone: kompaktes Feld, das ein Auswahlfenster öffnet
  if (Platform.OS === 'ios') {
    return (
      <DateTimePicker
        value={value}
        mode={mode}
        display="compact"
        locale="de-AT"
        minimumDate={minimumDate}
        accentColor="#E07A5F"
        onValueChange={(_event, date) => date && onChange(date)}
      />
    );
  }

  // Android: eigenes Feld, beim Tippen geht der System-Dialog auf
  function open() {
    DateTimePickerAndroid.open({
      value,
      mode,
      is24Hour: true,
      minimumDate,
      onValueChange: (_event, date) => {
        if (date) onChange(date);
      },
    });
  }

  return (
    <Pressable style={styles.field} onPress={open}>
      <Text style={styles.text}>{mode === 'date' ? formatDate(value) : formatTime(value)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { backgroundColor: colors.surfaceMuted, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  text: { fontSize: 15, color: colors.text, fontWeight: '500' },
});