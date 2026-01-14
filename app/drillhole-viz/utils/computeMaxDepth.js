export function computeMaxDepth({ plannedDepth, actualDepth, minDepth = 30, step = 10 }) {
  const planned = Number(plannedDepth);
  const actual = Number(actualDepth);

  const hasPlanned = Number.isFinite(planned) && planned > 0;
  const hasActual = Number.isFinite(actual) && actual > 0;

  const m = Math.max(hasPlanned ? planned : 0, hasActual ? actual : 0, minDepth);
  return Math.ceil(m / step) * step;
}