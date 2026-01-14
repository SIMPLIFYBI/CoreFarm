"use client";

import { useMemo } from "react";
import { computeMaxDepth } from "../utils/computeMaxDepth";

export default function DepthScalePreview({ plannedDepth, actualDepth, svgPxHeight = 620 }) {
  const planned = Number(plannedDepth);
  const actual = Number(actualDepth);

  const hasPlanned = Number.isFinite(planned) && planned > 0;
  const hasActual = Number.isFinite(actual) && actual > 0;

  const maxDepth = useMemo(() => {
    return computeMaxDepth({ plannedDepth, actualDepth, minDepth: 30, step: 10 });
  }, [plannedDepth, actualDepth]);

  const tickEvery = 5;
  const labelEvery = 10;

  const H = 620;
  const W = 180;
  const padTop = 30;
  const padBottom = 40;

  const yForDepth = (d) => {
    const clamped = Math.max(0, Math.min(maxDepth, d));
    const t = clamped / maxDepth;
    return padTop + t * (H - padTop - padBottom);
  };

  const plannedY = hasPlanned ? yForDepth(planned) : null;
  const actualY = hasActual ? yForDepth(actual) : null;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <div className="text-sm font-medium text-slate-100">Depth scale</div>
        <div className="text-[11px] text-slate-400">0 → {maxDepth}m</div>
      </div>

      <div style={{ height: `${svgPxHeight}px` }} className="w-full">
        <svg
          className="block h-full w-full"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
        >
          <rect
            x="0"
            y="0"
            width={W}
            height={H}
            rx="10"
            fill="rgba(15,23,42,0.45)"
            stroke="rgba(255,255,255,0.10)"
          />

          <line x1="60" y1={padTop} x2="60" y2={H - padBottom} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />

          {Array.from({ length: Math.floor(maxDepth / tickEvery) + 1 }, (_, i) => i * tickEvery).map((d) => {
            const y = yForDepth(d);
            const isLabel = d % labelEvery === 0;
            return (
              <g key={d}>
                <line
                  x1={isLabel ? 48 : 54}
                  y1={y}
                  x2={60}
                  y2={y}
                  stroke="rgba(255,255,255,0.25)"
                  strokeWidth={isLabel ? 1.2 : 1}
                />
                {isLabel && (
                  <text x="10" y={y + 4} fontSize="10" fill="rgba(226,232,240,0.85)">
                    {d}m
                  </text>
                )}
              </g>
            );
          })}

          {hasPlanned && <line x1={70} y1={plannedY} x2={W - 10} y2={plannedY} stroke="rgba(99,102,241,0.95)" strokeWidth="1.5" />}
          {hasActual && <line x1={70} y1={actualY} x2={W - 10} y2={actualY} stroke="rgba(16,185,129,0.95)" strokeWidth="1.5" />}
        </svg>
      </div>
    </div>
  );
}