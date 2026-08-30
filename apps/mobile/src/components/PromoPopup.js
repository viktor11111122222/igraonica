import { useEffect, useState } from 'react';
import { Modal, View, Text, Image, ScrollView, StyleSheet } from 'react-native';
import { PromoPodloga } from './PromoBanners';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PressableScale from './PressableScale';
import { mediaUrl } from '../utils/api';
import * as storage from '../utils/storage';
import { colors, radius, spacing, type, shadow } from '../theme';

// Koje je promocije uredjaj vec video. Pamti se spisak id-jeva, ne samo
// zastavica "video je nesto": tako i promocija dodata kasnije dobije svoj jedan
// prikaz, a stara se ne vraca svaki put.
const KLJUC = 'promo_videne';

async function procitajVidjene() {
  try {
    const zapis = await storage.getItem(KLJUC);
    const spisak = zapis ? JSON.parse(zapis) : [];
    return Array.isArray(spisak) ? spisak : [];
  } catch {
    // Neispravan zapis nije razlog da se aplikacija ponasa cudno - krece se
    // od praznog spiska, pa ce promocije biti prikazane jos jednom.
    return [];
  }
}

// Promocija se preko celog ekrana pokazuje samo prvi put; posle toga zivi na
// pocetnoj. Zato ovde stoji i pamcenje vidjenog.
export default function PromoPopup({ promocije }) {
  const insets = useSafeAreaInsets();
  const [zaPrikaz, setZaPrikaz] = useState([]);

  useEffect(() => {
    let otkazano = false;

    (async () => {
      const kandidati = (promocije || []).filter((p) => p.showPopup);
      if (!kandidati.length) return;

      const vidjene = await procitajVidjene();
      const nove = kandidati.filter((p) => !vidjene.includes(p.id));
      if (!otkazano && nove.length) setZaPrikaz(nove);
    })();

    return () => {
      otkazano = true;
    };
  }, [promocije]);

  async function zatvori() {
    const vidjene = await procitajVidjene();
    const spisak = [...new Set([...vidjene, ...zaPrikaz.map((p) => p.id)])];
    await storage.setItem(KLJUC, JSON.stringify(spisak));
    setZaPrikaz([]);
  }

  if (!zaPrikaz.length) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      // Android ima svoje dugme "nazad"; bez ovoga bi prozor ostao zakljucan.
      onRequestClose={zatvori}
    >
      <View style={styles.zastor}>
        <View style={[styles.prozor, { marginTop: insets.top, marginBottom: insets.bottom }]}>
          {/* Uz vise promocija sadrzaj ne stane u prozor. Traka i linija iznad
              dugmeta govore da ima jos - bez toga tekst deluje odseceno. */}
          <ScrollView contentContainerStyle={styles.sadrzaj}>
            {zaPrikaz.map((p) =>
              // Bez slike promocija bi bila samo dva reda teksta na belom, uz
              // susede sa slikama - zato ide u boji sa sarom, isto kao kartica
              // u karuselu na pocetnoj.
              p.imageUrl ? (
                <View key={p.id} style={styles.promocija}>
                  <Image
                    source={{ uri: mediaUrl(p.imageUrl) }}
                    style={styles.slika}
                    resizeMode="cover"
                    accessible
                    accessibilityLabel={p.title}
                  />
                  <Text style={styles.naslov}>{p.title}</Text>
                  {p.description ? <Text style={styles.opis}>{p.description}</Text> : null}
                </View>
              ) : (
                <View key={p.id} style={styles.uBoji}>
                  <PromoPodloga />
                  <Text style={[styles.naslov, styles.naslovUBoji]}>{p.title}</Text>
                  {p.description ? (
                    <Text style={[styles.opis, styles.opisUBoji]}>{p.description}</Text>
                  ) : null}
                </View>
              )
            )}
          </ScrollView>

          <View style={styles.podnozje}>
            <PressableScale
              style={styles.dugme}
              onPress={zatvori}
              accessibilityRole="button"
              accessibilityLabel="Zatvori"
            >
              <Text style={styles.dugmeTekst}>U redu</Text>
            </PressableScale>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  zastor: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 32, 0.55)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  prozor: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    overflow: 'hidden',
    maxHeight: '85%',
    ...shadow.raised,
  },
  sadrzaj: { padding: spacing.xl, gap: spacing.xl },
  promocija: { gap: spacing.sm },
  uBoji: {
    gap: spacing.xs,
    padding: spacing.xl,
    minHeight: 150,
    justifyContent: 'center',
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  slika: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryTint,
  },
  naslov: { ...type.title, fontSize: 20, color: colors.text },
  opis: { ...type.body, color: colors.textMuted, lineHeight: 21 },
  naslovUBoji: { color: colors.textOnPrimary },
  opisUBoji: { color: colors.onPrimaryMuted },
  podnozje: { borderTopWidth: 1, borderTopColor: colors.border },
  dugme: {
    margin: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  dugmeTekst: { ...type.label, fontSize: 15, color: colors.textOnPrimary },
});
