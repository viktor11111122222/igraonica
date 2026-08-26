import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';
import ThemeSwitch from '../ThemeSwitch';
import Banner from '../Banner';
import { ThemeProvider } from '../../context/ThemeContext';
import { themes } from '../../theme';

// Prekidac se gleda zajedno sa banerom: njegov posao i jeste da promeni boju
// ostatka rasporeda, a ne sebe.
const prikazi = () =>
  render(
    <ThemeProvider>
      <View>
        <Banner title="Jelovnik" />
        <ThemeSwitch />
      </View>
    </ThemeProvider>
  );

const podloga = () =>
  StyleSheet.flatten(screen.getByTestId('banner-bg').props.style).backgroundColor;

describe('ThemeSwitch', () => {
  test('nudi obe varijante i kaze koja je izabrana', async () => {
    await prikazi();

    expect(screen.getByLabelText('Zuta tema').props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText('Plava tema').props.accessibilityState.selected).toBe(false);
  });

  test('ima natpis, jer van banera kruzici sami ne govore sta biraju', async () => {
    await prikazi();
    expect(screen.getByText('Boja teme')).toBeTruthy();
  });

  test('dodir na plavi kruzic prebacuje glavnu boju u plavu', async () => {
    await prikazi();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Plava tema'));
    });

    expect(podloga()).toBe(themes.blue.primary);
    expect(screen.getByLabelText('Plava tema').props.accessibilityState.selected).toBe(true);
  });

  test('nazad na zutu radi isto tako', async () => {
    await prikazi();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Plava tema'));
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Zuta tema'));
    });

    expect(podloga()).toBe(themes.amber.primary);
  });

  // Ponovljen dodir na vec izabranu ne sme da je smeni na drugu.
  test('dodir na vec izabranu ostavlja je izabranom', async () => {
    await prikazi();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Zuta tema'));
    });

    expect(podloga()).toBe(themes.amber.primary);
  });
});
