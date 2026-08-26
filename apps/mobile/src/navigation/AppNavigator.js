import { ActivityIndicator, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { isOn, useSettings } from '../context/SettingsContext';
import { font } from '../theme';
import { useTheme } from '../context/ThemeContext';
import TabBar from '../components/TabBar';
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

// Ekrani van tabova nemaju tab traku, pa je strelica u zaglavlju jedini
// izlaz. Kada istorija postoji, strelicu crta sam navigator. Ako je nema
// (ekran otvoren direktno, obnovljeno stanje), korisnik bi ostao zarobljen -
// zato se tada ubacuje dugme koje vraca na tabove.
function escapeHatch(navigation, colors) {
  if (navigation.canGoBack()) return {};
  return {
    headerLeft: () => (
      <Pressable
        onPress={() => navigation.navigate('Tabs')}
        hitSlop={12}
        style={{ paddingRight: 18 }}
        accessibilityRole="button"
        accessibilityLabel="Nazad"
      >
        <Ionicons name="chevron-back" size={26} color={colors.textOnPrimary} />
      </Pressable>
    ),
  };
}

function MainStack() {
  const { colors } = useTheme();

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
        ...escapeHatch(navigation, colors),
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
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? <MainStack /> : <AuthStack />}
    </NavigationContainer>
  );
}

const styles = {
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
};
