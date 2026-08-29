import { describe, test, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BarChart, { MARK_AMBER, MARK_BLUE } from '../BarChart';

const dani = [
  { date: '2026-08-18', count: 3 },
  { date: '2026-08-19', count: 7 },
  { date: '2026-08-20', count: 0 },
];

describe('BarChart', () => {
  test('crta se kao slika sa opisom', () => {
    render(<BarChart data={dani} valueKey="count" />);
    expect(screen.getByRole('img', { name: 'Grafikon po danima' })).toBeInTheDocument();
  });

  test('bez podataka se ne ruši', () => {
    render(<BarChart data={undefined} valueKey="count" />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  test('prazan niz se ne ruši', () => {
    render(<BarChart data={[]} valueKey="count" />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  // Direktna oznaka stoji samo na najvisem stupcu, ne na svakom.
  test('najvisa vrednost je ispisana iznad stupca', () => {
    render(<BarChart data={dani} valueKey="count" formatValue={(v) => `${v}x`} />);
    const svg = screen.getByRole('img');
    expect(within(svg).getByText('7x')).toBeInTheDocument();
    expect(within(svg).queryByText('3x')).toBeNull();
  });

  // Podatak mora da bude dostupan i onima koji grafikon ne vide.
  test('isti podaci se mogu prikazati kao tabela', async () => {
    const user = userEvent.setup();
    render(
      <BarChart data={dani} valueKey="count" formatLabel={(d) => d.date} />
    );

    await user.click(screen.getByRole('button', { name: 'Prikazi kao tabelu' }));

    const tabela = screen.getByRole('table');
    expect(within(tabela).getByText('2026-08-19')).toBeInTheDocument();
    expect(within(tabela).getByText('7')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Sakrij tabelu' }));
    expect(screen.queryByRole('table')).toBeNull();
  });

  test('boje dolaze iz tokena teme, ne iz literala', () => {
    expect(MARK_BLUE).toBe('var(--chart-blue)');
    expect(MARK_AMBER).toBe('var(--chart-amber)');
  });

  test('oznake ose se ne ponavljaju kada su vrednosti male', () => {
    render(<BarChart data={[{ date: 'a', count: 0 }]} valueKey="count" formatValue={() => '0'} />);
    const svg = screen.getByRole('img');
    // Sve tri granice bi se posle formatiranja poklopile - ostaje jedna.
    expect(within(svg).getAllByText('0')).toHaveLength(1);
  });
});

// Grafikon se crta u pikselima, pa mora da se drzi sirine kartice. Dok se
// oslanjao samo na `ResizeObserver`, ostajao je na podrazumevanih 640px i gurao
// celu stranicu u stranu - na telefonu se pola nadzorne table skrolovalo bocno.
describe('BarChart - sirina', () => {
  test('meri sirinu omotaca odmah, bez cekanja na posmatraca', () => {
    // jsdom nema raspored, pa `clientWidth` vraca 0; komponenta mora da radi i
    // tada, umesto da nacrta 640px sirok SVG.
    render(<BarChart data={dani} valueKey="count" />);
    const svg = screen.getByRole('img', { name: 'Grafikon po danima' });

    expect(Number(svg.getAttribute('width'))).toBeLessThanOrEqual(320);
  });

  // Druga brana: cak i kad je izmerena sirina zastarela, SVG ne sme da izadje
  // iz kartice.
  test('SVG ne moze da bude siri od kartice', () => {
    render(<BarChart data={dani} valueKey="count" />);
    const svg = screen.getByRole('img', { name: 'Grafikon po danima' });

    expect(svg.style.maxWidth).toBe('100%');
  });
});
