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
import { useFocusEffect } from '@react-navigation/native';
import { apiRequest } from '../utils/api';
import PressableScale from '../components/PressableScale';
import { colors, radius, spacing, type, shadow } from '../theme';

// Redosled i nazivi prate MealType enum sa backenda.
const MEALS = [
  { key: 'BREAKFAST', label: 'Dorucak', icon: 'sunny-outline' },
  { key: 'SNACK_MORNING', label: 'Uzina', icon: 'nutrition-outline' },
  { key: 'LUNCH', label: 'Rucak', icon: 'restaurant-outline' },
  { key: 'SNACK_AFTERNOON', label: 'Popodnevna uzina', icon: 'ice-cream-outline' },
];

const DAY_NAMES = ['Pon', 'Uto', 'Sre', 'Cet', 'Pet', 'Sub', 'Ned'];

function toKey(date) {
  return date.toISOString().split('T')[0];
}

export default function MenuScreen() {
  const [week, setWeek] = useState({});
  const [selectedDay, setSelectedDay] = useState(toKey(new Date()));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiRequest(`/menu/week?date=${toKey(new Date())}`);
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

  const dayKeys = Object.keys(week).sort();
  const items = week[selectedDay] || [];
  const today = toKey(new Date());

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Jelovnik</Text>
        <Text style={styles.headerSub}>Sta se jede ove nedelje</Text>
      </View>

      <View style={styles.dayStrip}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dayStripContent}
        >
          {dayKeys.map((key, i) => {
            const active = key === selectedDay;
            return (
              <PressableScale
                key={key}
                style={[styles.dayChip, active && styles.dayChipActive]}
                onPress={() => setSelectedDay(key)}
              >
                <Text style={[styles.dayName, active && styles.dayNameActive]}>
                  {DAY_NAMES[i]}
                </Text>
                <Text style={[styles.dayNum, active && styles.dayNumActive]}>
                  {new Date(key).getUTCDate()}
                </Text>
                {key === today && <View style={[styles.dot, active && styles.dotActive]} />}
              </PressableScale>
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
  dayChip: {
    width: 52,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
  },
  dayChipActive: { backgroundColor: colors.surface },
  dayName: {
    ...type.caption,
    color: 'rgba(255,255,255,0.9)',
  },
  dayNameActive: { color: colors.textMuted },
  dayNum: {
    ...type.heading,
    color: colors.textOnPrimary,
    marginTop: 2,
  },
  dayNumActive: { color: colors.text },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginTop: 4,
  },
  dotActive: { backgroundColor: colors.accentDark },
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
