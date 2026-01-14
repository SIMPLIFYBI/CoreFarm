export const DEPTH_PAD_TOP = 30;
export const DEPTH_PAD_BOTTOM = 40;

// 150m ≈ 150 * 4.2 = 630px (plus 70px padding ≈ 700px total)
// Tweak this number to taste.
export const PX_PER_M = 4.2;

export function svgHeightForMaxDepth(maxDepth) {
  const md = Math.max(0, Number(maxDepth) || 0);
  return Math.round(DEPTH_PAD_TOP + DEPTH_PAD_BOTTOM + md * PX_PER_M);
}