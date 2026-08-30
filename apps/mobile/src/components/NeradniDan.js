import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, type, shadow } from '../theme';

// Dan kada se ne radi: rodjendan koji je zauzeo ceo dan, praznik, privatna
// proslava.
//
// Svi idu istom karticom, a menja se samo razlog - roditelj tako za istu stvar
// nikad ne vidi dva razlicita obavestenja, bez obzira odakle podatak stize
// (celodnevna rezervacija ili dan rucno oznacen u panelu).
//
// `today` bira izmedju "Danas" i "Ovog dana"; kod rodjendana ne igra ulogu,
// jer tu stoji sta se desava, a ne kad.
export default function NeradniDan({ kind, reason, note, today = false, style }) {
  const rodjendan = kind === 'BIRTHDAY';

  return (
    <View
      testID={rodjendan ? 'rodjendan-ceo-dan' : 'neradni-dan'}
      style={[styles.card, style]}
    >
      <View style={styles.ikona}>
        <Ionicons
          name={rodjendan ? 'gift' : 'close-circle'}
          size={30}
          color={colors.textOnAccent}
        />
      </View>
      <Text style={styles.naslov}>{rodjendan ? 'Rodjendan' : reason}</Text>
      <Text style={styles.tekst}>
        {rodjendan ? 'Ceo dan' : today ? 'Danas ne radimo' : 'Ovog dana ne radimo'}
      </Text>
      {note ? (
        <Text testID="closed-note" style={styles.napomena}>
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
  naslov: { ...type.title, color: colors.textOnAccent, textAlign: 'center' },
  tekst: { ...type.body, color: colors.textOnAccent, opacity: 0.9 },
  napomena: {
    ...type.caption,
    color: colors.textOnAccent,
    opacity: 0.9,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});
