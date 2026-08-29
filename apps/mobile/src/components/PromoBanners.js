import { useState } from 'react';
import { View, Text, Image, FlatList, StyleSheet, useWindowDimensions } from 'react-native';
import { mediaUrl } from '../utils/api';
import { colors, radius, spacing, type, shadow } from '../theme';

// Koliko se od sledece kartice vidi na ivici ekrana. Taj komadic je jedini
// nagovestaj da promocija ima jos - tacke ispod se primete tek kad se pogleda
// dole.
const PROVIRI = 28;

function Kartica({ promocija, sirina }) {
  return (
    <View style={[styles.kartica, { width: sirina }]}>
      {promocija.imageUrl ? (
        <Image
          source={{ uri: mediaUrl(promocija.imageUrl) }}
          style={styles.slika}
          resizeMode="cover"
          accessible
          accessibilityLabel={promocija.title}
        />
      ) : null}
      <View style={styles.telo}>
        <Text style={styles.naslov} numberOfLines={2}>
          {promocija.title}
        </Text>
        {promocija.description ? (
          // Tri reda drze kartice na slicnoj visini; ceo tekst se ionako video
          // u prozoru koji je iskocio pri prvom ulasku.
          <Text style={styles.opis} numberOfLines={3}>
            {promocija.description}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// Promocije koje su trenutno ukljucene. Jedna stoji kao obican baner, a vise
// njih ide u karusel: red kartica koje se prevlace prstom, sa tackama ispod.
export default function PromoBanners({ promocije }) {
  const { width } = useWindowDimensions();
  const [aktivna, setAktivna] = useState(0);

  if (!promocije?.length) return null;

  const jedna = promocije.length === 1;
  const sirinaKartice = width - spacing.xl * 2 - (jedna ? 0 : PROVIRI);
  const korak = sirinaKartice + spacing.md;

  if (jedna) {
    return (
      <View style={styles.jedna}>
        <Kartica promocija={promocije[0]} sirina={sirinaKartice} />
      </View>
    );
  }

  return (
    <View>
      <FlatList
        testID="promo-karusel"
        data={promocije}
        keyExtractor={(p) => p.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        // Kartica se "zakaci" na svoje mesto umesto da stane bilo gde.
        snapToInterval={korak}
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerStyle={styles.traka}
        onMomentumScrollEnd={(e) => {
          const x = e.nativeEvent.contentOffset.x;
          setAktivna(Math.min(promocije.length - 1, Math.max(0, Math.round(x / korak))));
        }}
        renderItem={({ item }) => <Kartica promocija={item} sirina={sirinaKartice} />}
      />

      {/* Tacke govore koliko promocija ima i gde je roditelj stao. Aktivna je
          izduzena, pa se razlika vidi i bez boje. */}
      <View style={styles.tacke} accessibilityRole="tablist">
        {promocije.map((p, i) => (
          <View
            key={p.id}
            style={[styles.tacka, i === aktivna && styles.tackaAktivna]}
            accessible
            accessibilityRole="tab"
            accessibilityState={{ selected: i === aktivna }}
            accessibilityLabel={`Promocija ${i + 1} od ${promocije.length}`}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  jedna: { paddingHorizontal: spacing.xl },
  traka: { paddingHorizontal: spacing.xl, gap: spacing.md },
  kartica: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.card,
  },
  // 16:9 je razmera u kojoj se slike i prave; bez fiksne razmere bi baner
  // menjao visinu od promocije do promocije.
  slika: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.primaryTint },
  telo: { padding: spacing.lg, gap: 2 },
  naslov: { ...type.heading, color: colors.text },
  opis: { ...type.body, color: colors.textMuted, lineHeight: 20 },

  tacke: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
  },
  tacka: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  tackaAktivna: {
    width: 18,
    backgroundColor: colors.primary,
  },
});
