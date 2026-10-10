import { PHYSICAL_METRICS } from "./physicalAssessments";

export const PLANS = {
  MENSUAL_DUPLA: { label: "Plan mensual (8 sesiones)", sessions: 8, price: 50000, billingType: "monthly", frequency: "2 veces por semana" },
  MENSUAL_SEMANAL: { label: "Plan mensual (4 sesiones)", sessions: 4, price: 30000, billingType: "monthly", frequency: "1 vez por semana" },
  SESION_UNICA: { label: "Sesión única", sessions: 1, price: 20000, billingType: "per_session" },
  DOMICILIO: { label: "Domicilio", sessions: 1, price: 15000, billingType: "per_session" },
};

export const BLOCKS = ["AM", "PM"];
export const SESSION_TYPES = [
  { value: "NORMAL", label: "Sesión normal" },
  { value: "RECUPERACION", label: "Recuperación" },
  { value: "DOMICILIO", label: "Domicilio" },
];
export const ATTENDANCE = {
  PRESENTE: {
    label: "Presente",
    tone: "ok",
    description: "Asistió; consume una clase del plan.",
  },
  AUSENTE_CON_AVISO: {
    label: "Aviso 24h",
    tone: "warn",
    description: "Registra el aviso y agrega una clase recuperativa al saldo.",
  },
  AUSENTE_SIN_AVISO: {
    label: "Sin aviso",
    tone: "bad",
    description: "No asistió sin aviso; consume una clase del plan.",
  },
};
export const PAYMENT = { AL_DIA: "Al día", PENDIENTE: "Pendiente" };
export const EMPTY_STATE = {
  athletes: [],
  sessions: [],
  schedules: [],
  exercises: [],
  circuits: [],
  logs: [],
  assessments: [],
  plans: Object.fromEntries(Object.entries(PLANS).map(([key, plan]) => [key, { ...plan }])),
  settings: {
    zoomFactor: 1.1,
    theme: "dark",
    assessmentMetrics: PHYSICAL_METRICS,
  },
};
