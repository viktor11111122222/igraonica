import { render, screen, act } from '@testing-library/react-native';
import LoadingScreen from '../LoadingScreen';

// Ekran se crta i pre nego sto se font ucita i van svih providera (App.js ga
// vraca pre SettingsProvider-a), pa ne sme da zavisi ni od cega spolja.
describe('LoadingScreen', () => {
  test('crta se bez providera i bez ucitanog fonta', async () => {
    await act(async () => {
      render(<LoadingScreen />);
    });
    expect(screen.getByTestId('loading-screen')).toBeTruthy();
  });

  test('citacu ekrana kaze da se ceka', async () => {
    await act(async () => {
      render(<LoadingScreen />);
    });
    const ekran = screen.getByTestId('loading-screen');
    expect(ekran.props.accessibilityLabel).toBe('Ucitavanje');
    expect(ekran.props.accessibilityRole).toBe('progressbar');
  });

  // Tekst bi pre ucitavanja fonta bio ispisan sistemskim pismom i poskocio bi
  // cim Montserrat stigne.
  test('nema nijednog slova', async () => {
    await act(async () => {
      render(<LoadingScreen />);
    });
    expect(screen.queryAllByText(/\S/)).toHaveLength(0);
  });

  test('animacija se zaustavi kad ekran ode', async () => {
    await act(async () => {
      render(<LoadingScreen />);
    });
    // Bez cuvanja petlje u cleanup-u ovo ostavi tajmere da rade u pozadini.
    await act(async () => {
      screen.unmount();
    });
    expect(screen.queryByTestId('loading-screen')).toBeNull();
  });
});
