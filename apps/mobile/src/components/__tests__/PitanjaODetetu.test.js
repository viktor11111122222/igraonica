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

describe('PitanjaODetetu - greske', () => {
  test('greska nestaje cim je na stavku odgovoreno', async () => {
    const greske = ['photoConsent', 'eatsLunch', 'telefonRoditelja'];
    const { rerender } = await render(
      <PitanjaODetetu odgovori={prazno} onChange={() => {}} telefonRoditelja="" greske={greske} />
    );
    expect(screen.getAllByText('Izaberite Da ili Ne.')).toHaveLength(2);
    expect(screen.getByText('Unesite ispravan broj telefona.')).toBeTruthy();

    await rerender(
      <PitanjaODetetu
        odgovori={{ ...prazno, photoConsent: false }}
        onChange={() => {}}
        telefonRoditelja="064 123 4567"
        greske={greske}
      />
    );
    expect(screen.getAllByText('Izaberite Da ili Ne.')).toHaveLength(1);
    expect(screen.queryByText('Unesite ispravan broj telefona.')).toBeNull();
  });
});
