wrgfwrgwrgimport { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useApp } from "../context/AppContext";
import { ActionButton, Chip, EmptyState, Screen, styles, colors } from "../native/ui";
import { PLANS } from "../utils/constants";
import { dashboardMetrics, isActive, todayISO } from "../utils/helpers";
import { getPaymentDetails, summarizePayments } from "../utils/payments";

const money = (value) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);

function recentMonths(count) {
  const today = new Date(`${todayISO()}T00:00:00`);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - count + index + 1, 1);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: date.toLocaleDateString("es-CL", { month: "short" }).replace(".", ""),
    };
  });
}

export default function DashboardPage({ onViewPendingPayments }) {
  const { state } = useApp();
  const [sortByName, setSortByName] = useState(false);
  const month = todayISO().slice(0, 7);
  const metrics = dashboardMetrics(state, month);
  const active = state.athletes.filter(isActive);
  const payments = summarizePayments(active, state.sessions, month);
  const sessionCount = state.sessions.filter((session) => session.date.startsWith(month)).length;
  const trends = useMemo(() => recentMonths(6).map(({ key, label }) => {
    const sessions = state.sessions.filter((session) => session.date.startsWith(key));
    const paid = state.athletes.flatMap((athlete) => Object.values(athlete.paymentRecords ?? []))
      .filter((record) => record.paid && record.paidAt?.startsWith(key))
      .reduce((sum, record) => sum + (Number(record.amount) || 0), 0);
    return {
      key,
      label,
      attendance: sessions.length ? Math.round((sessions.filter((session) => session.status === "PRESENTE").length / sessions.length) * 100) : 0,
      count: sessions.length,
      paid,
    };
  }), [state.sessions, state.athletes]);
  const pending = active.map((athlete) => {
    const charges = getPaymentDetails(athlete, state.sessions, month).charges.filter((charge) => !charge.paid);
    return {
      id: athlete.id,
      name: athlete.name,
      plan: athlete.plan,
      count: charges.length,
      amount: charges.reduce((sum, charge) => sum + charge.amount, 0),
    };
  }).filter((athlete) => athlete.count > 0).sort((a, b) => sortByName ? a.name.localeCompare(b.name, "es-CL") : b.amount - a.amount);

  const cards = [
    ["Atletas activos", String(metrics.active)],
    ["Asistencia del mes", sessionCount ? `${metrics.attendancePct}%` : "—"],
    ["Sesiones registradas", String(sessionCount)],
    ["Saldo pendiente", money(payments.pendingAmount)],
  ];

  return (
    <Screen eyebrow="Arevs Method" title="Resumen" subtitle="Actividad y seguimiento del equipo">
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 10 }}>
        {cards.map(([label, value]) => (
          <View key={label} style={{ width: "48.2%", minHeight: 80, padding: 14, gap: 10, justifyContent: "space-between", borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
            <Text style={styles.small}>{label}</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.accent, fontSize: 28, fontWeight: "800" }}>{value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.panel}>
        <View style={{ gap: 3 }}>
          <Text style={styles.sectionTitle}>Tendencia de asistencia</Text>
          <Text style={styles.small}>Porcentaje de sesiones marcadas como presente</Text>
        </View>
        <View style={{ flexDirection: "row", height: 120, alignItems: "flex-end", justifyContent: "space-around", paddingTop: 8 }}>
          {trends.map((trend) => (
            <View key={trend.key} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", height: "100%", gap: 7 }}>
              <Text style={{ color: colors.muted, fontSize: 10 }}>{trend.count ? `${trend.attendance}%` : "—"}</Text>
              <View style={{ width: 17, height: `${Math.max(trend.count ? trend.attendance : 0, 4)}%`, minHeight: 3, maxHeight: 74, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: trend.count ? colors.accent : colors.raised }} />
              <Text style={{ color: colors.muted, fontSize: 10 }}>{trend.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.panel, { gap: 10, paddingVertical: 12 }]}>
        <View style={{ gap: 3 }}>
          <Text style={styles.sectionTitle}>Recaudación</Text>
          <Text style={styles.small}>Últimos seis meses</Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 4 }}>
          {trends.map((trend) => (
            <View key={trend.key} accessibilityLabel={`${trend.label}: ${money(trend.paid)} recaudados`} style={{ flex: 1, minWidth: 0, alignItems: "center", gap: 4 }}>
              <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 10, textTransform: "capitalize" }}>{trend.label}</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.accent, fontSize: 11, fontWeight: "700" }}>{money(trend.paid)}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.panel}>
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.sectionTitle}>Pagos pendientes</Text>
              <Text style={styles.small}>{pending.length} atletas con saldo por cobrar</Text>
            </View>
            <Chip label={sortByName ? "A-Z" : "Mayor saldo"} variant="muted" compact onPress={() => setSortByName((value) => !value)} />
          </View>
          {pending.length ? pending.slice(0, 6).map((athlete) => (
            <Pressable key={athlete.id} onPress={onViewPendingPayments} style={({ pressed }) => [styles.row, { justifyContent: "space-between", paddingVertical: 5 }, pressed && { opacity: 0.7 }]}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text numberOfLines={1} style={[styles.body, { fontWeight: "700" }]}>{athlete.name}</Text>
                <Text style={styles.small}>{PLANS[athlete.plan].label} · {athlete.count} {athlete.count === 1 ? "cargo" : "cargos"}</Text>
              </View>
              <Text style={{ color: colors.amber, fontSize: 14, fontWeight: "800" }}>{money(athlete.amount)}</Text>
            </Pressable>
          )) : <EmptyState>No hay pagos pendientes este mes.</EmptyState>}
          {pending.length > 6 ? <ActionButton title="Ver atletas pendientes" secondary onPress={onViewPendingPayments} /> : null}
        </View>
      </View>
    </Screen>
  );
}
