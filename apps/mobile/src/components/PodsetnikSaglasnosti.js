import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from './PressableScale';
import { PITANJA, DOPUNSKE } from './PitanjaODetetu';
import { colors, radius, spacing, type, shadow } from '../theme';

// Fali bar jedna stavka. Sve su obavezne, pa su "obavezne" i "sve" isto;
// oba imena ostaju jer ih koriste ekran deteta i Moj paket.
export function nedostajuObavezne(dete) {
  return (
    PITANJA.some(({ kljuc }) => dete[kljuc] == null) ||
    DOPUNSKE.some((kljuc) => !(dete[kljuc] || '').trim())
  );
}

export const nedostajuSaglasnosti = nedostajuObavezne;

// Da li ovaj roditelj uopste vidi podsetnik. Osoblje ga u panelu gasi svima
// (podesavanje) ili jednom roditelju (nalog), a roditelj moze sam da ga
// skloni - osoblje ga tada moze vratiti.
export function podsetnikVidljiv(korisnik, podesavanja) {
  return (
    podesavanja?.mobile_consent_reminder !== 'false' &&
    korisnik?.consentReminder !== false &&
    !korisnik?.contactReminderHiddenAt
  );
}

// Da li za dete treba nesto istaci.
export function treba(dete, vidljiv = true) {
  return vidljiv && nedostajuObavezne(dete);
}

// Baner na pocetnoj koji podseca roditelja da popuni saglasnosti za decu
// dodatu pre ove forme ili iz starije verzije aplikacije (nova deca ne mogu
// da se sacuvaju bez njih). Nestaje cim je za svu decu sve upisano.
export default function PodsetnikSaglasnosti({ deca, navigation, vidljiv = true, onSakrij }) {
  const bez = (deca || []).filter((d) => treba(d, vidljiv));
  if (bez.length === 0) return null;

  const jedno = bez.length === 1;
  const imena = bez.map((d) => d.firstName).join(', ');
  // Imena se ne menjaju po padezima ("Za Marko"), pa stoje ispred dvotacke.
  const za = jedno ? `Dete ${imena}` : `Deca ${imena}`;

  // Jedno dete vodi pravo na pitanja; za vise dece roditelj bira na Mom paketu.
  function otvori() {
    if (jedno) navigation.navigate('AddChild', { child: bez[0], naSaglasnosti: true });
    else navigation.navigate('Package');
  }

  function sakrij() {
    Alert.alert(
      'Sakriti podsetnik?',
      'Podsetnik se vise nece prikazivati. Saglasnosti i kontakte uvek mozete popuniti na stranici deteta.',
      [
        { text: 'Otkazi', style: 'cancel' },
        { text: 'Sakrij', onPress: () => onSakrij?.() },
      ]
    );
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
          {`${za}: nedostaju saglasnosti ili kontakti. Popunite ih pre sledeceg dolaska u igraonicu.`}
        </Text>
      </View>
      {onSakrij ? (
        <Pressable
          onPress={sakrij}
          hitSlop={10}
          style={styles.zatvori}
          accessibilityRole="button"
          accessibilityLabel="Sakrij podsetnik"
        >
          <Ionicons name="close" size={20} color={colors.textMuted} />
        </Pressable>
      ) : (
        <Ionicons name="chevron-forward" size={20} color={colors.primaryDarker} />
      )}
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
  zatvori: {
    alignSelf: 'flex-start',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
});
