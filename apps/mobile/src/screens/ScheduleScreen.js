import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { apiRequest } from '../utils/api';
import { dayIndex, fromKey, monthDates, toKey } from '../utils/date';
import { useDaySelection } from '../hooks/useDay';
import Banner from '../components/Banner';
import DayStrip from '../components/DayStrip';
import Announcement from '../components/Announcement';
import ClosedNotice from '../components/ClosedNotice';
import { useClosedDays } from '../context/ClosedDaysContext';
import { radius, spacing, type, shadow } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useThemedStyles } from '../hooks/useThemedStyles';

// Backend koristi 0 = ponedeljak (ne JS konvenciju gde je 0 = nedelja).
// Imena stoje u akuzativu jer se koriste samo u recenici "Za <dan> nije
// zakazana...". Zenski dani tu menjaju oblik (sreda -> sredu), muski ne.
const DAY_NAMES_ACC = [
  'ponedeljak',
  'utorak',
  'sredu',
  'cetvrtak',
  'petak',
  'subotu',
  'nedelju',
];

export default function ScheduleScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [week, setWeek] = useState({});
  const { today, selected: selectedDay, setSelected: setSelectedDay } =
    useDaySelection();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiRequest('/schedule');
      setWeek(data.week || {});
    } catch {
      setWeek({});
    } finally {
      setLoading(false);
    }
  }, []);

  useAutoRefresh(load);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const { isClosed, closedDays } = useClosedDays();

  // Raspored se ponavlja svake nedelje, pa datum iz trake svodimo na dan
  // u nedelji i tim kljucem citamo aktivnosti.
  const day = dayIndex(fromKey(selectedDay));
  const zatvoreno = isClosed(selectedDay);
  // Neradnog dana aktivnosti se ne odrzavaju, pa se i ne prikazuju - inace bi
  // roditelj video "Mali kuvari 10:30" ispod obavestenja da se ne dolazi.
  const activities = zatvoreno ? [] : week[day] || [];

  // Raspored se ponavlja nedeljno, pa se oznacava svaki datum ciji dan u
  // nedelji ima aktivnosti. Neradni dani se ne oznacavaju.
  const marked = new Set(
    monthDates()
      .filter((d) => (week[dayIndex(d)] || []).length > 0 && !isClosed(toKey(d)))
      .map(toKey)
  );

  // Traka posebno oznacava neradne dane, da se vide i pre nego sto se dodirnu.
  const closed = new Set(Object.keys(closedDays));

  return (
    <View style={styles.container}>
      <Banner doodles="head" title="Raspored" subtitle="Nedeljne aktivnosti">
        <DayStrip
          today={today}
          selected={selectedDay}
          onSelect={setSelectedDay}
          marked={marked}
          closed={closed}
        />
      </Banner>

      <ClosedNotice date={selectedDay} today={selectedDay === today} />
      <Announcement screen="schedule" />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Neradnog dana obavestenje iznad vec sve objasnjava - "nije
              zakazana nijedna aktivnost" bi tu samo zbunjivalo. */}
          {zatvoreno ? null : activities.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="calendar-outline" size={34} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Nema aktivnosti</Text>
              <Text style={styles.emptyText}>
                Za {DAY_NAMES_ACC[day]} nije zakazana nijedna aktivnost.
              </Text>
            </View>
          ) : (
            activities.map((a) => (
              <View key={a.id} style={styles.card}>
                <View
                  style={[
                    styles.stripe,
                    { backgroundColor: a.color || colors.primary },
                  ]}
                />
                <View style={styles.cardBody}>
                  <View style={styles.timeRow}>
                    <Ionicons name="time-outline" size={14} color={colors.textFaint} />
                    <Text style={styles.time}>
                      {a.startTime} - {a.endTime}
                    </Text>
                  </View>
                  <Text style={styles.activityTitle}>{a.title}</Text>
                  {a.description ? (
                    <Text style={styles.activityDesc}>{a.description}</Text>
                  ) : null}
                  {a.ageGroup ? (
                    <View style={styles.ageChip}>
                      <Text style={styles.ageText}>{a.ageGroup}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: {
    padding: spacing.xl,
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.card,
  },
  stripe: { width: 5 },
  cardBody: { flex: 1, padding: spacing.lg },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  time: { ...type.caption, color: colors.textFaint },
  activityTitle: {
    ...type.heading,
    color: colors.text,
    marginTop: spacing.xs,
  },
  activityDesc: {
    ...type.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  ageChip: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingVertical: 4,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  ageText: { ...type.caption, color: colors.primaryDarker },
  empty: { alignItems: 'center', paddingTop: spacing.xxxl },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: { ...type.heading, color: colors.text },
  emptyText: {
    ...type.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});
