import { useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import PressableScale from '../components/PressableScale';
import { colors, radius, spacing, type, font } from '../theme';

// Mere su preuzete iz predloska (ekran 796x1703 px, tj. 393x841 pt) i ovde
// stoje kao udeo sirine, da bi se raspored isto ponasao i na uzem i na sirem
// telefonu. Razmere slika su iz samih fajlova, pa se nista ne rasteze.
const LOGO_RATIO = 536 / 260;
const LOGO_SHARE = 264 / 393;
const ILLUSTRATION_RATIO = 591 / 579;
const ILLUSTRATION_SHARE = 292 / 393;
const ILLUSTRATION_LEFT_SHARE = 34 / 393;

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const { settings } = useSettings();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
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

  const logoWidth = Math.min(width * LOGO_SHARE, 300);
  const illustrationWidth = width * ILLUSTRATION_SHARE;

  return (
    <View style={styles.container}>
      {/* Podloga je amber, pa tamna slova u statusnoj traci jedina ostaju
          citljiva. RN vraca prethodno podesenje kad ekran ode sa steka. */}
      <StatusBar style="dark" />

      {/* Ukras ide ispod forme i ne hvata dodir - inace bi ilustracija preko
          dna progutala pritisak na "Registrujte se" na nizim ekranima. */}
      <Image
        source={require('../../assets/login-sparkle.png')}
        style={[styles.sparkle, { top: insets.top + 4 }]}
        resizeMode="contain"
        pointerEvents="none"
        accessible={false}
      />
      <Image
        source={require('../../assets/login-illustration.png')}
        style={[
          styles.illustration,
          {
            width: illustrationWidth,
            height: illustrationWidth / ILLUSTRATION_RATIO,
            left: width * ILLUSTRATION_LEFT_SHARE,
          },
        ]}
        resizeMode="contain"
        pointerEvents="none"
        accessible={false}
      />

      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Kad se tastatura podigne na niskom ekranu, dugme mora da ostane
            dohvatljivo - zato forma moze da se skroluje. */}
        <ScrollView
          style={styles.fill}
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 62 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo umesto ispisanog naziva. Ako se naziv u podesavanjima promeni,
              ostaje kao alternativni tekst za citace ekrana. */}
          <Image
            source={require('../../assets/login-logo.png')}
            style={{ width: logoWidth, height: logoWidth / LOGO_RATIO }}
            resizeMode="contain"
            accessibilityLabel={clubName}
          />

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
                <ActivityIndicator color={colors.textOnAuth} />
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
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.authBg,
  },
  fill: {
    flex: 1,
  },
  sparkle: {
    position: 'absolute',
    right: 40,
    width: 54,
    height: 68,
  },
  illustration: {
    position: 'absolute',
    bottom: 15,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: spacing.xxl,
  },
  form: {
    width: '100%',
    marginTop: 47,
  },
  input: {
    backgroundColor: colors.authField,
    borderRadius: radius.md,
    height: 50,
    paddingHorizontal: 18,
    ...type.body,
    fontSize: 16,
    color: colors.text,
    marginBottom: 13,
  },
  button: {
    backgroundColor: colors.authAction,
    borderRadius: radius.md,
    height: 53,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.textOnAuth,
    fontSize: 18,
    fontFamily: font.semibold,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl + 4,
  },
  footerText: {
    ...type.body,
    color: colors.textOnAuth,
  },
  linkText: {
    ...type.body,
    fontFamily: font.bold,
    color: colors.textOnAuth,
  },
});
