import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { todayKey } from '../utils/date';
import { colors, radius, spacing, type, font, shadow } from '../theme';

// Koliko je popust, u obliku u kom se cita. Opisne akcije nemaju broj - sve
// pise u nazivu, pa znacke nema umesto da stoji prazna.
export function popustLabel(akcija) {
  if (akcija.discountType === 'TEXT') return null;
  if (akcija.discountType === 'AMOUNT') return `-${akcija.discountValue} RSD`;
  return `-${akcija.discountValue}%`;
}

// Koliko jos traje. Poslednji dan se kaze recima, jer je to jedino sto tera
// na odluku - "Vazi do 26.08." istog dana zvuci kao da ima vremena.
export function trajanje(akcija, danas = todayKey()) {
  if (akcija.dateTo === danas) return 'Poslednji dan';

  const [, mesec, dan] = akcija.dateTo.split('-');
  return `Vazi do ${dan}.${mesec}.`;
}

// Akcije koje trenutno vaze. Backend ih vec filtrira po datumu, pa se ovde
// samo prikazuju.
export default function PromoList({ promotions }) {
  if (!promotions?.length) return null;

  return (
    <View style={styles.lista}>
      {promotions.map((akcija) => {
        const popust = popustLabel(akcija);

        return (
          <View key={akcija.id} style={styles.kartica}>
            <View style={styles.ikona}>
              <Ionicons name="pricetag" size={18} color={colors.textOnAccent} />
            </View>

            <View style={styles.telo}>
              <View style={styles.red}>
                <Text style={styles.naslov} numberOfLines={2}>
                  {akcija.title}
                </Text>
                {popust ? (
                  <View style={styles.znacka}>
                    <Text style={styles.znackaTekst}>{popust}</Text>
                  </View>
                ) : null}
              </View>

              {akcija.description ? (
                <Text style={styles.opis}>{akcija.description}</Text>
              ) : null}

              <Text style={styles.rok}>{trajanje(akcija)}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  lista: { gap: spacing.md },
  kartica: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginHorizontal: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  ikona: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  telo: { flex: 1 },
  red: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  naslov: { ...type.heading, color: colors.text, flex: 1 },
  znacka: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
  },
  znackaTekst: { ...type.caption, fontFamily: font.bold, color: colors.primaryDarker },
  opis: { ...type.body, color: colors.textMuted, marginTop: 2, lineHeight: 20 },
  rok: { ...type.caption, color: colors.textFaint, marginTop: spacing.sm },
});
