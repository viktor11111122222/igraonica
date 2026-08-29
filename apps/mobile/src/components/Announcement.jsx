import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../context/SettingsContext';
import { colors, radius, spacing, type } from '../theme';

// Traka sa obavestenjem koje admin upisuje u web panelu.
// `screen` je ime ekrana (package, menu, schedule, gallery) - traka se
// prikazuje samo ako je taj ekran izabran u podesavanjima i ako tekst postoji.
export default function Announcement({ screen, style }) {
  const { settings } = useSettings();

  const text = (settings.mobile_announcement || '').trim();
  if (!text) return null;

  const screens = (settings.announcement_tabs || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!screens.includes(screen)) return null;

  return (
    <View style={[styles.wrap, style]}>
      <Ionicons name="megaphone-outline" size={18} color={colors.accentText} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginHorizontal: spacing.xl,
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
  },
  text: {
    ...type.body,
    color: colors.accentText,
    flex: 1,
    lineHeight: 21,
  },
});
