import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Rect } from 'react-native-svg';
import PressableScale from './PressableScale';
import { colors, type } from '../theme';

export const CLOUD_W = 72;
export const CLOUD_H = 76;

// Pravougaonik je samo ispuna sredine - siluetu u celosti crtaju krugovi,
// pa oblak nigde nema pravu ivicu.
const BODY = { x: 16, y: 24, width: 40, height: 32, rx: 8 };
const TOP = BODY.y;
const BASE = BODY.y + BODY.height;

// Deterministicki generator - isti dan uvek dobije isti oblak, i u Jelovniku
// i u Rasporedu. Fiksna lista varijanti ne bi bila dovoljna za ceo mesec.
function rng(seed) {
  let s = (seed * 9301 + 49297) % 233280;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function buildCloud(seed) {
  const rand = rng(seed + 1);
  const puffs = [];

  // Bokovi.
  const lr = 14 + rand() * 2;
  const rr = 14 + rand() * 2;
  puffs.push({ cx: lr + 2, cy: 40 + (rand() - 0.5) * 4, r: lr });
  puffs.push({ cx: CLOUD_W - rr - 2, cy: 40 + (rand() - 0.5) * 4, r: rr });

  // Gornji profil: 3-4 grbe, jedna je vrh i menja mesto od dana do dana.
  const count = 3 + Math.floor(rand() * 2);
  const peak = Math.floor(rand() * count);
  const step = (CLOUD_W - 32) / (count - 1);
  for (let i = 0; i < count; i++) {
    const edge = i === 0 || i === count - 1;
    const r = i === peak ? 16 + rand() * 2.5 : edge ? 12 + rand() * 2 : 13 + rand() * 2.5;
    const cx = clamp(16 + i * step + (rand() - 0.5) * 5, r + 1, CLOUD_W - r - 1);
    puffs.push({ cx, cy: TOP - r * 0.3 + (rand() - 0.5) * 2.5, r });
  }

  // Donji profil: blagi lobusi - dno ne sme da bude ravna ivica, ali ni
  // bucmasto kao vrh.
  const bottom = rand() < 0.5 ? [26, 46] : [21, 36, 51];
  for (const bx of bottom) {
    const r = 11 + rand() * 3;
    const cx = clamp(bx + (rand() - 0.5) * 4, r + 1, CLOUD_W - r - 1);
    puffs.push({ cx, cy: BASE + r * 0.2, r });
  }

  return puffs;
}

// Oblik zavisi samo od broja dana, pa ga racunamo jednom po datumu.
const cache = new Map();
function cloudFor(seed) {
  if (!cache.has(seed)) cache.set(seed, buildCloud(seed));
  return cache.get(seed);
}

// Jedan dan u traci datuma.
export default function DayCloud({ name, number, active, today, onPress }) {
  const puffs = cloudFor(number);

  return (
    <PressableScale style={styles.chip} onPress={onPress}>
      {/* Providnost ide na grupu, ne na pojedinacne krugove - inace bi se
          njihovi preklopi videli kao svetlije mrlje. */}
      <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${CLOUD_W} ${CLOUD_H}`}>
        <G opacity={active ? 1 : 0.18}>
          <Rect {...BODY} fill={colors.surface} />
          {puffs.map((p, i) => (
            <Circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={colors.surface} />
          ))}
        </G>
      </Svg>

      <View style={styles.content}>
        <Text style={[styles.name, active && styles.nameActive]}>{name}</Text>
        <Text style={[styles.number, active && styles.numberActive]}>{number}</Text>
        {today && <View style={[styles.dot, active && styles.dotActive]} />}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    width: CLOUD_W,
    height: CLOUD_H,
  },
  // Tekst sedi u sredini oblaka, iznad donjih lobusa.
  content: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 12,
    bottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { ...type.caption, color: 'rgba(255,255,255,0.9)' },
  nameActive: { color: colors.textMuted },
  number: { ...type.heading, color: colors.textOnPrimary, marginTop: 2 },
  numberActive: { color: colors.text },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginTop: 3,
  },
  dotActive: { backgroundColor: colors.accentDark },
});
