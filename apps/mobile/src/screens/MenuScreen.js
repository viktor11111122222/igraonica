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
import { apiRequest } from '../utils/api';
import { useDaySelection } from '../hooks/useDay';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import Banner from '../components/Banner';
import DayStrip from '../components/DayStrip';
import Announcement from '../components/Announcement';
import ClosedNotice from '../components/ClosedNotice';
import { useClosedDays } from '../context/ClosedDaysContext';
import { MEALS } from '../data/meals';
import { radius, spacing, type, shadow } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useThemedStyles } from '../hooks/useThemedStyles';

export default function MenuScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [days, setDays] = useState({});
  const { today, selected: selectedDay, setSelected: setSelectedDay } =
    useDaySelection();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Backend vraca nedelju po nedelju, a traka pokriva ceo mesec - zato
  // dovlacimo nedelju izabranog dana i spajamo je sa vec ucitanim danima.
  const load = useCallback(async (dateKey) => {
    try {
      const data = await apiRequest(`/menu/week?date=${dateKey}`);
      setDays((prev) => ({ ...prev, ...(data.week || {}) }));
    } catch {
      // Zadrzavamo ono sto je vec ucitano.
    } finally {
      setLoading(false);
    }
  }, []);

  // selectedDay je u zavisnostima, pa promena dana odmah povlaci njegovu
  // nedelju umesto da se ceka sledece osvezavanje.
  useAutoRefresh(useCallback(() => load(selectedDay), [load, selectedDay]));

  const { isClosed, closedDays } = useClosedDays();

  // Neradnog dana se ne kuva, pa se jelovnik ne prikazuje ni ako je ostao unet
  // od ranije.
  const zatvoreno = isClosed(selectedDay);
  const items = zatvoreno ? [] : days[selectedDay] || [];

  // Dani za koje je jelovnik unet - u traci se vide kao izrazeniji oblak,
  // pa prazan dan ne izgleda kao da aplikacija ne radi.
  const marked = new Set(
    Object.entries(days)
      .filter(([date, list]) => list?.length > 0 && !isClosed(date))
      .map(([date]) => date)
  );

  // Iz konteksta, a ne iz `days` - traka pokriva ceo mesec, a ucitane su samo
  // nedelje kroz koje je korisnik prosao.
  const closed = new Set(Object.keys(closedDays));

  async function onRefresh() {
    setRefreshing(true);
    await load(selectedDay);
    setRefreshing(false);
  }

  return (
    <View style={styles.container}>
      <Banner doodles="head" title="Jelovnik" subtitle="Sta se jede ove nedelje">
        <DayStrip
          today={today}
          selected={selectedDay}
          onSelect={setSelectedDay}
          marked={marked}
          closed={closed}
        />
      </Banner>

      <ClosedNotice date={selectedDay} today={selectedDay === today} />
      <Announcement screen="menu" />

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
          {items.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="restaurant-outline" size={34} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Za ovaj dan nema jelovnika</Text>
              <Text style={styles.emptyText}>
                Dani sa jelovnikom su u traci iznad izrazeniji - dodirnite neki
                od njih.
              </Text>
            </View>
          ) : (
            MEALS.map((meal) => {
              const item = items.find((it) => it.mealType === meal.key);
              if (!item) return null;
              return (
                <View key={meal.key} style={styles.card}>
                  <View style={styles.cardIcon}>
                    <Ionicons name={meal.icon} size={20} color={colors.accentText} />
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.mealLabel}>{meal.label}</Text>
                    <Text style={styles.mealName}>{item.name}</Text>
                    {item.description ? (
                      <Text style={styles.mealDesc}>{item.description}</Text>
                    ) : null}
                    {item.allergens ? (
                      <View style={styles.allergenChip}>
                        <Ionicons name="alert-circle" size={13} color={colors.danger} />
                        <Text style={styles.allergenText}>{item.allergens}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })
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
    padding: spacing.lg,
    ...shadow.card,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },
  cardBody: { flex: 1 },
  mealLabel: {
    ...type.caption,
    color: colors.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  mealName: {
    ...type.heading,
    color: colors.text,
    marginTop: 2,
  },
  mealDesc: {
    ...type.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  allergenChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.dangerSoft,
  },
  allergenText: {
    ...type.caption,
    color: colors.danger,
  },
  empty: {
    alignItems: 'center',
    paddingTop: spacing.xxxl,
  },
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
