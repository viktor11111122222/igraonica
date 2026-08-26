import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { spacing, font } from '../theme';
import { useTheme } from '../context/ThemeContext';
import QrTabButton, { QR_SIZE } from './QrTabButton';

const BAR_HEIGHT = 68;
const CORNER = 24;

// QR dugme stoji UNUTAR trake, a traka se nad njim izdize u kupolu koja prati
// njegov krug. Dugme nigde ne izlazi iz bele povrsine.
//
// Vazduh izmedju ivice dugmeta i ivice kupole. Posto su koncentricni, razmak
// je isti celom duzinom luka.
const QR_GAP = 8;
const DOME_R = QR_SIZE / 2 + QR_GAP;

// Koliko se kupola uzdize iznad ravne ivice trake.
const DOME_RISE = 22;

// Centar dugmeta je tacno DOME_R ispod vrha kupole, pa kupola svuda ostaje na
// istom odstojanju od dugmeta.
const QR_CENTER_Y = DOME_R;

// Luk ne pocinje tacno na ravnoj ivici nego malo ispod, da prelaz moze da se
// zaobli - inace bi tu ostao ostar ugao.
const ENTRY_Y = DOME_RISE + 3;
const DOME_HALF = Math.sqrt(DOME_R ** 2 - (QR_CENTER_Y - ENTRY_Y) ** 2);
const EASE = 16;

// Crta belu traku sa kupolom nad QR dugmetom.
//
// Ovaj SVG je JEDINA bela povrsina trake. Ako bi i `wrap` imao backgroundColor,
// pun pravougaonik bi presekao kupolu.
function BarShape({ width, height, fill }) {
  const cx = width / 2;
  const left = cx - DOME_HALF;
  const right = cx + DOME_HALF;

  const d = [
    `M ${CORNER} ${DOME_RISE}`,
    `L ${left - EASE} ${DOME_RISE}`,
    // Zaobljen prelaz iz ravne ivice u kupolu.
    `C ${left - EASE / 2} ${DOME_RISE} ${left - 2} ${DOME_RISE} ${left} ${ENTRY_Y}`,
    // Kupola: luk poluprecnika DOME_R oko centra dugmeta. large-arc = 0 jer je
    // gornji deo kruga manji od polovine, sweep = 1 jer ide na gore.
    `A ${DOME_R} ${DOME_R} 0 0 1 ${right} ${ENTRY_Y}`,
    `C ${right + 2} ${DOME_RISE} ${right + EASE / 2} ${DOME_RISE} ${right + EASE} ${DOME_RISE}`,
    `L ${width - CORNER} ${DOME_RISE}`,
    `Q ${width} ${DOME_RISE} ${width} ${DOME_RISE + CORNER}`,
    `L ${width} ${height}`,
    `L 0 ${height}`,
    `L 0 ${DOME_RISE + CORNER}`,
    `Q 0 ${DOME_RISE} ${CORNER} ${DOME_RISE}`,
    'Z',
  ].join(' ');

  return (
    // Kupola se crta IZNAD trake, izvan visine koju nav zauzima u rasporedu.
    // Da nav rezervise tih DOME_RISE piksela, iznad bele povrsine bi ostala
    // mrtva traka u boji pozadine ekrana. Ovako sadrzaj prolazi iza kupole.
    <Svg
      width={width}
      height={height}
      style={{ position: 'absolute', top: -DOME_RISE, left: 0 }}
      pointerEvents="none"
    >
      <Path d={d} fill={fill} />
    </Svg>
  );
}

export default function TabBar({ state, descriptors, navigation }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const inset = Platform.OS === 'ios' ? 24 : 8;

  function onPress(route, index) {
    const focused = state.index === index;
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });
    if (!focused && !event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  }

  const qrIndex = state.routes.findIndex((r) => r.name === 'Qr');

  // QR dugme mora da stoji tacno na sredini trake, jer su usek i lebdece
  // dugme centrirani. Zato se ostali tabovi dele na levu i desnu stranu, a
  // kraca strana se dopunjava praznim slotom - tako QR ostaje na sredini i
  // kada admin sakrije neki tab, pa ih ostane paran broj.
  const others = state.routes.filter((r) => r.name !== 'Qr');
  const half = Math.ceil(others.length / 2);
  const left = others.slice(0, half);
  const right = others.slice(half);
  while (right.length < left.length) right.push(null);
  while (left.length < right.length) left.unshift(null);

  const slots = [...left, state.routes[qrIndex], ...right];

  return (
    <View
      style={[styles.wrap, { paddingBottom: inset }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {/* Pozadina pokriva kupolu, traku i sigurnu zonu ispod nje, pa mora da
          bude izvan `bar` - inace bi kupola i zona ispod ostale providne. */}
      {width > 0 && (
        <BarShape
          width={width}
          height={DOME_RISE + BAR_HEIGHT + inset}
          fill={colors.surface}
        />
      )}

      <View style={[styles.bar, { height: BAR_HEIGHT }]}>
        {slots.map((route, slot) => {
          // Prazan slot koji dopunjava kracu stranu.
          if (!route) return <View key={`spacer-${slot}`} style={styles.tab} />;

          if (route.name === 'Qr') {
            // Sredisnji slot drzi mesto - dugme stoji iznad njega, u kupoli.
            return <View key={route.key} style={styles.qrSlot} />;
          }

          const index = state.routes.indexOf(route);
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const color = focused ? colors.primaryDarker : colors.textFaint;

          return (
            <Pressable
              key={route.key}
              style={styles.tab}
              onPress={() => onPress(route, index)}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={options.title}
            >
              <Ionicons
                name={options.tabBarIconName}
                size={22}
                color={color}
              />
              <Text style={[styles.label, { color }]} numberOfLines={1}>
                {options.title}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Centar dugmeta mora da padne tacno na QR_CENTER_Y, jer je kupola
          nacrtana oko te tacke. Racuna se od dna, pa se oduzima od ukupne
          visine. */}
      <View
        style={[
          styles.qrFloat,
          {
            bottom:
              DOME_RISE + BAR_HEIGHT + inset - QR_CENTER_Y - QR_SIZE / 2,
          },
        ]}
      >
        <QrTabButton
          focused={state.index === qrIndex}
          onPress={() => onPress(state.routes[qrIndex], qrIndex)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Bez pozadine i bez senke: oboje su pravougaoni, pa bi popunili usek i
  // presekli QR dugme. Belu povrsinu crta iskljucivo BarShape.
  wrap: {},
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingTop: spacing.sm,
  },
  qrSlot: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    fontFamily: font.semibold,
  },
  qrFloat: {
    position: 'absolute',
    alignSelf: 'center',
  },
});
