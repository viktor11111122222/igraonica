import { useEffect, useMemo, useRef } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import DayCloud, { CLOUD_W } from './DayCloud';
import { dayIndex, monthDates, toKey } from '../utils/date';
import { colors, spacing } from '../theme';

const DAY_NAMES = ['Pon', 'Uto', 'Sre', 'Cet', 'Pet', 'Sub', 'Ned'];

// Traka datuma za Jelovnik i Raspored. Namerno jedna implementacija - dva
// ekrana moraju da pokazuju isti mesec, isti izabrani dan i istu oznaku
// danasnjeg dana.
export default function DayStrip({ today, selected, onSelect, marked, closed }) {
  const ref = useRef(null);

  // Kada dan predje u novi mesec, traka mora da se prekomponuje.
  // `monthDates()` cita danasnji datum sam, bez argumenta - linter zato ne vidi
  // vezu i trazi da se `mesec` izbaci. Ostaje namerno: to je jedini ulaz koji
  // stvarno menja rezultat.
  const mesec = today.slice(0, 7);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dates = useMemo(() => monthDates(), [mesec]);

  // Mesec je duzi od ekrana, pa traku pomeramo na danasnji dan.
  useEffect(() => {
    const i = dates.findIndex((d) => toKey(d) === today);
    if (i > 1) {
      ref.current?.scrollTo({
        x: (CLOUD_W + spacing.sm) * (i - 1),
        animated: false,
      });
    }
  }, [dates, today]);

  return (
    <View style={styles.strip}>
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {dates.map((date) => {
          const key = toKey(date);
          return (
            <DayCloud
              key={key}
              name={DAY_NAMES[dayIndex(date)]}
              number={date.getDate()}
              active={key === selected}
              today={key === today}
              filled={marked?.has(key)}
              closed={closed?.has(key)}
              onPress={() => onSelect(key)}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { backgroundColor: colors.primary, paddingBottom: spacing.lg },
  content: { paddingHorizontal: spacing.xl, gap: spacing.sm },
});
