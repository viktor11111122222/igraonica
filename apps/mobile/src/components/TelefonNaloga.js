import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import PressableScale from './PressableScale';
import { jeTelefon } from '../utils/telefon';
import { colors, radius, spacing, type, shadow } from '../theme';

// Broj telefona roditelja u delu "Nalog". Osoblje zove roditelja dok je dete
// u igraonici. Nalozi otvoreni pre nego sto je telefon postao obavezan ga
// nemaju, pa ih kartica tada istaknuto poziva da ga dodaju.
export default function TelefonNaloga() {
  const { user, updateProfile } = useAuth();
  const [menja, setMenja] = useState(false);
  const [broj, setBroj] = useState(user?.phone ?? '');
  const [radi, setRadi] = useState(false);

  const nema = !user?.phone;

  async function sacuvaj() {
    if (!jeTelefon(broj)) {
      Alert.alert('Greska', 'Unesite ispravan broj telefona.');
      return;
    }
    setRadi(true);
    try {
      await updateProfile({ phone: broj.trim() });
      setMenja(false);
    } catch (err) {
      Alert.alert('Greska', err.message);
    } finally {
      setRadi(false);
    }
  }

  return (
    <View style={[styles.karta, nema && !menja && styles.upozorenje]}>
      <View style={styles.red}>
        <Ionicons name="call-outline" size={16} color={nema ? colors.danger : colors.primary} />
        {menja ? (
          <TextInput
            style={styles.unos}
            value={broj}
            onChangeText={setBroj}
            placeholder="Broj telefona"
            placeholderTextColor={colors.textFaint}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            autoFocus
            accessibilityLabel="Broj telefona"
          />
        ) : (
          <Text style={[styles.tekst, nema && styles.opasno]}>
            {nema ? 'Dodajte broj telefona' : user.phone}
          </Text>
        )}
        {radi ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <PressableScale
            onPress={menja ? sacuvaj : () => setMenja(true)}
            accessibilityRole="button"
          >
            <Text style={styles.akcija}>{menja ? 'Sacuvaj' : nema ? 'Dodaj' : 'Izmeni'}</Text>
          </PressableScale>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  karta: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    padding: spacing.sm,
    ...shadow.card,
  },
  upozorenje: { borderWidth: 1, borderColor: colors.danger },
  red: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  tekst: { ...type.body, color: colors.text, flex: 1 },
  opasno: { color: colors.danger },
  unos: {
    ...type.body,
    flex: 1,
    color: colors.text,
    paddingVertical: 0,
  },
  akcija: { ...type.label, color: colors.primaryDarker },
});
