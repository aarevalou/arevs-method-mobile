import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { useApp } from "../context/AppContext";
import { ActionButton, Field, styles, colors } from "../native/ui";

export default function AuthPage() {
  const { authConfigured, authReady, loadError, signIn } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (signInError) {
      setError(signInError.message || "No se pudo iniciar sesión.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", padding: 22 }}
    >
      <View style={[styles.panel, { padding: 22 }]}>
        <Text style={styles.eyebrow}>Gestión de entrenamiento</Text>
        <Text style={[styles.title, { marginTop: 4 }]}>Arevs Method</Text>
        {!authReady ? (
          <View style={{ alignItems: "center", gap: 12, paddingVertical: 22 }}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.small}>Conectando con Supabase…</Text>
          </View>
        ) : !authConfigured ? (
          <View style={{ gap: 10 }}>
            <Text style={[styles.body, { color: colors.red, fontWeight: "700" }]}>Falta configurar Supabase</Text>
            <Text style={styles.small}>Para desarrollo local, define EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY en .env y reinicia Expo. Para generar un APK con EAS, agrega ambas variables al entorno EAS del perfil de compilación.</Text>
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            <Text style={styles.small}>Inicia sesión con la cuenta administradora.</Text>
            <Field label="Correo electrónico" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" />
            <Field label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
            {error || loadError ? <Text accessibilityRole="alert" style={{ color: colors.red, lineHeight: 20 }}>{error || loadError}</Text> : null}
            <ActionButton title={busy ? "Conectando…" : "Iniciar sesión"} onPress={submit} disabled={busy || !email.trim() || !password} />
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
