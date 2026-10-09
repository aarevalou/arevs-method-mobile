import { useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { AppProvider, useApp } from "./src/context/AppContext";
import DashboardPage from "./src/pages/DashboardPage";
import AthletesPage from "./src/pages/AthletesPage";
import AttendancePage from "./src/pages/AttendancePage";
import EvaluationsPage from "./src/pages/EvaluationsPage";
import { colors } from "./src/native/ui";

const Tabs = createBottomTabNavigator();
const ICONS = {
  Resumen: ["grid-outline", "grid"],
  Atletas: ["people-outline", "people"],
  Asistencias: ["calendar-outline", "calendar"],
  Evaluaciones: ["stats-chart-outline", "stats-chart"],
};

function LoadingScreen() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.accent} size="large" />
      <Text style={{ color: colors.muted, marginTop: 12 }}>Cargando datos</Text>
    </View>
  );
}

function AppTabs() {
  const { state, ready } = useApp();
  const [athletePaymentFilter, setAthletePaymentFilter] = useState("TODOS");
  const insets = useSafeAreaInsets();

  if (!ready) return <LoadingScreen />;

  return (
    <NavigationContainer theme={{ ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.background, card: colors.surface, border: colors.border, text: colors.text, primary: colors.accent } }}>
      <Tabs.Navigator
        initialRouteName="Resumen"
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarShowLabel: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: {
            height: 58 + insets.bottom,
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom, 8),
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          },
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={ICONS[route.name][focused ? 1 : 0]} size={24} color={color} />
          ),
          tabBarAccessibilityLabel: route.name,
        })}
      >
        <Tabs.Screen name="Resumen">
          {({ navigation }) => (
            <DashboardPage onViewPendingPayments={() => {
              setAthletePaymentFilter("PENDIENTE");
              navigation.navigate("Atletas");
            }} />
          )}
        </Tabs.Screen>
        <Tabs.Screen
          name="Atletas"
          children={() => (
            <AthletesPage
              paymentFilter={athletePaymentFilter}
              onPaymentFilterChange={setAthletePaymentFilter}
            />
          )}
        />
        <Tabs.Screen name="Asistencias" component={AttendancePage} />
        <Tabs.Screen name="Evaluaciones" component={EvaluationsPage} />
      </Tabs.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AppProvider>
        <AppTabs />
      </AppProvider>
    </SafeAreaProvider>
  );
}
