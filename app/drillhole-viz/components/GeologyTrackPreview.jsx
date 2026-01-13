"use client";

import { useMemo } from "react";

export default function GeologyTrackPreview({ plannedDepth, actualDepth, intervals, lithById }) {
  const planned = Number(plannedDepth);
  const actual = Number(actualDepth);

  const hasPlanned = Number.isFinite(planned) && planned > 0;
  const hasActual = Number.isFinite(actual) && actual > 0;

  const maxDepth = useMemo(() => {
    const m = Math.max(hasPlanned ? planned : 0, hasActual ? actual : 0, 100);
    return Math.ceil(m / 50) * 50;
  }, [planned, actual, hasPlanned, hasActual]);

  const normalized = useMemo(() => {
    return (intervals || [])
      .map((r) => {
        const from = Number(r.from_m);
        const to = Number(r.to_m);
        const lithology_type_id = r.lithology_type_id || "";
        if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
        if (!(from < to)) return null;
        if (!lithology_type_id) return null;

        return {
          id: r.id || null,
          from,
          to,
          lithology_type_id,
          notes: r.notes || "",
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.from - b.from);
  }, [intervals]);

  const H = 520;
  const W = 520;
  const padTop = 20;
  const padBottom = 30;

  const trackX = 220;
  const trackW = 120;

  const yForDepth = (d) => {
    const clamped = Math.max(0, Math.min(maxDepth, d));
    const t = clamped / maxDepth;
    return padTop + t * (H - padTop - padBottom);
  };

  const plannedY = hasPlanned ? yForDepth(planned) : null;
  const actualY = hasActual ? yForDepth(actual) : null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="block">
        <defs>
          <pattern id="geoHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,0.22)" strokeWidth="2" />
          </pattern>
          <clipPath id="geoTrackClip">
            <rect x={trackX} y={padTop} width={trackW} height={H - padTop - padBottom} rx="10" />
          </clipPath>
        </defs>

        <rect x="0" y="0" width={W} height={H} rx="12" fill="rgba(15,23,42,0.35)" stroke="rgba(255,255,255,0.10)" />

        <rect
          x={trackX}
          y={padTop}
          width={trackW}
          height={H - padTop - padBottom}
          rx="10"
          fill="rgba(2,6,24,0.35)"
          stroke="rgba(255,255,255,0.18)"
        />

        <g clipPath="url(#geoTrackClip)">
          {(normalized || []).map((it, i) => {
            const t = it.lithology_type_id ? lithById?.get?.(it.lithology_type_id) : null;
            const color = t?.color || "#64748b";

            const y1 = yForDepth(it.from);
            const y2 = yForDepth(it.to);
            const h = Math.max(0, y2 - y1);
            if (h <= 0.5) return null;

            const label = t?.name || "Lithology";
            const showText = h >= 18;

            return (
              <g key={it.id || `${it.lithology_type_id}-${it.from}-${it.to}-${i}`}>
                <rect
                  x={trackX + 2}
                  y={y1}
                  width={trackW - 4}
                  height={h}
                  fill={color}
                  fillOpacity="0.88"
                  stroke="rgba(255,255,255,0.18)"
                >
                  <title>
                    {label} · {it.from.toFixed(1)}–{it.to.toFixed(1)}m{it.notes ? ` · ${it.notes}` : ""}
                  </title>
                </rect>

                {showText && (
                  <text
                    x={trackX + trackW / 2}
                    y={y1 + Math.min(h - 6, 16)}
                    textAnchor="middle"
                    fontSize="11"
                    fill="rgba(2,6,24,0.95)"
                  >
                    {label}
                  </text>
                )}
              </g>
            );
          })}

          {hasPlanned && hasActual && actual > planned && (
            <rect x={trackX} y={plannedY} width={trackW} height={Math.max(0, actualY - plannedY)} fill="url(#geoHatch)" />
          )}
        </g>

        {hasPlanned && (
          <g>
            <line
              x1={trackX - 24}
              y1={plannedY}
              x2={trackX + trackW + 24}
              y2={plannedY}
              stroke="rgba(99,102,241,0.95)"
              strokeWidth="1.5"
            />
            <text x={trackX + trackW + 30} y={plannedY + 4} fontSize="10" fill="rgba(226,232,240,0.9)">
              Planned {planned}m
            </text>
          </g>
        )}

        {hasActual && (
          <g>
            <line
              x1={trackX - 24}
              y1={actualY}
              x2={trackX + trackW + 24}
              y2={actualY}
              stroke="rgba(16,185,129,0.95)"
              strokeWidth="1.5"
            />
            <text x={trackX + trackW + 30} y={actualY + 4} fontSize="10" fill="rgba(226,232,240,0.9)">
              Actual {actual}m
            </text>
          </g>
        )}

        {normalized.length === 0 && (
          <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="12" fill="rgba(148,163,184,0.9)">
            No geology intervals
          </text>
        )}
      </svg>

      <div className="mt-2 text-[11px] text-slate-400">Tip: add intervals in the <b>Geology</b> tab, then they’ll appear here.</div>
    </div>
  );
}