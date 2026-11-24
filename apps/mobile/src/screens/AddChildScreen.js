import { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest } from '../utils/api';
import PressableScale from '../components/PressableScale';
import BirthDatePicker from '../components/BirthDatePicker';
import PitanjaODetetu, { DOPUNSKE, nepotpuno } from '../components/PitanjaODetetu';
import { useAuth } from '../context/AuthContext';
import { colors, radius, spacing, type, shadow } from '../theme';

// Najcesce alergije kod dece - da roditelj ne mora da kuca.
const COMMON_ALLERGIES = [
  'Kikiriki',
  'Orasasti plodovi',
  'Mleko',
  'Jaja',
  'Gluten',
  'Soja',
  'Riba',
  'Med',
  'Cokolada',
];

// Alergije su na serveru jedan tekst ("Mleko, Jaja, kivi"). Za izmenu ga
// vracamo u cipove koje znamo i slobodan unos za ostatak.
function razdvojiAlergije(tekst) {
  const delovi = (tekst || '').split(',').map((d) => d.trim()).filter(Boolean);
  return {
    picked: delovi.filter((d) => COMMON_ALLERGIES.includes(d)),
    other: delovi.filter((d) => !COMMON_ALLERGIES.includes(d)).join(', '),
  };
}

export default function AddChildScreen({ navigation, route }) {
  // Sa detetom u parametrima ekran menja postojece dete umesto da dodaje novo.
  const postojece = route?.params?.child;
  // Podsetnik na pocetnoj otvara obrazac zbog saglasnosti, a one su na dnu -
  // ekran tada sam skroluje do njih, jednom, cim zna gde su.
  const naSaglasnosti = Boolean(route?.params?.naSaglasnosti);
  const skrol = useRef(null);
  const vecSkrolovano = useRef(false);

  function saglasnostiPostavljene(e) {
    saglasnostiY.current = e.nativeEvent.layout.y;
    if (!naSaglasnosti || vecSkrolovano.current) return;
    vecSkrolovano.current = true;
    skrol.current?.scrollTo({ y: Math.max(0, e.nativeEvent.layout.y - spacing.lg), animated: true });
  }
  const pocetneAlergije = razdvojiAlergije(postojece?.allergies);

  const [firstName, setFirstName] = useState(postojece?.firstName ?? '');
  const [lastName, setLastName] = useState(postojece?.lastName ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(postojece?.dateOfBirth?.slice(0, 10) ?? '');
  const [gender, setGender] = useState(postojece?.gender ?? null);
  const [picked, setPicked] = useState(pocetneAlergije.picked);
  const [otherAllergies, setOtherAllergies] = useState(pocetneAlergije.other);
  const [notes, setNotes] = useState(postojece?.notes ?? '');
  const [odgovori, setOdgovori] = useState({
    photoConsent: postojece?.photoConsent ?? null,
    eatsLunch: postojece?.eatsLunch ?? null,
    eatsSnack: postojece?.eatsSnack ?? null,
    walksConsent: postojece?.walksConsent ?? null,
    pickupPersons: postojece?.pickupPersons ?? '',
    extraContactPhone: postojece?.extraContactPhone ?? '',
  });
  const { novNalog } = useAuth();
  // Prvi ekran posle registracije - ispod njega nema nicega.
  const prviEkran = navigation.getState?.()?.index === 0;
  const posleRegistracije = !postojece && novNalog && prviEkran;
  // Istaknuta polja se pune tek posle pokusaja cuvanja.
  const [greske, setGreske] = useState([]);
  const saglasnostiY = useRef(0);
  const [loading, setLoading] = useState(false);

  function toggleAllergy(name) {
    setPicked((prev) =>
      prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name]
    );
  }

  // Backend cuva alergije kao tekst, pa cipove i slobodan unos spajamo u
  // jedan citljiv niz.
  function buildAllergies() {
    const extra = otherAllergies.trim();
    return [...picked, ...(extra ? [extra] : [])].join(', ');
  }

  // Posle registracije ovaj ekran je prvi, pa ispod njega nema cemu da se
  // vrati - tada ide na pocetnu.
  function nazad() {
    if (navigation.getState?.()?.index === 0) navigation.navigate('Tabs');
    else navigation.goBack();
  }

  async function handleSubmit() {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Nedostaju podaci', 'Ime i prezime su obavezni.');
      return;
    }
    if (!dateOfBirth) {
      Alert.alert('Nedostaju podaci', 'Izaberite datum rodjenja.');
      return;
    }

    // Saglasnosti su obavezne: bez odgovora na svako da/ne pitanje dete se ne
    // cuva. Ekran se spusti do njih i istakne sta fali.
    const fali = nepotpuno(odgovori);
    setGreske(fali);
    if (fali.length > 0) {
      // Poruka navodi samo ono sto stvarno fali, da roditelj ne trazi gresku
      // u polju koje je vec dobro popunio.
      const nedostaje = [];
      if (fali.some((k) => !DOPUNSKE.includes(k))) {
        nedostaje.push('odgovorite sa Da ili Ne na sva pitanja');
      }
      if (fali.includes('extraContactPhone')) {
        nedostaje.push(
          odgovori.extraContactPhone.trim()
            ? 'ispravite broj dodatnog kontakta (stavka 4)'
            : 'upisite dodatni kontakt ili "Nema" (stavka 4)'
        );
      }
      if (fali.includes('pickupPersons')) {
        nedostaje.push('upisite ko sme da preuzme dete ili "Samo roditelji" (stavka 5)');
      }
      const tekst =
        nedostaje.length > 1
          ? `${nedostaje.slice(0, -1).join(', ')} i ${nedostaje[nedostaje.length - 1]}`
          : nedostaje[0];
      Alert.alert('Nedostaju saglasnosti', `Pre cuvanja ${tekst}.`);
      skrol.current?.scrollTo({ y: Math.max(0, saglasnostiY.current - spacing.lg), animated: true });
      return;
    }

    const allergies = buildAllergies();

    const saglasnosti = {
      photoConsent: odgovori.photoConsent,
      eatsLunch: odgovori.eatsLunch,
      eatsSnack: odgovori.eatsSnack,
      walksConsent: odgovori.walksConsent,
      pickupPersons: odgovori.pickupPersons.trim() || null,
      extraContactPhone: odgovori.extraContactPhone.trim() || null,
    };

    setLoading(true);
    try {
      if (postojece) {
        // Pri izmeni prazno polje znaci "obrisano", pa ide null - inace bi
        // server zadrzao staru vrednost.
        await apiRequest(`/children/${postojece.id}`, {
          method: 'PATCH',
          body: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            dateOfBirth,
            gender,
            allergies: allergies || null,
            notes: notes.trim() || null,
            ...saglasnosti,
          },
        });
        // Ekran deteta pri povratku sam ucitava sveze podatke (izmena je
        // vec ocistila kes).
        nazad();
        return;
      }

      await apiRequest('/children', {
        method: 'POST',
        body: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          dateOfBirth,
          // Pol nije obavezan. Server prihvata da polja nema, ali `null` odbija
          // kao nevazeci pol - pa bi dete bez izabranog pola puklo pri cuvanju.
          gender: gender || undefined,
          allergies: allergies || undefined,
          notes: notes.trim() || undefined,
          ...saglasnosti,
        },
      });

      Alert.alert('Gotovo', `Dete ${firstName.trim()} je dodato. QR kod je spreman.`, [
        { text: 'OK', onPress: nazad },
      ]);
    } catch (err) {
      Alert.alert('Greska', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      ref={skrol}
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {posleRegistracije && (
        <View style={styles.dobrodoslica}>
          <Text style={styles.dobrodoslicaNaslov}>Dobro dosli!</Text>
          <Text style={styles.dobrodoslicaTekst}>
            Dodajte dete i popunite saglasnosti - osoblju trebaju pre prvog
            dolaska. Dete mozete dodati i kasnije, sa taba Moj paket.
          </Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.label}>Ime *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ime deteta"
          placeholderTextColor={colors.textFaint}
          value={firstName}
          onChangeText={setFirstName}
        />

        <Text style={styles.label}>Prezime *</Text>
        <TextInput
          style={styles.input}
          placeholder="Prezime deteta"
          placeholderTextColor={colors.textFaint}
          value={lastName}
          onChangeText={setLastName}
        />

        <Text style={styles.label}>Datum rodjenja *</Text>
        <BirthDatePicker value={dateOfBirth} onChange={setDateOfBirth} />

        <Text style={styles.label}>Pol</Text>
        <View style={styles.genderRow}>
          {[
            { key: 'MALE', label: 'Muski' },
            { key: 'FEMALE', label: 'Zenski' },
          ].map((g) => {
            const active = gender === g.key;
            return (
              // PressableScale stavlja style na unutrasnji View, pa flex mora
              // na omotac da bi dugmad podelila red na pola.
              <View key={g.key} style={styles.genderCell}>
                <PressableScale
                  style={[styles.genderBtn, active && styles.genderActive]}
                  onPress={() => setGender(active ? null : g.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.genderText, active && styles.genderTextActive]}>
                    {g.label}
                  </Text>
                </PressableScale>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHead}>
          <Ionicons name="alert-circle" size={18} color={colors.danger} />
          <Text style={styles.sectionTitle}>Alergije</Text>
        </View>
        <Text style={styles.sectionHint}>
          Prikazuju se uz QR kod pri prijavi, da osoblje odmah vidi na sta dete
          reaguje.
        </Text>

        <View style={styles.chipWrap}>
          {COMMON_ALLERGIES.map((name) => {
            const active = picked.includes(name);
            return (
              <PressableScale
                key={name}
                style={[styles.allergyChip, active && styles.allergyChipActive]}
                onPress={() => toggleAllergy(name)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                {active && (
                  <Ionicons name="checkmark" size={13} color={colors.danger} />
                )}
                <Text
                  style={[styles.allergyText, active && styles.allergyTextActive]}
                >
                  {name}
                </Text>
              </PressableScale>
            );
          })}
        </View>

        <TextInput
          style={[styles.input, styles.inputTight]}
          placeholder="Nesto drugo? Upisite ovde"
          placeholderTextColor={colors.textFaint}
          value={otherAllergies}
          onChangeText={setOtherAllergies}
        />
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHead}>
          <Ionicons name="document-text-outline" size={18} color={colors.primaryDarker} />
          <Text style={styles.sectionTitle}>Napomene</Text>
        </View>
        <Text style={styles.sectionHint}>
          Sve sto osoblje treba da zna - lekovi, strahovi, navike.
        </Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="npr. ne jede meso, plasi se glasne muzike..."
          placeholderTextColor={colors.textFaint}
          value={notes}
          onChangeText={setNotes}
          multiline
        />
      </View>

      <View onLayout={saglasnostiPostavljene} testID="saglasnosti">
        <PitanjaODetetu
          odgovori={odgovori}
          onChange={setOdgovori}
          greske={greske}
        />
      </View>

      <PressableScale
        style={[styles.submit, loading && styles.submitDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={colors.textOnPrimary} />
        ) : (
          <Text style={styles.submitText}>{postojece ? 'Sacuvaj izmene' : 'Dodaj dete'}</Text>
        )}
      </PressableScale>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl },

  dobrodoslica: {
    backgroundColor: colors.primaryTint,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  dobrodoslicaNaslov: { ...type.heading, color: colors.text },
  dobrodoslicaTekst: { ...type.caption, color: colors.textMuted, marginTop: spacing.xs, lineHeight: 17 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  label: {
    ...type.caption,
    color: colors.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  input: {
    ...type.body,
    color: colors.text,
    backgroundColor: colors.primaryTint,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  inputTight: { marginTop: spacing.md },
  textArea: { height: 90, textAlignVertical: 'top', marginTop: spacing.md },

  genderRow: { flexDirection: 'row', gap: spacing.md },
  genderCell: { flex: 1 },
  genderBtn: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  genderText: { ...type.label, color: colors.textMuted },
  genderTextActive: { color: colors.textOnPrimary },

  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionTitle: { ...type.heading, color: colors.text },
  sectionHint: {
    ...type.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    lineHeight: 17,
  },

  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  allergyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  allergyChipActive: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
  },
  allergyText: { ...type.caption, color: colors.textMuted },
  allergyTextActive: { color: colors.danger },

  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    ...shadow.raised,
  },
  submitDisabled: { opacity: 0.7 },
  submitText: { ...type.heading, color: colors.textOnPrimary },
});
