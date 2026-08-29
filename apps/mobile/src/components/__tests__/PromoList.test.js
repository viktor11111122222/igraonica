import { render, screen } from '@testing-library/react-native';
import PromoList, { popustLabel, trajanje } from '../PromoList';
import { todayKey } from '../../utils/date';

function pomereno(dana) {
  const d = new Date();
  d.setDate(d.getDate() + dana);
  return d.toISOString().split('T')[0];
}

const akcija = {
  id: 'a1',
  title: 'Letnja akcija',
  description: 'Popust na sve pakete.',
  discountType: 'PERCENT',
  discountValue: 20,
  dateFrom: pomereno(-1),
  dateTo: pomereno(3),
};

describe('PromoList', () => {
  test('prikazuje naziv, opis i popust', async () => {
    await render(<PromoList promotions={[akcija]} />);

    expect(screen.getByText('Letnja akcija')).toBeTruthy();
    expect(screen.getByText('Popust na sve pakete.')).toBeTruthy();
    expect(screen.getByText('-20%')).toBeTruthy();
  });

  test('prazna lista ne crta nista', async () => {
    await render(<PromoList promotions={[]} />);
    expect(screen.queryByText('Letnja akcija')).toBeNull();
  });

  // Ekran zove endpoint koji moze da padne; tada stize undefined.
  test('bez podataka ne puca', async () => {
    await render(<PromoList />);
    expect(screen.queryByText('Letnja akcija')).toBeNull();
  });

  test('prikazuje sve akcije koje vaze', async () => {
    await render(
      <PromoList promotions={[akcija, { ...akcija, id: 'a2', title: 'Druga akcija' }]} />
    );

    expect(screen.getByText('Letnja akcija')).toBeTruthy();
    expect(screen.getByText('Druga akcija')).toBeTruthy();
  });
});

describe('popustLabel', () => {
  test('procenat', () => {
    expect(popustLabel(akcija)).toBe('-20%');
  });

  test('iznos u dinarima nije procenat', () => {
    expect(popustLabel({ ...akcija, discountType: 'AMOUNT', discountValue: 500 })).toBe('-500 RSD');
  });

  // "Drugo dete besplatno" nema broj, pa znacke nema umesto da stoji prazna.
  test('opisna akcija nema znacku', () => {
    expect(popustLabel({ ...akcija, discountType: 'TEXT', discountValue: null })).toBeNull();
  });
});

describe('trajanje', () => {
  test('kaze do kog datuma vazi', () => {
    expect(trajanje({ ...akcija, dateTo: '2026-09-05' }, '2026-08-26')).toBe('Vazi do 05.09.');
  });

  // Datum poslednjeg dana zvuci kao da ima vremena, pa se kaze recima.
  test('poslednji dan se kaze recima', () => {
    const danas = todayKey();
    expect(trajanje({ ...akcija, dateTo: danas }, danas)).toBe('Poslednji dan');
  });
});
