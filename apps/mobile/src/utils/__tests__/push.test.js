import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { registrujUredjaj } from '../push';
import { apiRequest } from '../api';

jest.mock('../api', () => ({ apiRequest: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  Notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
  Notifications.requestPermissionsAsync.mockResolvedValue({ status: 'granted' });
  Notifications.getExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[test]' });
  apiRequest.mockResolvedValue({});
});

describe('registrujUredjaj', () => {
  test('salje token serveru kad je dozvola data', async () => {
    const token = await registrujUredjaj();

    expect(token).toBe('ExponentPushToken[test]');
    expect(apiRequest).toHaveBeenCalledWith('/auth/profile', {
      method: 'PATCH',
      body: { pushToken: 'ExponentPushToken[test]' },
    });
  });

  // PATCH na svaki ulazak u aplikaciju bi bio uzaludan zahtev.
  test('nepromenjen token se ne salje ponovo', async () => {
    await registrujUredjaj('ExponentPushToken[test]');

    expect(apiRequest).not.toHaveBeenCalled();
  });

  test('odbijena dozvola ne salje nista i ne baca gresku', async () => {
    Notifications.getPermissionsAsync.mockResolvedValue({ status: 'denied' });
    Notifications.requestPermissionsAsync.mockResolvedValue({ status: 'denied' });

    await expect(registrujUredjaj()).resolves.toBeNull();
    expect(apiRequest).not.toHaveBeenCalled();
  });

  // Bez podesenih kredencijala Expo baca gresku; aplikacija mora da radi dalje.
  test('greska pri uzimanju tokena ne obara aplikaciju', async () => {
    Notifications.getExpoPushTokenAsync.mockRejectedValue(new Error('nema projectId'));

    await expect(registrujUredjaj()).resolves.toBeNull();
  });

  test('na Androidu se prvo pravi kanal za obavestenja', async () => {
    const stara = Platform.OS;
    Platform.OS = 'android';

    await registrujUredjaj();

    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      'default',
      expect.objectContaining({ name: expect.any(String) })
    );
    Platform.OS = stara;
  });
});
