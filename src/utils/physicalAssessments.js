export const PHYSICAL_METRICS = [
  { key: "bilateralLongJump", label: "Salto largo bipodal", unit: "cm", direction: "higher", optional: true },
  { key: "unilateralRightJump", label: "Salto unipodal · pierna derecha", unit: "cm", direction: "higher", optional: true },
  { key: "unilateralLeftJump", label: "Salto unipodal · pierna izquierda", unit: "cm", direction: "higher", optional: true },
  { key: "verticalJump", label: "Salto vertical", unit: "cm", direction: "higher", optional: true },
  { key: "sprint5m", label: "Sprint 5 metros", unit: "s", direction: "lower", optional: true },
  { key: "agilityTest", label: "Test de agilidad", unit: "s", direction: "lower", optional: true },
];

export const normalizePhysicalMetrics = (metrics) => {
  if (!Array.isArray(metrics)) return PHYSICAL_METRICS;
  const keys = new Set();
  const normalized = metrics.flatMap((metric) => {
    const key = typeof metric?.key === "string" ? metric.key.trim() : "";
    const label = typeof metric?.label === "string" ? metric.label.trim() : "";
    const unit = typeof metric?.unit === "string" ? metric.unit.trim() : "";
    if (!key || !label || !unit || keys.has(key)) return [];
    keys.add(key);
    return [{
      key,
      label: label.slice(0, 60),
      unit: unit.slice(0, 12),
      direction: metric.direction === "lower" ? "lower" : "higher",
      optional: metric.optional !== false,
    }];
  });
  return normalized.length ? normalized : PHYSICAL_METRICS;
};

const parseMeasurement = (value, label) => {
  if (value === "" || value == null) return null;
  const normalized = String(value).trim().replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
    throw new Error(`Ingresa un valor numérico válido para ${label}.`);
  }
  const measurement = Number(normalized);
  if (!Number.isFinite(measurement) || measurement <= 0) {
    throw new Error(`${label} debe ser mayor que cero.`);
  }
  return measurement;
};

export const createPhysicalAssessment = (athleteId, form, id, metrics = PHYSICAL_METRICS) => {
  const results = Object.fromEntries(metrics.map(({ key, label, optional }) => {
    if (optional === false && (form[key] === "" || form[key] == null)) {
      throw new Error(`${label} es obligatorio.`);
    }
    return [key, parseMeasurement(form[key], label)];
  }));
  if (!Object.values(results).some((value) => value !== null)) {
    throw new Error("Ingresa al menos un resultado de prueba.");
  }
  return { id, athleteId, date: form.date, createdAt: new Date().toISOString(), results };
};

export const getMetricTrend = (assessments, metric) => {
  const history = assessments
    .filter((assessment) => assessment.results?.[metric.key] != null && Number.isFinite(assessment.results[metric.key]))
    .sort((first, second) => first.date.localeCompare(second.date) ||
      (first.createdAt ?? "").localeCompare(second.createdAt ?? "") || first.id.localeCompare(second.id));
  if (!history.length) return null;
  const baseline = history[0];
  const current = history[history.length - 1];
  const changePercent = baseline.results[metric.key] === 0
    ? null
    : ((current.results[metric.key] - baseline.results[metric.key]) / baseline.results[metric.key]) * 100;
  const improved = changePercent == null ? null : metric.direction === "higher" ? changePercent > 0 : changePercent < 0;
  return { history, baseline, current, changePercent, improved };
};
