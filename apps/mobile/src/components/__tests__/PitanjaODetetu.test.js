import { render, screen } from '@testing-library/react-native';
import PitanjaODetetu from '../PitanjaODetetu';

const prazno = {
  photoConsent: null,
  eatsLunch: null,
  eatsSnack: null,
  walksConsent: null,
  pickupPersons: '',
  extraContactPhone: '',
};

describe('PitanjaODetetu - stavke', () => {
  test('sest stavki, bez telefona roditelja', async () => {
    await render(<PitanjaODetetu odgovori={prazno} onChange={() => {}} />);

    expect(screen.getByText(/^4\. Dodatni kontakt telefon/)).toBeTruthy();
    expect(screen.getByText(/^5\. Ovlascene osobe/)).toBeTruthy();
    expect(screen.getByText(/^6\. Saglasnost za odlazak u setnju/)).toBeTruthy();
    expect(screen.queryByText(/Kontakt telefon roditelja/)).toBeNull();
  });
});

describe('PitanjaODetetu - greske', () => {
  test('greska nestaje cim je na stavku odgovoreno', async () => {
    const greske = ['photoConsent', 'eatsLunch', 'extraContactPhone'];
    const losBroj = { ...prazno, extraContactPhone: '12' };
    const { rerender } = await render(
      <PitanjaODetetu odgovori={losBroj} onChange={() => {}} greske={greske} />
    );
    expect(screen.getAllByText('Izaberite Da ili Ne.')).toHaveLength(2);
    expect(screen.getByText('Broj telefona nije ispravan.')).toBeTruthy();

    await rerender(
      <PitanjaODetetu
        odgovori={{ ...prazno, photoConsent: false, extraContactPhone: '065 222 3333' }}
        onChange={() => {}}
        greske={greske}
      />
    );
    expect(screen.getAllByText('Izaberite Da ili Ne.')).toHaveLength(1);
    expect(screen.queryByText('Broj telefona nije ispravan.')).toBeNull();
  });
});
