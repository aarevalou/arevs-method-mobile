import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Modal, Pressable, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { AppProvider, useApp } from "./src/context/AppContext";
import DashboardPage from "./src/pages/DashboardPage";
import AthletesPage from "./src/pages/AthletesPage";
import AttendancePage from "./src/pages/AttendancePage";
import CircuitsPage from "./src/pages/CircuitsPage";
import PhysicalAssessmentsPage from "./src/pages/PhysicalAssessmentsPage";
import EvaluationsPage from "./src/pages/EvaluationsPage";
import SettingsPage from "./src/pages/SettingsPage";
import AuthPage from "./src/pages/AuthPage";
import { colors, setNativeTheme, styles } from "./src/native/ui";

const Tabs = createBottomTabNavigator();
const TAB_ICONS = {
  Resumen: ["grid-outline", "grid"],
  Atletas: ["people-outline", "people"],
  Asistencias: ["calendar-outline", "calendar"],
  Evaluaciones: ["fitness-outline", "fitness"],
};
const UTILITY_ROUTES = ["Circuitos", "Registro de rendimiento", "Configuración"];

function FullWidthTabBar({ state, descriptors, navigation, insets }) {
  const routes = state.routes.filter((route) => Boolean(TAB_ICONS[route.name]));
  const activeRoute = state.routes[state.index];
  if (UTILITY_ROUTES.includes(activeRoute.name)) return null;

  return (
    <View style={{
      width: "100%",
      minHeight: 58 + (insets?.bottom ?? 0),
      flexDirection: "row",
      alignItems: "stretch",
      paddingTop: 5,
      paddingBottom: Math.max(insets?.bottom ?? 0, 5),
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    }}>
      {routes.map((route) => {
        const focused = state.index === state.routes.findIndex((item) => item.key === route.key);
        const options = descriptors[route.key].options;
        const color = focused ? colors.accent : colors.muted;
        const label = typeof options.tabBarLabel === "string"
          ? options.tabBarLabel
          : typeof options.title === "string" ? options.title : route.name;
        const onPress = () => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };
        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
            testID={options.tabBarButtonTestID}
            style={({ pressed }) => [{
              flex: 1,
              minWidth: 0,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 2,
              gap: 2,
            }, pressed && { opacity: 0.72 }]}
          >
            {options.tabBarIcon?.({ focused, color, size: 21 })}
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ color, fontSize: 10, lineHeight: 14, fontWeight: focused ? "800" : "600" }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function LoadingScreen({ label = "Cargando datos" }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.accent} size="large" />
      <Text style={{ color: colors.muted, marginTop: 12 }}>{label}</Text>
    </View>
  );
}

function LoadErrorScreen() {
  const { loadError, retryLoading, signOut } = useApp();
  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 22, backgroundColor: colors.background, gap: 14 }}>
      <Text style={[styles.title, { fontSize: 23 }]}>No se pudieron cargar los datos</Text>
      <Text accessibilityRole="alert" style={[styles.body, { color: colors.red }]}>{loadError}</Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <ActionRetry onPress={retryLoading} />
        <Pressable onPress={signOut} style={[styles.secondaryButton, { flex: 1 }]}><Text style={styles.secondaryButtonText}>Cerrar sesión</Text></Pressable>
      </View>
    </View>
  );
}

function ActionRetry({ onPress }) {
  return <Pressable onPress={onPress} style={[styles.button, { flex: 1 }]}><Text style={styles.buttonText}>Reintentar</Text></Pressable>;
}

function AppHeader({ navigation, route }) {
  const { syncError, syncing, retrySaving } = useApp();
  const insets = useSafeAreaInsets();
  const isUtilityRoute = UTILITY_ROUTES.includes(route.name);
  const [menuVisible, setMenuVisible] = useState(false);
  const slide = useRef(new Animated.Value(360)).current;
  const shade = useRef(new Animated.Value(0)).current;
  const closeAndNavigate = (screen) => {
    Animated.parallel([
      Animated.timing(slide, { toValue: 360, duration: 210, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(shade, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setMenuVisible(false);
      navigation.navigate(screen);
    });
  };
  const closeMenu = () => {
    Animated.parallel([
      Animated.timing(slide, { toValue: 360, duration: 210, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(shade, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setMenuVisible(false));
  };
  const openMenu = () => {
    slide.setValue(360);
    shade.setValue(0);
    setMenuVisible(true);
    requestAnimationFrame(() => Animated.parallel([
      Animated.timing(slide, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(shade, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start());
  };
  return (
    <>
      <View style={{ minHeight: 56 + insets.top, paddingTop: insets.top, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        {isUtilityRoute ? (
          <Pressable onPress={() => navigation.navigate("Resumen")} accessibilityRole="button" accessibilityLabel="Volver al menú principal" hitSlop={9} style={({ pressed }) => [{ width: 38, height: 40, alignItems: "center", justifyContent: "center" }, pressed && { opacity: 0.72 }]}>
            <Ionicons name="arrow-back" size={23} color={colors.text} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1} style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>{route.name}</Text>
          {syncError || syncing ? <Text numberOfLines={1} style={{ color: syncError ? colors.red : colors.muted, fontSize: 10 }}>
            {syncError ? "Error al sincronizar · toca para reintentar" : "Guardando en Supabase…"}
          </Text> : null}
        </View>
        {syncError ? <Pressable onPress={retrySaving} accessibilityRole="button" accessibilityLabel="Reintentar sincronización"><Ionicons name="refresh" size={21} color={colors.red} /></Pressable> : null}
        {!isUtilityRoute ? (
          <Pressable onPress={openMenu} accessibilityRole="button" accessibilityLabel="Abrir menú" hitSlop={9} style={({ pressed }) => [{ width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.border }, pressed && { opacity: 0.72 }]}>
            <Ionicons name="menu" size={24} color={colors.text} />
          </Pressable>
        ) : null}
      </View>
      <Modal visible={menuVisible} transparent animationType="none" onRequestClose={closeMenu}>
        <View style={{ flex: 1, flexDirection: "row", justifyContent: "flex-end", paddingTop: Math.max(10, insets.top + 10), paddingBottom: Math.max(10, insets.bottom + 10), paddingRight: 10 }}>
          <Animated.View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "#000", opacity: shade }}>
            <Pressable onPress={closeMenu} style={{ flex: 1 }} accessibilityLabel="Cerrar menú" />
          </Animated.View>
          <Animated.View style={{ width: "82%", maxWidth: 340, backgroundColor: colors.background, paddingTop: 24, paddingHorizontal: 18, paddingBottom: 18, gap: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 24, shadowColor: "#000", shadowOpacity: 0.38, shadowRadius: 18, shadowOffset: { width: -5, height: 0 }, elevation: 14, transform: [{ translateX: slide }] }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10, paddingBottom: 8 }}>
              <View style={{ gap: 5 }}>
                <Text style={styles.eyebrow}>AREVS METHOD</Text>
                <Text style={styles.sectionTitle}>Menú de gestión</Text>
              </View>
              <Pressable onPress={closeMenu} accessibilityRole="button" accessibilityLabel="Cerrar menú" hitSlop={8} style={({ pressed }) => [{ width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, pressed && { opacity: 0.72 }]}>
                <Ionicons name="close" size={20} color={colors.muted} />
              </Pressable>
            </View>
            <Text style={styles.eyebrow}>SECCIONES</Text>
            {[
              ["Circuitos", "git-network-outline"],
              ["Registro de rendimiento", "stats-chart-outline"],
              ["Configuración", "settings-outline"],
            ].map(([screen, icon]) => (
              <Pressable key={screen} onPress={() => closeAndNavigate(screen)} accessibilityRole="button" style={({ pressed }) => [{ minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, borderRadius: 8, backgroundColor: colors.surface }, pressed && { opacity: 0.72 }]}>
                <Ionicons name={icon} size={20} color={colors.accent} />
                <Text style={styles.body}>{screen}</Text>
              </Pressable>
            ))}
            <Pressable onPress={closeMenu} style={{ marginTop: "auto", alignSelf: "flex-start", padding: 8 }}><Text style={styles.small}>Cerrar menú</Text></Pressable>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

function MainNavigation() {
  const { state, ready, syncError, retrySaving, loadError, retryLoading, signOut } = useApp();
  const [athletePaymentFilter, setAthletePaymentFilter] = useState("TODOS");
  const insets = useSafeAreaInsets();

  const [, setThemeApplied] = useState(0);
  useEffect(() => {
    const nextTheme = state.settings?.theme === "light" ? "light" : "dark";
    setNativeTheme(nextTheme);
    setThemeApplied((current) => current + 1);
  }, [state.settings?.theme]);

  if (!ready) return <LoadingScreen />;
  if (loadError) return <LoadErrorScreen loadError={loadError} retryLoading={retryLoading} signOut={signOut} />;

  const navTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: colors.background,
      card: colors.surface,
      border: colors.border,
      text: colors.text,
      primary: colors.accent,
    },
  };
  return (
    <>
      <NavigationContainer theme={navTheme}>
        <Tabs.Navigator
          initialRouteName="Resumen"
          screenOptions={({ route, navigation }) => ({
            headerShown: true,
            header: () => <AppHeader navigation={navigation} route={route} />,
            tabBarStyle: UTILITY_ROUTES.includes(route.name) ? { display: "none" } : undefined,
            tabBarIcon: ({ focused, color }) => {
              const names = TAB_ICONS[route.name];
              return names ? <Ionicons name={names[focused ? 1 : 0]} size={21} color={color} /> : null;
            },
          })}
          tabBar={(props) => <FullWidthTabBar {...props} insets={insets} />}
        >
          <Tabs.Screen name="Resumen">
            {({ navigation }) => <DashboardPage onViewPendingPayments={() => {
              setAthletePaymentFilter("PENDIENTE");
              navigation.navigate("Atletas");
            }} />}
          </Tabs.Screen>
          <Tabs.Screen name="Atletas">
            {() => <AthletesPage paymentFilter={athletePaymentFilter} onPaymentFilterChange={setAthletePaymentFilter} />}
          </Tabs.Screen>
          <Tabs.Screen name="Asistencias" component={AttendancePage} />
          <Tabs.Screen name="Evaluaciones" component={PhysicalAssessmentsPage} />
          <Tabs.Screen name="Circuitos" component={CircuitsPage} options={{ tabBarButton: () => null }} />
          <Tabs.Screen name="Registro de rendimiento" component={EvaluationsPage} options={{ tabBarButton: () => null }} />
          <Tabs.Screen name="Configuración" component={SettingsPage} options={{ tabBarButton: () => null }} />
        </Tabs.Navigator>
      </NavigationContainer>
      {syncError ? (
        <Pressable onPress={retrySaving} accessibilityRole="button" style={{ paddingHorizontal: 14, paddingVertical: 9, backgroundColor: "#512b28", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text numberOfLines={2} style={{ color: "#fff", flex: 1, fontSize: 12 }}>{syncError}</Text>
          <Text style={{ color: "#fff", fontWeight: "800", marginLeft: 10 }}>Reintentar</Text>
        </Pressable>
      ) : null}
    </>
  );
}

function AppGate() {
  const { authReady, authConfigured, user, ready, loadError, state } = useApp();
  let content;
  if (!authReady) content = <LoadingScreen label="Conectando con Supabase…" />;
  else if (!authConfigured || !user) content = <AuthPage />;
  else if (!ready && loadError) content = <LoadErrorScreen />;
  else content = <MainNavigation />;
  return (
    <>
      <StatusBar style={state.settings?.theme === "light" ? "dark" : "light"} />
      {content}
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <AppGate />
      </AppProvider>
    </SafeAreaProvider>
  );
}
