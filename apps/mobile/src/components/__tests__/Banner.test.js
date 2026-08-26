import { render, screen, within } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import Banner from '../Banner';
import { ThemeProvider } from '../../context/ThemeContext';
import { themes } from '../../theme';

const prikazi = (props = {}, varijanta) =>
  render(
    <ThemeProvider initialVariant={varijanta}>
      <Banner title="Jelovnik" subtitle="Sta se jede ove nedelje" {...props} />
    </ThemeProvider>
  );

const stil = (testID) => StyleSheet.flatten(screen.getByTestId(testID).props.style);

describe('Banner', () => {
  test('ispisuje naslov i podnaslov', async () => {
    await prikazi();

    expect(screen.getByText('Jelovnik')).toBeTruthy();
    expect(screen.getByText('Sta se jede ove nedelje')).toBeTruthy();
  });

  test('bez nadnaslova ga nema na ekranu', async () => {
    await prikazi();
    expect(screen.queryByText('Zdravo,')).toBeNull();
  });

  test('zadat nadnaslov stoji iznad naslova', async () => {
    await prikazi({ eyebrow: 'Zdravo,' });
    expect(screen.getByText('Zdravo,')).toBeTruthy();
  });

  // Pocetna od banera uzima samo podlogu sa sarom - svoje zaglavlje crta sama.
  test('bez teksta crta samo podlogu sa sarom', async () => {
    await render(
      <ThemeProvider>
        <Banner>
          <Text>sopstveno zaglavlje</Text>
        </Banner>
      </ThemeProvider>
    );

    expect(screen.getByText('sopstveno zaglavlje')).toBeTruthy();
    expect(screen.getByTestId('banner-doodles')).toBeTruthy();
    expect(screen.queryByText('Jelovnik')).toBeNull();
  });

  test('krece od zute varijante', async () => {
    await prikazi();
    expect(stil('banner-bg').backgroundColor).toBe(themes.amber.primary);
  });

  test('u plavoj varijanti uzima njenu glavnu boju', async () => {
    await prikazi({}, 'blue');
    expect(stil('banner-bg').backgroundColor).toBe(themes.blue.primary);
  });

  test('naslov uzima boju iz varijante', async () => {
    await prikazi();
    expect(StyleSheet.flatten(screen.getByText('Jelovnik').props.style).color).toBe(
      themes.amber.textOnPrimary
    );
  });

  // Sara je jedan fajl za obe varijante - razlikuje ih samo prozirnost,
  // izmerena sa prilozenih banera.
  test('u zutoj je sara izrazenija', async () => {
    await prikazi();
    expect(stil('banner-doodles').opacity).toBe(themes.amber.bannerDoodle);
  });

  test('u plavoj je sara blaza', async () => {
    await prikazi({}, 'blue');
    expect(stil('banner-doodles').opacity).toBe(themes.blue.bannerDoodle);
  });

  test("sa doodles='none' nema sare, ostaje samo boja", async () => {
    await prikazi({ doodles: 'none' });

    expect(screen.queryByTestId('banner-doodles')).toBeNull();
    expect(stil('banner-bg').backgroundColor).toBe(themes.amber.primary);
    expect(screen.getByText('Jelovnik')).toBeTruthy();
  });

  const saTrakom = (doodles) =>
    render(
      <ThemeProvider>
        <Banner doodles={doodles} title="Jelovnik">
          <Text>traka sa datumima</Text>
        </Banner>
      </ThemeProvider>
    );

  // Jelovnik: sara stoji iza naslova, a traka sa datumima ispod ostaje ravna.
  test("sa doodles='head' sara stoji samo iza naslova", async () => {
    await saTrakom('head');

    expect(within(screen.getByTestId('banner-head')).getByTestId('banner-doodles')).toBeTruthy();
    // Tacno jednom - ispod datuma podloga mora da ostane ravna.
    expect(screen.getAllByTestId('banner-doodles')).toHaveLength(1);
  });

  test("sa doodles='content' sara stoji samo iza sadrzaja u podnozju", async () => {
    await saTrakom('content');

    expect(within(screen.getByTestId('banner-content')).getByTestId('banner-doodles')).toBeTruthy();
    expect(screen.getAllByTestId('banner-doodles')).toHaveLength(1);
  });

  test('sara stoji u prirodnoj razmeri fajla, ne razvucena po visini', async () => {
    await prikazi();

    const s = stil('banner-doodles');
    expect(s.height / s.width).toBeCloseTo(780 / 1170, 3);
  });
});
