export const AUSTRALIAN_PROJECT_CRS = [
  { code: "EPSG:28349", name: "GDA94 / MGA zone 49" },
  { code: "EPSG:28350", name: "GDA94 / MGA zone 50" },
  { code: "EPSG:28351", name: "GDA94 / MGA zone 51" },
  { code: "EPSG:28352", name: "GDA94 / MGA zone 52" },
  { code: "EPSG:28353", name: "GDA94 / MGA zone 53" },
  { code: "EPSG:28354", name: "GDA94 / MGA zone 54" },
  { code: "EPSG:28355", name: "GDA94 / MGA zone 55" },
  { code: "EPSG:28356", name: "GDA94 / MGA zone 56" },
  { code: "EPSG:7849", name: "GDA2020 / MGA zone 49" },
  { code: "EPSG:7850", name: "GDA2020 / MGA zone 50" },
  { code: "EPSG:7851", name: "GDA2020 / MGA zone 51" },
  { code: "EPSG:7852", name: "GDA2020 / MGA zone 52" },
  { code: "EPSG:7853", name: "GDA2020 / MGA zone 53" },
  { code: "EPSG:7854", name: "GDA2020 / MGA zone 54" },
  { code: "EPSG:7855", name: "GDA2020 / MGA zone 55" },
  { code: "EPSG:7856", name: "GDA2020 / MGA zone 56" },
];

export function getAustralianProjectCrsByCode(code) {
  return AUSTRALIAN_PROJECT_CRS.find((item) => item.code === code) || null;
}
