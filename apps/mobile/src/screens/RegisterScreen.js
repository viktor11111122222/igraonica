import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../context/AuthContext';
import PressableScale from '../components/PressableScale';
import { colors, radius, spacing, type, font } from '../theme';

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Greska', 'Sva polja su obavezna.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Greska', 'Lozinke se ne poklapaju.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Greska', 'Lozinka mora imati najmanje 6 karaktera.');
      return;
    }

    setLoading(true);
    try {
      await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
    } catch (err) {
      Alert.alert('Greska', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Ekran je beo, pa ikone sistemske trake moraju da budu tamne. Bez ovoga
          nasledjuje se ono sto je zadao prethodni ekran. */}
      <StatusBar style="dark" />
      <KeyboardAvoidingView
      style={styles.container}
      // Android sam skuplja prozor kad se tastatura podigne
        // (`adjustResize` u manifestu), pa mu ovde ne treba jos jedno
        // podesavanje visine - sa 'height' je posle zatvaranja tastature
        // ostajala prazna traka na dnu ekrana.
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Otvorite nalog</Text>

        <View style={styles.form}>
          {/* Ime i prezime su odvojena polja - natpis "Full Name" na prvom je
              obecavao oba. */}
          <TextInput
            style={styles.input}
            placeholder="Ime"
            placeholderTextColor={colors.textFaint}
            value={firstName}
            onChangeText={setFirstName}
            autoComplete="given-name"
            textContentType="givenName"
          />

          <TextInput
            style={styles.input}
            placeholder="Prezime"
            placeholderTextColor={colors.textFaint}
            value={lastName}
            onChangeText={setLastName}
            autoComplete="family-name"
            textContentType="familyName"
          />

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textFaint}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
          />

          <TextInput
            style={styles.input}
            placeholder="Lozinka"
            placeholderTextColor={colors.textFaint}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
          />

          <TextInput
            style={styles.input}
            placeholder="Ponovite lozinku"
            placeholderTextColor={colors.textFaint}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            onSubmitEditing={handleRegister}
            returnKeyType="go"
          />

          <PressableScale
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator color={colors.textOnPrimary} />
            ) : (
              <Text style={styles.buttonText}>Otvori nalog</Text>
            )}
          </PressableScale>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Vec imate nalog? </Text>
            <PressableScale onPress={() => navigation.navigate('Login')}>
              <Text style={styles.linkText}>Prijavite se</Text>
            </PressableScale>
          </View>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl - 10,
    paddingVertical: spacing.xxxl,
  },
  title: {
    ...type.title,
    fontSize: 30,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  form: {
    width: '100%',
  },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    ...type.body,
    fontSize: 16,
    color: colors.text,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.textOnPrimary,
    fontSize: 18,
    fontFamily: font.semibold,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  footerText: {
    ...type.body,
    color: colors.textMuted,
  },
  linkText: {
    ...type.body,
    fontFamily: font.semibold,
    color: colors.primaryDarker,
  },
});
