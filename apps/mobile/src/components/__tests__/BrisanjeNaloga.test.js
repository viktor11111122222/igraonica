import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import BrisanjeNaloga from '../BrisanjeNaloga';
import { PRAVNO } from '../../utils/pravno';

const mockDeleteAccount = jest.fn();
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'roditelj@primer.rs' },
    deleteAccount: (...args) => mockDeleteAccount(...args),
  }),
}));

beforeEach(() => {
  mockDeleteAccount.mockReset().mockResolvedValue();
});

// Obe prodavnice traze da se nalog moze obrisati iz same aplikacije.
describe('BrisanjeNaloga', () => {
  test('dodir na dugme ne brise odmah, nego trazi lozinku', async () => {
    await render(<BrisanjeNaloga />);

    await fireEvent.press(screen.getByLabelText('Obrisi nalog'));

    expect(screen.getByPlaceholderText('Lozinka')).toBeTruthy();
    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });

  test('potvrda salje unetu lozinku', async () => {
    await render(<BrisanjeNaloga />);
    await fireEvent.press(screen.getByLabelText('Obrisi nalog'));

    await fireEvent.changeText(screen.getByPlaceholderText('Lozinka'), 'tajna123');
    await fireEvent.press(screen.getAllByText('Obrisi nalog')[1]);

    await waitFor(() => expect(mockDeleteAccount).toHaveBeenCalledWith('tajna123'));
  });

  test('greska sa servera ostaje u prozoru', async () => {
    mockDeleteAccount.mockRejectedValue(new Error('Lozinka nije tacna.'));
    await render(<BrisanjeNaloga />);
    await fireEvent.press(screen.getByLabelText('Obrisi nalog'));

    await fireEvent.changeText(screen.getByPlaceholderText('Lozinka'), 'pogresna');
    await fireEvent.press(screen.getAllByText('Obrisi nalog')[1]);

    expect(await screen.findByText('Lozinka nije tacna.')).toBeTruthy();
    expect(screen.getByPlaceholderText('Lozinka')).toBeTruthy();
  });

  test('odustajanje zatvara prozor i ne brise nista', async () => {
    await render(<BrisanjeNaloga />);
    await fireEvent.press(screen.getByLabelText('Obrisi nalog'));

    await fireEvent.press(screen.getByText('Odustani'));

    await waitFor(() => expect(screen.queryByPlaceholderText('Lozinka')).toBeNull());
    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });

  // Recenzent trazi oba dokumenta u aplikaciji, ne samo u opisu na prodavnici.
  test('vodi na politiku privatnosti i uslove', async () => {
    const otvori = jest.spyOn(Linking, 'openURL').mockResolvedValue();
    await render(<BrisanjeNaloga />);

    await fireEvent.press(screen.getByText('Politika privatnosti'));
    expect(otvori).toHaveBeenCalledWith(PRAVNO.privatnost);

    await fireEvent.press(screen.getByText('Uslovi koriscenja'));
    expect(otvori).toHaveBeenCalledWith(PRAVNO.uslovi);
  });
});
