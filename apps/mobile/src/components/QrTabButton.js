import { Animated, Pressable, StyleSheet, useAnimatedValue } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, motion, shadow } from '../theme';

export const QR_SIZE = 64;

// Kruzno dugme koje sedi u useku tab bara.
export default function QrTabButton({ onPress, focused }) {
  const scale = useAnimatedValue(1);

  function animateTo(value, duration) {
    Animated.timing(scale, {
      toValue: value,
      duration,
      useNativeDriver: true,
    }).start();
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => animateTo(0.94, motion.press)}
      onPressOut={() => animateTo(1, motion.exit)}
      accessibilityRole="button"
      accessibilityLabel="QR kod"
      hitSlop={8}
    >
      <Animated.View
        style={[
          styles.button,
          focused && styles.buttonFocused,
          { transform: [{ scale }] },
        ]}
      >
        <Ionicons name="qr-code" size={30} color={colors.primaryDarker} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: QR_SIZE,
    height: QR_SIZE,
    borderRadius: QR_SIZE / 2,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.raised,
  },
  buttonFocused: {
    backgroundColor: colors.accentDark,
  },
});
