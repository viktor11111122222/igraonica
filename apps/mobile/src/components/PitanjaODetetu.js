import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from './PressableScale';
import { jeTelefon } from '../utils/telefon';
import { colors, radius, spacing, type, shadow } from '../theme';

// "Saglasnosti i informacije o detetu" - sedam stavki koje igraonica trazi za
// svako dete. Da/ne stavke i telefon roditelja su obavezni pri dodavanju
// deteta; dodatni kontakt i ovlascene osobe nisu, ali ih podsetnik na
// pocetnoj trazi dok nisu upisani.
//
// Na serveru odgovor moze biti i `null` ("nije odgovoreno") - deca dodata pre
// ove forme ili iz starije verzije aplikacije - pa se "ne" i "nije
// odgovoreno" razlikuju.

// Obavezne da/ne stavke, sa brojem pod kojim stoje u formi.
export const PITANJA = [
  {
    kljuc: 'photoConsent',
    broj: 1,
    naslov: 'Saglasnost za fotografisanje i snimanje deteta',
    pitanje:
      'Da li ste saglasni da osoblje Kids Club-a fotografise i snima Vase dete tokom boravka i aktivnosti u igraonici, i da te fotografije i snimke objavi na sajtu i drustvenim mrezama Kids Club-a?',
  },
  {
    kljuc: 'eatsLunch',
    broj: 2,
    naslov: 'Saglasnost za konzumiranje rucka',
    pitanje:
      'Da li Vase dete sme da jede rucak koji obezbedjuje Kids Club? Alergije i posebnu ishranu upisite iznad, u delovima Alergije i Napomene.',
  },
  {
    kljuc: 'eatsSnack',
    broj: 3,
    naslov: 'Saglasnost za konzumiranje uzine',
    pitanje:
      'Da li Vase dete sme da jede uzinu koju obezbedjuje Kids Club? Alergije i posebnu ishranu upisite iznad, u delovima Alergije i Napomene.',
  },
  {
    kljuc: 'walksConsent',
    broj: 7,
    naslov: 'Saglasnost za odlazak u setnju',
    pitanje:
      'Da li ste saglasni da Vase dete, uz pratnju i nadzor zaposlenih Kids Club-a, ide u organizovane setnje van prostora igraonice?',
  },
];

// Neobavezne stavke (5 i 6): ne traze se pri cuvanju, ali ih podsetnik trazi.
export const DOPUNSKE = ['extraContactPhone', 'pickupPersons'];

// Sta fali za cuvanje: obavezni odgovori i ispravni telefoni. Vraca kljuceve.
export function nepotpuno(odgovori, telefonRoditelja) {
  const fali = PITANJA.filter(({ kljuc }) => odgovori[kljuc] == null).map((p) => p.kljuc);
  if (!jeTelefon(telefonRoditelja)) fali.push('telefonRoditelja');
  const dodatni = (odgovori.extraContactPhone || '').trim();
  if (dodatni && !jeTelefon(dodatni)) fali.push('extraContactPhone');
  return fali;
}

function DaNe({ vrednost, onChange, oznaka }) {
  return (
    <View style={styles.daNe}>
      {[
        { v: true, tekst: 'Da' },
        { v: false, tekst: 'Ne' },
      ].map(({ v, tekst }) => {
        const aktivno = vrednost === v;
        return (
          // Flex mora na omotac jer PressableScale stil daje unutrasnjem View-u.
          <View key={tekst} style={styles.daNeCelija}>
            <PressableScale
              style={[styles.daNeDugme, aktivno && styles.daNeAktivno]}
              onPress={() => onChange(v)}
              accessibilityRole="button"
              accessibilityLabel={`${oznaka}: ${tekst}`}
              accessibilityState={{ selected: aktivno }}
            >
              <Text style={[styles.daNeTekst, aktivno && styles.daNeTekstAktivno]}>{tekst}</Text>
            </PressableScale>
          </View>
        );
      })}
    </View>
  );
}

function Stavka({ broj, naslov, opis, obavezno, greska, children }) {
  return (
    <View style={[styles.stavka, greska && styles.stavkaGreska]}>
      <Text style={styles.naslov}>
        {broj}. {naslov}
        {obavezno ? <Text style={styles.zvezdica}> *</Text> : null}
      </Text>
      {opis ? <Text style={styles.opis}>{opis}</Text> : null}
      {children}
      {greska ? <Text style={styles.greskaTekst}>{greska}</Text> : null}
    </View>
  );
}

// `onChange` prima funkciju nad prethodnim stanjem (kao setState), da dva brza
// dodira ne pregaze jedan drugog. `greske` je spisak kljuceva koje treba
// istaci - puni se tek posle pokusaja cuvanja.
export default function PitanjaODetetu({
  odgovori,
  onChange,
  telefonRoditelja,
  onTelefonRoditelja,
  greske = [],
}) {
  const postavi = (kljuc) => (v) => onChange((pre) => ({ ...pre, [kljuc]: v }));
  // Greska se pokazuje samo dok stavka i dalje nije ispravna - cim roditelj
  // odgovori ili ispravi broj, crveni tekst nestaje bez novog pokusaja cuvanja.
  const jos = nepotpuno(odgovori, telefonRoditelja);
  const imaGresku = (kljuc) => greske.includes(kljuc) && jos.includes(kljuc);
  const daNe = (p) => (
    <Stavka
      key={p.kljuc}
      broj={p.broj}
      naslov={p.naslov}
      opis={p.pitanje}
      obavezno
      greska={imaGresku(p.kljuc) ? 'Izaberite Da ili Ne.' : null}
    >
      <DaNe vrednost={odgovori[p.kljuc]} onChange={postavi(p.kljuc)} oznaka={p.naslov} />
    </Stavka>
  );

  return (
    <View style={styles.card}>
      <View style={styles.sectionHead}>
        <Ionicons name="shield-checkmark-outline" size={18} color={colors.primaryDarker} />
        <Text style={styles.sectionTitle}>Saglasnosti i informacije o detetu</Text>
      </View>
      <Text style={styles.sectionHint}>
        Stavke oznacene sa * su obavezne. Stavke 5 i 6 nisu obavezne, ali vam
        preporucujemo da ih popunite. Odgovore mozete promeniti u svakom
        trenutku na stranici deteta.
      </Text>

      {PITANJA.slice(0, 3).map(daNe)}

      <Stavka
        broj={4}
        naslov="Kontakt telefon roditelja/staratelja"
        opis="Broj na koji osoblje zove roditelja/staratelja. Cuva se na Vasem nalogu i vazi za svu Vasu decu."
        obavezno
        greska={imaGresku('telefonRoditelja') ? 'Unesite ispravan broj telefona.' : null}
      >
        <TextInput
          style={styles.input}
          placeholder="npr. 064 123 4567"
          placeholderTextColor={colors.textFaint}
          value={telefonRoditelja}
          onChangeText={onTelefonRoditelja}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          accessibilityLabel="Kontakt telefon roditelja/staratelja"
        />
      </Stavka>

      <Stavka
        broj={5}
        naslov="Dodatni kontakt telefon"
        opis="Broj osobe koju osoblje zove ako Vi niste dostupni (npr. drugi roditelj, baka, deka)."
        greska={imaGresku('extraContactPhone') ? 'Broj telefona nije ispravan.' : null}
      >
        <TextInput
          style={styles.input}
          placeholder="npr. 065 222 3333"
          placeholderTextColor={colors.textFaint}
          value={odgovori.extraContactPhone}
          onChangeText={postavi('extraContactPhone')}
          keyboardType="phone-pad"
          accessibilityLabel="Dodatni kontakt telefon"
        />
      </Stavka>

      <Stavka
        broj={6}
        naslov="Ovlascene osobe za preuzimanje deteta"
        opis="Osobe koje, osim roditelja/staratelja, smeju da preuzmu Vase dete iz Kids Club-a. Za svaku osobu upisite ime, prezime i broj telefona, svaku u novi red. Ako polje ostavite prazno, dete preuzima samo roditelj/staratelj."
      >
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder={'npr. Mira Petrovic, 064 111 2222\nJovan Petrovic, 065 333 4444'}
          placeholderTextColor={colors.textFaint}
          value={odgovori.pickupPersons}
          onChangeText={postavi('pickupPersons')}
          multiline
          accessibilityLabel="Ovlascene osobe za preuzimanje deteta"
        />
      </Stavka>

      {PITANJA.slice(3).map(daNe)}
    </View>
  );
}

// Tekstovi za prikaz odgovora (ekran deteta).
export function opisOdgovora(v) {
  if (v === true) return 'Da';
  if (v === false) return 'Ne';
  return 'Nije odgovoreno';
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionTitle: { ...type.heading, color: colors.text, flex: 1 },
  sectionHint: {
    ...type.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    lineHeight: 17,
  },
  stavka: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  stavkaGreska: {},
  naslov: { ...type.label, color: colors.text },
  zvezdica: { color: colors.danger },
  opis: { ...type.caption, color: colors.textMuted, marginTop: spacing.xs, lineHeight: 17 },
  greskaTekst: { ...type.caption, color: colors.danger, marginTop: spacing.xs },
  daNe: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  daNeCelija: { flex: 1 },
  daNeDugme: {
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  daNeAktivno: { backgroundColor: colors.primary, borderColor: colors.primary },
  daNeTekst: { ...type.label, color: colors.textMuted },
  daNeTekstAktivno: { color: colors.textOnPrimary },
  input: {
    ...type.body,
    color: colors.text,
    backgroundColor: colors.primaryTint,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
});
