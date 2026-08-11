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

// Redosled i nazivi prate MealType enum sa backenda.
const MEALS = [
  { key: 'BREAKFAST', label: 'Dorucak', icon: 'sunny-outline' },
  { key: 'SNACK_MORNING', label: 'Uzina', icon: 'nutrition-outline' },
  { key: 'LUNCH', label: 'Rucak', icon: 'restaurant-outline' },
  { key: 'SNACK_AFTERNOON', label: 'Popodnevna uzina', icon: 'ice-cream-outline' },
];

const DAY_NAMES = ['Pon', 'Uto', 'Sre', 'Cet', 'Pet', 'Sub', 'Ned'];

export default function MenuScreen() {
  const [days, setDays] = useState({});
  const [selectedDay, setSelectedDay] = useState(todayKey());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const stripRef = useRef(null);

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

  useFocusEffect(
    useCallback(() => {
      load(selectedDay);
    }, [load, selectedDay])
  );

  const dates = monthDates();
  const today = todayKey();
  const items = days[selectedDay] || [];

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

  async function onRefresh() {
    setRefreshing(true);
    await load(selectedDay);
    setRefreshing(false);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Jelovnik</Text>
        <Text style={styles.headerSub}>Sta se jede ove nedelje</Text>
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
                name={DAY_NAMES[dayIndex(date)]}
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
          {items.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="restaurant-outline" size={34} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Jelovnik nije objavljen</Text>
              <Text style={styles.emptyText}>
                Za ovaj dan jos uvek nema unetih obroka.
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
  dayStrip: {
    backgroundColor: colors.primary,
    paddingBottom: spacing.lg,
  },
  dayStripContent: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
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
