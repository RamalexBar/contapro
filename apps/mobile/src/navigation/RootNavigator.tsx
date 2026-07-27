import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { DashboardScreen } from "../screens/dashboard/DashboardScreen";
import { POSScreen } from "../screens/pos/POSScreen";

export type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  POS: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: "Dashboard" }} />
        <Stack.Screen name="POS" component={POSScreen} options={{ title: "Punto de venta" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
