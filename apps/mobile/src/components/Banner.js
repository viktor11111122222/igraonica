import { View, Text, Image, StyleSheet, useWindowDimensions } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { font, radius, spacing, type } from '../theme';

// Zaglavlje ekrana: puna glavna boja sa belom decjom sarom preko nje.
//
// Sara je jedan fajl - bela sa alfom - a ne dve slike u boji. Sa prilozena
// dva banera izmereno je da je crtez u oba isti i beo, samo razlicite
// prozirnosti, pa je dovoljno da se ista sara polozi preko boje teme. Time
// baner prati prekidac bez menjanja slike.
// Prirodna razmera sare. Sirina je puna sirina ekrana, pa crtezi ispadnu
// tacno onoliko krupni koliko su i u predlosku.
//
// Fajl je visi od prilozenog banera: gornjih 381 redova je original, a ostatak
// je dopuna istim crtezima na novim mestima (deo ogledalno), da bi sara mogla
// da se produzi i ispod trake sa datumima a da se nigde ne ponovi.
const SARA = { width: 1170, height: 780 };

// Sama sara, bez podloge. Uvek se kaci za vrh onoga u sta je stavljena, pa
// mesto na kom pocinje bira onaj ko je koristi.
//
// Ne rasteze se: `cover` bi je uvecao da pokrije i visinu, pa bi se od crteza
// videlo samo par uvecanih komada. Sirina je puna sirina ekrana, a visina ide
// iz razmere fajla - tako crtezi ostaju sitni i cita se cela sara.
function Doodles() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
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
  const styles = useThemedStyles(makeStyles);

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
  const styles = useThemedStyles(makeStyles);

  // Pocetna nosi svoje zaglavlje (ime, zvono sa brojacem), pa od banera uzima
  // samo obojenu podlogu sa sarom - tada ovoga nema.
  const zaglavlje =
    title || eyebrow || right ? (
      <View style={styles.head}>
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

const makeStyles = (colors) =>
  StyleSheet.create({
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
      paddingTop: 64,
      paddingHorizontal: spacing.xl,
      // Donji vazduh nosi zaglavlje, ne ceo baner - inace bi se dodao i ispod
      // trake sa datumima kada ona stoji unutra.
      paddingBottom: spacing.xl,
    },
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
