import { render, screen } from '@testing-library/react-native';
import Announcement from '../Announcement';

let mockPodesavanja = {};
jest.mock('../../context/SettingsContext', () => ({
  useSettings: () => ({ settings: mockPodesavanja }),
}));

const PORUKA = 'U subotu radimo do 23h';

beforeEach(() => {
  mockPodesavanja = { mobile_announcement: PORUKA, announcement_tabs: 'home,menu' };
});

describe('Announcement', () => {
  test('vidi se na ekranu koji je admin izabrao', async () => {
    await render(<Announcement screen="menu" />);
    expect(screen.getByText(PORUKA)).toBeTruthy();
  });

  test('ne vidi se na ekranu koji nije izabran', async () => {
    const { toJSON } = await render(<Announcement screen="schedule" />);
    expect(toJSON()).toBeNull();
  });

  // Bez teksta obavestenje se ne prikazuje nigde, ma koji ekran bio izabran.
  test('prazan tekst ne pravi praznu traku', async () => {
    mockPodesavanja = { mobile_announcement: '   ', announcement_tabs: 'home,menu' };
    const { toJSON } = await render(<Announcement screen="menu" />);
    expect(toJSON()).toBeNull();
  });

  test('bez ijednog izabranog ekrana se ne prikazuje', async () => {
    mockPodesavanja = { mobile_announcement: PORUKA, announcement_tabs: '' };
    const { toJSON } = await render(<Announcement screen="home" />);
    expect(toJSON()).toBeNull();
  });

  // Lista se cuva kao tekst razdvojen zarezom, pa razmaci ne smeju da smetaju.
  test('razmaci oko imena ekrana se zanemaruju', async () => {
    mockPodesavanja = { mobile_announcement: PORUKA, announcement_tabs: ' home , menu ' };
    await render(<Announcement screen="menu" />);
    expect(screen.getByText(PORUKA)).toBeTruthy();
  });

  test('tekst se ocisti od suvisnih razmaka', async () => {
    mockPodesavanja = { mobile_announcement: `  ${PORUKA}  `, announcement_tabs: 'home' };
    await render(<Announcement screen="home" />);
    expect(screen.getByText(PORUKA)).toBeTruthy();
  });

  test('bez podesavanja se ne rusi', async () => {
    mockPodesavanja = {};
    const { toJSON } = await render(<Announcement screen="home" />);
    expect(toJSON()).toBeNull();
  });
});
