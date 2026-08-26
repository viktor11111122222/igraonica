import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { themes, VARIANTS, radius, spacing, type } from '../theme';
import PressableScale from './PressableScale';

const NAZIV = {
  amber: 'Zuta tema',
  blue: 'Plava tema',
};

// Dva kruzica u boji same teme. Namerno nisu jedno dugme koje smenjuje: kada
// su obe boje na ekranu, izabrana se poredi sa drugom bez dodirivanja.
//
// Stoji u podnozju ekrana "Moj paket", a ne u baneru: alat je za poredjenje
// dok se bira boja, pa ne treba da stoji na vrhu svakog ekrana.
export default function ThemeSwitch({ label = 'Boja teme' }) {
  const { variant, setVariant } = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.red}>
      <Text style={styles.natpis}>{label}</Text>
      <View style={styles.wrap} accessibilityRole="radiogroup">
        {VARIANTS.map((v) => (
          <PressableScale
            key={v}
            onPress={() => setVariant(v)}
            hitSlop={6}
            accessibilityRole="radio"
            accessibilityLabel={NAZIV[v]}
            accessibilityState={{ selected: v === variant }}
            style={[
              styles.swatch,
              { backgroundColor: themes[v].primary },
              v === variant && styles.swatchActive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    red: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      marginTop: spacing.xl,
    },
    natpis: {
      ...type.caption,
      color: colors.textFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      padding: 5,
      borderRadius: radius.pill,
      backgroundColor: colors.primarySoft,
    },
    swatch: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      // Neizabrani kruzic i dalje ima okvir, samo providan - inace bi izabrani
      // bio za 4px veci i par bi poskakivao pri promeni.
      borderColor: 'transparent',
    },
    swatchActive: {
      borderColor: colors.text,
    },
  });
