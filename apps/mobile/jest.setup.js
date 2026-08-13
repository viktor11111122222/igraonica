// Ekrani se u testu renderuju bez pravog navigatora i bez mreze, pa se ovde
// zamenjuje ono sto zavisi od uredjaja. Sve ostalo ide kroz jest-expo preset.

// Fontovi se ne ucitavaju u testu - useFonts odmah javlja da je gotovo.
jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  loadAsync: jest.fn(() => Promise.resolve()),
  isLoaded: () => true,
}));

// SecureStore trazi nativni modul; u testu je dovoljna memorija.
jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    getItemAsync: jest.fn((key) => Promise.resolve(store.get(key) ?? null)),
    setItemAsync: jest.fn((key, value) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    deleteItemAsync: jest.fn((key) => {
      store.delete(key);
      return Promise.resolve();
    }),
  };
});
