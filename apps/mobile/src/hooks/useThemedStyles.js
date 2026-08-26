import { useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';

// StyleSheet.create se racuna jednom, pri uvozu modula, pa staticki `styles`
// zamrzne boje one varijante koja je vazila tada. Zato ekrani drze fabriku
// stilova na nivou modula, a ovde je zovu sa aktuelnim bojama:
//
//   const makeStyles = (colors) => StyleSheet.create({ ... });
//   ...
//   const styles = useThemedStyles(makeStyles);
//
// Fabrika mora da bude konstanta modula - ako se pise u telu komponente,
// menja identitet pri svakom renderu i memoizacija otpada.
export function useThemedStyles(makeStyles) {
  const { colors } = useTheme();
  return useMemo(() => makeStyles(colors), [makeStyles, colors]);
}

export default useThemedStyles;
