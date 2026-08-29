import { render, screen, within } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import Banner from '../Banner';
import { colors, spacing } from '../../theme';

// Gornja sigurna zona dolazi iz uredjaja; mera se zadaje u jest.setup.js, a
// pojedini testovi je menjaju da bi proverili drugi uredjaj.
const zonaGore = (top) => {
  global.__sigurnaZona = { top, right: 0, bottom: 34, left: 0 };
};

const prikazi = (props = {}, top = 59) => {
  zonaGore(top);
  return render(<Banner title="Jelovnik" subtitle="Sta se jede ove nedelje" {...props} />);
};

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
      <Banner>
        <Text>sopstveno zaglavlje</Text>
      </Banner>
    );

    expect(screen.getByText('sopstveno zaglavlje')).toBeTruthy();
    expect(screen.getByTestId('banner-doodles')).toBeTruthy();
    expect(screen.queryByText('Jelovnik')).toBeNull();
  });

  test('podloga je u glavnoj boji', async () => {
    await prikazi();
    expect(stil('banner-bg').backgroundColor).toBe(colors.primary);
  });

  test('naslov se cita na toj podlozi', async () => {
    await prikazi();
    expect(StyleSheet.flatten(screen.getByText('Jelovnik').props.style).color).toBe(
      colors.textOnPrimary
    );
  });

  test("sa doodles='none' nema sare, ostaje samo boja", async () => {
    await prikazi({ doodles: 'none' });

    expect(screen.queryByTestId('banner-doodles')).toBeNull();
    expect(stil('banner-bg').backgroundColor).toBe(colors.primary);
    expect(screen.getByText('Jelovnik')).toBeTruthy();
  });

  const saTrakom = (doodles) =>
    render(
      <Banner doodles={doodles} title="Jelovnik">
        <Text>traka sa datumima</Text>
      </Banner>
    );

  // Jelovnik i Raspored: sara stoji iza naslova, a traka sa datumima ispod
  // ostaje ravna boja.
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

  test('sara je izrazena onoliko koliko tema kaze', async () => {
    await prikazi();
    expect(stil('banner-doodles').opacity).toBe(colors.bannerDoodle);
  });

  test('sara stoji u prirodnoj razmeri fajla, ne razvucena po visini', async () => {
    await prikazi();

    const s = stil('banner-doodles');
    expect(s.height / s.width).toBeCloseTo(780 / 1170, 3);
  });
});

// Sistemska traka nije svuda iste visine: ~59 na iPhone-u sa ostrvom, 20 na
// starom SE, 24-49 na Androidu. Sa fiksnih 64 je Android dobijao dvostruko
// vise vazduha iznad naslova nego iOS.
describe('Banner - gornja sigurna zona', () => {
  const vazduhIznadNaslova = () =>
    StyleSheet.flatten(screen.getByText('Jelovnik').parent.parent.props.style).paddingTop;

  test('vazduh prati sigurnu zonu uredjaja', async () => {
    await prikazi({}, 59);
    expect(vazduhIznadNaslova()).toBe(59 + spacing.sm);
  });

  test('na uredjaju sa nizom trakom vazduha je manje', async () => {
    await prikazi({}, 24);
    expect(vazduhIznadNaslova()).toBe(24 + spacing.sm);
  });
});
