import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useApp } from "../context/AppContext";
import { Chip, DateField, EmptyState, Screen, styles, colors } from "../native/ui";
import { ATTENDANCE, BLOCKS } from "../utils/constants";
import { isActive, todayISO } from "../utils/helpers";

const BLOCK_LABELS = { AM: "Mañana", PM: "Tarde", RECUPERACION: "Recuperación", DOMICILIO: "Domicilio" };
const STATUS_COLOR = { PRESENTE: colors.green, AUSENTE_CON_AVISO: colors.amber, AUSENTE_SIN_AVISO: colors.red };
const STATUS_LABEL = { PRESENTE: "Presente", AUSENTE_CON_AVISO: "Aviso 24h", AUSENTE_SIN_AVISO: "Sin aviso" };

export default function AttendancePage() {
  const { state, actions } = useApp();
  const [date, setDate] = useState(todayISO());
  const [block, setBlock] = useState("AM");
  const active = state.athletes.filter(isActive);
  const getStatus = (athleteId) => state.sessions.find((session) => session.athleteId === athleteId && session.date === date && session.block === block)?.status;
  const mark = (athleteId, status) => actions.markAttendance({ athleteId, date, block, status });

  return (
    <Screen eyebrow="Control de entrenamiento" title="Asistencias" subtitle="Registra presencia y administra las clases del plan">
      <View style={styles.panel}>
        <DateField label="Fecha" value={date} onChange={setDate} />
        <Text style={styles.fieldLabel}>Bloque</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {BLOCKS.map((item) => <Chip key={item} label={BLOCK_LABELS[item]} compact selected={block === item} onPress={() => setBlock(item)} />)}
        </View>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Text style={styles.sectionTitle}>Lista de atletas</Text>
        <Text style={styles.small}>{active.length} activos</Text>
      </View>
      {active.length ? active.map((athlete) => {
        const selectedStatus = getStatus(athlete.id);
        return (
          <View key={athlete.id} style={[styles.panel, { padding: 12, gap: 8 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ flex: 1, minWidth: 76, gap: 3 }}>
                <Text numberOfLines={2} style={[styles.body, { fontWeight: "800", fontSize: 13 }]}>{athlete.name}</Text>
                <Text style={[styles.small, { fontSize: 10 }]}>{athlete.remaining} clases</Text>
              </View>
              <View style={{ flex: 1.75, flexDirection: "row", gap: 3 }}>
                {Object.keys(ATTENDANCE).map((status) => {
                  const selected = selectedStatus === status;
                  const tone = STATUS_COLOR[status];
                  return (
                    <Pressable
                      key={status}
                      onPress={() => mark(athlete.id, status)}
                      accessibilityRole="button"
                      accessibilityLabel={`${athlete.name}: ${STATUS_LABEL[status]}`}
                      accessibilityState={{ selected }}
                      style={({ pressed }) => [{ flex: 1, minWidth: 0, height: 32, paddingHorizontal: 3, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: selected ? tone : colors.border, borderRadius: 6, backgroundColor: selected ? `${tone}24` : colors.surface }, pressed && { opacity: 0.72 }]}
                    >
                      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: selected ? tone : colors.muted, fontSize: 10, fontWeight: selected ? "800" : "600" }}>{STATUS_LABEL[status]}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            {selectedStatus ? <Text style={[styles.small, { fontSize: 11 }]}>{ATTENDANCE[selectedStatus].description}</Text> : null}
          </View>
        );
      }) : <EmptyState>No hay atletas activos. Agrégalos en la sección Atletas.</EmptyState>}
    </Screen>
  );
}
