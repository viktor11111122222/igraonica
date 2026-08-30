import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { apiRequest } from './api';

// Nativni deo postoji samo u buildu koji ga ukljucuje. Stariji build - telefon
// koji jos nije azuriran, ili simulator sa prethodnom verzijom - na obican
// `import` puca pri pokretanju ("Cannot find native module
// 'ExpoPushTokenManager'").
//
// Ne pomaze da se ucitavanje samo obavije u try/catch: Metro u razvoju sam
// hvata pad modula i prijavljuje ga kao fatalnu gresku (crveni ekran) pre nego
// sto `catch` ovde dodje na red. Zato se prvo pita da li nativnog dela ima -
// `requireOptionalNativeModule` vraca null umesto da baci - pa se paket dira
// tek ako ga ima.
function notifikacije() {
  try {
    const { requireOptionalNativeModule } = require('expo-modules-core');
    if (!requireOptionalNativeModule('ExpoPushTokenManager')) return null;
    return require('expo-notifications');
  } catch {
    return null;
  }
}

// Prijava uredjaja za obavestenja na zakljucanom ekranu.
//
// Sve moze da zakaze bez posledica: bez dozvole, bez podesenih kredencijala ili
// na simulatoru, aplikacija radi isto - obavestenja i dalje stoje u zvoncetu.
// Zato ovde nema nijednog bacenog izuzetka.

// Android trazi kanal, inace poruke stizu bez zvuka i bez prioriteta.
async function pripremiKanal(Notifications) {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'Obavestenja igraonice',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
  });
}

function idProjekta() {
  return (
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId ??
    undefined
  );
}

// Vraca token ako je sve proslo, inace null. Token se salje serveru samo kad se
// promeni - PATCH na svaki ulazak u aplikaciju bi bio uzaludan zahtev.
export async function registrujUredjaj(poslednji = null) {
  try {
    const Notifications = notifikacije();
    if (!Notifications) return null;
    if (!Constants.isDevice && Platform.OS !== 'android') return null;

    await pripremiKanal(Notifications);

    const { status } = await Notifications.getPermissionsAsync();
    let dozvola = status;
    if (dozvola !== 'granted') {
      const trazeno = await Notifications.requestPermissionsAsync();
      dozvola = trazeno.status;
    }
    if (dozvola !== 'granted') return null;

    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: idProjekta(),
    });
    if (!token || token === poslednji) return token ?? null;

    await apiRequest('/auth/profile', { method: 'PATCH', body: { pushToken: token } });
    return token;
  } catch {
    // Nema kredencijala, nema mreze, korisnik odbio - aplikacija radi i bez
    // ovoga, pa se greska ne prosledjuje dalje.
    return null;
  }
}

export default registrujUredjaj;
