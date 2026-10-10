import AsyncStorage from "@react-native-async-storage/async-storage";
import { EMPTY_STATE, PLANS } from "../utils/constants";
import { normalizePhysicalMetrics } from "../utils/physicalAssessments";
import { supabase } from "./supabase";

const LEGACY_LOCAL_KEY = "arevs-method:data:v1";
const localKeyFor = (userId) => `arevs-method:data:v1:${userId}`;
let saveQueue = Promise.resolve();

const normalizeData = (value) => {
  const stored = value ?? EMPTY_STATE;
  const plans = stored.plans && Object.keys(stored.plans).length
    ? stored.plans
    : Object.fromEntries(Object.entries(PLANS).map(([key, plan]) => [key, { ...plan }]));
  return {
    ...EMPTY_STATE,
    ...stored,
    schedules: stored.schedules ?? [],
    exercises: stored.exercises ?? [],
    circuits: stored.circuits ?? [],
    logs: stored.logs ?? [],
    assessments: stored.assessments ?? [],
    plans,
    settings: {
      ...EMPTY_STATE.settings,
      ...(stored.settings ?? {}),
      theme: stored.settings?.theme === "light" ? "light" : "dark",
      assessmentMetrics: normalizePhysicalMetrics(stored.settings?.assessmentMetrics),
    },
    athletes: (stored.athletes ?? []).map((athlete) => {
      const { paymentArchivedAt, paymentArchivedDetails, ...currentAthlete } = athlete;
      const archivedRecords = Object.fromEntries((paymentArchivedDetails?.charges ?? []).map((charge) => [
        charge.key, { paid: true, paidAt: paymentArchivedAt ?? null },
      ]));
      const paymentRecords = { ...archivedRecords, ...(athlete.paymentRecords ?? {}) };
      return {
        ...currentAthlete,
        payment: athlete.payment === "VENCIDO" ? "PENDIENTE" : (athlete.payment ?? "PENDIENTE"),
        ...(athlete.paymentRecords || Object.keys(archivedRecords).length ? { paymentRecords } : {}),
      };
    }),
  };
};

const readCloudState = async (userId) => {
  const { data, error } = await supabase
    .from("app_data")
    .select("state")
    .eq("owner_id", userId)
    .maybeSingle();
  if (error) throw new Error(`No se pudieron cargar los datos: ${error.message}`);
  return data?.state ?? null;
};

export const loadData = async (userId) => {
  if (!supabase) throw new Error("La conexión con Supabase no está configurada.");
  const localKey = localKeyFor(userId);
  const cloudState = await readCloudState(userId);
  if (cloudState) {
    await AsyncStorage.setItem(localKey, JSON.stringify(cloudState));
    await AsyncStorage.removeItem(LEGACY_LOCAL_KEY);
    return normalizeData(cloudState);
  }

  const serialized = await AsyncStorage.getItem(localKey) ?? await AsyncStorage.getItem(LEGACY_LOCAL_KEY);
  const initialState = normalizeData(serialized ? JSON.parse(serialized) : null);
  const { error } = await supabase.from("app_data").insert({ owner_id: userId, state: initialState });
  if (!error) {
    await AsyncStorage.setItem(localKey, JSON.stringify(initialState));
    await AsyncStorage.removeItem(LEGACY_LOCAL_KEY);
    return initialState;
  }
  if (error.code !== "23505") throw new Error(`No se pudieron inicializar los datos: ${error.message}`);
  const concurrentlyCreatedState = await readCloudState(userId);
  if (!concurrentlyCreatedState) throw new Error("No se encontró el estado inicial creado en Supabase.");
  await AsyncStorage.setItem(localKey, JSON.stringify(concurrentlyCreatedState));
  await AsyncStorage.removeItem(LEGACY_LOCAL_KEY);
  return normalizeData(concurrentlyCreatedState);
};

export const saveData = (userId, state) => {
  if (!supabase) return Promise.reject(new Error("La conexión con Supabase no está configurada."));
  const write = saveQueue.catch(() => undefined).then(async () => {
    const { error } = await supabase.from("app_data").upsert(
      { owner_id: userId, state },
      { onConflict: "owner_id" },
    );
    if (error) throw new Error(`No se pudieron guardar los cambios: ${error.message}`);
    await AsyncStorage.setItem(localKeyFor(userId), JSON.stringify(state));
  });
  saveQueue = write;
  return write;
};
