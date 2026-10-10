import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "../context/AppContext";
import { ActionButton, BottomSheetModal, Chip, DateField, EmptyState, Field, Screen, SelectField, styles, colors } from "../native/ui";
import { todayISO } from "../utils/helpers";
import { createPhysicalAssessment, getMetricTrend, PHYSICAL_METRICS } from "../utils/physicalAssessments";

const emptyResults = (metrics) => Object.fromEntries(metrics.map(({ key }) => [key, ""]));
const id = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const formatValue = (value, unit) => `${new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(value)} ${unit}`;

export default function PhysicalAssessmentsPage() {
  const { state, actions } = useApp();
  const metrics = state.settings?.assessmentMetrics ?? PHYSICAL_METRICS;
  const [athleteId, setAthleteId] = useState("");
  const [metricKey, setMetricKey] = useState(metrics[0]?.key ?? "");
  const [form, setForm] = useState(() => ({ date: todayISO(), ...emptyResults(metrics) }));
  const [error, setError] = useState("");
  const [progressVisible, setProgressVisible] = useState(false);
  const athletes = useMemo(() => [...state.athletes].sort((a, b) => a.name.localeCompare(b.name, "es-CL")), [state.athletes]);
  const athlete = athletes.find((item) => item.id === athleteId) ?? athletes[0];
  const metric = metrics.find((item) => item.key === metricKey) ?? metrics[0];
  const history = (state.assessments ?? []).filter((item) => item.athleteId === athlete?.id)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  const trend = metric ? getMetricTrend(history, metric) : null;
  const change = trend?.changePercent;
  const setField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  };
  const save = () => {
    if (!athlete) {
      setError("Agrega un atleta antes de registrar una evaluación.");
      return;
    }
    try {
      actions.addPhysicalAssessment(createPhysicalAssessment(athlete.id, form, id(), metrics));
      setForm((current) => ({ date: current.date, ...emptyResults(metrics) }));
      setError("");
    } catch (saveError) {
      setError(saveError.message);
    }
  };
  const remove = (assessment) => Alert.alert("Eliminar evaluación", "Este registro se eliminará de forma permanente.", [
    { text: "Cancelar", style: "cancel" },
    { text: "Eliminar", style: "destructive", onPress: () => actions.removePhysicalAssessment(assessment.id) },
  ]);

  return (
    <>
      <Screen eyebrow="Seguimiento deportivo" title="Evaluaciones físicas" subtitle="Registra mediciones y consulta el progreso individual">
        {athletes.length ? (
          <>
            <SelectField label="Atleta" value={athlete?.id ?? ""} onValueChange={setAthleteId} items={athletes.map((item) => ({ value: item.id, label: item.name }))} />
            <View style={styles.panel}>
              <Text style={styles.sectionTitle}>Registrar evaluación</Text>
              <DateField label="Fecha de evaluación" value={form.date} onChange={(date) => setField("date", date)} />
              {metrics.map((item) => (
                <Field key={item.key} label={`${item.label} · ${item.unit}${item.optional ? " · opcional" : " · obligatorio"}`}
                  value={form[item.key] ?? ""} onChangeText={(value) => setField(item.key, value)}
                  placeholder="Ingresa un valor" keyboardType="decimal-pad" />
              ))}
              {error ? <Text accessibilityRole="alert" style={{ color: colors.red }}>{error}</Text> : null}
              <ActionButton title="Guardar evaluación" onPress={save} />
            </View>
            <ActionButton title="Ver progreso de evaluación" secondary onPress={() => setProgressVisible(true)} />
          </>
        ) : <EmptyState>Agrega un atleta activo para registrar evaluaciones.</EmptyState>}
      </Screen>

      <BottomSheetModal visible={progressVisible} onRequestClose={() => setProgressVisible(false)} contentStyle={{ maxHeight: "94%" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.eyebrow}>Seguimiento deportivo</Text>
              <Text style={styles.modalTitle}>Progreso · {athlete?.name}</Text>
            </View>
            <Pressable onPress={() => setProgressVisible(false)} accessibilityRole="button" accessibilityLabel="Cerrar progreso" hitSlop={10}>
              <Ionicons name="close" size={25} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ gap: 13, paddingBottom: 8 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
              {metrics.map((item) => <Chip key={item.key} label={item.label} compact selected={metric?.key === item.key} onPress={() => setMetricKey(item.key)} />)}
            </ScrollView>
            {trend ? (
              <>
                <View style={styles.panel}>
                  <Text style={[styles.body, { fontWeight: "700" }]}>
                    Línea base: {formatValue(trend.baseline.results[metric.key], metric.unit)}
                  </Text>
                  <Text style={[styles.body, { fontWeight: "700" }]}>
                    Último resultado: {formatValue(trend.current.results[metric.key], metric.unit)}
                  </Text>
                  <Text style={[styles.small, { color: change == null ? colors.muted : trend.improved ? colors.green : colors.amber }]}>
                    {trend.history.length === 1 ? "Línea base" : change == null ? "Sin base de comparación" : `${trend.improved ? "Mejora" : Math.abs(change) < 0.01 ? "Sin cambio" : "Cambio"}${Math.abs(change) < 0.01 ? "" : ` ${Math.abs(change).toLocaleString("es-CL", { maximumFractionDigits: 1 })}%`}`}
                  </Text>
                </View>
                <View style={[styles.panel, { flexDirection: "row", alignItems: "flex-end", height: 145, gap: 5, paddingTop: 12 }]}>
                  {trend.history.slice(-10).map((entry) => {
                    const values = trend.history.map((item) => item.results[metric.key]);
                    const min = Math.min(...values);
                    const max = Math.max(...values);
                    const ratio = max === min ? 0.72 : (entry.results[metric.key] - min) / (max - min);
                    return <View key={entry.id} style={{ flex: 1, height: `${Math.max(18, 25 + ratio * 70)}%`, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: colors.accent, justifyContent: "flex-start", alignItems: "center" }}><Text numberOfLines={1} style={{ color: colors.ink, fontSize: 9, fontWeight: "700", paddingTop: 3 }}>{entry.results[metric.key]}</Text></View>;
                  })}
                </View>
                <Text style={styles.small}>{trend.history.length} medición(es) de {metric.label}</Text>
                <Text style={styles.sectionTitle}>Historial</Text>
                {history.map((item) => (
                  <View key={item.id} style={[styles.panel, { padding: 12 }]}>
                    <Text style={[styles.body, { fontWeight: "800" }]}>{new Date(`${item.date}T00:00:00`).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" })}</Text>
                    {metrics.filter((entry) => item.results?.[entry.key] != null).map((entry) => (
                      <Text key={entry.key} style={styles.small}>{entry.label}: {formatValue(item.results[entry.key], entry.unit)}</Text>
                    ))}
                    <ActionButton title="Eliminar registro" secondary destructive onPress={() => remove(item)} />
                  </View>
                ))}
              </>
            ) : <EmptyState>Este atleta todavía no tiene resultados físicos registrados.</EmptyState>}
          </ScrollView>
            <ActionButton title="Cerrar" secondary onPress={() => setProgressVisible(false)} />
      </BottomSheetModal>
    </>
  );
}
