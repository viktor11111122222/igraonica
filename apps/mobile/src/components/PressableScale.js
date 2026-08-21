import { Animated, Pressable, useAnimatedValue } from 'react-native';
import { motion } from '../theme';

// Svako dugme mora da reaguje na dodir. Scale 0.96 daje trenutni feedback.
export default function PressableScale({ children, style, onPress, ...rest }) {
  const scale = useAnimatedValue(1);

  function to(value, duration) {
    Animated.timing(scale, {
      toValue: value,
      duration,
      useNativeDriver: true,
    }).start();
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => to(0.96, motion.press)}
      onPressOut={() => to(1, motion.exit)}
      {...rest}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
