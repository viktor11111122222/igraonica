import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const KEY = 'igraonica_admin_theme';
const ThemeContext = createContext(null);

export const THEMES = [
  { key: 'system', label: 'Kao sistem' },
  { key: 'light', label: 'Svetla' },
  { key: 'dark', label: 'Tamna' },
];

// Tema je licna preferenca ovog uredjaja, ne podatak o igraonici, pa zivi u
// localStorage a ne u bazi - drugi admin na drugom racunaru bira svoju.
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => localStorage.getItem(KEY) || 'system');

  useEffect(() => {
    const root = document.documentElement;
    // "system" ne postavlja atribut - tada odlucuje prefers-color-scheme.
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    localStorage.setItem(KEY, theme);
  }, [theme]);

  const setTheme = useCallback((next) => setThemeState(next), []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
