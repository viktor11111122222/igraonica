import { useState } from 'react';
import { View, Text, Image, FlatList, StyleSheet, useWindowDimensions } from 'react-native';
import { mediaUrl } from '../utils/api';
import { colors, radius, spacing, type, shadow } from '../theme';

// Koliko se od sledece kartice vidi na ivici ekrana. Taj komadic je jedini
// nagovestaj da promocija ima jos - tacke ispod se primete tek kad se pogleda
// dole.
const PROVIRI = 28;

// Podloga promocije bez slike: glavna boja sa istom decjom sarom kao zaglavlje.
//
// Sara se ovde ne kaci za vrh kao u baneru nego pokriva celu povrsinu - kartica
// u karuselu se rastegne na visinu najvise, pa bi se crtezi inace prekinuli na
// pola i ostavili gole donje uglove. Preko svega ide tanka koprena, jer bez nje
// crtezi prolaze kroz tekst i belo pismo se gubi.
export function PromoPodloga() {
  return (
    <View style={[StyleSheet.absoluteFill, styles.podloga]} pointerEvents="none">
      <Image
        testID="promo-sara"
        source={require('../../assets/banner-doodles.png')}
        style={styles.sara}
        resizeMode="cover"
        accessible={false}
      />
      <View style={[StyleSheet.absoluteFill, styles.koprena]} />
    </View>
  );
}

// Bez slike kartica ne moze da ostane bela: u karuselu se sve rastegnu na
// visinu najvise, pa bi tekst stajao u vrhu a ispod njega ostala prazna
// povrsina. Takva promocija zato ide cela u boji, sa istom sarom kao zaglavlje,
// a tekst se spusta na sredinu - deluje kao namerna kartica, ne kao praznina.
function Kartica({ promocija, sirina }) {
  const bezSlike = !promocija.imageUrl;

  return (
    <View style={[styles.kartica, { width: sirina }]}>
      {bezSlike ? (
        <PromoPodloga />
      ) : (
        <Image
          source={{ uri: mediaUrl(promocija.imageUrl) }}
          style={styles.slika}
          resizeMode="cover"
          accessible
          accessibilityLabel={promocija.title}
        />
      )}
      <View style={[styles.telo, bezSlike && styles.teloUBoji]}>
        <Text style={[styles.naslov, bezSlike && styles.naslovUBoji]} numberOfLines={2}>
          {promocija.title}
        </Text>
        {promocija.description ? (
          // Uz sliku tri reda drze kartice na slicnoj visini; bez nje ima mesta
          // za ceo tekst, pa se retko koja promocija uopste sece.
          <Text
            style={[styles.opis, bezSlike && styles.opisUBoji]}
            numberOfLines={bezSlike ? 6 : 3}
          >
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
  podloga: { backgroundColor: colors.primary },
  sara: { width: '100%', height: '100%', opacity: colors.bannerDoodle },
  koprena: { backgroundColor: colors.onPrimaryVeil },
  telo: { padding: spacing.lg, gap: 2 },
  // Tekst na boji ima celu karticu za sebe, pa stoji po sredini i sa vise
  // vazduha nego kad deli mesto sa slikom.
  teloUBoji: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.xs },
  naslov: { ...type.heading, color: colors.text },
  naslovUBoji: { ...type.title, fontSize: 22, color: colors.textOnPrimary },
  opis: { ...type.body, color: colors.textMuted, lineHeight: 20 },
  opisUBoji: { color: colors.onPrimaryMuted },

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
