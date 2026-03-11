import proj4 from "proj4";

const WGS84 = "EPSG:4326";
const REGISTERED = new Set();

function parseAustralianMgaCode(crsCode) {
  if (!crsCode) return null;

  const normalized = String(crsCode).trim().toUpperCase();
  const match = normalized.match(/^EPSG:(283(4[9-9]|5[0-6])|78(49|5[0-6]))$/);
  if (!match) return null;

  const epsgNumber = Number(normalized.replace("EPSG:", ""));

  if (epsgNumber >= 28349 && epsgNumber <= 28356) {
    return {
      crsCode: normalized,
      datum: "GDA94",
      zone: epsgNumber - 28300,
      proj4Def: `+proj=utm +zone=${epsgNumber - 28300} +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs`,
    };
  }

  if (epsgNumber >= 7849 && epsgNumber <= 7856) {
    return {
      crsCode: normalized,
      datum: "GDA2020",
      zone: epsgNumber - 7800,
      proj4Def: `+proj=utm +zone=${epsgNumber - 7800} +south +ellps=GRS80 +units=m +no_defs +type=crs`,
    };
  }

  return null;
}

function ensureRegistered(crsCode) {
  const parsed = parseAustralianMgaCode(crsCode);
  if (!parsed) {
    throw new Error(`Unsupported coordinate system: ${crsCode}`);
  }

  if (!REGISTERED.has(parsed.crsCode)) {
    proj4.defs(parsed.crsCode, parsed.proj4Def);
    REGISTERED.add(parsed.crsCode);
  }

  return parsed;
}

function roundCoordinate(value, decimals = 8) {
  return Number(value.toFixed(decimals));
}

export function convertProjectedToWgs84({ crsCode, easting, northing }) {
  const parsed = ensureRegistered(crsCode);
  const east = Number(easting);
  const north = Number(northing);

  if (!Number.isFinite(east) || !Number.isFinite(north)) {
    throw new Error("Projected coordinates must be numeric.");
  }

  const [longitude, latitude] = proj4(parsed.crsCode, WGS84, [east, north]);

  return {
    crsCode: parsed.crsCode,
    datum: parsed.datum,
    zone: parsed.zone,
    longitude: roundCoordinate(longitude),
    latitude: roundCoordinate(latitude),
  };
}
