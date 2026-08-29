import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import PressableScale from './PressableScale';
import { ageInYears, daysInMonth, yearsLabel } from '../utils/date';
import { colors, radius, spacing, type } from '../theme';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'januar', 'februar', 'mart', 'april', 'maj', 'jun',
  'jul', 'avgust', 'septembar', 'oktobar', 'novembar', 'decembar',
];
const YEARS_BACK = 16;

const pad = (n) => String(n).padStart(2, '0');

// Datum rodjenja se bira, ne kuca. Opseg je mali (dete do ~16 godina), pa su
// tri reda dovoljna i nemoguce je uneti nepostojeci datum.
export default function BirthDatePicker({ value, onChange }) {
  const [year, setYear] = useState(value ? Number(value.slice(0, 4)) : null);
  const [month, setMonth] = useState(value ? Number(value.slice(5, 7)) : null);
  const [day, setDay] = useState(value ? Number(value.slice(8, 10)) : null);

  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: YEARS_BACK }, (_, i) => thisYear - i);
  // Dok godina nije izabrana racunamo po prestupnoj, da 29. februar ostane u
  // ponudi; kad se godina izabere, dan se po potrebi skrati.
  const maxDay = daysInMonth(year ?? 2024, month ?? 1);
  const days = Array.from({ length: maxDay }, (_, i) => i + 1);

  function commit(y, m, d) {
    setYear(y);
    setMonth(m);
    setDay(d);
    onChange(y && m && d ? `${y}-${pad(m)}-${pad(d)}` : '');
  }

  function pickYear(y) {
    const limit = daysInMonth(y, month ?? 1);
    commit(y, month, day && day > limit ? limit : day);
  }

  function pickMonth(m) {
    const limit = daysInMonth(year ?? 2024, m);
    commit(year, m, day && day > limit ? limit : day);
  }

  const complete = year && month && day;

  return (
    <View>
      <View style={styles.summary}>
        {complete ? (
          <>
            <Text style={styles.summaryDate}>
              {day}. {MONTHS_LONG[month - 1]} {year}.
            </Text>
            <Text style={styles.summaryAge}>
              {yearsLabel(ageInYears(`${year}-${pad(month)}-${pad(day)}`))}
            </Text>
          </>
        ) : (
          <Text style={styles.summaryHint}>Izaberite godinu, mesec i dan</Text>
        )}
      </View>

      <Row label="Godina">
        {years.map((y) => (
          <Chip key={y} label={y} active={y === year} onPress={() => pickYear(y)} />
        ))}
      </Row>

      <Row label="Mesec">
        {MONTHS_SHORT.map((name, i) => (
          <Chip
            key={name}
            label={name}
            active={i + 1 === month}
            onPress={() => pickMonth(i + 1)}
          />
        ))}
      </Row>

      <Row label="Dan">
        {days.map((d) => (
          <Chip
            key={d}
            label={d}
            narrow
            active={d === day}
            onPress={() => commit(year, month, d)}
          />
        ))}
      </Row>
    </View>
  );
}

function Row({ label, children }) {

  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rowContent}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </View>
  );
}

function Chip({ label, active, narrow, onPress }) {

  return (
    <PressableScale
      style={[styles.chip, narrow && styles.chipNarrow, active && styles.chipActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  summaryDate: { ...type.heading, color: colors.primaryDarker },
  summaryAge: { ...type.caption, color: colors.textMuted },
  summaryHint: { ...type.body, color: colors.textFaint },

  row: { marginTop: spacing.md },
  rowLabel: {
    ...type.caption,
    color: colors.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.xs,
  },
  rowContent: { gap: spacing.sm, paddingRight: spacing.xl },
  chip: {
    minWidth: 58,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  chipNarrow: { minWidth: 44 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...type.label, color: colors.textMuted },
  chipTextActive: { color: colors.textOnPrimary },
});
