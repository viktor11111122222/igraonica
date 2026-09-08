import { useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, ActivityIndicator, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import PressableScale from './PressableScale';
import { PRAVNO } from '../utils/pravno';
import { colors, radius, spacing, type, shadow } from '../theme';

// Brisanje naloga iz same aplikacije.
//
// Obe prodavnice to traze od svake aplikacije u kojoj nalog moze da se napravi:
// roditelj mora da ga obrise sam, bez pisanja podrsci. Uz to stoje i uslovi i
// politika privatnosti - recenzent ih trazi na vidnom mestu, a ne samo u
// opisu na prodavnici.
//
// Sta se brise stoji u tekstu pre potvrde, jer je nepovratno: sa nalogom odlaze
// i deca i njihova istorija poseta.
export default function BrisanjeNaloga() {
  const { user, deleteAccount } = useAuth();
  const [otvoren, setOtvoren] = useState(false);
  const [lozinka, setLozinka] = useState('');
  const [radi, setRadi] = useState(false);
  const [greska, setGreska] = useState('');

  function zatvori() {
    setOtvoren(false);
    setLozinka('');
    setGreska('');
  }

  async function obrisi() {
    setRadi(true);
    setGreska('');
    try {
      // Uspeh odjavljuje, pa ovaj ekran nestaje - stanje se posle ne dira.
      await deleteAccount(lozinka);
    } catch (err) {
      setGreska(err.message);
      setRadi(false);
    }
  }

  return (
    <>
      <View style={styles.karta}>
        <PressableScale
          style={styles.red}
          onPress={() => Linking.openURL(PRAVNO.privatnost)}
          accessibilityRole="link"
        >
          <Ionicons name="lock-closed-outline" size={16} color={colors.primary} />
          <Text style={styles.tekst}>Politika privatnosti</Text>
          <Ionicons name="open-outline" size={14} color={colors.textFaint} />
        </PressableScale>

        <PressableScale
          style={styles.red}
          onPress={() => Linking.openURL(PRAVNO.uslovi)}
          accessibilityRole="link"
        >
          <Ionicons name="document-text-outline" size={16} color={colors.primary} />
          <Text style={styles.tekst}>Uslovi koriscenja</Text>
          <Ionicons name="open-outline" size={14} color={colors.textFaint} />
        </PressableScale>

        <PressableScale
          style={styles.red}
          onPress={() => setOtvoren(true)}
          accessibilityRole="button"
          accessibilityLabel="Obrisi nalog"
        >
          <Ionicons name="trash-outline" size={16} color={colors.danger} />
          <Text style={[styles.tekst, styles.opasno]}>Obrisi nalog</Text>
        </PressableScale>
      </View>

      <Modal visible={otvoren} transparent animationType="fade" onRequestClose={zatvori}>
        <View style={styles.zastor}>
          <View style={styles.prozor}>
            <Text style={styles.naslov}>Brisanje naloga</Text>
            <Text style={styles.opis}>
              Nalog {user?.email} se brise zauvek. Sa njim odlaze i podaci o vasoj deci i
              istorija njihovih dolazaka. Ovo se ne moze ponistiti.
            </Text>
            <Text style={styles.opis}>Unesite lozinku da potvrdite.</Text>

            <TextInput
              style={styles.polje}
              value={lozinka}
              onChangeText={setLozinka}
              placeholder="Lozinka"
              placeholderTextColor={colors.textFaint}
              secureTextEntry
              autoCapitalize="none"
              editable={!radi}
            />

            {!!greska && <Text style={styles.greska}>{greska}</Text>}

            <View style={styles.dugmad}>
              <PressableScale style={[styles.dugme, styles.odustani]} onPress={zatvori} disabled={radi}>
                <Text style={styles.odustaniTekst}>Odustani</Text>
              </PressableScale>
              <PressableScale
                style={[styles.dugme, styles.potvrdi]}
                onPress={obrisi}
                disabled={radi}
                accessibilityRole="button"
              >
                {radi ? (
                  <ActivityIndicator color={colors.textOnPrimary} />
                ) : (
                  <Text style={styles.potvrdiTekst}>Obrisi nalog</Text>
                )}
              </PressableScale>
            </View>
          </View>
        </View>
      </Modal>
    </>
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
  red: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  tekst: { ...type.body, color: colors.text, flex: 1 },
  opasno: { color: colors.danger },

  zastor: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  prozor: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  naslov: { ...type.heading, color: colors.text },
  opis: { ...type.body, color: colors.textMuted },
  polje: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...type.body,
    color: colors.text,
  },
  greska: { ...type.body, color: colors.danger },
  dugmad: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  dugme: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  odustani: { backgroundColor: colors.bg },
  odustaniTekst: { ...type.label, color: colors.text },
  potvrdi: { backgroundColor: colors.danger },
  potvrdiTekst: { ...type.label, color: colors.textOnPrimary },
});
