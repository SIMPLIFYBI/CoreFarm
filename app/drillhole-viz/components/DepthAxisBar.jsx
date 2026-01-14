"use client";

import { useMemo } from "react";
import { computeMaxDepth } from "../utils/computeMaxDepth";
import { DEPTH_PAD_TOP, DEPTH_PAD_BOTTOM, PX_PER_M, svgHeightForMaxDepth } from "../utils/depthScaleConfig";

export default function DepthAxisBar({
  plannedDepth,
  actualDepth,
  waterLevel,
  minDepth = 30,
  step = 10,
  tickEvery = 1,
  labelEvery = 5,
}) {
  const planned = Number(plannedDepth);
  const actual = Number(actualDepth);
  const water = Number(waterLevel);

  const hasPlanned = Number.isFinite(planned) && planned > 0;
  const hasActual = Number.isFinite(actual) && actual > 0;
  const hasWater = Number.isFinite(water) && water >= 0;

  const maxDepth = useMemo(() => {
    return computeMaxDepth({ plannedDepth, actualDepth, minDepth, step });
  }, [plannedDepth, actualDepth, minDepth, step]);

  const W = 90;
  const padTop = DEPTH_PAD_TOP;
  const padBottom = DEPTH_PAD_BOTTOM;
  const H = svgHeightForMaxDepth(maxDepth);

  const yForDepth = (d) => padTop + Math.max(0, Math.min(maxDepth, d)) * PX_PER_M;

  const plannedY = hasPlanned ? yForDepth(planned) : null;
  const actualY = hasActual ? yForDepth(actual) : null;
  const waterY = hasWater ? yForDepth(water) : null;

  return (
    <div className="shrink-0">
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMinYMin meet"
        className="block"
      >
        <rect
          x="0"
          y="0"
          width={W}
          height={H}
          rx="10"
          fill="rgba(15,23,42,0.35)"
          stroke="rgba(255,255,255,0.10)"
        />

        <line x1="62" y1={padTop} x2="62" y2={H - padBottom} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />

        {Array.from({ length: Math.floor(maxDepth / tickEvery) + 1 }, (_, i) => i * tickEvery).map((d) => {
          const y = yForDepth(d);
          const major = d % labelEvery === 0;
          const x1 = major ? 48 : 56;

          return (
            <g key={d}>
              <line x1={x1} y1={y} x2={62} y2={y} stroke="rgba(255,255,255,0.25)" strokeWidth={major ? 1.2 : 1} />
              {major && (
                <text x="10" y={y + 4} fontSize="10" fill="rgba(226,232,240,0.85)">
                  {d}m
                </text>
              )}
            </g>
          );
        })}

        {hasWater && <line x1="64" y1={waterY} x2={W - 8} y2={waterY} stroke="rgba(59,130,246,0.9)" strokeWidth="2" />}
        {hasActual && <line x1="64" y1={actualY} x2={W - 8} y2={actualY} stroke="rgba(16,185,129,0.9)" strokeWidth="2" />}
        {hasPlanned && <line x1="64" y1={plannedY} x2={W - 8} y2={plannedY} stroke="rgba(99,102,241,0.9)" strokeWidth="2" />}
      </svg>
    </div>
  );
}