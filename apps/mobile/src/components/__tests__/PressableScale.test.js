import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { Text } from 'react-native';
import PressableScale from '../PressableScale';

describe('PressableScale', () => {
  test('javlja dodir', async () => {
    const onPress = jest.fn();
    await render(<PressableScale onPress={onPress}><Text>Dugme</Text></PressableScale>);

    await act(async () => {
      fireEvent.press(screen.getByText('Dugme'));
    });

    expect(onPress).toHaveBeenCalled();
  });

  test('prosledjuje dalje props za pristupacnost', async () => {
    await render(
      <PressableScale onPress={jest.fn()} accessibilityRole="button" accessibilityLabel="Prijavi se">
        <Text>Dugme</Text>
      </PressableScale>
    );

    expect(screen.getByLabelText('Prijavi se')).toBeTruthy();
  });

  // Pritisak i otpustanje pokrecu animaciju; test proverava da ne pucaju.
  test('pritisak i otpustanje ne rusi komponentu', async () => {
    await render(<PressableScale onPress={jest.fn()}><Text>Dugme</Text></PressableScale>);
    const dugme = screen.getByText('Dugme');

    await act(async () => {
      fireEvent(dugme, 'pressIn');
      fireEvent(dugme, 'pressOut');
    });

    expect(screen.getByText('Dugme')).toBeTruthy();
  });

  test('zakljucano dugme ne javlja dodir', async () => {
    const onPress = jest.fn();
    await render(
      <PressableScale onPress={onPress} disabled><Text>Dugme</Text></PressableScale>
    );

    await act(async () => {
      fireEvent.press(screen.getByText('Dugme'));
    });

    expect(onPress).not.toHaveBeenCalled();
  });
});
