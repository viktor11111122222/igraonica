import { render, screen, waitFor, act } from '@testing-library/react-native';
import { Text, AppState } from 'react-native';
import { ClosedDaysProvider, useClosedDays } from '../ClosedDaysContext';
import { apiRequest } from '../../utils/api';

jest.mock('../../utils/api', () => ({ apiRequest: jest.fn() }));

const DAN = '2026-08-25';
const neradni = { date: DAN, reason: 'Rodjendan', note: 'Zatvoreni ceo dan' };

function Ekran({ datum = DAN }) {
  const { isClosed, closedOn, loading } = useClosedDays();
  const podatak = closedOn(datum);
  return (
    <>
      <Text testID="zatvoreno">{String(isClosed(datum))}</Text>
      <Text testID="razlog">{podatak ? podatak.reason : 'nema'}</Text>
      <Text testID="ucitava">{String(loading)}</Text>
    </>
  );
}

const prikazi = (props) =>
  render(<ClosedDaysProvider><Ekran {...props} /></ClosedDaysProvider>);
const vidi = (id) => screen.getByTestId(id).props.children;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  apiRequest.mockResolvedValue({ closedDays: [] });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('ClosedDaysContext', () => {
  test('dovlaci neradne dane bez prijave', async () => {
    apiRequest.mockResolvedValue({ closedDays: [neradni] });
    await prikazi();

    await waitFor(() => expect(vidi('zatvoreno')).toBe('true'));
    expect(apiRequest).toHaveBeenCalledWith('/closed-days');
  });

  test('vraca ceo podatak o danu, ne samo zastavicu', async () => {
    apiRequest.mockResolvedValue({ closedDays: [neradni] });
    await prikazi();

    await waitFor(() => expect(vidi('razlog')).toBe('Rodjendan'));
  });

  test('radni dan nije oznacen', async () => {
    apiRequest.mockResolvedValue({ closedDays: [neradni] });
    await prikazi({ datum: '2026-08-26' });

    await waitFor(() => expect(vidi('ucitava')).toBe('false'));
    expect(vidi('zatvoreno')).toBe('false');
    expect(vidi('razlog')).toBe('nema');
  });

  // Lazno "ne radimo" je gore od nikakvog obavestenja.
  test('greska sa servera ne izmislja neradni dan', async () => {
    apiRequest.mockRejectedValue(new Error('Nema veze sa serverom.'));
    await prikazi();

    await waitFor(() => expect(vidi('ucitava')).toBe('false'));
    expect(vidi('zatvoreno')).toBe('false');
  });

  test('sama se osvezava dok je aplikacija otvorena', async () => {
    jest.useFakeTimers();
    await prikazi();
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(1));

    await act(async () => {
      jest.advanceTimersByTime(15000);
    });

    expect(apiRequest).toHaveBeenCalledTimes(2);
  });

  test('povratak iz pozadine odmah proverava', async () => {
    const slusaoci = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_, fn) => {
      slusaoci.push(fn);
      return { remove: jest.fn() };
    });

    await prikazi();
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(1));

    await act(async () => {
      slusaoci.forEach((fn) => fn('active'));
    });

    expect(apiRequest).toHaveBeenCalledTimes(2);
    AppState.addEventListener.mockRestore();
  });

  test('van provajdera nista nije zatvoreno', async () => {
    await render(<Ekran />);
    expect(vidi('zatvoreno')).toBe('false');
    expect(vidi('razlog')).toBe('nema');
  });
});
