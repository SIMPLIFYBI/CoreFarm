export const LITHOLOGY_PATTERN_OPTIONS = [
  { key: "solid", label: "Solid" },
  { key: "dots", label: "Fine grain" },
  { key: "speckle", label: "Pebble" },
  { key: "dash", label: "Vein" },
  { key: "crosshatch", label: "Fractured" },
  { key: "bedding", label: "Layered" },
  { key: "chevron", label: "Folded" },
];

const VALID_PATTERN_KEYS = new Set(LITHOLOGY_PATTERN_OPTIONS.map((option) => option.key));

export function normalizeLithologyPatternKey(value) {
  const key = String(value || "solid").trim().toLowerCase();
  return VALID_PATTERN_KEYS.has(key) ? key : "solid";
}