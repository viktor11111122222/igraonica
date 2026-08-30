import { render, screen, fireEvent } from '@testing-library/react-native';
import DayStrip from '../DayStrip';
import { toKey } from '../../utils/date';

// Traka datuma je jedna komponenta za Jelovnik i Raspored - ista traka mora da
// pokazuje isti mesec, isti izabrani dan i istu oznaku danasnjeg dana.
const danas = toKey(new Date());
const sutra = toKey(new Date(Date.now() + 864e5));

const prikazi = (props = {}) =>
  render(
    <DayStrip
      today={danas}
      selected={danas}
      onSelect={jest.fn()}
      marked={new Set()}
      closed={new Set()}
      {...props}
    />
  );

describe('DayStrip', () => {
  test('prikazuje dane tekuceg meseca', async () => {
    await prikazi();

    const uMesecu = new Date(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      0
    ).getDate();

    expect(screen.getAllByLabelText(/^\d{1,2}\./)).toHaveLength(uMesecu);
  });

  test('dodir na dan javlja izbor', async () => {
    const izbor = jest.fn();
    await prikazi({ onSelect: izbor });

    const dan = new Date(sutra).getDate();
    fireEvent.press(screen.getByLabelText(new RegExp(`^${dan}\\.`)));

    expect(izbor).toHaveBeenCalledWith(sutra);
  });

  // Izabran dan mora da se razlikuje od ostalih i za citac ekrana, ne samo
  // bojom.
  test('izabran dan je oznacen', async () => {
    await prikazi();

    const dan = new Date(danas).getDate();
    const oblak = screen.getByLabelText(new RegExp(`^${dan}\\.`));
    expect(oblak.props.accessibilityState.selected).toBe(true);
  });
});
