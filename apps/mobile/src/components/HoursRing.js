import { useEffect } from 'react';
import { Animated, StyleSheet, View, useAnimatedValue } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Prsten sa preostalim satima. Luk se pri ulasku popunjava od nule, da se
// odmah vidi koliko je ostalo, a ne da broj samo "iskoci".
export default function HoursRing({ size = 116, stroke = 10, progress = 0, children }) {
  const { colors } = useTheme();
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = useAnimatedValue(circumference);

  useEffect(() => {
    Animated.timing(offset, {
      toValue: circumference * (1 - Math.max(0, Math.min(1, progress))),
      duration: 700,
      // strokeDashoffset nije transform, pa ne moze na native driver.
      useNativeDriver: false,
    }).start();
  }, [progress, circumference, offset]);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.primarySoft}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
