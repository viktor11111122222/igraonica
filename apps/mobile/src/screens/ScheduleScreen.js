import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { apiRequest } from '../utils/api';
import { dayIndex, monthDates, toKey, todayKey } from '../utils/date';
import DayCloud, { CLOUD_W } from '../components/DayCloud';
import { colors, radius, spacing, type, shadow } from '../theme';

// Backend koristi 0 = ponedeljak (ne JS konvenciju gde je 0 = nedelja).
const DAYS = [
  { i: 0, short: 'Pon', long: 'Ponedeljak' },
  { i: 1, short: 'Uto', long: 'Utorak' },
  { i: 2, short: 'Sre', long: 'Sreda' },
  { i: 3, short: 'Cet', long: 'Cetvrtak' },
  { i: 4, short: 'Pet', long: 'Petak' },
  { i: 5, short: 'Sub', long: 'Subota' },
  { i: 6, short: 'Ned', long: 'Nedelja' },
];

export default function ScheduleScreen() {
  const [week, setWeek] = useState({});
  const [selectedDay, setSelectedDay] = useState(todayKey());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const stripRef = useRef(null);

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

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const dates = monthDates();
  const today = todayKey();

  // Raspored se ponavlja svake nedelje, pa datum iz trake svodimo na dan
  // u nedelji i tim kljucem citamo aktivnosti.
  const selectedDate = dates.find((d) => toKey(d) === selectedDay) || new Date();
  const day = dayIndex(selectedDate);
  const activities = week[day] || [];

  // Mesec je duzi od ekrana, pa traku pomeramo na danasnji dan.
  useEffect(() => {
    const i = dates.findIndex((d) => toKey(d) === today);
    if (i > 1) {
      stripRef.current?.scrollTo({
        x: (CLOUD_W + spacing.sm) * (i - 1),
        animated: false,
      });
    }
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Raspored</Text>
        <Text style={styles.headerSub}>Nedeljne aktivnosti</Text>
      </View>

      <View style={styles.dayStrip}>
        <ScrollView
          ref={stripRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dayStripContent}
        >
          {dates.map((date) => {
            const key = toKey(date);
            return (
              <DayCloud
                key={key}
                name={DAYS[dayIndex(date)].short}
                number={date.getDate()}
                active={key === selectedDay}
                today={key === today}
                onPress={() => setSelectedDay(key)}
              />
            );
          })}
        </ScrollView>
      </View>

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
          {activities.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="calendar-outline" size={34} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Nema aktivnosti</Text>
              <Text style={styles.emptyText}>
                Za {DAYS[day].long.toLowerCase()} nije zakazana nijedna aktivnost.
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  dayStrip: { backgroundColor: colors.primary, paddingBottom: spacing.lg },
  dayStripContent: { paddingHorizontal: spacing.xl, gap: spacing.sm },
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
