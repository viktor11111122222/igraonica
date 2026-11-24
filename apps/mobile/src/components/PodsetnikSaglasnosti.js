import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from './PressableScale';
import { PITANJA, DOPUNSKE } from './PitanjaODetetu';
import { colors, radius, spacing, type, shadow } from '../theme';

// Fali bar jedan obavezan odgovor - dete dodato pre ove forme ili iz starije
// verzije aplikacije.
export function nedostajuObavezne(dete) {
  return PITANJA.some(({ kljuc }) => dete[kljuc] == null);
}

// Fali bilo sta, i neobavezne stavke 5 i 6 - na njih podsetnik takodje
// podseca, jer osoblju pomazu kad roditelj nije dostupan.
export function nedostajuSaglasnosti(dete) {
  return nedostajuObavezne(dete) || DOPUNSKE.some((kljuc) => !dete[kljuc]);
}

// Baner na pocetnoj koji podseca roditelja da popuni saglasnosti. Kad fali
// nesto obavezno, poziva da se saglasnosti popune; kad fale samo dodatni
// kontakt i ovlascene osobe, blaze poziva da se dopune. Nestaje cim je za svu
// decu sve upisano.
export default function PodsetnikSaglasnosti({ deca, navigation }) {
  const bez = (deca || []).filter(nedostajuSaglasnosti);
  if (bez.length === 0) return null;

  const obavezno = bez.some(nedostajuObavezne);
  const jedno = bez.length === 1;
  const imena = bez.map((d) => d.firstName).join(', ');
  // Imena se ne menjaju po padezima ("Za Marko"), pa stoje ispred dvotacke.
  const za = jedno ? `Dete ${imena}` : `Deca ${imena}`;

  // Jedno dete vodi pravo na pitanja; za vise dece roditelj bira na Mom paketu.
  function otvori() {
    if (jedno) navigation.navigate('AddChild', { child: bez[0], naSaglasnosti: true });
    else navigation.navigate('Package');
  }

  return (
    <PressableScale
      style={styles.baner}
      onPress={otvori}
      accessibilityRole="button"
      accessibilityLabel={`${obavezno ? 'Popunite saglasnosti' : 'Dopunite kontakte'} za ${imena}`}
    >
      <View style={styles.ikona}>
        <Ionicons
          name={obavezno ? 'shield-checkmark-outline' : 'people-outline'}
          size={22}
          color={colors.primaryDarker}
        />
      </View>
      <View style={styles.tekst}>
        <Text style={styles.naslov}>{obavezno ? 'Popunite saglasnosti' : 'Dopunite kontakte'}</Text>
        <Text style={styles.opis}>
          {obavezno
            ? `${za}: nedostaju obavezne saglasnosti. Popunite ih pre sledeceg dolaska u igraonicu.`
            : `${za}: upisite dodatni kontakt telefon i osobe koje smeju da preuzmu dete. Nije obavezno, ali pomaze osoblju.`}
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
