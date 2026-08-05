import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { colors, font } from '../theme';
import TabBar from '../components/TabBar';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import MenuScreen from '../screens/MenuScreen';
import QrScreen from '../screens/QrScreen';
import ScheduleScreen from '../screens/ScheduleScreen';
import GalleryScreen from '../screens/GalleryScreen';
import ChildrenListScreen from '../screens/ChildrenListScreen';
import AddChildScreen from '../screens/AddChildScreen';
import ChildDetailScreen from '../screens/ChildDetailScreen';

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
  return (
    <Tab.Navigator
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen
        name="Package"
        component={HomeScreen}
        options={{ title: 'Moj paket', tabBarIconName: 'cube-outline' }}
      />
      <Tab.Screen
        name="Menu"
        component={MenuScreen}
        options={{ title: 'Jelovnik', tabBarIconName: 'restaurant-outline' }}
      />
      <Tab.Screen name="Qr" component={QrScreen} options={{ title: 'QR' }} />
      <Tab.Screen
        name="Schedule"
        component={ScheduleScreen}
        options={{ title: 'Raspored', tabBarIconName: 'calendar-outline' }}
      />
      <Tab.Screen
        name="Gallery"
        component={GalleryScreen}
        options={{ title: 'Galerija', tabBarIconName: 'image-outline' }}
      />
    </Tab.Navigator>
  );
}

function MainStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.textOnPrimary,
        headerTitleStyle: { fontFamily: font.bold },
      }}
    >
      <Stack.Screen
        name="Tabs"
        component={MainTabs}
        options={{ headerShown: false }}
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

  if (loading) {
    return (
      <View style={styles.loading}>
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
    backgroundColor: colors.bg,
  },
};
