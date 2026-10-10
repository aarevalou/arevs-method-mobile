import { createContext, useContext, useEffect, useRef, useState } from "react";
import { loadData, saveData } from "../services/storage";
import { supabase, supabaseConfigured } from "../services/supabase";
import { EMPTY_STATE, PLANS } from "../utils/constants";
import { createAthlete, createEvaluation, remainingAfter, schedulePeriod, scheduleSessionType, todayISO } from "../utils/helpers";
import { getPaymentDetails, syncPaymentRecords } from "../utils/payments";
import { normalizePhysicalMetrics } from "../utils/physicalAssessments";

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);
const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const freshPlans = () => Object.fromEntries(Object.entries(PLANS).map(([id, plan]) => [id, { ...plan }]));

export function AppProvider({ children }) {
  const [state, setState] = useState(EMPTY_STATE);
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(!supabaseConfigured);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [syncError, setSyncError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [retryLoad, setRetryLoad] = useState(0);
  const [retrySave, setRetrySave] = useState(0);
  const pendingSave = useRef(Promise.resolve());
  const month = todayISO().slice(0, 7);

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession);
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setLoadError(`No se pudo recuperar la sesión: ${error.message}`);
      setSession(data?.session ?? null);
      setAuthReady(true);
    }).catch((error) => {
      if (!active) return;
      setLoadError(`No se pudo recuperar la sesión: ${error.message}`);
      setAuthReady(true);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      setReady(false);
      setLoadError("");
      setState(EMPTY_STATE);
      return undefined;
    }
    let active = true;
    setReady(false);
    setLoadError("");
    loadData(userId).then((saved) => {
      if (!active) return;
      setState(saved);
      setReady(true);
      setSyncError("");
    }).catch((error) => {
      if (active) setLoadError(error.message || "No se pudieron cargar los datos.");
    });
    return () => { active = false; };
  }, [session?.user?.id, retryLoad]);

  useEffect(() => {
    if (!ready || !session?.user?.id) return undefined;
    let active = true;
    setSyncing(true);
    setSyncError("");
    const request = saveData(session.user.id, state);
    pendingSave.current = request;
    request.then(() => {
      if (active) setSyncing(false);
    }).catch((error) => {
      if (active) {
        setSyncing(false);
        setSyncError(error.message || "No se pudieron guardar los cambios.");
      }
    });
    return () => { active = false; };
  }, [state, ready, session?.user?.id, retrySave]);

  useEffect(() => {
    if (!ready) return;
    setState((current) => {
      let changed = false;
      const athletes = current.athletes.map((athlete) => {
        const synced = syncPaymentRecords(athlete, current.sessions, month, current.plans);
        if (synced !== athlete) changed = true;
        return synced;
      });
      return changed ? { ...current, athletes } : current;
    });
  }, [ready, state.athletes, state.sessions, state.plans, month]);

  const actions = {
    addAthlete: (form) => setState((s) => ({
      ...s,
      athletes: [...s.athletes, createAthlete(form, newId(), s.plans)],
    })),
    updateAthlete: (id, patch) => setState((s) => ({
      ...s,
      athletes: s.athletes.map((athlete) => athlete.id === id ? { ...athlete, ...patch } : athlete),
    })),
    savePlan: (id, plan) => setState((s) => ({
      ...s,
      plans: { ...s.plans, [id]: plan },
      athletes: s.athletes.map((athlete) => {
        if (athlete.plan !== id) return athlete;
        const used = Math.max(0, athlete.allocated - athlete.remaining);
        return { ...athlete, allocated: plan.sessions, remaining: Math.max(0, plan.sessions - used) };
      }),
    })),
    deletePlan: (id) => setState((s) => {
      if (Object.keys(s.plans).length <= 1 || s.athletes.some((athlete) => athlete.plan === id)) return s;
      return { ...s, plans: Object.fromEntries(Object.entries(s.plans).filter(([key]) => key !== id)) };
    }),
    updateSettings: (patch) => setState((s) => ({
      ...s, settings: { ...(s.settings ?? EMPTY_STATE.settings), ...patch },
    })),
    saveAssessmentMetrics: (metrics) => setState((s) => ({
      ...s,
      settings: { ...(s.settings ?? EMPTY_STATE.settings), assessmentMetrics: normalizePhysicalMetrics(metrics) },
      assessments: [],
    })),
    clearPaymentHistory: () => setState((s) => ({
      ...s,
      athletes: s.athletes.map((athlete) => {
        const { paymentArchivedAt, paymentArchivedAmount, paymentArchivedDetails, paymentRecords, ...rest } = athlete;
        return { ...rest, payment: "PENDIENTE" };
      }),
    })),
    resetAllData: () => setState({
      ...EMPTY_STATE,
      athletes: [], sessions: [], schedules: [], exercises: [], circuits: [],
      logs: [], assessments: [], plans: freshPlans(), settings: { ...EMPTY_STATE.settings },
    }),
    updatePaymentRecord: (athleteId, chargeKey, paid) => setState((current) => ({
      ...current,
      athletes: current.athletes.map((athlete) => {
        if (athlete.id !== athleteId) return athlete;
        const details = getPaymentDetails(athlete, current.sessions, month, current.plans);
        const previous = athlete.paymentRecords?.[chargeKey];
        const paymentRecords = {
          ...(athlete.paymentRecords ?? {}),
          [chargeKey]: {
            paid,
            paidAt: paid ? (previous?.paidAt ?? new Date().toISOString()) : null,
            amount: details.charges.find((charge) => charge.key === chargeKey)?.amount ?? previous?.amount,
          },
        };
        const payment = details.charges.every((charge) =>
          charge.key === chargeKey ? paid : Boolean(paymentRecords[charge.key]?.paid ?? charge.paid),
        ) ? "AL_DIA" : "PENDIENTE";
        return { ...athlete, payment, paymentRecords };
      }),
    })),
    markAllPaymentsPaid: (athleteId) => setState((current) => ({
      ...current,
      athletes: current.athletes.map((athlete) => {
        if (athlete.id !== athleteId) return athlete;
        const details = getPaymentDetails(athlete, current.sessions, month, current.plans);
        const now = new Date().toISOString();
        const paymentRecords = {
          ...(athlete.paymentRecords ?? {}),
          ...Object.fromEntries(details.charges.map((charge) => [charge.key, {
            paid: true, paidAt: athlete.paymentRecords?.[charge.key]?.paidAt ?? now, amount: charge.amount,
          }])),
        };
        return { ...athlete, payment: "AL_DIA", paymentRecords };
      }),
    })),
    archiveAthlete: (id) => setState((s) => ({
      ...s,
      athletes: s.athletes.map((athlete) => athlete.id === id ? {
        ...athlete, statusBeforeArchive: athlete.status, status: "INACTIVO", archivedAt: new Date().toISOString(),
      } : athlete),
    })),
    restoreAthlete: (id) => setState((s) => ({
      ...s,
      athletes: s.athletes.map((athlete) => {
        if (athlete.id !== id) return athlete;
        const { archivedAt, statusBeforeArchive, ...rest } = athlete;
        return { ...rest, status: statusBeforeArchive ?? "ACTIVO", archivedAt: null };
      }),
    })),
    markAttendance: ({ athleteId, date, block, sessionType, status, noticeAt, scheduledStartAt }) => setState((s) => {
      const resolvedType = sessionType ?? (["RECUPERACION", "DOMICILIO"].includes(block) ? block : "NORMAL");
      const old = s.sessions.find((item) => item.athleteId === athleteId && item.date === date &&
        schedulePeriod(item) === schedulePeriod({ block }) && scheduleSessionType(item) === resolvedType);
      const athlete = s.athletes.find((item) => item.id === athleteId);
      if (!athlete) return s;
      const recovery = resolvedType === "RECUPERACION";
      const grantsCredit = !recovery && status === "AUSENTE_CON_AVISO";
      const consumesCredit = recovery && (status === "PRESENTE" || status === "AUSENTE_SIN_AVISO");
      const creditDelta = (grantsCredit && !old?.recoveryCreditGranted ? 1 : 0) -
        (!grantsCredit && old?.recoveryCreditGranted ? 1 : 0) -
        (consumesCredit && !old?.recoveryCreditConsumed ? 1 : 0) +
        (old?.recoveryCreditConsumed && !consumesCredit ? 1 : 0);
      const remaining = recovery ? athlete.remaining : remainingAfter(athlete, old?.status, status);
      const plan = s.plans[athlete.plan];
      const record = {
        ...(old ?? { id: newId() }), athleteId, date, block, sessionType: resolvedType, status,
        noticeAt: noticeAt ?? null, scheduledStartAt: scheduledStartAt ?? null,
        billingType: plan?.billingType ?? old?.billingType,
        recoveryCreditGranted: grantsCredit, recoveryCreditConsumed: consumesCredit,
        cycleClosedWithoutNotice: !recovery && plan?.billingType !== "monthly" &&
          status === "AUSENTE_SIN_AVISO" && remaining === 0,
      };
      return {
        ...s,
        sessions: old ? s.sessions.map((item) => item === old ? record : item) : [...s.sessions, record],
        athletes: s.athletes.map((item) => item.id === athleteId ? {
          ...item, remaining, recoveryCredits: Math.max(0, (item.recoveryCredits ?? 0) + creditDelta),
        } : item),
      };
    }),
    saveAttendanceSchedule: ({ athleteId, date, block, sessionType = "NORMAL", scheduleId, ...times }) => setState((s) => {
      const old = s.schedules.find((item) => (scheduleId && item.id === scheduleId) ||
        (item.athleteId === athleteId && item.date === date && item.block === block &&
          (item.sessionType ?? "NORMAL") === sessionType));
      const punctual = Object.hasOwn(times, "time");
      const schedule = {
        ...(old ?? {}), ...times, sessionType,
        time: punctual ? times.time : "",
        startTime: punctual ? "" : (times.startTime ?? old?.startTime ?? ""),
        endTime: punctual ? "" : (times.endTime ?? old?.endTime ?? ""),
        athleteId, date, block,
      };
      const hasTime = punctual ? Boolean(schedule.time) : Boolean(schedule.startTime || schedule.endTime);
      return {
        ...s,
        schedules: hasTime
          ? old ? s.schedules.map((item) => item === old ? schedule : item) : [...s.schedules, { id: newId(), ...schedule }]
          : s.schedules.filter((item) => item !== old),
      };
    }),
    saveExercise: (exercise) => setState((s) => ({
      ...s,
      exercises: s.exercises.some((item) => item.id === exercise.id)
        ? s.exercises.map((item) => item.id === exercise.id ? exercise : item)
        : [...s.exercises, exercise],
    })),
    deleteExercise: (id) => setState((s) => s.circuits.some((circuit) =>
      circuit.nodes?.some((node) => node.exerciseId === id),
    ) ? s : { ...s, exercises: s.exercises.filter((item) => item.id !== id) }),
    saveCircuit: (circuit) => setState((s) => ({
      ...s,
      circuits: s.circuits.some((item) => item.id === circuit.id)
        ? s.circuits.map((item) => item.id === circuit.id ? circuit : item)
        : [...s.circuits, circuit],
    })),
    deleteCircuit: (id) => setState((s) => ({
      ...s,
      circuits: s.circuits.filter((item) => item.id !== id),
      sessions: s.sessions.map((item) => item.circuitId === id ? { ...item, circuitId: "" } : item),
    })),
    assignCircuitToSession: (sessionId, circuitId) => setState((s) => ({
      ...s, sessions: s.sessions.map((item) => item.id === sessionId ? { ...item, circuitId: circuitId || "" } : item),
    })),
    deleteAthlete: (id) => setState((s) => ({
      ...s,
      athletes: s.athletes.filter((athlete) => athlete.id !== id),
      schedules: s.schedules.filter((schedule) => schedule.athleteId !== id),
    })),
    addEvaluation: (athleteId, form) => setState((s) => ({
      ...s, logs: [...s.logs, createEvaluation(athleteId, form, newId())],
    })),
    removeEvaluation: (id) => setState((s) => ({ ...s, logs: s.logs.filter((log) => log.id !== id) })),
    addPhysicalAssessment: (assessment) => setState((s) => ({
      ...s, assessments: [...(s.assessments ?? []), assessment],
    })),
    removePhysicalAssessment: (id) => setState((s) => ({
      ...s, assessments: (s.assessments ?? []).filter((assessment) => assessment.id !== id),
    })),
  };

  const signIn = async (email, password) => {
    if (!supabase) throw new Error("La conexión con Supabase no está configurada. Configura EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY.");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(`No se pudo iniciar sesión: ${error.message}`);
  };
  const signOut = async () => {
    if (!supabase) return;
    await pendingSave.current;
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(`No se pudo cerrar sesión: ${error.message}`);
  };

  const value = {
    state, actions, ready, user: session?.user ?? null,
    authReady, authConfigured: supabaseConfigured, loadError, syncError, syncing,
    signIn, signOut,
    retryLoading: () => setRetryLoad((attempt) => attempt + 1),
    retrySaving: () => setRetrySave((attempt) => attempt + 1),
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
