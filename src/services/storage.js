import { EMPTY_STATE } from "../utils/constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "arevs-method:data:v1";

export const loadData = async () => {
  const serialized = await AsyncStorage.getItem(STORAGE_KEY);
  const stored = serialized ? JSON.parse(serialized) : EMPTY_STATE;
  return {
    ...EMPTY_STATE,
    ...stored,
    athletes: (stored.athletes ?? []).map((athlete) => {
      const {
        paymentArchivedAt,
        paymentArchivedAmount,
        paymentArchivedDetails,
        ...currentAthlete
      } = athlete;
      const archivedRecords = Object.fromEntries(
        (paymentArchivedDetails?.charges ?? []).map((charge) => [
          charge.key,
          { paid: true, paidAt: paymentArchivedAt ?? null },
        ]),
      );
      const paymentRecords = {
        ...archivedRecords,
        ...(athlete.paymentRecords ?? {}),
      };
      return {
        ...currentAthlete,
        payment:
          athlete.payment === "VENCIDO"
            ? "PENDIENTE"
            : (athlete.payment ?? "PENDIENTE"),
        ...(athlete.paymentRecords || Object.keys(archivedRecords).length
          ? { paymentRecords }
          : {}),
      };
    }),
  };
};
export const saveData = (state) =>
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
