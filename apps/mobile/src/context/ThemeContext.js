import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { themes, DEFAULT_VARIANT } from '../theme';

// Dve varijante iste teme: "amber" (glavna boja je zuta sa ekrana za prijavu)
// i "blue" (glavna je prasnjavo plava). Prekidac u baneru menja varijantu, a
// sa njom i baner i glavnu i sporednu boju kroz ceo raspored - da bi se dve
// mogucnosti gledale jedna do druge, a ne zamisljale.
//
// Izbor stoji u memoriji, ne na disku: ovo je alat za poredjenje, pa svako
// pokretanje krece od podrazumevane varijante.

const ThemeContext = createContext(null);

// Bez providera (ekran renderovan sam za sebe u testu) tema ne sme da pukne,
// pa se vraca podrazumevana varijanta sa prekidacem koji ne radi nista.
const BEZ_PROVIDERA = {
  variant: DEFAULT_VARIANT,
  colors: themes[DEFAULT_VARIANT],
  setVariant: () => {},
  toggleVariant: () => {},
};

export function ThemeProvider({ children, initialVariant = DEFAULT_VARIANT }) {
  const [variant, setVariant] = useState(
    themes[initialVariant] ? initialVariant : DEFAULT_VARIANT
  );

  const toggleVariant = useCallback(
    () => setVariant((v) => (v === 'amber' ? 'blue' : 'amber')),
    []
  );

  const value = useMemo(
    () => ({ variant, colors: themes[variant], setVariant, toggleVariant }),
    [variant, toggleVariant]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext) ?? BEZ_PROVIDERA;
}
