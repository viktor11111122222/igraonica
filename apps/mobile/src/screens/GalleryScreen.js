import { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from '../components/PressableScale';
import Lightbox from '../components/Lightbox';
import { photos } from '../data/gallery';
import { colors, radius, spacing, type } from '../theme';

// Slike su za sada spakovane uz aplikaciju (src/data/gallery.js).
// Kada backend dobije GET /api/gallery, menja se samo izvor niza.
//
// Ekran se otvara sa pocetne. `route.params.index` znaci da je korisnik
// dodirnuo odredjenu sliku u traci, pa se ona odmah prikazuje preko celog
// ekrana - bez tog koraka bi morao ponovo da je trazi u gridu.
export default function GalleryScreen({ route }) {
  const { width } = useWindowDimensions();
  const [openIndex, setOpenIndex] = useState(route?.params?.index ?? null);

  // Dve kolone unutar paddinga ekrana, sa razmakom izmedju.
  const tileW = (width - spacing.xl * 2 - spacing.md) / 2;

  const [hero, ...rest] = photos;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <PressableScale
          style={styles.hero}
          onPress={() => setOpenIndex(0)}
          accessibilityRole="imagebutton"
          accessibilityLabel={hero.title}
        >
          <Image source={hero.thumb} style={styles.heroImage} resizeMode="cover" />
          <View style={styles.heroBadge}>
            <Ionicons name="images" size={13} color={colors.textOnAccent} />
            <Text style={styles.heroBadgeText}>{photos.length} fotografija</Text>
          </View>
        </PressableScale>

        <View style={styles.grid}>
          {rest.map((photo, i) => (
            <PressableScale
              key={photo.id}
              style={[styles.tile, { width: tileW, height: tileW * 1.28 }]}
              // +1 jer je hero prva slika u nizu.
              onPress={() => setOpenIndex(i + 1)}
              accessibilityRole="imagebutton"
              accessibilityLabel={photo.title}
            >
              <Image source={photo.thumb} style={styles.tileImage} resizeMode="cover" />
            </PressableScale>
          ))}
        </View>
      </ScrollView>

      <Lightbox
        photos={photos}
        startIndex={openIndex}
        onClose={() => setOpenIndex(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxl * 2,
  },
  // Bez senke: iOS je odseca kada je na istom cvoru sa overflow: hidden.
  hero: {
    height: 210,
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: spacing.md,
    backgroundColor: colors.primarySoft,
  },
  heroImage: { width: '100%', height: '100%' },
  heroBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 5,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  heroBadgeText: { ...type.caption, color: colors.textOnAccent },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  tile: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.primarySoft,
  },
  tileImage: { width: '100%', height: '100%' },
});
