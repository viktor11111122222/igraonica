import { useState } from 'react';
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

export default function AddChildScreen({ navigation }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState(null);
  const [picked, setPicked] = useState([]);
  const [otherAllergies, setOtherAllergies] = useState('');
  const [notes, setNotes] = useState('');
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

  async function handleSubmit() {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Nedostaju podaci', 'Ime i prezime su obavezni.');
      return;
    }
    if (!dateOfBirth) {
      Alert.alert('Nedostaju podaci', 'Izaberite datum rodjenja.');
      return;
    }

    const allergies = buildAllergies();

    setLoading(true);
    try {
      await apiRequest('/children', {
        method: 'POST',
        body: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          dateOfBirth,
          gender,
          allergies: allergies || undefined,
          notes: notes.trim() || undefined,
        },
      });

      Alert.alert('Gotovo', `${firstName.trim()} je dodat/a. QR kod je spreman.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Greska', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
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
          Sve sto osoblje treba da zna - lekovi, strahovi, ko sme da preuzme
          dete.
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

      <PressableScale
        style={[styles.submit, loading && styles.submitDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={colors.textOnPrimary} />
        ) : (
          <Text style={styles.submitText}>Dodaj dete</Text>
        )}
      </PressableScale>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl },

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
