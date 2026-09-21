import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
} from '@expo-google-fonts/montserrat';
import { AuthProvider } from './src/context/AuthContext';
import { SettingsProvider } from './src/context/SettingsContext';
import { ClosedDaysProvider } from './src/context/ClosedDaysContext';
import AppNavigator from './src/navigation/AppNavigator';
import LoadingScreen from './src/components/LoadingScreen';
import { useMinimalniBoot } from './src/hooks/useUcitavanje';

export default function App() {
  const [loaded, error] = useFonts({
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
  });

  // Font se ceka da se ne bi videla promena tipografije posle prvog rendera,
  // a `bootProsao` drzi ekran ucitavanja dovoljno dugo da se uopste vidi.
  const bootProsao = useMinimalniBoot();

  if ((!loaded && !error) || !bootProsao) {
    return <LoadingScreen />;
  }

  return (
    <SettingsProvider>
      <ClosedDaysProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <AppNavigator />
        </AuthProvider>
      </ClosedDaysProvider>
    </SettingsProvider>
  );
}
