import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import HoursRing from '../HoursRing';

describe('HoursRing', () => {
  test('prikazuje sadrzaj u sredini prstena', async () => {
    await render(<HoursRing progress={0.5}><Text>60%</Text></HoursRing>);
    expect(screen.getByText('60%')).toBeTruthy();
  });

  test('crta se i bez zadatog napretka', async () => {
    const { toJSON } = await render(<HoursRing />);
    expect(toJSON()).not.toBeNull();
  });

  // Napredak van 0-1 se odseca, da luk ne izadje iz kruga.
  test('vrednosti van opsega ne rusi crtanje', async () => {
    const { toJSON: preveliko } = await render(<HoursRing progress={2} />);
    expect(preveliko()).not.toBeNull();

    const { toJSON: negativno } = await render(<HoursRing progress={-1} />);
    expect(negativno()).not.toBeNull();
  });

  test('postuje zadatu velicinu', async () => {
    const { toJSON } = await render(<HoursRing size={200} />);
    expect(JSON.stringify(toJSON())).toContain('200');
  });
});
