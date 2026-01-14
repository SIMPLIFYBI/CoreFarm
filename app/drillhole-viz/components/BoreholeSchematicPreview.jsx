"use client";

import { useId, useMemo } from "react";
import { computeMaxDepth } from "../utils/computeMaxDepth";
import { DEPTH_PAD_TOP, DEPTH_PAD_BOTTOM, PX_PER_M, svgHeightForMaxDepth } from "../utils/depthScaleConfig";

export default function BoreholeSchematicPreview({
  plannedDepth,
  actualDepth,
  geologyIntervals,
  lithById,
  annulusIntervals,
  annulusById,
  constructionIntervals,
  constructionById,
  waterLevel,
}) {
  const uid = useId();

  const planned = Number(plannedDepth);
  const actual = Number(actualDepth);
  const water = Number(waterLevel);

  const hasPlanned = Number.isFinite(planned) && planned > 0;
  const hasActual = Number.isFinite(actual) && actual > 0;
  const hasWater = Number.isFinite(water) && water >= 0;

  const maxDepth = useMemo(() => {
    return computeMaxDepth({ plannedDepth, actualDepth, minDepth: 30, step: 10 });
  }, [plannedDepth, actualDepth]);

  const W = 980; // fixed => never gets wider
  const padTop = DEPTH_PAD_TOP;
  const padBottom = DEPTH_PAD_BOTTOM;
  const H = svgHeightForMaxDepth(maxDepth);

  const yForDepth = (d) => padTop + Math.max(0, Math.min(maxDepth, d)) * PX_PER_M;

  const plannedY = hasPlanned ? yForDepth(planned) : null;
  const actualY = hasActual ? yForDepth(actual) : null;
  const waterY = hasWater ? yForDepth(water) : null;

  const clipId = `schemClip-${uid}`;

  const normGeology = useMemo(() => {
    return (geologyIntervals || [])
      .map((r) => {
        const from = Number(r.from_m);
        const to = Number(r.to_m);
        const id = r.lithology_type_id || "";
        if (!Number.isFinite(from) || !Number.isFinite(to) || !(from < to) || !id) return null;
        return { id: r.id || null, from, to, typeId: id, notes: r.notes || "" };
      })
      .filter(Boolean)
      .sort((a, b) => a.from - b.from);
  }, [geologyIntervals]);

  const normAnnulus = useMemo(() => {
    return (annulusIntervals || [])
      .map((r) => {
        const from = Number(r.from_m);
        const to = Number(r.to_m);
        const id = r.annulus_type_id || "";
        if (!Number.isFinite(from) || !Number.isFinite(to) || !(from < to) || !id) return null;
        return { id: r.id || null, from, to, typeId: id, notes: r.notes || "" };
      })
      .filter(Boolean)
      .sort((a, b) => a.from - b.from);
  }, [annulusIntervals]);

  const normConstruction = useMemo(() => {
    return (constructionIntervals || [])
      .map((r) => {
        const from = Number(r.from_m);
        const to = Number(r.to_m);
        const id = r.construction_type_id || "";
        if (!Number.isFinite(from) || !Number.isFinite(to) || !(from < to) || !id) return null;
        return { id: r.id || null, from, to, typeId: id, notes: r.notes || "" };
      })
      .filter(Boolean)
      .sort((a, b) => a.from - b.from);
  }, [constructionIntervals]);

  // Layout (keep your current symmetric panel math; just ensure it uses W)
  const holeX = 420;
  const holeW = 120;
  const annulusBandW = 34;

  const leftPanelEndX = holeX - annulusBandW - 18;
  const rightPanelStartX = holeX + holeW + annulusBandW + 18;

  const maxLeftW = Math.max(0, leftPanelEndX - 20);
  const maxRightW = Math.max(0, W - 20 - rightPanelStartX);

  const geologyPanelW = Math.min(380, maxLeftW, maxRightW);

  const geologyLeftX = leftPanelEndX - geologyPanelW;
  const geologyLeftW = geologyPanelW;

  const geologyRightX = rightPanelStartX;
  const geologyRightW = geologyPanelW;

  return (
    <div className="shrink-0">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMinYMin meet" className="block">
        <defs>
          <clipPath id={clipId}>
            <rect x="0" y={padTop} width={W} height={H - padTop - padBottom} />
          </clipPath>
        </defs>

        <rect x="0" y="0" width={W} height={H} rx="12" fill="rgba(15,23,42,0.35)" stroke="rgba(255,255,255,0.10)" />

        {/* geology outer panels */}
        <rect
          x={geologyLeftX}
          y={padTop}
          width={geologyLeftW}
          height={H - padTop - padBottom}
          rx="10"
          fill="rgba(2,6,24,0.20)"
          stroke="rgba(255,255,255,0.12)"
        />
        <rect
          x={geologyRightX}
          y={padTop}
          width={geologyRightW}
          height={H - padTop - padBottom}
          rx="10"
          fill="rgba(2,6,24,0.20)"
          stroke="rgba(255,255,255,0.12)"
        />

        {/* hole + annulus bands */}
        <rect
          x={holeX}
          y={padTop}
          width={holeW}
          height={H - padTop - padBottom}
          rx="10"
          fill="rgba(2,6,24,0.35)"
          stroke="rgba(255,255,255,0.18)"
        />
        <rect
          x={holeX - annulusBandW}
          y={padTop}
          width={annulusBandW}
          height={H - padTop - padBottom}
          rx="10"
          fill="rgba(2,6,24,0.25)"
          stroke="rgba(255,255,255,0.12)"
        />
        <rect
          x={holeX + holeW}
          y={padTop}
          width={annulusBandW}
          height={H - padTop - padBottom}
          rx="10"
          fill="rgba(2,6,24,0.25)"
          stroke="rgba(255,255,255,0.12)"
        />

        <g clipPath={`url(#${clipId})`}>
          {/* geology (both sides) */}
          {normGeology.map((it, i) => {
            const t = lithById?.get?.(it.typeId);
            const color = t?.color || "#64748b";
            const label = t?.name || "Geology";

            const y1 = yForDepth(it.from);
            const y2 = yForDepth(it.to);
            const h = Math.max(0, y2 - y1);
            if (h <= 0.5) return null;

            return (
              <g key={it.id || `g-${it.typeId}-${it.from}-${it.to}-${i}`}>
                <rect x={geologyLeftX + 2} y={y1} width={geologyLeftW - 4} height={h} fill={color} fillOpacity="0.75">
                  <title>
                    {label} · {it.from.toFixed(1)}–{it.to.toFixed(1)}m{it.notes ? ` · ${it.notes}` : ""}
                  </title>
                </rect>
                <rect x={geologyRightX + 2} y={y1} width={geologyRightW - 4} height={h} fill={color} fillOpacity="0.75" />
                {h >= 18 && (
                  <text x={geologyRightX + geologyRightW - 10} y={y1 + Math.min(h - 6, 16)} textAnchor="end" fontSize="11" fill="rgba(15,23,42,0.95)">
                    {label}
                  </text>
                )}
              </g>
            );
          })}

          {/* annulus */}
          {normAnnulus.map((it, i) => {
            const t = annulusById?.get?.(it.typeId);
            const color = t?.color || "#64748b";
            const label = t?.name || "Annulus";

            const y1 = yForDepth(it.from);
            const y2 = yForDepth(it.to);
            const h = Math.max(0, y2 - y1);
            if (h <= 0.5) return null;

            return (
              <g key={it.id || `a-${it.typeId}-${it.from}-${it.to}-${i}`}>
                <rect x={holeX - annulusBandW + 2} y={y1} width={annulusBandW - 4} height={h} fill={color} fillOpacity="0.88">
                  <title>
                    {label} · {it.from.toFixed(1)}–{it.to.toFixed(1)}m{it.notes ? ` · ${it.notes}` : ""}
                  </title>
                </rect>
                <rect x={holeX + holeW + 2} y={y1} width={annulusBandW - 4} height={h} fill={color} fillOpacity="0.88" />
              </g>
            );
          })}

          {/* construction */}
          {normConstruction.map((it, i) => {
            const t = constructionById?.get?.(it.typeId);
            const color = t?.color || "#64748b";
            const label = t?.name || "Construction";

            const y1 = yForDepth(it.from);
            const y2 = yForDepth(it.to);
            const h = Math.max(0, y2 - y1);
            if (h <= 0.5) return null;

            return (
              <g key={it.id || `c-${it.typeId}-${it.from}-${it.to}-${i}`}>
                <rect x={holeX + 2} y={y1} width={holeW - 4} height={h} fill={color} fillOpacity="0.92" stroke="rgba(255,255,255,0.14)">
                  <title>
                    {label} · {it.from.toFixed(1)}–{it.to.toFixed(1)}m{it.notes ? ` · ${it.notes}` : ""}
                  </title>
                </rect>
                {h >= 18 && (
                  <text x={holeX + holeW / 2} y={y1 + Math.min(h - 6, 16)} textAnchor="middle" fontSize="11" fill="rgba(15,23,42,0.95)">
                    {label}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* markers across the whole schematic */}
        {hasWater && (
          <g>
            <line x1={20} y1={waterY} x2={W - 20} y2={waterY} stroke="rgba(59,130,246,0.75)" strokeWidth="2" />
            <rect x={holeX + 10} y={waterY - 16} width={holeW - 20} height={22} rx="8" fill="rgba(255,255,255,0.92)" stroke="rgba(15,23,42,0.15)" />
            <text x={holeX + holeW / 2} y={waterY - 1} textAnchor="middle" fontSize="11" fill="rgba(15,23,42,0.95)">
              Water level {water.toFixed(1)}m
            </text>
          </g>
        )}

        {hasActual && (
          <g>
            <line x1={20} y1={actualY} x2={W - 20} y2={actualY} stroke="rgba(16,185,129,0.65)" strokeWidth="1.5" />
            <text x={W - 20} y={actualY - 4} textAnchor="end" fontSize="10" fill="rgba(226,232,240,0.9)">
              Actual {actual}m
            </text>
          </g>
        )}

        {hasPlanned && (
          <g>
            <line x1={20} y1={plannedY} x2={W - 20} y2={plannedY} stroke="rgba(99,102,241,0.65)" strokeWidth="1.5" />
            <text x={W - 20} y={plannedY - 4} textAnchor="end" fontSize="10" fill="rgba(226,232,240,0.9)">
              Planned {planned}m
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}