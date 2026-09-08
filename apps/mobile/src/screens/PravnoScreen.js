import { useLayoutEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Linking } from 'react-native';
import PressableScale from '../components/PressableScale';
import podaci from '../pravno/dokumenti.json';
import { colors, radius, spacing, type, shadow } from '../theme';

// Pravni tekstovi unutar aplikacije, na srpskom i engleskom.
//
// Namerno ekran, a ne otvaranje adrese u pregledaču: dokument je deo
// aplikacije, čita se bez mreže, i roditelj ne ispada iz aplikacije da bi ga
// video. Isti tekst stoji i na javnoj adresi, jer prodavnice traže da politika
// bude dostupna i pre instalacije - oba izlaza dolaze iz istog izvora
// (pravno/dokumenti.mjs), pa ne mogu da se raziđu.

const PO_PUTANJI = Object.fromEntries(
  Object.entries(podaci.dokumenti).map(([kljuc, dok]) => [dok.putanja, { kljuc, ...dok }])
);

// **podebljano**, [natpis](adresa) i {{POPUNITI: šta}}
function delovi(s) {
  return String(s)
    .split(/(\*\*[^*]+\*\*|\{\{POPUNITI:[^}]*\}\}|\[[^\]]+\]\(https?:\/\/[^)]+\))/g)
    .filter(Boolean);
}

function Tekst({ x, style }) {
  return (
    <Text style={style}>
      {delovi(x).map((deo, i) => {
        if (deo.startsWith('**')) {
          return (
            <Text key={i} style={styles.jako}>
              <Tekst x={deo.slice(2, -2)} />
            </Text>
          );
        }
        if (deo.startsWith('{{')) {
          return (
            <Text key={i} style={styles.popuni}>
              [{deo.slice(2, -2)}]
            </Text>
          );
        }
        const veza = deo.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
        if (veza) {
          return (
            <Text key={i} style={styles.veza} onPress={() => Linking.openURL(veza[2])}>
              {veza[1]}
            </Text>
          );
        }
        return deo;
      })}
    </Text>
  );
}

function Blok({ b }) {
  switch (b.t) {
    case 'p':
      return <Tekst x={b.x} style={styles.pasus} />;
    case 'h3':
      return <Tekst x={b.x} style={styles.podnaslov} />;
    case 'ul':
    case 'ol':
      return (
        <View style={styles.lista}>
          {b.x.map((s, i) => (
            <View key={i} style={styles.stavka}>
              <Text style={styles.oznaka}>{b.t === 'ol' ? `${i + 1}.` : '•'}</Text>
              <Tekst x={s} style={styles.stavkaTekst} />
            </View>
          ))}
        </View>
      );
    case 'karta':
      return (
        <View style={styles.karta}>
          {b.x.map((unutra, i) => (
            <Blok key={i} b={unutra} />
          ))}
        </View>
      );
    // Tabela na uskom ekranu ne staje u kolone, pa svaki red postaje kartica sa
    // natpisima - isti podatak, čitljivo bez vodoravnog pomeranja.
    case 'tabela':
      return (
        <View style={styles.lista}>
          {b.redovi.map((red, i) => (
            <View key={i} style={styles.redTabele}>
              {red.map((celija, j) => (
                <View key={j} style={styles.celija}>
                  <Text style={styles.natpis}>{b.zaglavlje[j]}</Text>
                  <Tekst x={celija} style={styles.stavkaTekst} />
                </View>
              ))}
            </View>
          ))}
        </View>
      );
    default:
      return null;
  }
}

export default function PravnoScreen({ route, navigation }) {
  const [jezik, setJezik] = useState('sr');
  const dok = PO_PUTANJI[route.params?.dokument] || PO_PUTANJI.privatnost;
  const sadrzaj = dok[jezik];

  useLayoutEffect(() => {
    navigation.setOptions({ title: dok.naslov[jezik] });
  }, [navigation, dok, jezik]);

  return (
    <ScrollView style={styles.okvir} contentContainerStyle={styles.sadrzaj}>
      <View style={styles.jezici}>
        {podaci.jezici.map((j) => (
          <PressableScale
            key={j.kod}
            style={[styles.jezik, jezik === j.kod && styles.jezikIzabran]}
            onPress={() => setJezik(j.kod)}
            accessibilityRole="button"
            accessibilityState={{ selected: jezik === j.kod }}
          >
            <Text style={[styles.jezikTekst, jezik === j.kod && styles.jezikTekstIzabran]}>
              {j.naziv}
            </Text>
          </PressableScale>
        ))}
      </View>

      <Text style={styles.datum}>
        {jezik === 'sr' ? 'Poslednja izmena' : 'Last updated'}: {sadrzaj.azurirano}
      </Text>
      <Tekst x={sadrzaj.uvod} style={styles.pasus} />

      {sadrzaj.sekcije.map((s) => (
        <View key={s.naslov}>
          <Text style={styles.naslov}>{s.naslov}</Text>
          {s.blokovi.map((b, i) => (
            <Blok key={i} b={b} />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  okvir: { flex: 1, backgroundColor: colors.bg },
  sadrzaj: { padding: spacing.xl, paddingBottom: spacing.xxxl },

  jezici: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  jezik: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  jezikIzabran: { backgroundColor: colors.primary, borderColor: colors.primary },
  jezikTekst: { ...type.label, color: colors.textMuted },
  jezikTekstIzabran: { color: colors.textOnPrimary },

  datum: { ...type.caption, color: colors.textMuted, marginBottom: spacing.md },
  naslov: { ...type.heading, color: colors.text, marginTop: spacing.xl, marginBottom: spacing.xs },
  podnaslov: { ...type.label, color: colors.text, marginTop: spacing.md, marginBottom: 2 },
  pasus: { ...type.body, color: colors.textMuted, marginVertical: spacing.xs, lineHeight: 23 },
  jako: { color: colors.text, fontWeight: '700' },
  veza: { color: colors.primary, textDecorationLine: 'underline' },
  popuni: { color: colors.accentText, fontWeight: '700' },

  lista: { marginVertical: spacing.xs },
  stavka: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
  oznaka: { ...type.body, color: colors.textFaint, width: 18 },
  stavkaTekst: { ...type.body, color: colors.textMuted, flex: 1, lineHeight: 23 },

  karta: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginVertical: spacing.sm,
    ...shadow.card,
  },
  redTabele: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.xs,
    ...shadow.card,
  },
  celija: { gap: 2 },
  natpis: { ...type.caption, color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.4 },
});
