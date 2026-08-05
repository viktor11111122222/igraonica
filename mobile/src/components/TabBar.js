import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, font, shadow } from '../theme';
import QrTabButton, { QR_SIZE } from './QrTabButton';

const BAR_HEIGHT = 68;
const NOTCH_RADIUS = QR_SIZE / 2 + 6; // razmak izmedju dugmeta i ivice useka
const CORNER = 24;

// Crta belu traku sa polukruznim usekom na sredini gornje ivice.
function BarShape({ width }) {
  const cx = width / 2;
  const r = NOTCH_RADIUS;
  // Kontrolne tacke prave blagi prelaz iz ravne ivice u usek.
  const d = [
    `M ${CORNER} 0`,
    `L ${cx - r - 18} 0`,
    `C ${cx - r - 6} 0 ${cx - r} 2 ${cx - r} 10`,
    `A ${r} ${r} 0 0 0 ${cx + r} 10`,
    `C ${cx + r} 2 ${cx + r + 6} 0 ${cx + r + 18} 0`,
    `L ${width - CORNER} 0`,
    `Q ${width} 0 ${width} ${CORNER}`,
    `L ${width} ${BAR_HEIGHT}`,
    `L 0 ${BAR_HEIGHT}`,
    `L 0 ${CORNER}`,
    `Q 0 0 ${CORNER} 0`,
    'Z',
  ].join(' ');

  return (
    <Svg
      width={width}
      height={BAR_HEIGHT}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      <Path d={d} fill={colors.surface} />
    </Svg>
  );
}

export default function TabBar({ state, descriptors, navigation }) {
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

  return (
    <View
      style={[styles.wrap, { paddingBottom: inset }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <View style={[styles.bar, { height: BAR_HEIGHT }]}>
        {width > 0 && <BarShape width={width} />}

        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;

          if (index === qrIndex) {
            // Sredisnji slot drzi mesto - dugme lebdi iznad, u useku.
            return <View key={route.key} style={styles.qrSlot} />;
          }

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

      <View style={[styles.qrFloat, { bottom: BAR_HEIGHT - QR_SIZE / 2 + inset }]}>
        <QrTabButton
          focused={state.index === qrIndex}
          onPress={() => onPress(state.routes[qrIndex], qrIndex)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    ...shadow.card,
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
