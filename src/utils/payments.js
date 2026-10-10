import { PLANS } from "./constants";

const formatDate = (date) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

const formatMonth = (month) =>
  new Date(`${month}-01T00:00:00`).toLocaleDateString("es-CL", {
    month: "long",
    year: "numeric",
  });

const isChargeable = (session) =>
  session.status === "PRESENTE" || session.status === "AUSENTE_SIN_AVISO";

export const getPaymentDetails = (athlete, sessions, currentMonth, plans = PLANS) => {
  const plan = plans[athlete.plan] ?? PLANS[athlete.plan];
  const records = athlete.paymentRecords ?? {};
  const legacyPaid =
    athlete.payment === "AL_DIA" && Object.keys(records).length === 0;
  const athleteSessions = sessions
    .filter((session) => session.athleteId === athlete.id)
    .sort((first, second) => first.date.localeCompare(second.date));
  let charges;

  if ((plan.billingType ?? (athlete.plan === "MENSUAL_DUPLA" ? "monthly" : "per_session")) === "monthly") {
    const sessionsByMonth = new Map();
    athleteSessions.forEach((session) => {
      const month = session.date.slice(0, 7);
      sessionsByMonth.set(month, [
        ...(sessionsByMonth.get(month) ?? []),
        session,
      ]);
    });
    if (!sessionsByMonth.has(currentMonth)) {
      sessionsByMonth.set(currentMonth, []);
    }

    charges = [...sessionsByMonth.entries()]
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([month, monthSessions]) => ({
        key: month,
        title: `Mensualidad de ${formatMonth(month)}`,
        amount: plan.price,
        sessions: monthSessions,
      }));
  } else {
    charges = athleteSessions.filter(isChargeable).map((session) => ({
      key: session.id,
      title: formatDate(session.date),
      block: session.block,
      amount: plan.price,
      sessions: [session],
    }));

    if (!charges.length) {
      charges.push({
        key: "plan-pending",
        title: "Plan pendiente de pago",
        amount: plan.price,
        sessions: [],
      });
    }
  }

  return {
    charges: charges.map((charge) => {
      const record = records[charge.key];
      return {
        ...charge,
        amount: Number.isFinite(record?.amount) ? record.amount : charge.amount,
        paid: record ? Boolean(record.paid) : legacyPaid,
        paidAt: record?.paidAt ?? null,
      };
    }),
    unbilledSessions:
      (plan.billingType ?? (athlete.plan === "MENSUAL_DUPLA" ? "monthly" : "per_session")) === "monthly"
        ? []
        : athleteSessions.filter((session) => !isChargeable(session)),
  };
};

export const syncPaymentRecords = (athlete, sessions, currentMonth, plans = PLANS) => {
  const details = getPaymentDetails(athlete, sessions, currentMonth, plans);
  const existingRecords = athlete.paymentRecords ?? {};
  const legacyPaid =
    athlete.payment === "AL_DIA" && Object.keys(existingRecords).length === 0;
  const paymentRecords = { ...existingRecords };
  let changed = false;

  details.charges.forEach((charge) => {
    if (!paymentRecords[charge.key]) {
      paymentRecords[charge.key] = {
        paid: legacyPaid,
        paidAt: null,
        amount: charge.amount,
      };
      changed = true;
    } else if (!Number.isFinite(paymentRecords[charge.key].amount)) {
      paymentRecords[charge.key] = {
        ...paymentRecords[charge.key],
        amount: charge.amount,
      };
      changed = true;
    }
  });

  const payment =
    details.charges.length > 0 &&
    details.charges.every((charge) => paymentRecords[charge.key].paid)
      ? "AL_DIA"
      : "PENDIENTE";
  if (!changed && athlete.payment === payment) return athlete;
  return { ...athlete, payment, paymentRecords };
};

export const summarizePayments = (athletes, sessions, currentMonth, plans = PLANS) => {
  const charges = athletes.flatMap((athlete) =>
    getPaymentDetails(athlete, sessions, currentMonth, plans).charges.map(
      (charge) => ({
        ...charge,
        athleteId: athlete.id,
      }),
    ),
  );
  const pending = charges.filter((charge) => !charge.paid);

  return {
    pendingAmount: pending.reduce((total, charge) => total + charge.amount, 0),
    pendingCharges: pending.length,
    athletesWithPending: new Set(pending.map((charge) => charge.athleteId))
      .size,
  };
};
