import { useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";
import { useApp } from "../context/AppContext";
import { ActionButton, DateField, EmptyState, Field, Screen, SelectField, styles, colors } from "../native/ui";
import { isActive, todayISO, improvementVsFirst } from "../utils/helpers";

const BLANK = { date: todayISO(), circuit: "", laps: "", longJump: "", highJump: "", speed: "" };
const display = (value) => value ?? "—";

export default function EvaluationsPage() {
  const { state, actions } = useApp();
  const [athleteId, setAthleteId] = useState("");
  const [form, setForm] = useState(BLANK);
  const active = state.athletes.filter(isActive);
  const athleteOptions = [{ value: "", label: "Selecciona un atleta" }, ...active.map((athlete) => ({ value: athlete.id, label: athlete.name }))];
  const logs = useMemo(() => state.logs.filter((log) => log.athleteId === athleteId).sort((a, b) => a.date.localeCompare(b.date)), [state.logs, athleteId]);
  const firstSpeed = logs.find((log) => log.speed)?.speed;
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const save = () => {
    if (!athleteId) {
      Alert.alert("Selecciona un atleta", "Elige el atleta al que pertenece esta evaluación.");
      return;
    }
    actions.addEvaluation(athleteId, form);
    setForm((current) => ({ ...BLANK, date: todayISO(), circuit: current.circuit }));
  };
  const remove = (log) => Alert.alert("Eliminar evaluación", "Este registro se eliminará de forma permanente.", [
    { text: "Cancelar", style: "cancel" },
    { text: "Eliminar", style: "destructive", onPress: () => actions.removeEvaluation(log.id) },
  ]);

  return (
    <Screen eyebrow="Seguimiento de rendimiento" title="Evaluaciones" subtitle="Registra marcas y observa el progreso individual">
      {active.length ? <SelectField label="Atleta" value={athleteId} onValueChange={setAthleteId} items={athleteOptions} /> : <EmptyState>Agrega un atleta activo para registrar evaluaciones.</EmptyState>}
      {athleteId ? <>
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Nueva evaluación</Text>
          <DateField label="Fecha" value={form.date} onChange={(value) => update("date", value)} />
          <Field label="Circuito" value={form.circuit} onChangeText={(value) => update("circuit", value)} placeholder="Nombre o número" />
          <Field label="Vueltas · segundos separados por espacio" value={form.laps} onChangeText={(value) => update("laps", value)} placeholder="12,4 11,9 11,7" keyboardType="decimal-pad" />
          <View style={{ flexDirection: "row", gap: 9 }}>
            <Field label="Salto largo · cm" value={form.longJump} onChangeText={(value) => update("longJump", value)} placeholder="0" keyboardType="decimal-pad" />
            <Field label="Salto alto · cm" value={form.highJump} onChangeText={(value) => update("highJump", value)} placeholder="0" keyboardType="decimal-pad" />
          </View>
          <Field label="Velocidad · segundos" value={form.speed} onChangeText={(value) => update("speed", value)} placeholder="0,0" keyboardType="decimal-pad" />
          <ActionButton title="Guardar evaluación" onPress={save} />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <Text style={styles.sectionTitle}>Historial</Text>
          <Text style={styles.small}>{logs.length} registros</Text>
        </View>
        {logs.length ? [...logs].reverse().map((log) => {
          const delta = improvementVsFirst(firstSpeed, log.speed);
          return (
            <View key={log.id} style={styles.panel}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <View style={{ flex: 1, gap: 3 }}><Text style={[styles.body, { fontWeight: "800" }]}>{log.circuit || "Evaluación"}</Text><Text style={styles.small}>{log.date}</Text></View>
                <Text style={{ color: delta > 0 ? colors.green : delta < 0 ? colors.red : colors.muted, fontSize: 13, fontWeight: "800" }}>{delta === null ? "—" : `${delta.toFixed(1)}%`}</Text>
              </View>
              <View style={styles.separator} />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                <Text style={styles.small}>Mejor vuelta {display(log.best)} s</Text>
                <Text style={styles.small}>· Largo {display(log.longJump)} cm</Text>
                <Text style={styles.small}>· Alto {display(log.highJump)} cm</Text>
                <Text style={styles.small}>· Velocidad {display(log.speed)} s</Text>
              </View>
              <Text style={styles.small}>{log.laps?.length ? `Vueltas: ${log.laps.join(" / ")}` : "Sin tiempos de vuelta"}</Text>
              <ActionButton title="Eliminar registro" secondary destructive onPress={() => remove(log)} />
            </View>
          );
        }) : <EmptyState>Este atleta aún no tiene evaluaciones.</EmptyState>}
      </> : null}
    </Screen>
  );
}
