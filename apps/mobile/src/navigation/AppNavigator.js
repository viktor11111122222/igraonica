import { Platform, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { isOn, useSettings } from '../context/SettingsContext';
import { colors, font, radius, spacing } from '../theme';
import TabBar from '../components/TabBar';
import LoadingScreen from '../components/LoadingScreen';
import { useMinimalniBoot } from '../hooks/useUcitavanje';
import { BannerBackground } from '../components/Banner';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import PackageScreen from '../screens/PackageScreen';
import MenuScreen from '../screens/MenuScreen';
import QrScreen from '../screens/QrScreen';
import ScheduleScreen from '../screens/ScheduleScreen';
import GalleryScreen from '../screens/GalleryScreen';
import ChildrenListScreen from '../screens/ChildrenListScreen';
import AddChildScreen from '../screens/AddChildScreen';
import ChildDetailScreen from '../screens/ChildDetailScreen';
import PravnoScreen from '../screens/PravnoScreen';
import NotificationsScreen from '../screens/NotificationsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  // Admin kroz web panel moze da sakrije pojedine tabove. Paket i QR su
  // sustina aplikacije, pa se oni ne mogu iskljuciti.
  const { settings } = useSettings();

  return (
    <Tab.Navigator
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Pocetna', tabBarIconName: 'home-outline' }}
      />
      {isOn(settings.mobile_tab_menu) && (
        <Tab.Screen
          name="Menu"
          component={MenuScreen}
          options={{ title: 'Jelovnik', tabBarIconName: 'restaurant-outline' }}
        />
      )}
      <Tab.Screen name="Qr" component={QrScreen} options={{ title: 'QR' }} />
      {isOn(settings.mobile_tab_schedule) && (
        <Tab.Screen
          name="Schedule"
          component={ScheduleScreen}
          options={{ title: 'Raspored', tabBarIconName: 'calendar-outline' }}
        />
      )}
      {/* Galerija nije tab - zivi na pocetnoj, a puna se otvara iz stack-a. */}
      <Tab.Screen
        name="Package"
        component={PackageScreen}
        options={{ title: 'Moj paket', tabBarIconName: 'cube-outline' }}
      />
    </Tab.Navigator>
  );
}

// Ekrani van tabova nemaju tab traku, pa je strelica u zaglavlju jedini izlaz.
//
// Podrazumevanu strelicu crta sam navigator, ali je to gola bela strelica na
// banneru punom belih sara - stapa se sa podlogom i roditelji je ne vide, pa
// deluje kao da se sa ekrana ne moze nazad. Zato ovde stoji svoje dugme sa
// istom tamnom koprenom koju vec nose zvono na pocetnoj i odjava u paketu:
// isti jezik kroz celu aplikaciju i jasno se cita preko sare.
//
// Dugme radi i kada istorije nema (ekran otvoren direktno, obnovljeno stanje) -
// tada vraca na tabove, da korisnik ne ostane zarobljen.
// Izvezeno zbog testa: ponasanje (nazad vs. povratak na tabove) je ono sto
// je pucalo, a kroz ceo navigator bi se do njega stizalo tek posle navigacije.
export function BackButton({ navigation }) {
  return (
    <Pressable
      onPress={() =>
        navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Tabs')
      }
      hitSlop={12}
      style={styles.back}
      accessibilityRole="button"
      accessibilityLabel="Nazad"
    >
      <Ionicons name="chevron-back" size={22} color={colors.textOnPrimary} />
    </Pressable>
  );
}

function MainStack() {
  return (
    <Stack.Navigator
      screenOptions={({ navigation }) => ({
        // Zaglavlja ekrana van tabova nose istu podlogu kao baneri u tabovima,
        // pa sara ne prestaje cim se otvori Galerija ili Obavestenja.
        //
        // Boja NE sme da ide kroz headerStyle: native-stack uzima traku kao
        // providnu samo ako backgroundColor nije zadat, pa bi puna boja
        // prekrila podlogu i sara se ne bi videla. Boju daje sama podloga.
        headerBackground: () => <BannerBackground />,
        headerTintColor: colors.textOnPrimary,
        headerTitleStyle: { fontFamily: font.bold },
        headerBackTitle: 'Nazad',
        headerLeft: () => <BackButton navigation={navigation} />,
      })}
    >
      <Stack.Screen
        name="Tabs"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Obavestenja' }}
      />
      <Stack.Screen
        name="Gallery"
        component={GalleryScreen}
        options={{ title: 'Galerija' }}
      />
      <Stack.Screen
        name="Children"
        component={ChildrenListScreen}
        options={{ title: 'Moja deca' }}
      />
      <Stack.Screen
        name="AddChild"
        component={AddChildScreen}
        options={{ title: 'Dodaj dete' }}
      />
      {/* Uslovi i politika privatnosti su ekran u aplikaciji, ne adresa u
          pregledacu: citaju se i bez mreze, a roditelj ne ispada iz
          aplikacije. Naslov postavlja sam ekran, jer zavisi od jezika. */}
      <Stack.Screen name="Pravno" component={PravnoScreen} options={{ title: '' }} />
      <Stack.Screen
        name="ChildDetail"
        component={ChildDetailScreen}
        options={({ route }) => ({
          title: `${route.params.child.firstName} ${route.params.child.lastName}`,
        })}
      />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();

  // Ista podloga kao ekran za prijavu: kad provera zavrsi, forma se samo
  // pojavi preko nje umesto da beli spiner odskoci u amber ekran.
  //
  // Obe kapije (font u App.js i ova) broje od istog trenutka pokretanja, pa se
  // cekanja ne sabiraju.
  const bootProsao = useMinimalniBoot();

  if (loading || !bootProsao) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      {user ? <MainStack /> : <AuthStack />}
    </NavigationContainer>
  );
}

const styles = {
  // Isti kvadrat sa koprenom kao zvono na pocetnoj, samo manji jer zaglavlje
  // native-stack-a ima nizu traku od banera.
  back: {
    width: 34,
    height: 34,
    // Nativno zaglavlje samo uvlaci headerLeft od ivice; na webu ne, pa bi
    // dugme stajalo zalepljeno za levu ivicu ekrana.
    marginLeft: Platform.OS === 'web' ? spacing.lg : 0,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.onPrimaryVeil,
  },
};
