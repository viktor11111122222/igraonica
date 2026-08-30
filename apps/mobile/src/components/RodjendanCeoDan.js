import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, type, shadow } from '../theme';

// Dan koji je ceo zauzet rodjendanom.
//
// Stoji zasebno, a ne kao red u spisku, jer je tog dana jedino sto se desava:
// redovan program se ne odrzava, a igraonica je zauzeta. Isti izgled vazi bez
// obzira na to odakle podatak stize - iz rezervacije ili iz neradnog dana
// oznacenog u panelu - da roditelj ne bi za istu stvar video dva razlicita
// obavestenja.
export default function RodjendanCeoDan({ note, style }) {
  return (
    <View testID="rodjendan-ceo-dan" style={[styles.card, style]}>
      <View style={styles.ikona}>
        <Ionicons name="gift" size={30} color={colors.textOnAccent} />
      </View>
      <Text style={styles.naslov}>Rodjendan</Text>
      <Text style={styles.tekst}>Ceo dan</Text>
      {note ? (
        <Text testID="rodjendan-napomena" style={styles.napomena}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    ...shadow.card,
  },
  ikona: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentDark,
    marginBottom: spacing.xs,
  },
  naslov: { ...type.title, color: colors.textOnAccent },
  tekst: { ...type.body, color: colors.textOnAccent, opacity: 0.9 },
  napomena: {
    ...type.caption,
    color: colors.textOnAccent,
    opacity: 0.9,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});
