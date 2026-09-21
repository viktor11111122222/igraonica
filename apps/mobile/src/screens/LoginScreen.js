import { useEffect, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useAuth, ZAPAMCEN_EMAIL } from '../context/AuthContext';
import * as storage from '../utils/storage';
import {
  ILLUSTRATION_LEFT_SHARE,
  ILLUSTRATION_RATIO,
  ILLUSTRATION_SHARE,
  LOGO_MAX,
  LOGO_RATIO,
  LOGO_SHARE,
} from './authLayout';
import { useSettings } from '../context/SettingsContext';
import PressableScale from '../components/PressableScale';
import LoadingScreen from '../components/LoadingScreen';
import { useNajmanjeTrajanje } from '../hooks/useUcitavanje';
import { colors, radius, spacing, type, font } from '../theme';


export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const { settings } = useSettings();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  // Telefon je licni uredjaj, pa je pamcenje ovde podrazumevano - suprotno od
  // admin panela, gde racunar na recepciji deli vise ljudi.
  const [rememberMe, setRememberMe] = useState(true);

  // Zapamcen email stize iz Keychain-a, dakle tek posle prvog rendera.
  useEffect(() => {
    let otkazano = false;
    storage.getItem(ZAPAMCEN_EMAIL).then((sacuvan) => {
      // Ako je korisnik vec poceo da kuca, ne diramo mu polje.
      if (!otkazano && sacuvan) setEmail((trenutni) => trenutni || sacuvan);
    });
    return () => {
      otkazano = true;
    };
  }, []);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Greska', 'Unesite email i lozinku.');
      return;
    }

    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password, rememberMe);
    } catch (err) {
      Alert.alert('Greska', err.message);
    } finally {
      setLoading(false);
    }
  }

  // Dok prijava traje, ceo ekran prelazi u ucitavanje umesto da se vrti samo
  // tockic u dugmetu: posle uspesne prijave ionako sledi isti taj ekran dok se
  // pocetna puni, pa je prelaz prijava -> ucitavanje -> pocetna jedan potez.
  const ucitava = useNajmanjeTrajanje(loading);

  if (ucitava) return <LoadingScreen />;

  const clubName = (settings.club_name || 'Kids club').trim();

  const logoWidth = Math.min(width * LOGO_SHARE, LOGO_MAX);
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
        // Android sam skuplja prozor kad se tastatura podigne
        // (`adjustResize` u manifestu), pa mu ovde ne treba jos jedno
        // podesavanje visine - sa 'height' je posle zatvaranja tastature
        // ostajala prazna traka na dnu ekrana.
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
              style={styles.remember}
              onPress={() => setRememberMe((v) => !v)}
              accessibilityRole="checkbox"
              // accessibilityState pokriva iOS i Android; react-native-web ga u
              // ovoj verziji ne prevodi u aria-checked, pa bi na webu ostao
              // role="checkbox" bez stanja - citac ekrana ne bi znao da li je
              // kvacica ukljucena. Zato oba.
              accessibilityState={{ checked: rememberMe }}
              aria-checked={rememberMe}
              accessibilityLabel="Zapamti me"
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxOn]}>
                {rememberMe && (
                  <Ionicons name="checkmark" size={15} color={colors.textOnAuth} />
                )}
              </View>
              <Text style={styles.rememberText}>Zapamti me</Text>
            </PressableScale>

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
  remember: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm - 2,
    borderWidth: 2,
    borderColor: colors.textOnAuth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: colors.authAction,
    borderColor: colors.authAction,
  },
  rememberText: {
    ...type.body,
    fontSize: 15,
    color: colors.textOnAuth,
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
