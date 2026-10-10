import { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "../context/AppContext";
import { ActionButton, BottomSheetModal, Chip, Field, Screen, SelectField, styles, colors } from "../native/ui";

const blankPlan = { label: "", billingType: "monthly", sessions: "8", frequency: "2 veces por semana", price: "" };
const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const idFromLabel = (label) => `${label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "") || "PLAN"}_${newId()}`;
const money = (value) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);

export default function SettingsPage() {
  const { state, actions, signOut } = useApp();
  const [planEditor, setPlanEditor] = useState(undefined);
  const [planForm, setPlanForm] = useState(blankPlan);
  const [metricDraft, setMetricDraft] = useState(() => (state.settings?.assessmentMetrics ?? []).map((metric) => ({ ...metric })));
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetText, setResetText] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");

  const openPlan = (id) => {
    setPlanEditor(id ?? null);
    setPlanForm(id ? { ...state.plans[id], sessions: String(state.plans[id].sessions), price: String(state.plans[id].price) } : { ...blankPlan, price: "" });
    setError("");
  };
  const savePlan = () => {
    const label = planForm.label.trim();
    const sessions = Number(planForm.sessions);
    const price = Number(planForm.price);
    if (!label || !Number.isInteger(sessions) || sessions < 1 || !Number.isInteger(price) || price < 1 ||
      (planForm.billingType === "monthly" && !planForm.frequency.trim())) {
      setError("Completa el nombre, sesiones, modalidad, frecuencia y precio con valores válidos.");
      return;
    }
    const planId = planEditor || idFromLabel(label);
    actions.savePlan(planId, {
      label, sessions, price, billingType: planForm.billingType,
      ...(planForm.billingType === "monthly" ? { frequency: planForm.frequency.trim() } : {}),
    });
    setPlanEditor(undefined);
  };
  const requestDeletePlan = (planId, plan) => {
    if (Object.keys(state.plans).length <= 1 || state.athletes.some((athlete) => athlete.plan === planId)) {
      Alert.alert("No se puede eliminar", "Debe quedar al menos un plan y ningún atleta debe estar usando este plan.");
      return;
    }
    Alert.alert("Eliminar plan", `¿Eliminar ${plan.label}?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: () => actions.deletePlan(planId) },
    ]);
  };
  const updateMetric = (key, field, value) => setMetricDraft((current) =>
    current.map((metric) => metric.key === key ? { ...metric, [field]: value } : metric));
  const addMetric = () => setMetricDraft((current) => [...current, {
    key: `custom_${newId()}`, label: "", unit: "cm", direction: "higher", optional: true,
  }]);
  const saveMetrics = () => {
    if (!metricDraft.length || metricDraft.some((metric) => !metric.label.trim() || !metric.unit.trim())) {
      setError("Debe quedar al menos una prueba y cada prueba necesita nombre y unidad.");
      return;
    }
    const labels = metricDraft.map((metric) => metric.label.trim().toLocaleLowerCase("es-CL"));
    if (new Set(labels).size !== labels.length) {
      setError("Cada prueba debe tener un nombre diferente.");
      return;
    }
    Alert.alert("Actualizar pruebas", "Al cambiar las pruebas configuradas, se eliminarán las evaluaciones anteriores.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Actualizar", style: "destructive", onPress: () => {
        actions.saveAssessmentMetrics(metricDraft.map((metric) => ({ ...metric, label: metric.label.trim(), unit: metric.unit.trim() })));
        setError("");
      } },
    ]);
  };
  const clearPayments = () => Alert.alert("Limpiar historial de pagos", "Se eliminarán las marcas y fechas de pago; los cobros aplicables quedarán pendientes.", [
    { text: "Cancelar", style: "cancel" },
    { text: "Limpiar pagos", style: "destructive", onPress: actions.clearPaymentHistory },
  ]);
  const executeReset = () => {
    if (resetText !== "eliminar") return;
    actions.resetAllData();
    setResetText("");
    setConfirmReset(false);
  };
  const logout = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } catch (logoutError) {
      setError(logoutError.message || "No se pudo cerrar la sesión.");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <>
      <Screen eyebrow="Preferencias y administración" title="Configuración" subtitle="Planes, pruebas físicas, apariencia y cuenta">
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Apariencia</Text>
          <Text style={styles.small}>Elige el tema que prefieres para la aplicación.</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Chip label="Oscuro" selected={(state.settings?.theme ?? "dark") === "dark"} onPress={() => actions.updateSettings({ theme: "dark" })} />
            <Chip label="Claro" selected={state.settings?.theme === "light"} onPress={() => actions.updateSettings({ theme: "light" })} />
          </View>
        </View>

        <View style={styles.panel}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={styles.sectionTitle}>Planes de entrenamiento</Text>
            <Pressable onPress={() => openPlan(null)} accessibilityRole="button" accessibilityLabel="Agregar plan"><Ionicons name="add-circle-outline" size={25} color={colors.accent} /></Pressable>
          </View>
          {Object.entries(state.plans).map(([id, plan]) => (
            <View key={id} style={[styles.row, { justifyContent: "space-between" }]}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[styles.body, { fontWeight: "700" }]}>{plan.label}</Text>
                <Text style={styles.small}>{plan.sessions} sesiones · {plan.billingType === "monthly" ? `${plan.frequency ?? "Mensual"} · mensual` : "por sesión"} · {money(plan.price)}</Text>
              </View>
              <Pressable onPress={() => openPlan(id)} accessibilityRole="button" accessibilityLabel={`Editar plan ${plan.label}`} hitSlop={8}><Ionicons name="create-outline" size={21} color={colors.accent} /></Pressable>
              <Pressable onPress={() => requestDeletePlan(id, plan)} accessibilityRole="button" accessibilityLabel={`Eliminar plan ${plan.label}`} hitSlop={8}><Ionicons name="trash-outline" size={21} color={colors.red} /></Pressable>
            </View>
          ))}
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Pruebas de evaluación física</Text>
          <Text style={styles.small}>Las mediciones existentes se eliminan al guardar cambios en esta lista.</Text>
          {metricDraft.map((metric) => (
            <View key={metric.key} style={[styles.panel, { padding: 11 }]}>
              <Field label="Nombre de la prueba" value={metric.label} onChangeText={(value) => updateMetric(metric.key, "label", value)} placeholder="Ej. Salto vertical" />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Field label="Unidad" value={metric.unit} onChangeText={(value) => updateMetric(metric.key, "unit", value)} placeholder="cm" style={{ flex: 1 }} />
                <SelectField label="Mejora cuando…" value={metric.direction} onValueChange={(value) => updateMetric(metric.key, "direction", value)} items={[{ value: "higher", label: "Aumenta" }, { value: "lower", label: "Disminuye" }]} style={{ flex: 1 }} />
              </View>
              <View style={[styles.row, { justifyContent: "space-between" }]}>
                <Text style={styles.body}>Resultado obligatorio</Text>
                <Switch value={!metric.optional} onValueChange={(value) => updateMetric(metric.key, "optional", !value)} trackColor={{ true: colors.accent }} thumbColor={colors.text} />
                <Pressable onPress={() => setMetricDraft((current) => current.filter((item) => item.key !== metric.key))} accessibilityRole="button" accessibilityLabel="Eliminar prueba"><Ionicons name="trash-outline" size={21} color={colors.red} /></Pressable>
              </View>
            </View>
          ))}
          <ActionButton title="＋ Agregar prueba" secondary onPress={addMetric} />
          <ActionButton title="Guardar pruebas" onPress={saveMetrics} />
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Datos y cuenta</Text>
          <ActionButton title="Limpiar historial de pagos" secondary destructive onPress={clearPayments} />
          <ActionButton title={signingOut ? "Cerrando sesión…" : "Cerrar sesión"} secondary onPress={logout} disabled={signingOut} />
          <ActionButton title="Eliminar todos los datos…" secondary destructive onPress={() => setConfirmReset(true)} />
          <Text style={styles.small}>La eliminación afecta todos los datos sincronizados con esta cuenta.</Text>
        </View>
        {error ? <Text accessibilityRole="alert" style={{ color: colors.red }}>{error}</Text> : null}
      </Screen>

      <BottomSheetModal visible={planEditor !== undefined} onRequestClose={() => setPlanEditor(undefined)}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={styles.modalTitle}>{planEditor ? "Editar plan" : "Nuevo plan"}</Text>
              <Pressable onPress={() => setPlanEditor(undefined)} accessibilityLabel="Cerrar"><Ionicons name="close" size={24} color={colors.muted} /></Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12 }}>
              <Field label="Nombre del plan" value={planForm.label} onChangeText={(value) => setPlanForm((current) => ({ ...current, label: value }))} />
              <SelectField label="Modalidad de cobro" value={planForm.billingType} onValueChange={(value) => setPlanForm((current) => ({ ...current, billingType: value }))} items={[{ value: "monthly", label: "Mensual" }, { value: "per_session", label: "Por sesión" }]} />
              <Field label="Cantidad de sesiones" value={planForm.sessions} onChangeText={(value) => setPlanForm((current) => ({ ...current, sessions: value }))} keyboardType="number-pad" />
              {planForm.billingType === "monthly" ? <Field label="Frecuencia semanal" value={planForm.frequency} onChangeText={(value) => setPlanForm((current) => ({ ...current, frequency: value }))} placeholder="Ej. 2 veces por semana" /> : null}
              <Field label="Precio en CLP" value={planForm.price} onChangeText={(value) => setPlanForm((current) => ({ ...current, price: value }))} keyboardType="number-pad" />
              {error ? <Text accessibilityRole="alert" style={{ color: colors.red }}>{error}</Text> : null}
            </ScrollView>
            <View style={{ flexDirection: "row", gap: 9 }}>
              <ActionButton title="Cancelar" secondary onPress={() => setPlanEditor(undefined)} style={{ flex: 1 }} />
              <ActionButton title="Guardar plan" onPress={savePlan} style={{ flex: 1 }} />
            </View>
      </BottomSheetModal>

      <Modal visible={confirmReset} transparent animationType="fade" onRequestClose={() => setConfirmReset(false)}>
        <View style={[styles.modalShade, { justifyContent: "center", padding: 18 }]}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Eliminar todos los datos</Text>
            <Text style={styles.small}>Esta acción no se puede deshacer. Escribe <Text style={{ color: colors.red, fontWeight: "800" }}>eliminar</Text> para confirmar.</Text>
            <Field label="Confirmación" value={resetText} onChangeText={setResetText} autoCapitalize="none" />
            <View style={{ flexDirection: "row", gap: 9 }}>
              <ActionButton title="Cancelar" secondary onPress={() => { setConfirmReset(false); setResetText(""); }} style={{ flex: 1 }} />
              <ActionButton title="Eliminar todo" destructive onPress={executeReset} disabled={resetText !== "eliminar"} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
