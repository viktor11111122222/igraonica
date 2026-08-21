import { useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import PressableScale from '../components/PressableScale';
import { colors, radius, spacing, type, font } from '../theme';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const { settings } = useSettings();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Greska', 'Unesite email i lozinku.');
      return;
    }

    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err) {
      Alert.alert('Greska', err.message);
    } finally {
      setLoading(false);
    }
  }

  const clubName = (settings.club_name || 'Kids club').trim();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Logo umesto ispisanog naziva. Ako se naziv u podesavanjima promeni,
          ostaje kao alternativni tekst za citace ekrana. */}
      <View style={styles.logoContainer}>
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel={clubName}
        />
      </View>

      <View style={styles.form}>
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
          textContentType="username"
        />

        <TextInput
          style={styles.input}
          placeholder="Lozinka"
          placeholderTextColor={colors.textFaint}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          onSubmitEditing={handleLogin}
          returnKeyType="go"
        />

        <PressableScale
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color={colors.textOnPrimary} />
          ) : (
            <Text style={styles.buttonText}>Prijavi se</Text>
          )}
        </PressableScale>

        {/* Jedan izlaz ka registraciji. Ranije su ovde stajala dva dugmeta koja
            vode na isto mesto, a natpis je pisao "Vec imate nalog? Prijava" -
            na ekranu za prijavu. */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Nemate nalog? </Text>
          <PressableScale onPress={() => navigation.navigate('Register')}>
            <Text style={styles.linkText}>Registrujte se</Text>
          </PressableScale>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl - 10,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 50,
  },
  // Odnos stranica logoa je 2.07; visina prati sirinu da se ne rasteze.
  logo: {
    width: 240,
    height: 116,
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
