import { render, screen, fireEvent, act } from '@testing-library/react-native';
import BirthDatePicker from '../BirthDatePicker';

const onChange = jest.fn();
const prikazi = (value) => render(<BirthDatePicker value={value} onChange={onChange} />);

async function izaberi(tekst) {
  await act(async () => {
    fireEvent.press(screen.getByText(tekst));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.setSystemTime(new Date('2026-08-21T12:00:00'));
});

describe('BirthDatePicker', () => {
  test('javlja datum tek kada su izabrana sva tri dela', async () => {
    await prikazi('');

    await izaberi('2020');
    expect(onChange).toHaveBeenLastCalledWith('');

    await izaberi('Maj');
    expect(onChange).toHaveBeenLastCalledWith('');

    await izaberi('10');
    expect(onChange).toHaveBeenLastCalledWith('2020-05-10');
  });

  // Backend ocekuje YYYY-MM-DD, pa jednocifreni dan i mesec moraju da imaju nulu.
  test('jednocifreni dan i mesec dobijaju vodecu nulu', async () => {
    await prikazi('');

    await izaberi('2021');
    await izaberi('Mar');
    await izaberi('3');

    expect(onChange).toHaveBeenLastCalledWith('2021-03-03');
  });

  test('pocetna vrednost se prikazuje kao izabrana', async () => {
    await prikazi('2019-12-24');

    expect(screen.getByText('2019')).toBeTruthy();
    expect(screen.getByText('Dec')).toBeTruthy();
    expect(screen.getByText('24')).toBeTruthy();
  });

  test('promena godine zadrzava vec izabran dan i mesec', async () => {
    await prikazi('2020-05-10');

    await izaberi('2021');

    expect(onChange).toHaveBeenLastCalledWith('2021-05-10');
  });
});
