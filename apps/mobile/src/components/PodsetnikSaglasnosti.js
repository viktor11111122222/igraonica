import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from './PressableScale';
import { PITANJA, DOPUNSKE } from './PitanjaODetetu';
import { colors, radius, spacing, type, shadow } from '../theme';

// Fali bar jedan obavezan odgovor - dete dodato pre ove forme ili iz starije
// verzije aplikacije.
export function nedostajuObavezne(dete) {
  return PITANJA.some(({ kljuc }) => dete[kljuc] == null);
}

// Fali bilo sta, i neobavezne stavke 4 i 5 - na njih podsetnik takodje
// podseca, jer osoblju pomazu kad roditelj nije dostupan.
export function nedostajuSaglasnosti(dete) {
  return nedostajuObavezne(dete) || DOPUNSKE.some((kljuc) => !dete[kljuc]);
}

// Na sta sme da se podseti ovaj roditelj. Osoblje u panelu gasi podsetnik
// svima (podesavanje) ili jednom roditelju (nalog); blazi podsetnik za
// kontakte roditelj moze i sam da skloni. Obavezne saglasnosti roditelj ne
// moze da skloni - samo osoblje.
export function podsetnikDozvoljen(korisnik, podesavanja) {
  const ukljuceno =
    podesavanja?.mobile_consent_reminder !== 'false' && korisnik?.consentReminder !== false;
  return {
    obavezne: ukljuceno,
    kontakti: ukljuceno && !korisnik?.contactReminderHiddenAt,
  };
}

// Da li za dete treba nesto istaci, po onome sto je roditelju dozvoljeno.
export function treba(dete, dozvola) {
  if (nedostajuObavezne(dete)) return dozvola.obavezne;
  return dozvola.kontakti && nedostajuSaglasnosti(dete);
}

// Baner na pocetnoj koji podseca roditelja da popuni saglasnosti. Kad fali
// nesto obavezno, poziva da se saglasnosti popune; kad fale samo dodatni
// kontakt i ovlascene osobe, blaze poziva da se dopune i tada ga roditelj moze
// skloniti. Nestaje cim je za svu decu sve upisano.
export default function PodsetnikSaglasnosti({ deca, navigation, dozvola, onSakrij }) {
  const dozvoljeno = dozvola || { obavezne: true, kontakti: true };
  const bez = (deca || []).filter((d) => treba(d, dozvoljeno));
  if (bez.length === 0) return null;

  const obavezno = bez.some(nedostajuObavezne);
  const jedno = bez.length === 1;
  const imena = bez.map((d) => d.firstName).join(', ');
  // Imena se ne menjaju po padezima ("Za Marko"), pa stoje ispred dvotacke.
  const za = jedno ? `Dete ${imena}` : `Deca ${imena}`;
  const naslov = obavezno ? 'Popunite saglasnosti' : 'Dopunite kontakte';

  // Jedno dete vodi pravo na pitanja; za vise dece roditelj bira na Mom paketu.
  function otvori() {
    if (jedno) navigation.navigate('AddChild', { child: bez[0], naSaglasnosti: true });
    else navigation.navigate('Package');
  }

  function sakrij() {
    Alert.alert(
      'Sakriti podsetnik?',
      'Podsetnik za dodatni kontakt i osobe koje smeju da preuzmu dete vise se nece prikazivati. Podatke uvek mozete dopuniti na stranici deteta.',
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
      accessibilityLabel={`${naslov} za ${imena}`}
    >
      <View style={styles.ikona}>
        <Ionicons
          name={obavezno ? 'shield-checkmark-outline' : 'people-outline'}
          size={22}
          color={colors.primaryDarker}
        />
      </View>
      <View style={styles.tekst}>
        <Text style={styles.naslov}>{naslov}</Text>
        <Text style={styles.opis}>
          {obavezno
            ? `${za}: nedostaju obavezne saglasnosti. Popunite ih pre sledeceg dolaska u igraonicu.`
            : `${za}: upisite dodatni kontakt telefon i osobe koje smeju da preuzmu dete. Nije obavezno, ali pomaze osoblju.`}
        </Text>
      </View>
      {/* Obavezne saglasnosti se ne sklanjaju - samo blazi podsetnik. */}
      {!obavezno && onSakrij ? (
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
