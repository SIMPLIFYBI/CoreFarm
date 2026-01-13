"use client";

import { useMemo } from "react";

export default function DepthScalePreview({ plannedDepth, actualDepth }) {
  const planned = Number(plannedDepth);
  const actual = Number(actualDepth);

  const hasPlanned = Number.isFinite(planned) && planned > 0;
  const hasActual = Number.isFinite(actual) && actual > 0;

  const progressPct = useMemo(() => {
    if (!hasPlanned || !hasActual) return null;
    return Math.max(0, Math.min(999, (actual / planned) * 100));
  }, [hasPlanned, hasActual, actual, planned]);

  const overrunM = useMemo(() => {
    if (!hasPlanned || !hasActual) return null;
    return Math.max(0, actual - planned);
  }, [hasPlanned, hasActual, actual, planned]);

  // Always scale to the higher of planned vs actual (so both markers are visible)
  const maxDepth = useMemo(() => {
    const m = Math.max(hasPlanned ? planned : 0, hasActual ? actual : 0, 100);
    return Math.ceil(m / 50) * 50; // round up to nearest 50m for nicer ticks
  }, [planned, actual, hasPlanned, hasActual]);

  const H = 520;
  const W = 160;
  const padTop = 20;
  const padBottom = 30;
  const barX = 90;
  const barW = 22;

  const yForDepth = (d) => {
    const clamped = Math.max(0, Math.min(maxDepth, d));
    const t = clamped / maxDepth;
    return padTop + t * (H - padTop - padBottom);
  };

  const plannedY = hasPlanned ? yForDepth(planned) : null;
  const actualY = hasActual ? yForDepth(actual) : null;

  const tickEvery = 10;
  const labelEvery = 50;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <div className="text-sm font-medium text-slate-100">Depth scale</div>
        <div className="text-[11px] text-slate-400">0 → {maxDepth}m</div>
      </div>

      <div className="text-[11px] text-slate-300">
        Planned: <span className="text-slate-100">{hasPlanned ? `${planned}m` : "—"}</span> · Actual:{" "}
        <span className="text-slate-100">{hasActual ? `${actual}m` : "—"}</span>
        {progressPct != null && (
          <>
            {" "}
            · Progress: <span className="text-slate-100">{progressPct.toFixed(1)}%</span>
          </>
        )}
        {overrunM != null && overrunM > 0 && (
          <>
            {" "}
            · Overrun: <span className="text-amber-300">{overrunM.toFixed(1)}m</span>
          </>
        )}
      </div>

      {!hasPlanned && (
        <div className="text-[11px] text-amber-300">
          Planned depth is not set. Hatched “beyond planned” can’t be shown until planned depth exists.
        </div>
      )}

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="block">
        <defs>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
          </pattern>
        </defs>

        <rect
          x="0"
          y="0"
          width={W}
          height={H}
          rx="10"
          fill="rgba(15,23,42,0.45)"
          stroke="rgba(255,255,255,0.10)"
        />

        <line x1="50" y1={padTop} x2="50" y2={H - padBottom} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />

        {Array.from({ length: Math.floor(maxDepth / tickEvery) + 1 }, (_, i) => i * tickEvery).map((d) => {
          const y = yForDepth(d);
          const isLabel = d % labelEvery === 0;
          return (
            <g key={d}>
              <line
                x1={isLabel ? 42 : 46}
                y1={y}
                x2={50}
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

        {hasPlanned && (
          <g>
            <rect
              x={barX}
              y={padTop}
              width={barW}
              height={plannedY - padTop}
              rx="6"
              fill="rgba(99,102,241,0.55)"
              stroke="rgba(99,102,241,0.95)"
            />
            <line
              x1={barX - 10}
              y1={plannedY}
              x2={barX + barW + 10}
              y2={plannedY}
              stroke="rgba(99,102,241,0.95)"
              strokeWidth="1.5"
            />
            <text x={barX + barW + 14} y={plannedY + 4} fontSize="10" fill="rgba(226,232,240,0.9)">
              Planned: {planned}m
            </text>
          </g>
        )}

        {hasActual && (
          <g>
            <line
              x1={barX + barW / 2}
              y1={padTop}
              x2={barX + barW / 2}
              y2={actualY}
              stroke="rgba(16,185,129,0.9)"
              strokeWidth="2"
            />
            <line
              x1={barX - 10}
              y1={actualY}
              x2={barX + barW + 10}
              y2={actualY}
              stroke="rgba(16,185,129,0.95)"
              strokeWidth="1.5"
            />
            <text x={barX + barW + 14} y={actualY + 4} fontSize="10" fill="rgba(226,232,240,0.9)">
              Actual: {actual}m
            </text>
          </g>
        )}

        {hasPlanned && hasActual && actual > planned && (
          <rect
            x={barX}
            y={plannedY}
            width={barW}
            height={actualY - plannedY}
            rx="6"
            fill="url(#hatch)"
            stroke="rgba(255,255,255,0.25)"
          />
        )}
      </svg>

      <div className="text-[11px] text-slate-400">Blue = planned. Green = actual. Hatched = beyond plan.</div>
    </div>
  );
}