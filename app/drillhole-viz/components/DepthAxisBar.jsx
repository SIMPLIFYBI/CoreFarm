"use client";

import { useMemo } from "react";
import { computeMaxDepth } from "../utils/computeMaxDepth";

export default function DepthAxisBar({
  plannedDepth,
  actualDepth,
  waterLevel,
  svgPxHeight = 620,
  minDepth = 30,
  step = 10,
  tickEvery = 5,
  labelEvery = 10,
}) {
  const planned = Number(plannedDepth);
  const actual = Number(actualDepth);
  const water = Number(waterLevel);

  const hasPlanned = Number.isFinite(planned) && planned > 0;
  const hasActual = Number.isFinite(actual) && actual > 0;
  const hasWater = Number.isFinite(water) && water >= 0;

  const H = 620;
  const W = 90;
  const padTop = 30;
  const padBottom = 40;

  const maxDepth = useMemo(() => {
    return computeMaxDepth({ plannedDepth, actualDepth, minDepth, step });
  }, [plannedDepth, actualDepth, minDepth, step]);

  const yForDepth = (d) => {
    const clamped = Math.max(0, Math.min(maxDepth, d));
    const t = clamped / maxDepth;
    return padTop + t * (H - padTop - padBottom);
  };

  const plannedY = hasPlanned ? yForDepth(planned) : null;
  const actualY = hasActual ? yForDepth(actual) : null;
  const waterY = hasWater ? yForDepth(water) : null;

  return (
    <div style={{ height: `${svgPxHeight}px` }} className="w-[90px] shrink-0">
      <svg className="block h-full w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMinYMin meet">
        <rect
          x="0"
          y="0"
          width={W}
          height={H}
          rx="10"
          fill="rgba(15,23,42,0.35)"
          stroke="rgba(255,255,255,0.10)"
        />

        {/* Axis line */}
        <line x1="62" y1={padTop} x2="62" y2={H - padBottom} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />

        {/* Ticks + labels */}
        {Array.from({ length: Math.floor(maxDepth / tickEvery) + 1 }, (_, i) => i * tickEvery).map((d) => {
          const y = yForDepth(d);
          const major = d % labelEvery === 0;
          return (
            <g key={d}>
              <line
                x1={major ? 50 : 56}
                y1={y}
                x2={62}
                y2={y}
                stroke="rgba(255,255,255,0.25)"
                strokeWidth={major ? 1.2 : 1}
              />
              {major && (
                <text x="10" y={y + 4} fontSize="10" fill="rgba(226,232,240,0.85)">
                  {d}m
                </text>
              )}
            </g>
          );
        })}

        {/* Markers (small) */}
        {hasWater && <line x1="64" y1={waterY} x2={W - 8} y2={waterY} stroke="rgba(59,130,246,0.9)" strokeWidth="2" />}
        {hasActual && <line x1="64" y1={actualY} x2={W - 8} y2={actualY} stroke="rgba(16,185,129,0.9)" strokeWidth="2" />}
        {hasPlanned && <line x1="64" y1={plannedY} x2={W - 8} y2={plannedY} stroke="rgba(99,102,241,0.9)" strokeWidth="2" />}
      </svg>
    </div>
  );
}