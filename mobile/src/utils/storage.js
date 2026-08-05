import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// expo-secure-store je native keychain API i ne radi na webu.
// Na webu se koristi localStorage (samo za dev pregled), na uredjaju SecureStore.
const isWeb = Platform.OS === 'web';

export async function getItem(key) {
  if (isWeb) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function setItem(key, value) {
  if (isWeb) {
    try {
      window.localStorage.setItem(key, value);
    } catch {}
    return;
  }
  return SecureStore.setItemAsync(key, value);
}

export async function deleteItem(key) {
  if (isWeb) {
    try {
      window.localStorage.removeItem(key);
    } catch {}
    return;
  }
  return SecureStore.deleteItemAsync(key);
}
