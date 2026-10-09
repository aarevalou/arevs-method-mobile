import { createContext, useContext, useEffect, useState } from "react";
import { loadData, saveData } from "../services/storage";
import { EMPTY_STATE } from "../utils/constants";
import {
  createAthlete,
  createEvaluation,
  remainingAfter,
  todayISO,
} from "../utils/helpers";
import { getPaymentDetails, syncPaymentRecords } from "../utils/payments";

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);
const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function AppProvider({ children }) {
  const [state, setState] = useState(EMPTY_STATE);
  const [ready, setReady] = useState(false);
  const currentMonth = todayISO().slice(0, 7);

  useEffect(() => {
    let mounted = true;
    loadData()
      .then((saved) => {
        if (mounted) setState(saved);
      })
      .catch(() => {
        if (mounted) setState(EMPTY_STATE);
      })
      .finally(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    if (ready) saveData(state).catch(() => {});
  }, [state, ready]);

  useEffect(() => {
    if (!ready) return;
    setState((current) => {
      let changed = false;
      const athletes = current.athletes.map((athlete) => {
        const synced = syncPaymentRecords(
          athlete,
          current.sessions,
          currentMonth,
        );
        if (synced !== athlete) changed = true;
        return synced;
      });
      return changed ? { ...current, athletes } : current;
    });
  }, [ready, state.athletes, state.sessions, currentMonth]);

  const actions = {
    addAthlete: (form) =>
      setState((s) => ({
        ...s,
        athletes: [...s.athletes, createAthlete(form, newId())],
      })),

    updateAthlete: (id, patch) =>
      setState((s) => ({
        ...s,
        athletes: s.athletes.map((athlete) =>
          athlete.id === id ? { ...athlete, ...patch } : athlete,
        ),
      })),

    updatePaymentRecord: (athleteId, chargeKey, paid) =>
      setState((current) => ({
        ...current,
        athletes: current.athletes.map((athlete) => {
          if (athlete.id !== athleteId) return athlete;
          const details = getPaymentDetails(
            athlete,
            current.sessions,
            currentMonth,
          );
          const previous = athlete.paymentRecords?.[chargeKey];
          const paymentRecords = {
            ...(athlete.paymentRecords ?? {}),
            [chargeKey]: {
              paid,
              paidAt: paid
                ? (previous?.paidAt ?? new Date().toISOString())
                : null,
              amount:
                details.charges.find((charge) => charge.key === chargeKey)
                  ?.amount ?? previous?.amount,
            },
          };
          const payment = details.charges.every((charge) =>
            charge.key === chargeKey
              ? paid
              : Boolean(paymentRecords[charge.key]?.paid ?? charge.paid),
          )
            ? "AL_DIA"
            : "PENDIENTE";
          return { ...athlete, payment, paymentRecords };
        }),
      })),

    markAllPaymentsPaid: (athleteId) =>
      setState((current) => ({
        ...current,
        athletes: current.athletes.map((athlete) => {
          if (athlete.id !== athleteId) return athlete;
          const details = getPaymentDetails(
            athlete,
            current.sessions,
            currentMonth,
          );
          const now = new Date().toISOString();
          const paymentRecords = {
            ...(athlete.paymentRecords ?? {}),
            ...Object.fromEntries(
              details.charges.map((charge) => [
                charge.key,
                {
                  paid: true,
                  paidAt: athlete.paymentRecords?.[charge.key]?.paidAt ?? now,
                  amount: charge.amount,
                },
              ]),
            ),
          };
          return { ...athlete, payment: "AL_DIA", paymentRecords };
        }),
      })),

    archiveAthlete: (id) =>
      setState((current) => ({
        ...current,
        athletes: current.athletes.map((athlete) =>
          athlete.id === id
            ? {
                ...athlete,
                statusBeforeArchive: athlete.status,
                status: "INACTIVO",
                archivedAt: new Date().toISOString(),
              }
            : athlete,
        ),
      })),

    restoreAthlete: (id) =>
      setState((current) => ({
        ...current,
        athletes: current.athletes.map((athlete) => {
          if (athlete.id !== id) return athlete;
          const { archivedAt, statusBeforeArchive, ...rest } = athlete;
          return {
            ...rest,
            status: statusBeforeArchive ?? "ACTIVO",
            archivedAt: null,
          };
        }),
      })),

    markAttendance: ({ athleteId, date, block, status }) =>
      setState((s) => {
        const old = s.sessions.find(
          (x) =>
            x.athleteId === athleteId && x.date === date && x.block === block,
        );
        return {
          ...s,
          sessions: old
            ? s.sessions.map((x) => (x === old ? { ...x, status } : x))
            : [...s.sessions, { id: newId(), athleteId, date, block, status }],
          athletes: s.athletes.map((a) =>
            a.id === athleteId
              ? { ...a, remaining: remainingAfter(a, old?.status, status) }
              : a,
          ),
        };
      }),

    deleteAthlete: (id) =>
      setState((s) => ({
        ...s,
        athletes: s.athletes.filter((a) => a.id !== id),
      })),

    addEvaluation: (athleteId, form) =>
      setState((s) => ({
        ...s,
        logs: [...s.logs, createEvaluation(athleteId, form, newId())],
      })),

    removeEvaluation: (id) =>
      setState((s) => ({ ...s, logs: s.logs.filter((l) => l.id !== id) })),
  };
  return (
    <AppContext.Provider value={{ state, actions, ready }}>
      {children}
    </AppContext.Provider>
  );
}
