import { View, Text, Image, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, radius, spacing, type } from '../theme';

// Zaglavlje ekrana: puna glavna boja sa belom decjom sarom preko nje.
//
// Sara je jedan fajl - bela sa alfom - a ne slika u boji. Sa prilozenog
// predloska (Pattern 1170x381px novi.psd) izmereno je da je crtez beo i samo
// providan, pa je dovoljno da se polozi preko boje. Boja tako ostaje na
// jednom mestu, u temi.
//
// Prirodna razmera sare. Sirina je puna sirina ekrana, pa crtezi ispadnu
// tacno onoliko krupni koliko su i u predlosku.
//
// Fajl je visi od prilozenog banera: gornjih 381 redova je original, a ostatak
// je dopuna istim crtezima na novim mestima (deo ogledalno), da bi sara mogla
// da pokrije i traku sa datumima a da se nigde ne ponovi.
const SARA = { width: 1170, height: 780 };

// Sama sara, bez podloge. Uvek se kaci za vrh onoga u sta je stavljena, pa
// mesto na kom pocinje bira onaj ko je koristi.
//
// Ne rasteze se: `cover` bi je uvecao da pokrije i visinu, pa bi se od crteza
// videlo samo par uvecanih komada. Sirina je puna sirina ekrana, a visina ide
// iz razmere fajla - tako crtezi ostaju sitni i cita se cela sara.
function Doodles() {
  const { width } = useWindowDimensions();

  return (
    <Image
      source={require('../../assets/banner-doodles.png')}
      testID="banner-doodles"
      style={[
        styles.doodles,
        { width, height: (width * SARA.height) / SARA.width, opacity: colors.bannerDoodle },
      ]}
      pointerEvents="none"
      accessible={false}
    />
  );
}

// Podloga: glavna boja sa sarom preko nje. Stoji zasebno jer istu podlogu
// koristi i zaglavlje stack navigatora (headerBackground), gde nema mesta za
// naslov i decu - njih crta sam navigator.
export function BannerBackground({ style, plain }) {

  return (
    <View testID="banner-bg" style={[styles.podloga, style]}>
      {plain ? null : <Doodles />}
    </View>
  );
}

// `doodles` bira dokle ide sara:
//   'full'    - preko celog banera (podrazumevano)
//   'head'    - samo iza naslova, dok traka sa datumima ispod ostaje ravna boja
//   'content' - obrnuto: samo iza sadrzaja u podnozju (traka sa datumima)
//   'none'    - bez sare, samo boja
//
// 'head' i 'content' rade tako sto se sara stavi u kutiju koja sece preko
// ivica (`overflow: hidden`), pa se vidi samo onoliko koliko ta kutija zauzima.
export default function Banner({
  eyebrow,
  title,
  subtitle,
  right,
  rounded,
  style,
  doodles = 'full',
  children,
}) {

  // Gornji vazduh mora da krene ispod sistemske trake, a ona nije svuda ista:
  // ~59 na iPhone-u sa ostrvom, 20 na starom SE, 24-49 na Androidu. Fiksnih 64
  // je zato na Androidu ostavljalo dvostruko vise vazduha nego na iOS-u.
  const insets = useSafeAreaInsets();

  // Pocetna nosi svoje zaglavlje (ime, zvono sa brojacem), pa od banera uzima
  // samo obojenu podlogu sa sarom - tada ovoga nema.
  const zaglavlje =
    title || eyebrow || right ? (
      <View style={[styles.head, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.texts}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
    ) : null;

  return (
    <View
      testID="banner"
      style={[
        styles.banner,
        rounded && styles.rounded,
        style,
      ]}
    >
      <BannerBackground style={StyleSheet.absoluteFill} plain={doodles !== 'full'} />

      {zaglavlje && doodles === 'head' ? (
        <View testID="banner-head" style={styles.isecak}>
          <Doodles />
          {zaglavlje}
        </View>
      ) : (
        zaglavlje
      )}

      {/* Donji vazduh zaglavlja stoji IZVAN isecka. Da je unutra (kao padding
          na samom zaglavlju), sara bi se videla i u razmaku iznad datuma -
          isecak se sece po svojoj ivici, a ivica bi tada bila ispod razmaka. */}
      {zaglavlje ? <View style={styles.podZaglavljem} /> : null}

      {/* Traka sa datumima stoji unutar banera, bez svoje pozadine, pa se kroz
          nju vidi ono sto je iza. */}
      {children && doodles === 'content' ? (
        <View testID="banner-content" style={styles.isecak}>
          <Doodles />
          {children}
        </View>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
    podloga: {
      flex: 1,
      backgroundColor: colors.primary,
      // Sara ide preko cele povrsine, pa mora da se sece na zaobljenim uglovima.
      overflow: 'hidden',
    },
    banner: {
      overflow: 'hidden',
    },
    isecak: { overflow: 'hidden' },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      // paddingTop dolazi iz sigurne zone, u samoj komponenti.
      paddingHorizontal: spacing.xl,
    },
    // Vazduh ispod naslova. Zaseban je, a ne padding zaglavlja, iz razloga
    // objasnjenog gore - i ne dodaje se ispod trake sa datumima, jer ga nosi
    // zaglavlje a ne ceo baner.
    podZaglavljem: { height: spacing.xl },
    doodles: {
      position: 'absolute',
      top: 0,
      left: 0,
    },
    rounded: {
      borderBottomLeftRadius: radius.xl,
      borderBottomRightRadius: radius.xl,
    },
    texts: { flex: 1 },
    eyebrow: { ...type.body, color: colors.onPrimaryMuted },
    title: { ...type.title, color: colors.textOnPrimary, marginTop: 2 },
    subtitle: {
      ...type.body,
      // Polumasno, jer podnaslov stoji na sari - tanko pismo se u njoj gubi.
      fontFamily: font.semibold,
      color: colors.onPrimaryMuted,
      marginTop: spacing.xs,
    },
  });
