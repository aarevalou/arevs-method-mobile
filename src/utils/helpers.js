import { PLANS } from "./constants";

export const todayISO = () => new Date().toISOString().slice(0, 10);
export const isActive = (a) => a.status === "ACTIVO";
export const ageOf = (birth) =>
  birth ? Math.floor((Date.now() - new Date(birth)) / 31557600000) : "-";

export const createAthlete = (form, id, plans = PLANS) => {
  const plan = plans[form.plan] ?? PLANS[form.plan];
  const n = plan.sessions;
  return {
    id,
    name: form.name.trim(),
    birth: form.birth,
    heightCm: form.heightCm === "" || form.heightCm == null ? null : Number(form.heightCm),
    weightKg: form.weightKg === "" || form.weightKg == null ? null : Number(form.weightKg),
    club: form.club?.trim() ?? "",
    courtPosition: form.courtPosition?.trim() ?? "",
    dominantFoot: form.dominantFoot ?? "",
    guardian: form.guardian,
    guardianNotApplicable: Boolean(form.guardianNotApplicable),
    phone: form.phone,
    plan: form.plan,
    status: "ACTIVO",
    payment: "PENDIENTE",
    paymentRecords: {},
    allocated: n,
    remaining: n,
  };
};

// Regla: presente o ausente sin aviso consume la clase; con aviso (24h) se puede reagendar
export const consumesClass = (status) =>
  status === "PRESENTE" || status === "AUSENTE_SIN_AVISO";
export const remainingAfter = (athlete, oldStatus, newStatus) => {
  const delta =
    (consumesClass(newStatus) ? 1 : 0) -
    (oldStatus && consumesClass(oldStatus) ? 1 : 0);
  return Math.min(athlete.allocated, Math.max(0, athlete.remaining - delta));
};

const num = (v) => (v === "" ? null : parseFloat(v));
export const createEvaluation = (athleteId, form, id) => {
  const laps = form.laps
    .split(/[;\s]+/)
    .map((x) => parseFloat(x.replace(",", ".")))
    .filter((x) => !isNaN(x));
  return {
    id,
    athleteId,
    date: form.date,
    circuit: form.circuit,
    laps,
    best: laps.length ? Math.min(...laps) : null,
    longJump: num(form.longJump),
    highJump: num(form.highJump),
    speed: num(form.speed),
  };
};
// Mejora (%) respecto a la marca inicial del MISMO atleta (menos segundos = mejor)
export const improvementVsFirst = (first, current) =>
  first && current ? ((first - current) / first) * 100 : null;

const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
export const dashboardMetrics = ({ athletes, sessions }, month) => {
  const active = athletes.filter(isActive);
  const monthly = active.filter((a) => a.plan === "MENSUAL_DUPLA");
  const monthSessions = sessions.filter((s) => s.date.startsWith(month));
  const consumed = monthly.reduce((t, a) => t + a.allocated - a.remaining, 0);
  return {
    active: active.length,
    paidPct: pct(
      active.filter((a) => a.payment === "AL_DIA").length,
      active.length,
    ),
    attendancePct: pct(
      monthSessions.filter((s) => s.status === "PRESENTE").length,
      monthSessions.length,
    ),
    avgConsumed: monthly.length ? (consumed / monthly.length).toFixed(1) : "0",
    pending: active.filter((a) => a.payment !== "AL_DIA"),
  };
};

export const schedulePeriod = (schedule) => {
  if (schedule?.period === "AM" || schedule?.period === "PM") return schedule.period;
  if (schedule?.block === "SIN_FRANJA") return "SIN_FRANJA";
  if (schedule?.block === "AM" || schedule?.block === "PM") return schedule.block;
  return ["RECUPERACION", "DOMICILIO"].includes(schedule?.block) ? "SIN_FRANJA" : "";
};

export const scheduleSessionType = (schedule) =>
  schedule?.sessionType ??
  (["RECUPERACION", "DOMICILIO"].includes(schedule?.block) ? schedule.block : "NORMAL");

export const scheduleStartTime = (schedule) => schedule?.time || schedule?.startTime || "";

export const scheduleSlotKey = (schedule) => {
  const start = scheduleStartTime(schedule);
  const period = schedulePeriod(schedule);
  const type = scheduleSessionType(schedule);
  if (!period || !type || !start) return "";
  return `${period}|${type}|${start}|${schedule.time ? "" : (schedule.endTime ?? "")}`;
};
