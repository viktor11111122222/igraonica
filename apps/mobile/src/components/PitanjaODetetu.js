import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from './PressableScale';
import { colors, radius, spacing, type, shadow } from '../theme';

// Pitanja na koja osoblje treba odgovor pre nego sto dete ostane u igraonici.
// Svako moze da ostane bez odgovora (`null`) - roditelj ga preskace sada i
// dopunjuje kasnije sa ekrana deteta - pa se "ne" i "nije odgovoreno" razlikuju.
export const PITANJA = [
  { kljuc: 'photoConsent', pitanje: 'Da li dete sme da se slika?' },
  { kljuc: 'eatsLunch', pitanje: 'Da li dete jede rucak u igraonici?' },
  { kljuc: 'eatsSnack', pitanje: 'Da li dete jede uzinu u igraonici?' },
];

function DaNe({ vrednost, onChange, oznaka }) {
  return (
    <View style={styles.daNe}>
      {[
        { v: true, tekst: 'Da' },
        { v: false, tekst: 'Ne' },
      ].map(({ v, tekst }) => {
        const aktivno = vrednost === v;
        return (
          // Ponovni dodir vraca na "nije odgovoreno" - roditelj koji se
          // predomisli ne mora da izmisli odgovor.
          <View key={tekst} style={styles.daNeCelija}>
            <PressableScale
              style={[styles.daNeDugme, aktivno && styles.daNeAktivno]}
              onPress={() => onChange(aktivno ? null : v)}
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

// `onChange` prima funkciju nad prethodnim stanjem (kao setState), da dva
// brza dodira ne pregaze jedan drugog.
export default function PitanjaODetetu({ odgovori, onChange }) {
  return (
    <View style={styles.card}>
      <View style={styles.sectionHead}>
        <Ionicons name="shield-checkmark-outline" size={18} color={colors.primaryDarker} />
        <Text style={styles.sectionTitle}>Saglasnosti</Text>
      </View>
      <Text style={styles.sectionHint}>
        Mozete preskociti i odgovoriti kasnije, sa ekrana deteta.
      </Text>

      {PITANJA.map(({ kljuc, pitanje }) => (
        <View key={kljuc} style={styles.red}>
          <Text style={styles.pitanje}>{pitanje}</Text>
          <DaNe
            vrednost={odgovori[kljuc]}
            oznaka={pitanje}
            onChange={(v) => onChange((pre) => ({ ...pre, [kljuc]: v }))}
          />
        </View>
      ))}

      <Text style={styles.pitanje}>Ko sme da preuzme dete?</Text>
      <Text style={styles.sectionHint}>
        Osim vas - ime i broj telefona svake osobe.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="npr. baka Mira, 064 111 2222"
        placeholderTextColor={colors.textFaint}
        value={odgovori.pickupPersons}
        onChangeText={(t) => onChange((pre) => ({ ...pre, pickupPersons: t }))}
        multiline
        accessibilityLabel="Ko sme da preuzme dete"
      />
    </View>
  );
}

// Tekstovi za prikaz odgovora (ekran deteta, admin).
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
  sectionTitle: { ...type.heading, color: colors.text },
  sectionHint: {
    ...type.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    lineHeight: 17,
  },
  red: {},
  pitanje: { ...type.label, color: colors.text, marginTop: spacing.lg },
  daNe: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
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
    minHeight: 70,
    textAlignVertical: 'top',
  },
});
