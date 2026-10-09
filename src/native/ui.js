import { Picker } from "@react-native-picker/picker";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

export const colors = {
  background: "#111311",
  surface: "#1b1e1b",
  raised: "#232723",
  border: "#343a34",
  text: "#f2f1e9",
  muted: "#a6aaa1",
  accent: "#e6bd45",
  green: "#72c49a",
  red: "#e17e71",
  amber: "#efb25d",
  ink: "#151712",
};

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  page: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 28, gap: 18 },
  header: { gap: 4, marginBottom: 2 },
  eyebrow: { color: colors.accent, fontSize: 11, fontWeight: "800", letterSpacing: 1.3, textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 28, fontWeight: "800" },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: "700" },
  body: { color: colors.text, fontSize: 14, lineHeight: 20 },
  small: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  panel: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 15, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  fieldLabel: { color: colors.muted, fontSize: 12, fontWeight: "700", marginBottom: 6 },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 7, backgroundColor: colors.raised, color: colors.text, paddingHorizontal: 12, fontSize: 15 },
  button: { minHeight: 46, borderRadius: 7, paddingHorizontal: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.accent },
  buttonText: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  secondaryButton: { minHeight: 42, paddingHorizontal: 13, alignItems: "center", justifyContent: "center", borderRadius: 7, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.raised },
  secondaryButtonText: { color: colors.text, fontSize: 13, fontWeight: "700" },
  chip: { minHeight: 36, borderRadius: 18, paddingHorizontal: 13, justifyContent: "center", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipCompact: { minHeight: 30, borderRadius: 7, paddingHorizontal: 9 },
  chipMuted: { borderRadius: 6, borderColor: "#454b49", backgroundColor: "#343936" },
  chipActive: { borderColor: colors.accent, backgroundColor: "#433a20" },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: colors.accent },
  separator: { height: 1, backgroundColor: colors.border },
  picker: { minHeight: 50, backgroundColor: colors.raised, color: colors.text, borderColor: colors.border },
  modalShade: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.72)" },
  modal: { maxHeight: "92%", backgroundColor: colors.background, borderTopLeftRadius: 14, borderTopRightRadius: 14, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 30, borderWidth: 1, borderColor: colors.border, gap: 14 },
  modalTitle: { color: colors.text, fontSize: 21, fontWeight: "800" },
  status: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12, backgroundColor: colors.raised },
});

export function Screen({ eyebrow, title, subtitle, children, contentStyle }) {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.page, contentStyle]}>
        <View style={styles.header}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Field({ label, style, inputStyle, ...props }) {
  return (
    <View style={[{ flex: 1 }, style]}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput placeholderTextColor="#777d74" {...props} style={[styles.input, inputStyle]} />
    </View>
  );
}

const pad = (value) => String(value).padStart(2, "0");
const dateFromISO = (value) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date();
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export function DateField({ label, value, onChange, placeholder = "Seleccionar fecha" }) {
  const [visible, setVisible] = useState(false);
  const [shownMonth, setShownMonth] = useState(() => {
    const date = dateFromISO(value);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const selectedDate = value ? dateFromISO(value) : null;
  const monthTitle = shownMonth.toLocaleDateString("es-CL", { month: "long", year: "numeric" });
  const daysInMonth = new Date(shownMonth.getFullYear(), shownMonth.getMonth() + 1, 0).getDate();
  const offset = (new Date(shownMonth.getFullYear(), shownMonth.getMonth(), 1).getDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = index - offset + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });
  const moveMonth = (amount) => setShownMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  const chooseDay = (day) => {
    onChange(`${shownMonth.getFullYear()}-${pad(shownMonth.getMonth() + 1)}-${pad(day)}`);
    setVisible(false);
  };
  const openCalendar = () => {
    const date = dateFromISO(value);
    setShownMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    setVisible(true);
  };

  return (
    <View style={{ flex: 1 }}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <Pressable onPress={openCalendar} accessibilityRole="button" accessibilityLabel={`${label ?? "Fecha"}: ${value || placeholder}`} style={({ pressed }) => [styles.input, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, pressed && { opacity: 0.78 }]}>
        <Text style={{ color: selectedDate ? colors.text : "#777d74", fontSize: 15 }}>
          {selectedDate ? selectedDate.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" }) : placeholder}
        </Text>
        <Ionicons name="calendar-outline" size={19} color={colors.accent} />
      </Pressable>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <View style={[styles.modalShade, { justifyContent: "center", padding: 18 }]}>
          <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 16, gap: 16 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={styles.sectionTitle}>Seleccionar fecha</Text>
              <Pressable onPress={() => setVisible(false)} hitSlop={10} accessibilityLabel="Cerrar calendario"><Ionicons name="close" size={23} color={colors.muted} /></Pressable>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Pressable onPress={() => moveMonth(-1)} hitSlop={12} accessibilityLabel="Mes anterior" style={{ padding: 6 }}><Ionicons name="chevron-back" size={21} color={colors.text} /></Pressable>
              <Text style={[styles.body, { fontWeight: "800" }]}>{monthTitle}</Text>
              <Pressable onPress={() => moveMonth(1)} hitSlop={12} accessibilityLabel="Mes siguiente" style={{ padding: 6 }}><Ionicons name="chevron-forward" size={21} color={colors.text} /></Pressable>
            </View>
            <View style={{ flexDirection: "row" }}>
              {["L", "M", "X", "J", "V", "S", "D"].map((weekday, index) => <Text key={`${weekday}-${index}`} style={{ width: `${100 / 7}%`, textAlign: "center", color: colors.muted, fontSize: 12, fontWeight: "700", paddingVertical: 7 }}>{weekday}</Text>)}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {days.map((day, index) => {
                const selected = day && selectedDate && selectedDate.getFullYear() === shownMonth.getFullYear() && selectedDate.getMonth() === shownMonth.getMonth() && selectedDate.getDate() === day;
                return (
                  <View key={index} style={{ width: `${100 / 7}%`, padding: 2 }}>
                    {day ? <Pressable onPress={() => chooseDay(day)} accessibilityRole="button" accessibilityLabel={`${day} ${monthTitle}`} style={({ pressed }) => [{ aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: selected ? colors.accent : "transparent" }, pressed && !selected && { backgroundColor: colors.raised }]}>
                      <Text style={{ color: selected ? colors.ink : colors.text, fontSize: 14, fontWeight: selected ? "800" : "500" }}>{day}</Text>
                    </Pressable> : <View style={{ aspectRatio: 1 }} />}
                  </View>
                );
              })}
            </View>
            <Pressable onPress={() => { const now = new Date(); setShownMonth(new Date(now.getFullYear(), now.getMonth(), 1)); onChange(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`); setVisible(false); }} style={{ alignSelf: "flex-end", paddingHorizontal: 8, paddingVertical: 5 }}>
              <Text style={{ color: colors.accent, fontSize: 14, fontWeight: "800" }}>Hoy</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export function SelectField({ label, value, onValueChange, items, style }) {
  return (
    <View style={[{ flex: 1 }, style]}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <View style={{ overflow: "hidden", borderColor: colors.border, borderWidth: 1, borderRadius: 7, backgroundColor: colors.raised }}>
        <Picker selectedValue={value} onValueChange={onValueChange} style={styles.picker} dropdownIconColor={colors.accent}>
          {items.map((item) => <Picker.Item key={item.value} label={item.label} value={item.value} color={colors.text} />)}
        </Picker>
      </View>
    </View>
  );
}

export function ActionButton({ title, onPress, secondary, destructive, disabled, style }) {
  const buttonStyle = secondary ? styles.secondaryButton : styles.button;
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [buttonStyle, destructive && { borderColor: colors.red }, disabled && { opacity: 0.45 }, pressed && !disabled && { opacity: 0.78 }, style]}>
      <Text style={[secondary ? styles.secondaryButtonText : styles.buttonText, destructive && { color: colors.red }]}>{title}</Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, style, compact, variant }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, compact && styles.chipCompact, variant === "muted" && styles.chipMuted, selected && variant !== "muted" && styles.chipActive, style]}>
      <Text style={[styles.chipText, selected && variant !== "muted" && styles.chipTextActive, variant === "muted" && { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export function EmptyState({ children }) {
  return <View style={[styles.panel, { alignItems: "center", paddingVertical: 24 }]}><Text style={styles.small}>{children}</Text></View>;
}
