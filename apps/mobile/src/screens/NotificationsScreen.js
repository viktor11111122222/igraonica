import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '../hooks/useNotifications';
import PressableScale from '../components/PressableScale';
import { formatTime } from '../utils/date';
import { colors, radius, spacing, type, shadow } from '../theme';

// Ikona uz vrstu dogadjaja - brze se prepoznaje nego iz samog teksta.
const IKONA = {
  CHILD_CHECKED_IN: { name: 'log-in-outline', boja: colors.success },
  CHILD_CHECKED_OUT: { name: 'log-out-outline', boja: colors.primaryDarker },
  PACKAGE_ASSIGNED: { name: 'cube-outline', boja: colors.accentText },
  HOURS_ADJUSTED: { name: 'swap-vertical-outline', boja: colors.accentText },
};

// Koliko je proslo, grubo. Tacan sat stoji uz red.
function pre(datum) {
  const minuta = Math.round((Date.now() - new Date(datum)) / 60000);
  if (minuta < 1) return 'upravo sada';
  if (minuta < 60) return `pre ${minuta} min`;
  const sati = Math.round(minuta / 60);
  if (sati < 24) return `pre ${sati} h`;
  const dana = Math.round(sati / 24);
  return dana === 1 ? 'juce' : `pre ${dana} dana`;
}

function Red({ obavestenje, onPress }) {
  const ikona = IKONA[obavestenje.type] || { name: 'notifications-outline', boja: colors.textMuted };
  const novo = !obavestenje.readAt;

  return (
    <PressableScale
      style={[styles.red, novo && styles.redNov]}
      onPress={() => onPress(obavestenje)}
      accessibilityRole="button"
    >
      <View style={[styles.ikona, { backgroundColor: novo ? colors.surface : colors.bg }]}>
        <Ionicons name={ikona.name} size={20} color={ikona.boja} />
      </View>

      <View style={styles.telo}>
        <Text style={styles.naslov}>{obavestenje.title}</Text>
        <Text style={styles.tekst}>{obavestenje.body}</Text>
        <Text style={styles.kada}>
          {pre(obavestenje.createdAt)} · {formatTime(obavestenje.createdAt)}
        </Text>
      </View>

      {/* Boja sama ne bi bila dovoljna, pa neprocitano nosi i tackicu. */}
      {novo && <View style={styles.tacka} accessibilityLabel="neprocitano" />}
    </PressableScale>
  );
}

export default function NotificationsScreen() {
  const { notifications, unreadCount, loading, reload, oznaciProcitano, oznaciSve } =
    useNotifications();

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {unreadCount > 0 && (
        <PressableScale style={styles.sve} onPress={oznaciSve} accessibilityRole="button">
          <Text style={styles.sveTekst}>Oznaci sve kao procitano</Text>
        </PressableScale>
      )}

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.spisak}
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <Red obavestenje={item} onPress={(o) => !o.readAt && oznaciProcitano(o.id)} />
        )}
        ListEmptyComponent={
          <View style={styles.prazno}>
            <View style={styles.praznoIkona}>
              <Ionicons name="notifications-outline" size={36} color={colors.primary} />
            </View>
            <Text style={styles.praznoNaslov}>Nema obavestenja</Text>
            <Text style={styles.praznoTekst}>
              Ovde ce stizati kada dete udje u igraonicu, kada izadje i kada dobijete paket.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },

  sve: {
    alignSelf: 'flex-end',
    marginTop: spacing.lg,
    marginRight: spacing.xl,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  sveTekst: { ...type.label, color: colors.primaryDarker },

  spisak: { padding: spacing.xl, gap: spacing.md, flexGrow: 1 },

  red: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  redNov: { backgroundColor: colors.primarySoft },
  ikona: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  telo: { flex: 1, minWidth: 0, gap: 2 },
  naslov: { ...type.label, color: colors.text },
  tekst: { ...type.body, color: colors.textMuted, lineHeight: 20 },
  kada: { ...type.caption, color: colors.textFaint, marginTop: spacing.xs },
  tacka: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    backgroundColor: colors.primaryDark,
  },

  prazno: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxl },
  praznoIkona: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  praznoNaslov: { ...type.heading, color: colors.text, marginBottom: spacing.xs },
  praznoTekst: { ...type.body, color: colors.textMuted, textAlign: 'center', lineHeight: 21 },
});
