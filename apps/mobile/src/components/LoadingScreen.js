import { useEffect } from 'react';
import { Animated, Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAnimatedValue } from '../hooks/useAnimatedValue';
import { colors, motion, spacing } from '../theme';
import {
  ILLUSTRATION_LEFT_SHARE,
  ILLUSTRATION_RATIO,
  ILLUSTRATION_SHARE,
  LOGO_MAX,
  LOGO_RATIO,
  LOGO_SHARE,
} from '../screens/authLayout';

// Ekran koji stoji dok se aplikacija podize: dok se ucitava font i dok se
// proverava da li je korisnik jos prijavljen.
//
// Namerno je to ista amber podloga sa istim ukrasima kao ekran za prijavu, i
// logo je iste velicine. Kad provera zavrsi, ne menja se ekran nego se samo
// pojavi forma - nema bljeska i skoka koji je ranije pravio goli spiner na
// beloj podlozi.
//
// Nema nijednog slova: ovaj ekran se crta i pre nego sto se Montserrat ucita,
// pa bi tekst prvo bio ispisan sistemskim pismom, a onda bi poskocio.

// Animacije ovde idu kroz JS, ne kroz native driver.
//
// Ekran se pri pokretanju montira i demontira dva puta zaredom (prvo kapija za
// font, pa kapija za sesiju). Native driver pri gasenju animacije pokusava da
// vrati vrednost u JS, a komponente vise nema - iOS je na to ispisivao
// "Sending `onAnimatedValueUpdate` with no listeners registered" i dizao zuti
// baner preko aplikacije. Ovde se animiraju tri tackice i jedan logo, pa je
// racun kroz JS bez ikakvog troska. Uz to react-native-web native driver
// ionako ne podrzava.
const BROJ_TACKICA = 3;
// Koliko jedna tackica traje od pojave do nestanka.
const OTKUCAJ = motion.enter * 2;
// Razmak izmedju tackica, da talas ide s leva na desno.
const RAZMAK = 160;

function Tackica({ kasnjenje }) {
  const puls = useAnimatedValue(0);

  useEffect(() => {
    const petlja = Animated.loop(
      Animated.sequence([
        Animated.delay(kasnjenje),
        Animated.timing(puls, {
          toValue: 1,
          duration: OTKUCAJ,
          useNativeDriver: false,
        }),
        Animated.timing(puls, {
          toValue: 0,
          duration: OTKUCAJ,
          useNativeDriver: false,
        }),
        // Pauza na kraju kruga je duza od jednog talasa, pa se tackice smire
        // pre nego sto krenu opet - bez toga deluje uzurbano.
        Animated.delay(RAZMAK * BROJ_TACKICA - kasnjenje),
      ])
    );
    petlja.start();
    return () => petlja.stop();
  }, [puls, kasnjenje]);

  return (
    <Animated.View
      style={[
        styles.tackica,
        {
          opacity: puls.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
          transform: [
            { scale: puls.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) },
          ],
        },
      ]}
    />
  );
}

export default function LoadingScreen() {
  const { width } = useWindowDimensions();
  const ulaz = useAnimatedValue(0);

  // Logo je odmah vidljiv, animira se samo jedva primetan rast.
  //
  // Ranije je ulazio i iz prozirnosti 0, pa se na kratkom ucitavanju (prijava
  // traje oko 250ms, a fade 220ms) video prazan amber ekran sa tackicama i bez
  // loga. Uz to se pri pokretanju montiraju dve instance zaredom - font pa
  // provera sesije - pa bi fade krenuo iz nule dvaput i logo bi trepnuo.
  useEffect(() => {
    Animated.timing(ulaz, {
      toValue: 1,
      duration: motion.enter,
      useNativeDriver: false,
    }).start();
  }, [ulaz]);

  const logoWidth = Math.min(width * LOGO_SHARE, LOGO_MAX);
  const illustrationWidth = width * ILLUSTRATION_SHARE;

  return (
    <View style={styles.container}>
      {/* Podloga je amber, pa tamna slova u statusnoj traci jedina ostaju citljiva. */}
      <StatusBar style="dark" />

      <Image
        source={require('../../assets/login-sparkle.png')}
        style={styles.sparkle}
        resizeMode="contain"
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
        accessible={false}
      />

      {/* Citac ekrana treba da kaze da se ceka, a ne da nabraja ukrase. */}
      <View
        style={styles.sredina}
        accessibilityRole="progressbar"
        accessibilityLabel="Ucitavanje"
        testID="loading-screen"
      >
        <Animated.Image
          source={require('../../assets/login-logo.png')}
          style={{
            width: logoWidth,
            height: logoWidth / LOGO_RATIO,
            transform: [
              { scale: ulaz.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) },
            ],
          }}
          resizeMode="contain"
          accessible={false}
        />

        <View style={styles.tackice}>
          {Array.from({ length: BROJ_TACKICA }, (_, i) => (
            <Tackica key={i} kasnjenje={i * RAZMAK} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.authBg,
  },
  sparkle: {
    position: 'absolute',
    top: 62,
    right: 40,
    width: 54,
    height: 68,
  },
  illustration: {
    position: 'absolute',
    bottom: 15,
  },
  // Logo stoji u sredini ekrana, a ne na visini na kojoj je u prijavi: ovaj
  // ekran nema formu ispod njega, pa bi gore delovao odsecen.
  sredina: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tackice: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
    marginTop: spacing.xxl,
  },
  tackica: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.textOnAuth,
  },
});
