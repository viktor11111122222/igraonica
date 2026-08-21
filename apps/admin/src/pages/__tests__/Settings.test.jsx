import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Settings from '../Settings';
import { get, patch } from '../../lib/api';

vi.mock('../../lib/api', () => ({ get: vi.fn(), patch: vi.fn() }));

vi.mock('../../components/Layout', () => ({
  PageHeader: ({ title }) => <h1>{title}</h1>,
}));

vi.mock('../../context/ThemeContext', () => ({
  THEMES: [
    { key: 'light', label: 'Svetla' },
    { key: 'dark', label: 'Tamna' },
  ],
  useTheme: () => ({ theme: 'light', setTheme: vi.fn() }),
}));

const podesavanja = [
  { key: 'mobile_announcement', value: 'U subotu radimo do 23h' },
  { key: 'announcement_tabs', value: 'home' },
  { key: 'mobile_tab_menu', value: 'true' },
  { key: 'club_name', value: 'Kids club' },
];

beforeEach(() => {
  get.mockReset().mockResolvedValue({ settings: podesavanja });
  patch.mockReset().mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Settings - ucitavanje', () => {
  test('prikazuje vrednosti sa servera', async () => {
    render(<Settings />);

    expect(await screen.findByDisplayValue('U subotu radimo do 23h')).toBeInTheDocument();
  });

  // Ovo je bio kvar: `data?.settings || []` je pravio nov niz pri svakom
  // renderu, pa je useMemo davao nov objekat, effect se okidao i setValues zvao
  // novi render - u krug. Dok zahtev traje bilo je nevidljivo; kada padne,
  // petlja nije imala kraj.
  test('dok podaci ne stignu, ne renderuje se u krug', async () => {
    let razresi;
    get.mockReturnValue(new Promise((r) => { razresi = r; }));

    let brojRendera = 0;
    function Brojac() {
      brojRendera++;
      return <Settings />;
    }
    render(<Brojac />);

    await new Promise((r) => setTimeout(r, 150));
    expect(brojRendera).toBeLessThan(10);

    await act(async () => {
      razresi({ settings: podesavanja });
    });
  });

  test('kada zahtev padne, ekran se smiri sa porukom', async () => {
    get.mockRejectedValue(new Error('Nema veze sa serverom.'));

    let brojRendera = 0;
    function Brojac() {
      brojRendera++;
      return <Settings />;
    }
    render(<Brojac />);

    expect(await screen.findByText('Nema veze sa serverom.')).toBeInTheDocument();
    const posleGreske = brojRendera;
    await new Promise((r) => setTimeout(r, 150));
    expect(brojRendera).toBe(posleGreske);
  });
});

describe('Settings - cuvanje', () => {
  // Namerno bez laznih tajmera: sa njima React ne stigne da prerenderuje izmedju
  // dva klika, pa drugi klik radi nad zastarelim stanjem - artefakt testa, ne
  // ponasanje aplikacije.
  test('tekst se cuva kada polje izgubi fokus', async () => {
    const user = userEvent.setup();
    render(<Settings />);
    const polje = await screen.findByDisplayValue('U subotu radimo do 23h');

    await user.clear(polje);
    await user.type(polje, 'Zatvoreni smo u ponedeljak');
    await user.tab();

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/settings/mobile_announcement', {
        value: 'Zatvoreni smo u ponedeljak',
      })
    );
  });

  test('nepromenjen tekst ne salje zahtev', async () => {
    const user = userEvent.setup();
    render(<Settings />);
    const polje = await screen.findByDisplayValue('U subotu radimo do 23h');

    await user.click(polje);
    await user.tab();

    await new Promise((r) => setTimeout(r, 500));
    expect(patch).not.toHaveBeenCalled();
  });

  test('ekrani obavestenja se ukljucuju', async () => {
    const user = userEvent.setup();
    render(<Settings />);

    await user.click(await screen.findByRole('button', { name: 'Jelovnik' }));

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/settings/announcement_tabs', { value: 'home,menu' })
    );
  });

  test('ponovni klik iskljucuje ekran', async () => {
    const user = userEvent.setup();
    render(<Settings />);

    await user.click(await screen.findByRole('button', { name: 'Pocetna' }));

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/settings/announcement_tabs', { value: '' })
    );
  });

  // Uzastopne izmene istog podesavanja ne smeju da posalju zahtev po kliku.
  test('dve brze izmene istog podesavanja salju jedan zahtev', async () => {
    const user = userEvent.setup();
    render(<Settings />);

    await user.click(await screen.findByRole('button', { name: 'Jelovnik' }));
    await user.click(screen.getByRole('button', { name: 'Raspored' }));

    await waitFor(() => expect(patch).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 300));

    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch).toHaveBeenCalledWith('/settings/announcement_tabs', {
      value: 'home,menu,schedule',
    });
  });

  // Bez teksta obavestenje se nigde ne prikazuje, pa je izbor ekrana zakljucan.
  test('bez teksta se ekrani ne mogu birati', async () => {
    get.mockResolvedValue({
      settings: [
        { key: 'mobile_announcement', value: '' },
        { key: 'announcement_tabs', value: '' },
      ],
    });
    render(<Settings />);

    expect(await screen.findByRole('button', { name: 'Jelovnik' })).toBeDisabled();
  });

  test('neuspelo cuvanje javlja gresku i vraca stanje sa servera', async () => {
    patch.mockRejectedValue(new Error('Nemate dozvolu za ovu akciju.'));
    const user = userEvent.setup();
    render(<Settings />);

    await user.click(await screen.findByRole('button', { name: 'Jelovnik' }));

    expect(await screen.findByText('Nemate dozvolu za ovu akciju.')).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(2);
  });
});
