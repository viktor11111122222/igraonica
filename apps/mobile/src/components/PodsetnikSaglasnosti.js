import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from './PressableScale';
import { PITANJA } from './PitanjaODetetu';
import { colors, radius, spacing, type, shadow } from '../theme';

// Dete kome fali bar jedan odgovor - pitanja su mogla biti preskocena pri
// dodavanju.
export function nedostajuSaglasnosti(dete) {
  return PITANJA.some(({ kljuc }) => dete[kljuc] == null) || !dete.pickupPersons;
}

// Baner na pocetnoj koji podseca roditelja da popuni saglasnosti. Osoblju ti
// odgovori trebaju dok je dete u igraonici, a bez podsetnika preskocena
// pitanja ostaju zaboravljena. Nestaje cim su odgovori za svu decu upisani.
export default function PodsetnikSaglasnosti({ deca, navigation }) {
  const bez = (deca || []).filter(nedostajuSaglasnosti);
  if (bez.length === 0) return null;

  const jedno = bez.length === 1;
  const imena = bez.map((d) => d.firstName).join(', ');

  // Jedno dete vodi pravo na obrazac; za vise dece roditelj bira na Mom paketu.
  function otvori() {
    if (jedno) navigation.navigate('AddChild', { child: bez[0], naSaglasnosti: true });
    else navigation.navigate('Package');
  }

  return (
    <PressableScale
      style={styles.baner}
      onPress={otvori}
      accessibilityRole="button"
      accessibilityLabel={`Popunite saglasnosti za ${imena}`}
    >
      <View style={styles.ikona}>
        <Ionicons name="shield-checkmark-outline" size={22} color={colors.primaryDarker} />
      </View>
      <View style={styles.tekst}>
        <Text style={styles.naslov}>Popunite saglasnosti</Text>
        <Text style={styles.opis}>
          {jedno ? `Za ${imena}` : `Za decu: ${imena}`} - slikanje, obroci i ko sme da
          preuzme dete.
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.primaryDarker} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  baner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.primaryTint,
    borderWidth: 1,
    borderColor: colors.primary,
    ...shadow.card,
  },
  ikona: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tekst: { flex: 1 },
  naslov: { ...type.heading, color: colors.text },
  opis: { ...type.caption, color: colors.textMuted, marginTop: 2, lineHeight: 17 },
});
