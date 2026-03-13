import { convertProjectedToWgs84 } from "@/lib/coordinateTransforms";

export function deriveHoleCoordinates({
  collarLongitude,
  collarLatitude,
  collarEasting,
  collarNorthing,
  projectCrsCode,
}) {
  const longitude = collarLongitude ?? null;
  const latitude = collarLatitude ?? null;

  if (longitude != null && latitude != null) {
    return {
      collarLongitude: longitude,
      collarLatitude: latitude,
      coordinateDerived: false,
    };
  }

  if (collarEasting == null || collarNorthing == null || !projectCrsCode) {
    return {
      collarLongitude: longitude,
      collarLatitude: latitude,
      coordinateDerived: false,
    };
  }

  try {
    const converted = convertProjectedToWgs84({
      crsCode: projectCrsCode,
      easting: collarEasting,
      northing: collarNorthing,
    });

    return {
      collarLongitude: converted.longitude,
      collarLatitude: converted.latitude,
      coordinateDerived: true,
    };
  } catch {
    return {
      collarLongitude: longitude,
      collarLatitude: latitude,
      coordinateDerived: false,
    };
  }
}
