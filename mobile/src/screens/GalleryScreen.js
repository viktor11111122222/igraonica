import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, type } from '../theme';

// Placeholder. Galerija jos nema backend - nema modela ni rute za listanje.
// Kada se doda: GET /api/gallery -> grid slika ovde.
export default function GalleryScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Galerija</Text>
        <Text style={styles.headerSub}>Trenuci iz igraonice</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.icon}>
          <Ionicons name="images-outline" size={38} color={colors.primary} />
        </View>
        <Text style={styles.title}>Uskoro</Text>
        <Text style={styles.text}>
          Ovde ce se pojaviti fotografije sa aktivnosti i rodjendana.
        </Text>
        <View style={styles.badge}>
          <Ionicons name="hammer-outline" size={14} color={colors.accentText} />
          <Text style={styles.badgeText}>U pripremi</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingTop: 64,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    backgroundColor: colors.primary,
  },
  headerTitle: { ...type.title, color: colors.textOnPrimary },
  headerSub: {
    ...type.body,
    color: 'rgba(255,255,255,0.85)',
    marginTop: spacing.xs,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  icon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: { ...type.title, color: colors.text },
  text: {
    ...type.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xl,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
  badgeText: { ...type.label, color: colors.accentText },
});
