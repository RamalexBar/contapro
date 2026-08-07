import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { DashboardScreen } from "../screens/dashboard/DashboardScreen";
import { POSScreen } from "../screens/pos/POSScreen";
import { CashScreen } from "../screens/cash/CashScreen";
import { InventoryScreen } from "../screens/inventory/InventoryScreen";
import { refreshAccessToken } from "../lib/api-client";
import { useAuthStore } from "../store/useAuthStore";

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  POS: undefined;
  Caja: undefined;
  Inventario: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

/** Item 42 de docs/ALCANCE.md: pasar de 2 a 4 pantallas de primer nivel amerita tabs en vez del
 * stack plano anterior. Login se queda como pantalla de stack pre-autenticacion. */
function MainTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="POS" component={POSScreen} options={{ title: "Punto de venta" }} />
      <Tab.Screen name="Caja" component={CashScreen} />
      <Tab.Screen name="Inventario" component={InventoryScreen} />
    </Tab.Navigator>
  );
}

/**
 * Mientras el store de auth persistido (AsyncStorage) todavia no termino de leerse en disco, no
 * se puede decidir si arrancar en Login o en Dashboard sin parpadear a Login primero. Una vez
 * hidratado, si hay refreshToken guardado se intenta refrescar el accessToken de una vez (una
 * sesion persistida de hace rato casi siempre tiene el accessToken vencido, dura 15 min) antes de
 * navegar -- si el refresh falla (refresh token tambien vencido/revocado), clearSession ya se
 * disparo dentro de refreshAccessToken y se manda a Login.
 */
export function RootNavigator() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!refreshToken) {
      setCheckingSession(false);
      return;
    }
    // Solo se ejecuta una vez, cuando termina de hidratarse (no en cada cambio de accessToken,
    // que refreshAccessToken() mismo dispara al renovar la sesion -- por eso no esta en deps).
    refreshAccessToken().finally(() => setCheckingSession(false));
  }, [hasHydrated]);

  if (!hasHydrated || checkingSession) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const isLoggedIn = Boolean(accessToken);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={isLoggedIn ? "Main" : "Login"}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Main" component={MainTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
