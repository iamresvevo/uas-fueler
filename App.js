import { StyleSheet, View } from 'react-native';
import MainNavigation from './navigations/MainNavigation';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import FuelOUT from './modals/FuelOUT';
import { device_width } from './helpers/deviceDimensions';
import FuelIN from './modals/FuelIN';
import { ModalProvider } from './context/ModalContext';
import { AccountProvider, useAccount } from './context/AccountContext';
import FuelingHistory from './screens/FuelingHistory';
import Statistics from './screens/Statistics';
import LiveFueling from './screens/LiveFueling';
import SignIn from './screens/SignIn';
import FuelTransactionDetail from './modals/FuelTransactionDetail';
import BowserCheckup from './screens/BowserCheckup';
import BowserCheckHistory from './screens/BowserCheckHistory';
import BowserCheckDetail from './screens/BowserCheckDetail';
import { ThemeProvider, useAppTheme, useThemedStyles } from './context/ThemeContext';

const Stack = createNativeStackNavigator();

function AppContent() {
  const { colors, isDark } = useAppTheme();
  const { account, accountLoading } = useAccount();
  const navigationTheme = {
    ...DarkTheme,
    dark: isDark,
    colors: {
      ...DarkTheme.colors,
      primary: colors.accent,
      background: colors.dark,
      card: colors.darker,
      text: colors.white,
      border: colors.border,
      notification: colors.accent,
    },
  };

  // Wait for SecureStore restore before rendering anything
  if (accountLoading) {
    return <View style={{ flex: 1, backgroundColor: colors.dark }} />;
  }

  // Show SignIn screen if account is null
  if (!account) {
    return <SignIn />;
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        screenOptions={ ({ route }) => {

        let gestureEnabled = true;
        let presentation = 'card';
        let animation = 'default';

        switch(route.name){
            case "FuelIN":
            case "FuelOUT":
                presentation = 'card';
                animation = 'default';
                gestureEnabled = false;
            break;

        }
        
        
        return {
            gestureEnabled: gestureEnabled,
            presentation: presentation,
            animation: animation,
            headerShown: false,
            contentStyle: { backgroundColor: colors.dark },
            gestureResponseDistance: (device_width)
        }
      }}
    >
      <Stack.Screen name="Main" component={MainNavigation} />
      <Stack.Screen name="FuelOUT" component={FuelOUT} />
      <Stack.Screen name="FuelIN" component={FuelIN} />
      <Stack.Screen name="BowserCheckup" component={BowserCheckup} />
      <Stack.Screen name="BowserCheckHistory" component={BowserCheckHistory} />
      <Stack.Screen name="BowserCheckDetail" component={BowserCheckDetail} />
      <Stack.Screen name="FuelingHistory" component={FuelingHistory} />
      <Stack.Screen name="FuelTransactionDetail" component={FuelTransactionDetail} />
      <Stack.Screen name="Statistics" component={Statistics} />
      <Stack.Screen name="LiveFueling" component={LiveFueling} />
    </Stack.Navigator>
  </NavigationContainer>
  );
}

function ThemedApp() {
  const { styles } = useThemedStyles(createStyles);
  return (
    <SafeAreaProvider style={styles.container}>
      <View style={{ flex: 1 }}>
        <AccountProvider>
          <ModalProvider>
            <AppContent />
          </ModalProvider>
        </AccountProvider>
      </View>
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  screenContainer: {
    flex: 1,
    backgroundColor: colors.dark,
  },
});
