import { describe, test, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, useTheme, THEMES } from '../ThemeContext';

function Ekran() {
  const { theme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="tema">{theme}</span>
      {THEMES.map((t) => (
        <button key={t.key} onClick={() => setTheme(t.key)}>{t.label}</button>
      ))}
    </div>
  );
}

const prikazi = () => render(<ThemeProvider><Ekran /></ThemeProvider>);

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('ThemeContext', () => {
  test('podrazumevano prati sistem', () => {
    prikazi();
    expect(screen.getByTestId('tema')).toHaveTextContent('system');
  });

  // "system" namerno ne postavlja atribut - tada odlucuje prefers-color-scheme.
  test('sistemska tema ne ostavlja atribut na dokumentu', () => {
    prikazi();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  test('izbor tamne teme stampa atribut', async () => {
    const user = userEvent.setup();
    prikazi();

    await user.click(screen.getByRole('button', { name: 'Tamna' }));

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  test('povratak na sistem sklanja atribut', async () => {
    const user = userEvent.setup();
    prikazi();
    await user.click(screen.getByRole('button', { name: 'Tamna' }));

    await user.click(screen.getByRole('button', { name: 'Kao sistem' }));

    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  // Tema je preferenca uredjaja, ne podatak o igraonici.
  test('izbor prezivljava osvezavanje stranice', async () => {
    const user = userEvent.setup();
    const { unmount } = prikazi();
    await user.click(screen.getByRole('button', { name: 'Svetla' }));
    unmount();

    prikazi();

    expect(screen.getByTestId('tema')).toHaveTextContent('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
