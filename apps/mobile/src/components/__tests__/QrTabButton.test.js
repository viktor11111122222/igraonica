import { render, screen, fireEvent, act } from '@testing-library/react-native';
import QrTabButton from '../QrTabButton';

describe('QrTabButton', () => {
  test('predstavlja se kao dugme', async () => {
    await render(<QrTabButton onPress={jest.fn()} focused={false} />);
    expect(screen.getByRole('button')).toBeTruthy();
  });

  test('javlja dodir', async () => {
    const onPress = jest.fn();
    await render(<QrTabButton onPress={onPress} focused={false} />);

    await act(async () => {
      fireEvent.press(screen.getByRole('button'));
    });

    expect(onPress).toHaveBeenCalled();
  });

  test('crta se i kada je izabran', async () => {
    const { toJSON } = await render(<QrTabButton onPress={jest.fn()} focused />);
    expect(toJSON()).not.toBeNull();
  });
});
