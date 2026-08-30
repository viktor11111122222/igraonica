import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useClosedDays } from '../context/ClosedDaysContext';
import RodjendanCeoDan from './RodjendanCeoDan';
import { colors, radius, spacing, type } from '../theme';

// Obavestenje da se tog dana ne dolazi. Za razliku od <Announcement/>, koje
// admin rucno kuca u podesavanjima, ovo se pojavljuje samo - cim je dan
// oznacen kao neradni u panelu.
//
// `date` je kljuc dana (YYYY-MM-DD). `today` govori da li je taj dan danasnji,
// da bi tekst bio "Danas ne radimo" umesto "Ne radimo".
export default function ClosedNotice({ date, today = false, style }) {
  const { closedOn } = useClosedDays();

  const dan = closedOn(date);
  if (!dan) return null;

  // Celodnevni rodjendan ima svoj izgled, jedan za sve - stize li iz
  // rezervacije ili je dan rucno oznacen u panelu, roditelj vidi istu karticu.
  if (dan.kind === 'BIRTHDAY') {
    return <RodjendanCeoDan note={dan.note} style={[styles.rodjendan, style]} />;
  }

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.icon}>
        <Ionicons name="close-circle" size={20} color={colors.danger} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>
          {today ? 'Danas ne radimo' : 'Ovog dana ne radimo'}
        </Text>
        <Text style={styles.reason}>{dan.reason}</Text>
        {dan.note ? (
          <Text testID="closed-note" style={styles.note}>
            {dan.note}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.dangerSoft,
  },
  rodjendan: { marginHorizontal: spacing.xl, marginTop: spacing.lg },
  icon: { paddingTop: 1 },
  body: { flex: 1 },
  title: { ...type.heading, color: colors.danger },
  reason: { ...type.body, color: colors.text, marginTop: 2 },
  note: { ...type.caption, color: colors.textMuted, marginTop: spacing.xs },
});
