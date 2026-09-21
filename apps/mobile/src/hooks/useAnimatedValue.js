import { useState } from 'react';
import { Animated } from 'react-native';

// React Native izvozi svoj `useAnimatedValue`, ali react-native-web ga nema -
// zbog toga je web build pucao cim bi se render dotakao nekog dugmeta. Ovde
// stoji ista stvar napisana rucno, pa radi na sve tri platforme.
//
// Lenja inicijalizacija preko useState: vrednost se pravi jednom, prezivljava
// re-rendere i ne cita se ref u renderu.
export function useAnimatedValue(initial) {
  const [value] = useState(() => new Animated.Value(initial));
  return value;
}
