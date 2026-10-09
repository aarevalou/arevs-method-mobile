import { useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "../context/AppContext";
import { ActionButton, Chip, DateField, EmptyState, Field, Screen, SelectField, styles, colors } from "../native/ui";
import { PAYMENT, PLANS } from "../utils/constants";
import { ageOf, isActive } from "../utils/helpers";
import { getPaymentDetails } from "../utils/payments";

const BLANK = { name: "", birth: "", guardian: "", guardianNotApplicable: false, phone: "", plan: "MENSUAL_DUPLA" };
const money = (value) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
const PLAN_OPTIONS = Object.entries(PLANS).map(([value, plan]) => ({ value, label: `${plan.label} · ${plan.sessions} clases` }));
const FILTERS = [
  ["TODOS", "Todos"],
  ["PENDIENTE", "Pendientes"],
  ["AL_DIA", "Al día"],
  ["ARCHIVADOS", "Archivados"],
];

export default function AthletesPage({ paymentFilter = "TODOS", onPaymentFilterChange = () => {} }) {
  const { state, actions } = useApp();
  const [query, setQuery] = useState("");
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [editing, setEditing] = useState(null);
  const [paymentAthlete, setPaymentAthlete] = useState(null);
  const month = new Date().toISOString().slice(0, 7);
  const normalizedQuery = query.trim().toLocaleLowerCase("es-CL");
  const athletes = useMemo(() => state.athletes.filter((athlete) => {
    const archived = Boolean(athlete.archivedAt);
    const matchesFilter = paymentFilter === "ARCHIVADOS" ? archived : !archived && (paymentFilter === "TODOS" || athlete.payment === paymentFilter);
    return matchesFilter && athlete.name.toLocaleLowerCase("es-CL").includes(normalizedQuery);
  }), [state.athletes, paymentFilter, normalizedQuery]);

  const closeForm = () => {
    setFormVisible(false);
    setEditing(null);
    setForm(BLANK);
  };
  const openAdd = () => {
    setEditing(null);
    setForm(BLANK);
    setFormVisible(true);
  };
  const openEdit = (athlete) => {
    setEditing(athlete);
    setForm({
      name: athlete.name ?? "",
      birth: athlete.birth ?? "",
      guardian: athlete.guardian ?? "",
      guardianNotApplicable: Boolean(athlete.guardianNotApplicable),
      phone: athlete.phone ?? "",
      plan: athlete.plan,
      status: athlete.archivedAt ? (athlete.statusBeforeArchive ?? "ACTIVO") : athlete.status,
    });
    setFormVisible(true);
  };
  const saveAthlete = () => {
    if (!form.name.trim() || (!form.guardianNotApplicable && !form.guardian.trim())) {
      Alert.alert("Revisa el formulario", "Ingresa el nombre del atleta y el apoderado, o marca No aplica.");
      return;
    }
    if (!editing) {
      actions.addAthlete({ ...form, guardian: form.guardianNotApplicable ? "" : form.guardian.trim() });
    } else {
      const used = Math.max(0, editing.allocated - editing.remaining);
      const allocated = PLANS[form.plan].sessions;
      actions.updateAthlete(editing.id, {
        ...form,
        name: form.name.trim(),
        guardian: form.guardianNotApplicable ? "" : form.guardian.trim(),
        ...(editing.archivedAt ? { status: "INACTIVO", statusBeforeArchive: form.status } : { status: form.status }),
        allocated,
        remaining: Math.max(0, allocated - used),
      });
    }
    closeForm();
  };
  const toggleArchive = () => {
    if (!editing) return;
    if (editing.archivedAt) actions.restoreAthlete(editing.id);
    else actions.archiveAthlete(editing.id);
    closeForm();
  };
  const deleteAthlete = (athlete) => Alert.alert("Eliminar atleta", `Se eliminará a ${athlete.name} y sus registros asociados.`, [
    { text: "Cancelar", style: "cancel" },
    { text: "Eliminar", style: "destructive", onPress: () => actions.deleteAthlete(athlete.id) },
  ]);
  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <>
      <Screen eyebrow="Gestión del equipo" title="Atletas" subtitle={`${state.athletes.length} registrados · busca, edita y revisa sus pagos`}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 9 }}>
          <Field label="Buscar atleta" value={query} onChangeText={setQuery} placeholder="Nombre del atleta" returnKeyType="search" style={{ flex: 1 }} />
          <ActionButton title="＋ Agregar" onPress={openAdd} style={{ minHeight: 48, paddingHorizontal: 11 }} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {FILTERS.map(([value, label]) => <Chip key={value} label={label} compact selected={paymentFilter === value} onPress={() => onPaymentFilterChange(value)} />)}
        </ScrollView>
        {athletes.length ? athletes.map((athlete) => (
          <View key={athlete.id} style={styles.panel}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.sectionTitle, { fontSize: 16 }]}>{athlete.name}</Text>
                <Text style={styles.small}>{ageOf(athlete.birth)} años · {PLANS[athlete.plan].label}</Text>
              </View>
              <Pressable onPress={() => openEdit(athlete)} accessibilityRole="button" accessibilityLabel={`Editar ${athlete.name}`} hitSlop={10}>
                <Ionicons name="create-outline" color={colors.muted} size={22} />
              </Pressable>
            </View>
            <View style={[styles.separator]} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.small}>{athlete.guardianNotApplicable ? "Sin apoderado" : athlete.guardian || "Sin apoderado registrado"}</Text>
                <Text style={styles.small}>{athlete.allocated - athlete.remaining} de {athlete.allocated} clases usadas · quedan {athlete.remaining}</Text>
              </View>
              <Pressable onPress={() => setPaymentAthlete(athlete)} style={{ flexDirection: "row", alignItems: "center", gap: 5 }} accessibilityRole="button" accessibilityLabel={`Pagos ${PAYMENT[athlete.payment]}`}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: athlete.payment === "AL_DIA" ? colors.green : colors.amber }} />
                <Text style={{ color: athlete.payment === "AL_DIA" ? colors.green : colors.amber, fontWeight: "700", fontSize: 12 }}>{PAYMENT[athlete.payment]}</Text>
              </Pressable>
            </View>
          </View>
        )) : <EmptyState>{state.athletes.length ? "No hay atletas que coincidan con el filtro." : "Aún no hay atletas. Agrega el primero para comenzar."}</EmptyState>}
      </Screen>

      <Modal visible={formVisible} transparent animationType="slide" onRequestClose={closeForm}>
        <View style={styles.modalShade}>
          <View style={styles.modal}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ gap: 3 }}>
                <Text style={styles.eyebrow}>{editing ? "Perfil del atleta" : "Nuevo registro"}</Text>
                <Text style={styles.modalTitle}>{editing ? "Editar atleta" : "Agregar atleta"}</Text>
              </View>
              <Pressable onPress={closeForm} hitSlop={12} accessibilityLabel="Cerrar" accessibilityRole="button"><Ionicons name="close" size={25} color={colors.muted} /></Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 13, paddingBottom: 4 }}>
              <Field label="Nombre completo" value={form.name} onChangeText={(value) => updateForm("name", value)} placeholder="Nombre del atleta" autoCapitalize="words" />
              <DateField label="Fecha de nacimiento" value={form.birth} onChange={ (value) => updateForm("birth", value)} />
              <SelectField label="Plan" value={form.plan} onValueChange={(value) => updateForm("plan", value)} items={PLAN_OPTIONS} />
              <Field label="Nombre del apoderado" value={form.guardian} onChangeText={(value) => updateForm("guardian", value)} placeholder="Apoderado" editable={!form.guardianNotApplicable} />
              <View style={[styles.row, { justifyContent: "space-between" }]}>
                <Text style={styles.body}>No aplica apoderado</Text>
                <Switch value={form.guardianNotApplicable} onValueChange={(value) => setForm((current) => ({ ...current, guardianNotApplicable: value, guardian: value ? "" : current.guardian }))} trackColor={{ true: colors.accent }} thumbColor={colors.text} />
              </View>
              <Field label="WhatsApp" value={form.phone} onChangeText={(value) => updateForm("phone", value.replace(/\D/g, "").slice(0, 9))} placeholder="912345678" keyboardType="phone-pad" maxLength={9} />
              {editing ? <View style={[styles.row, { justifyContent: "space-between" }]}><Text style={styles.body}>Atleta activo</Text><Switch value={form.status === "ACTIVO"} onValueChange={(value) => updateForm("status", value ? "ACTIVO" : "INACTIVO")} trackColor={{ true: colors.accent }} thumbColor={colors.text} /></View> : null}
            </ScrollView>
            {editing ? <ActionButton title={editing.archivedAt ? "Restaurar atleta" : "Archivar atleta"} secondary onPress={toggleArchive} /> : null}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <ActionButton title="Cancelar" secondary onPress={closeForm} style={{ flex: 1 }} />
              <ActionButton title={editing ? "Guardar cambios" : "Agregar atleta"} onPress={saveAthlete} style={{ flex: 1 }} />
            </View>
            {editing ? <ActionButton title="Eliminar atleta" secondary destructive onPress={() => { closeForm(); deleteAthlete(editing); }} /> : null}
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(paymentAthlete)} transparent animationType="slide" onRequestClose={() => setPaymentAthlete(null)}>
        <View style={styles.modalShade}>
          <View style={styles.modal}>
            {paymentAthlete ? (() => {
              const details = getPaymentDetails(paymentAthlete, state.sessions, month);
              const pendingTotal = details.charges.filter((charge) => !charge.paid).reduce((sum, charge) => sum + charge.amount, 0);
              const paidAll = details.charges.length > 0 && details.charges.every((charge) => charge.paid);
              return <>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1, gap: 4 }}><Text style={styles.eyebrow}>Pagos · {paymentAthlete.name}</Text><Text style={styles.modalTitle}>{money(pendingTotal)} pendiente</Text></View>
                  <Pressable onPress={() => setPaymentAthlete(null)} hitSlop={12} accessibilityLabel="Cerrar pagos"><Ionicons name="close" size={25} color={colors.muted} /></Pressable>
                </View>
                <ScrollView contentContainerStyle={{ gap: 10 }}>
                  {details.charges.map((charge) => <View key={charge.key} style={[styles.panel, { padding: 12 }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <View style={{ flex: 1, gap: 3 }}><Text style={[styles.body, { fontWeight: "700" }]}>{charge.title}</Text><Text style={styles.small}>{charge.sessions.length ? `${charge.sessions.length} asistencia(s)` : PLANS[paymentAthlete.plan].label}</Text></View>
                      <Text style={styles.body}>{money(charge.amount)}</Text>
                      <Switch value={charge.paid} onValueChange={(paid) => actions.updatePaymentRecord(paymentAthlete.id, charge.key, paid)} trackColor={{ true: colors.green }} thumbColor={colors.text} />
                    </View>
                  </View>)}
                </ScrollView>
                <ActionButton title={paidAll ? "Todos los pagos al día" : "Marcar todo al día"} onPress={() => actions.markAllPaymentsPaid(paymentAthlete.id)} disabled={paidAll} />
              </>;
            })() : null}
          </View>
        </View>
      </Modal>
    </>
  );
}
