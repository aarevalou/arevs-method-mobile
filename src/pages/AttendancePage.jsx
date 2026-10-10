import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "../context/AppContext";
import { ActionButton, BottomSheetModal, Chip, DateField, EmptyState, Field, Screen, styles, colors } from "../native/ui";
import { ATTENDANCE, SESSION_TYPES } from "../utils/constants";
import { isActive, schedulePeriod, scheduleSessionType, scheduleSlotKey, scheduleStartTime, todayISO } from "../utils/helpers";

const NO_SCHEDULE = "UNSCHEDULED";
const statusColor = { PRESENTE: colors.green, AUSENTE_CON_AVISO: colors.amber, AUSENTE_SIN_AVISO: colors.red };
const startAt = (date, schedule) => {
  const time = scheduleStartTime(schedule);
  if (!time) return "";
  const value = new Date(`${date}T${time}:00`);
  return Number.isFinite(value.getTime()) ? value.toISOString() : "";
};

export default function AttendancePage() {
  const { state, actions } = useApp();
  const [date, setDate] = useState(todayISO());
  const [period, setPeriod] = useState("AM");
  const [sessionType, setSessionType] = useState("NORMAL");
  const [slotKey, setSlotKey] = useState("");
  const [editor, setEditor] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const active = state.athletes.filter(isActive);
  const slots = useMemo(() => {
    const seen = new Map();
    state.schedules.filter((item) => item.date === date && scheduleSlotKey(item))
      .forEach((item) => {
        const key = scheduleSlotKey(item);
        seen.set(key, {
          key, period: schedulePeriod(item), type: scheduleSessionType(item),
          time: item.time || `${item.startTime} – ${item.endTime || "sin término"}`,
          start: scheduleStartTime(item),
        });
      });
    return [...seen.values()].filter((item) => item.period === period && item.type === sessionType)
      .sort((a, b) => a.start.localeCompare(b.start));
  }, [state.schedules, date, period, sessionType]);
  const selectedSlot = slots.find((item) => item.key === slotKey) ?? (slotKey === "" ? slots[0] : null);
  const noScheduleSelected = slotKey === NO_SCHEDULE || (!slotKey && slots.length === 0);
  const hasSchedule = (athlete) => state.schedules.some((item) => item.athleteId === athlete.id &&
    item.date === date && schedulePeriod(item) === period && scheduleSessionType(item) === sessionType && scheduleSlotKey(item));
  const visibleAthletes = selectedSlot
    ? active.filter((athlete) => state.schedules.some((item) => item.athleteId === athlete.id &&
      item.date === date && schedulePeriod(item) === period && scheduleSessionType(item) === sessionType &&
      scheduleSlotKey(item) === selectedSlot.key))
    : noScheduleSelected ? active.filter((athlete) => !hasSchedule(athlete)) : [];
  const sessionFor = (athlete) => state.sessions.find((item) => item.athleteId === athlete.id &&
    item.date === date && schedulePeriod(item) === period && scheduleSessionType(item) === sessionType);
  const scheduleFor = (athlete) => state.schedules.find((item) => item.athleteId === athlete.id &&
    item.date === date && item.block === period && scheduleSessionType(item) === sessionType &&
    (selectedSlot ? scheduleSlotKey(item) === selectedSlot.key : !scheduleSlotKey(item))) ?? {};

  const openSchedule = (athlete) => {
    const schedule = state.schedules.find((item) => item.athleteId === athlete.id && item.date === date &&
      schedulePeriod(item) === period && scheduleSessionType(item) === sessionType) ?? {};
    const perSession = state.plans[athlete.plan]?.billingType === "per_session";
    setEditor({
      athleteId: athlete.id,
      athleteName: athlete.name,
      scheduleId: schedule.id,
      perSession,
      time: schedule.time ?? "",
      startTime: schedule.startTime ?? "",
      endTime: schedule.endTime ?? "",
    });
    setError("");
  };
  const saveSchedule = () => {
    if (!editor) return;
    const hasAnyTime = editor.perSession ? Boolean(editor.time) : Boolean(editor.startTime || editor.endTime);
    if (hasAnyTime && (editor.perSession ? !editor.time : (!editor.startTime || !editor.endTime))) {
      setError("Completa el horario antes de guardarlo.");
      return;
    }
    const enteredTimes = editor.perSession ? [editor.time] : [editor.startTime, editor.endTime];
    if (hasAnyTime && enteredTimes.some((time) => !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))) {
      setError("Ingresa las horas en formato válido HH:MM.");
      return;
    }
    actions.saveAttendanceSchedule({
      athleteId: editor.athleteId, scheduleId: editor.scheduleId, date, block: period, sessionType,
      ...(editor.perSession ? { time: editor.time } : { startTime: editor.startTime, endTime: editor.endTime }),
    });
    if (hasAnyTime) {
      const saved = editor.perSession ? { block: period, sessionType, time: editor.time } :
        { block: period, sessionType, startTime: editor.startTime, endTime: editor.endTime };
      setSlotKey(scheduleSlotKey(saved));
    } else setSlotKey(NO_SCHEDULE);
    setEditor(null);
    setError("");
  };
  const mark = (athlete, status) => {
    if (!selectedSlot) {
      setError("Define primero el horario del atleta.");
      return;
    }
    const schedule = scheduleFor(athlete);
    const scheduledStartAt = startAt(date, schedule);
    if (status !== "PRESENTE" && !scheduledStartAt) {
      setError("Guarda el horario del atleta antes de registrar una inasistencia.");
      openSchedule(athlete);
      return;
    }
    if (sessionType === "RECUPERACION" && status === "PRESENTE" && (athlete.recoveryCredits ?? 0) < 1) {
      setError("Este atleta no tiene clases recuperativas disponibles.");
      return;
    }
    actions.markAttendance({
      athleteId: athlete.id, date, block: period, sessionType, status,
      ...(scheduledStartAt ? { scheduledStartAt } : {}),
      ...(status === "AUSENTE_CON_AVISO" ? { noticeAt: new Date().toISOString() } : {}),
    });
    setError("");
    setMessage(status === "AUSENTE_CON_AVISO"
      ? sessionType === "RECUPERACION" ? "La recuperación sigue disponible; no se generó un crédito duplicado." : "Aviso registrado: se agregó una clase recuperativa al saldo."
      : "");
  };

  return (
    <>
      <Screen eyebrow="Control de entrenamiento" title="Asistencias" subtitle="Administra horarios, asistencias y clases recuperativas">
        <View style={styles.panel}>
          <DateField label="Fecha" value={date} onChange={(value) => { setDate(value); setSlotKey(""); setError(""); setMessage(""); }} />
          <Text style={styles.fieldLabel}>Franja</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {["AM", "PM"].map((value) => <Chip key={value} label={value === "AM" ? "Mañana" : "Tarde"} selected={period === value} onPress={() => { setPeriod(value); setSlotKey(""); }} />)}
          </View>
          <Text style={styles.fieldLabel}>Tipo de sesión</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            {SESSION_TYPES.map((item) => <Chip key={item.value} label={item.label} compact selected={sessionType === item.value} onPress={() => { setSessionType(item.value); setSlotKey(""); }} />)}
          </View>
          <Text style={styles.fieldLabel}>Horarios del día</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            {slots.map((slot) => <Chip key={slot.key} label={slot.time} compact selected={selectedSlot?.key === slot.key} onPress={() => setSlotKey(slot.key)} />)}
            <Chip label="Sin horario" compact selected={noScheduleSelected} onPress={() => setSlotKey(NO_SCHEDULE)} />
          </View>
        </View>
        {error ? <Text accessibilityRole="alert" style={{ color: colors.red }}>{error}</Text> : null}
        {message ? <Text accessibilityRole="status" style={{ color: colors.green }}>{message}</Text> : null}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <Text style={styles.sectionTitle}>Lista de atletas</Text>
          <Text style={styles.small}>{visibleAthletes.length} de {active.length} activos</Text>
        </View>
        {visibleAthletes.length ? visibleAthletes.map((athlete) => {
          const recorded = sessionFor(athlete);
          const schedule = scheduleFor(athlete);
          const plan = state.plans[athlete.plan];
          return (
            <View key={athlete.id} style={[styles.panel, { padding: 12, gap: 10 }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[styles.body, { fontWeight: "800" }]}>{athlete.name}</Text>
                  <Text style={styles.small}>{plan?.label ?? "Plan no disponible"} · {athlete.remaining} clases restantes{(athlete.recoveryCredits ?? 0) ? ` · ${athlete.recoveryCredits} recuperativa(s)` : ""}</Text>
                </View>
                <Pressable onPress={() => openSchedule(athlete)} accessibilityRole="button" accessibilityLabel={`Gestionar horario de ${athlete.name}`} style={{ alignItems: "center" }}>
                  <Ionicons name="time-outline" size={21} color={colors.accent} />
                  <Text style={{ color: colors.accent, fontSize: 10 }}>{schedule.time || schedule.startTime ? schedule.time || `${schedule.startTime}–${schedule.endTime || "—"}` : "Horario"}</Text>
                </Pressable>
              </View>
              {!selectedSlot ? <Text style={[styles.small, { color: colors.amber }]}>Agrega un horario para habilitar el registro.</Text> : (
                <View style={{ flexDirection: "row", gap: 5 }}>
                  {Object.entries(ATTENDANCE).map(([status, item]) => {
                    const selected = recorded?.status === status;
                    return (
                      <Pressable key={status} onPress={() => mark(athlete, status)} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`${athlete.name}: ${item.label}`}
                        style={({ pressed }) => [{ flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", paddingHorizontal: 3, borderWidth: 1, borderColor: selected ? statusColor[status] : colors.border, backgroundColor: selected ? `${statusColor[status]}22` : colors.raised, borderRadius: 7 }, pressed && { opacity: 0.72 }]}>
                        <Text adjustsFontSizeToFit numberOfLines={1} style={{ color: selected ? statusColor[status] : colors.muted, fontSize: 10, fontWeight: "700" }}>{item.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
              {recorded ? <Text style={styles.small}>{ATTENDANCE[recorded.status]?.description}</Text> : null}
            </View>
          );
        }) : <EmptyState>{active.length ? "No hay atletas en este horario. Selecciona Sin horario para agendarlos." : "No hay atletas activos. Agrégalos en la sección Atletas."}</EmptyState>}
      </Screen>

      <BottomSheetModal visible={Boolean(editor)} onRequestClose={() => setEditor(null)}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ gap: 3 }}><Text style={styles.eyebrow}>Horario · {editor?.athleteName}</Text><Text style={styles.modalTitle}>Programar sesión</Text></View>
              <Pressable onPress={() => setEditor(null)} accessibilityLabel="Cerrar horario"><Ionicons name="close" size={25} color={colors.muted} /></Pressable>
            </View>
            {editor?.perSession ? (
              <Field label="Hora de inicio (HH:MM)" value={editor.time} onChangeText={(value) => setEditor((current) => ({ ...current, time: value }))} placeholder="16:30" keyboardType="numbers-and-punctuation" maxLength={5} />
            ) : (
              <View style={{ flexDirection: "row", gap: 9 }}>
                <Field label="Desde (HH:MM)" value={editor?.startTime ?? ""} onChangeText={(value) => setEditor((current) => ({ ...current, startTime: value }))} placeholder="16:00" keyboardType="numbers-and-punctuation" maxLength={5} />
                <Field label="Hasta (HH:MM)" value={editor?.endTime ?? ""} onChangeText={(value) => setEditor((current) => ({ ...current, endTime: value }))} placeholder="17:00" keyboardType="numbers-and-punctuation" maxLength={5} />
              </View>
            )}
            {error ? <Text accessibilityRole="alert" style={{ color: colors.red }}>{error}</Text> : null}
            <Text style={styles.small}>Deja los campos vacíos para quitar el horario de esta sesión.</Text>
            <View style={{ flexDirection: "row", gap: 9 }}>
              <ActionButton title="Cancelar" secondary onPress={() => setEditor(null)} style={{ flex: 1 }} />
              <ActionButton title="Guardar horario" onPress={saveSchedule} style={{ flex: 1 }} />
            </View>
      </BottomSheetModal>
    </>
  );
}
