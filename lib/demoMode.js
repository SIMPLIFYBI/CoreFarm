const DEFAULT_DEMO_ORG_ID = "d012a71c-e9e2-4cd3-a3ba-08dcef8519ec";
const DEFAULT_DEMO_ORG_NAME = "Shared Demo";

export const DEMO_ORG_ID = String(process.env.NEXT_PUBLIC_DEMO_ORG_ID || DEFAULT_DEMO_ORG_ID).trim();
export const DEMO_ORG_NAME = String(process.env.NEXT_PUBLIC_DEMO_ORG_NAME || DEFAULT_DEMO_ORG_NAME).trim();

export const PUBLIC_DEMO_ROUTE_PREFIXES = [
  "/map",
  "/dashboard",
  "/activity",
  "/coretasks",
  "/drillhole-viz",
  "/projects",
  "/assets",
  "/plods",
  "/how-to",
  "/preview",
];

export function isPublicDemoEnabled() {
  return Boolean(DEMO_ORG_ID);
}

export function isPublicDemoRoute(pathname) {
  const normalizedPath = String(pathname || "").trim();
  if (!normalizedPath) return false;

  return PUBLIC_DEMO_ROUTE_PREFIXES.some((prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`));
}