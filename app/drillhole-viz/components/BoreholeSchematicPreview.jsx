"use client";

import { useId, useMemo } from "react";
import { computeMaxDepth } from "../utils/computeMaxDepth";
import { DEPTH_PAD_TOP, DEPTH_PAD_BOTTOM, PX_PER_M, svgHeightForMaxDepth } from "../utils/depthScaleConfig";
import { normalizeLithologyPatternKey } from "../utils/lithologyPatterns";
import { ComponentIconGlyph } from "../utils/componentIcons";

function makeSvgIdFragment(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function getLithologyPatternId(uid, typeId, patternKey) {
  return `lith-pattern-${makeSvgIdFragment(uid)}-${makeSvgIdFragment(typeId)}-${patternKey}`;
}

function LithologyPatternDefs({ uid, types }) {
  return (types || []).map((type) => {
    const patternKey = normalizeLithologyPatternKey(type?.pattern_key);
    if (patternKey === "solid") return null;

    const patternId = getLithologyPatternId(uid, type?.id, patternKey);
    const color = type?.color || "#64748b";
    const shadow = "rgba(15,23,42,0.18)";
    const overlay = "rgba(15,23,42,0.28)";
    const accent = "rgba(255,255,255,0.12)";
    const highlight = "rgba(255,255,255,0.06)";

    if (patternKey === "dots") {
      return (
        <pattern key={patternId} id={patternId} width="18" height="18" patternUnits="userSpaceOnUse">
          <rect width="18" height="18" fill={color} fillOpacity="0.82" />
          <circle cx="4" cy="4" r="1.1" fill={overlay} />
          <circle cx="12.5" cy="6.5" r="0.9" fill={shadow} />
          <circle cx="8" cy="13" r="1" fill={overlay} />
          <circle cx="15" cy="14.5" r="0.75" fill={highlight} />
        </pattern>
      );
    }

    if (patternKey === "speckle") {
      return (
        <pattern key={patternId} id={patternId} width="24" height="18" patternUnits="userSpaceOnUse">
          <rect width="24" height="18" fill={color} fillOpacity="0.82" />
          <ellipse cx="5" cy="5.5" rx="2.1" ry="1.35" fill={overlay} transform="rotate(-18 5 5.5)" />
          <ellipse cx="14" cy="8.5" rx="2.5" ry="1.5" fill={shadow} transform="rotate(12 14 8.5)" />
          <ellipse cx="20" cy="4.5" rx="1.7" ry="1.1" fill={accent} transform="rotate(-14 20 4.5)" />
          <ellipse cx="10" cy="14" rx="2.2" ry="1.2" fill={overlay} transform="rotate(9 10 14)" />
        </pattern>
      );
    }

    if (patternKey === "dash") {
      return (
        <pattern key={patternId} id={patternId} width="24" height="18" patternUnits="userSpaceOnUse">
          <rect width="24" height="18" fill={color} fillOpacity="0.82" />
          <path d="M 2 14 L 8 9" stroke={overlay} strokeWidth="1.4" strokeLinecap="round" fill="none" />
          <path d="M 10 6 L 16 2" stroke={accent} strokeWidth="1.1" strokeLinecap="round" fill="none" />
          <path d="M 14 16 L 22 10" stroke={shadow} strokeWidth="1.5" strokeLinecap="round" fill="none" />
          <path d="M 0 4 L 4 1" stroke={highlight} strokeWidth="0.9" strokeLinecap="round" fill="none" />
        </pattern>
      );
    }

    if (patternKey === "crosshatch") {
      return (
        <pattern key={patternId} id={patternId} width="22" height="18" patternUnits="userSpaceOnUse">
          <rect width="22" height="18" fill={color} fillOpacity="0.8" />
          <path d="M 3 4 L 9 8 L 14 5 L 19 9" stroke={overlay} strokeWidth="1.05" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M 2 14 L 7 11 L 13 14 L 18 10" stroke={shadow} strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M 11 0 L 8 5" stroke={accent} strokeWidth="0.9" strokeLinecap="round" fill="none" />
          <path d="M 16 18 L 13 13" stroke={highlight} strokeWidth="0.8" strokeLinecap="round" fill="none" />
        </pattern>
      );
    }

    if (patternKey === "bedding") {
      return (
        <pattern key={patternId} id={patternId} width="28" height="16" patternUnits="userSpaceOnUse">
          <rect width="28" height="16" fill={color} fillOpacity="0.82" />
          <path d="M 0 4 C 4 2, 9 2, 14 4 S 24 6, 28 4" stroke={overlay} strokeWidth="0.95" fill="none" />
          <path d="M 0 9 C 5 7, 10 7, 15 9 S 24 11, 28 9" stroke={accent} strokeWidth="0.8" fill="none" />
          <path d="M 0 13 C 4 12, 8 11.5, 14 13 S 23 14.5, 28 13" stroke={shadow} strokeWidth="0.95" fill="none" />
        </pattern>
      );
    }

    if (patternKey === "chevron") {
      return (
        <pattern key={patternId} id={patternId} width="26" height="18" patternUnits="userSpaceOnUse">
          <rect width="26" height="18" fill={color} fillOpacity="0.82" />
          <path d="M 0 6 C 4 3, 7 3, 10 6 S 17 9, 21 6 S 24 3, 26 4" stroke={overlay} strokeWidth="1" fill="none" />
          <path d="M 0 13 C 4 10, 8 10, 11 13 S 18 16, 22 13 S 25 10, 26 11" stroke={accent} strokeWidth="0.85" fill="none" />
          <path d="M 6 0 L 9 18" stroke={highlight} strokeWidth="0.55" fill="none" opacity="0.7" />
        </pattern>
      );
    }

    return null;
  });
}

export default function BoreholeSchematicPreview({
  plannedDepth,
  actualDepth,
  geologyIntervals,
  lithById,
  componentRows,
  componentById,
  annulusIntervals,
  annulusById,
  constructionIntervals,
  constructionById,
  waterLevel,
  compact = false,
  selectedComponentId = "",
  onSelectComponent,
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

  const W = compact ? 258 : 980;
  const padTop = DEPTH_PAD_TOP;
  const padBottom = DEPTH_PAD_BOTTOM;
  const H = svgHeightForMaxDepth(maxDepth);
  const sidePad = compact ? 8 : 20;

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

  const normComponents = useMemo(() => {
    return (componentRows || [])
      .map((r) => {
        const depth = Number(r.depth_m);
        const id = r.component_type_id || "";
        if (!Number.isFinite(depth) || depth < 0 || !id) return null;
        return {
          id: r.id || null,
          depth,
          typeId: id,
          label: r.label || "",
          status: r.status || "installed",
          notes: r.notes || "",
          details: r.details || {},
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.depth - b.depth);
  }, [componentRows]);

  const selectedComponent = useMemo(() => {
    if (!selectedComponentId) return null;
    return normComponents.find((item) => item.id === selectedComponentId) || null;
  }, [normComponents, selectedComponentId]);

  const holeW = compact ? 62 : 120;
  const annulusBandW = compact ? 16 : 34;
  const spacing = compact ? 8 : 18;
  const showRightGeology = !compact;

  const compactLeftPanelW = 130;
  const compactHoleX = sidePad + compactLeftPanelW + spacing + annulusBandW;

  const holeX = compact ? compactHoleX : 420;

  const leftPanelEndX = holeX - annulusBandW - spacing;
  const rightPanelStartX = holeX + holeW + annulusBandW + spacing;

  const maxLeftW = Math.max(0, leftPanelEndX - sidePad);
  const maxRightW = Math.max(0, W - sidePad - rightPanelStartX);

  const geologyPanelW = compact ? maxLeftW : Math.min(380, maxLeftW, maxRightW);

  const geologyLeftX = leftPanelEndX - geologyPanelW;
  const geologyLeftW = geologyPanelW;

  const geologyRightX = rightPanelStartX;
  const geologyRightW = showRightGeology ? geologyPanelW : 0;
  const componentRailX = holeX + holeW / 2;
  const componentCalloutX = compact ? holeX + holeW + annulusBandW + 10 : holeX + holeW + annulusBandW + 44;

  const fitLabel = (text, panelWidth, isCompact) => {
    const raw = String(text || "").trim();
    if (!raw) return "";
    const approxCharPx = isCompact ? 5.3 : 6.1;
    const maxChars = Math.max(5, Math.floor((panelWidth - 16) / approxCharPx));
    if (raw.length <= maxChars) return raw;
    return `${raw.slice(0, Math.max(0, maxChars - 1))}…`;
  };

  const selectedComponentPopup = useMemo(() => {
    if (!selectedComponent) return null;
    const type = componentById?.get?.(selectedComponent.typeId);
    const detailEntries = Object.entries(selectedComponent.details || {})
      .filter(([, value]) => value !== null && value !== "")
      .slice(0, compact ? 2 : 3)
      .map(([key, value]) => `${key.replace(/_/g, " ")}: ${String(value)}`);

    const label = selectedComponent.label || type?.name || "Selected component";
    const lines = [
      label,
      `${type?.name || "Unknown type"} . ${selectedComponent.depth.toFixed(1)}m`,
      `Status: ${selectedComponent.status || "installed"}`,
      ...(selectedComponent.notes ? [selectedComponent.notes] : []),
      ...detailEntries,
    ];

    const popupW = compact ? 152 : 228;
    const popupLineH = compact ? 13 : 15;
    const popupH = 18 + lines.length * popupLineH;
    const markerY = yForDepth(selectedComponent.depth);
    const preferredX = compact ? holeX - popupW - 8 : componentCalloutX + 26;
    const popupX = Math.max(sidePad + 6, Math.min(W - popupW - sidePad - 6, preferredX));
    const popupY = Math.max(padTop + 8, Math.min(H - padBottom - popupH - 8, markerY - popupH / 2));
    const anchorX = compact ? popupX + popupW : popupX;

    return {
      x: popupX,
      y: popupY,
      w: popupW,
      h: popupH,
      anchorX,
      anchorY: markerY,
      lines,
      color: type?.color || "#38bdf8",
    };
  }, [compact, componentById, componentCalloutX, holeX, padBottom, padTop, selectedComponent, sidePad, W, H]);

  const lithologyPatternTypes = useMemo(() => {
    const typeIds = new Set(normGeology.map((interval) => interval.typeId));
    return Array.from(typeIds)
      .map((typeId) => lithById?.get?.(typeId))
      .filter(Boolean);
  }, [lithById, normGeology]);

  return (
    <div className="shrink-0">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMinYMin meet" className="block">
        <defs>
          <LithologyPatternDefs uid={uid} types={lithologyPatternTypes} />
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
        {showRightGeology && (
          <rect
            x={geologyRightX}
            y={padTop}
            width={geologyRightW}
            height={H - padTop - padBottom}
            rx="10"
            fill="rgba(2,6,24,0.20)"
            stroke="rgba(255,255,255,0.12)"
          />
        )}

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
            const patternKey = normalizeLithologyPatternKey(t?.pattern_key);
            const fill = patternKey === "solid" ? color : `url(#${getLithologyPatternId(uid, it.typeId, patternKey)})`;
            const fittedLabel = fitLabel(label, geologyLeftW, compact);

            const y1 = yForDepth(it.from);
            const y2 = yForDepth(it.to);
            const h = Math.max(0, y2 - y1);
            if (h <= 0.5) return null;

            return (
              <g key={it.id || `g-${it.typeId}-${it.from}-${it.to}-${i}`}>
                <rect x={geologyLeftX + 2} y={y1} width={geologyLeftW - 4} height={h} fill={fill} fillOpacity={patternKey === "solid" ? "0.75" : undefined}>
                  <title>
                    {label} · {it.from.toFixed(1)}–{it.to.toFixed(1)}m{it.notes ? ` · ${it.notes}` : ""}
                  </title>
                </rect>
                {showRightGeology && <rect x={geologyRightX + 2} y={y1} width={geologyRightW - 4} height={h} fill={fill} fillOpacity={patternKey === "solid" ? "0.75" : undefined} />}
                {h >= 18 && (
                  <text
                    x={geologyLeftX + 8}
                    y={y1 + Math.min(h - 6, 16)}
                    textAnchor="start"
                    fontSize={compact ? "10" : "11"}
                    fill="rgba(15,23,42,0.95)"
                  >
                    {fittedLabel}
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

          {normComponents.map((it, i) => {
            const t = componentById?.get?.(it.typeId);
            const color = t?.color || "#38bdf8";
            const label = it.label || t?.name || `Component ${i + 1}`;
            const y = yForDepth(it.depth);
            const isSelected = selectedComponentId && selectedComponentId === it.id;
            const railEndX = compact ? componentRailX + 14 : componentCalloutX - 10;

            return (
              <g key={it.id || `component-${it.typeId}-${it.depth}-${i}`}>
                <line
                  x1={componentRailX}
                  y1={y}
                  x2={railEndX}
                  y2={y}
                  stroke={isSelected ? "rgba(255,255,255,0.9)" : "rgba(148,163,184,0.72)"}
                  strokeWidth={isSelected ? "2.5" : "1.5"}
                  strokeDasharray={compact ? undefined : "4 4"}
                />
                <g
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectComponent?.(selectedComponentId === it.id ? null : it)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectComponent?.(selectedComponentId === it.id ? null : it);
                    }
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <circle
                    cx={componentRailX}
                    cy={y}
                    r={isSelected ? 11 : 9}
                    fill={color}
                    stroke={isSelected ? "rgba(255,255,255,0.95)" : "rgba(15,23,42,0.55)"}
                    strokeWidth={isSelected ? "3" : "2"}
                  >
                    <title>
                      {label} . {it.depth.toFixed(1)}m{it.notes ? ` . ${it.notes}` : ""}
                    </title>
                  </circle>
                  <ComponentIconGlyph icon={t?.icon} cx={componentRailX} cy={y} selected={isSelected} scale={1.12} />
                </g>
                {!compact && (
                  <text x={componentCalloutX} y={y + 4} textAnchor="start" fontSize="11" fill={isSelected ? "rgba(255,255,255,0.96)" : "rgba(226,232,240,0.84)"}>
                    {fitLabel(label, Math.max(120, W - componentCalloutX - sidePad), false)}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {selectedComponentPopup ? (
          <g>
            <line
              x1={selectedComponentPopup.anchorX}
              y1={selectedComponentPopup.anchorY}
              x2={selectedComponentPopup.x + (compact ? selectedComponentPopup.w - 12 : 0)}
              y2={selectedComponentPopup.y + selectedComponentPopup.h / 2}
              stroke="rgba(255,255,255,0.32)"
              strokeWidth="1.5"
            />
            <rect
              x={selectedComponentPopup.x}
              y={selectedComponentPopup.y}
              width={selectedComponentPopup.w}
              height={selectedComponentPopup.h}
              rx="14"
              fill="rgba(2,6,23,0.94)"
              stroke="rgba(255,255,255,0.16)"
            />
            <rect
              x={selectedComponentPopup.x + 10}
              y={selectedComponentPopup.y + 10}
              width="8"
              height={selectedComponentPopup.h - 20}
              rx="4"
              fill={selectedComponentPopup.color}
              opacity="0.95"
            />
            {selectedComponentPopup.lines.map((line, index) => (
              <text
                key={`${line}-${index}`}
                x={selectedComponentPopup.x + 26}
                y={selectedComponentPopup.y + 18 + index * (compact ? 13 : 15)}
                textAnchor="start"
                fontSize={index === 0 ? (compact ? "10" : "12") : compact ? "9" : "10"}
                fill={index === 0 ? "rgba(255,255,255,0.98)" : "rgba(226,232,240,0.86)"}
                fontWeight={index === 0 ? "700" : "400"}
              >
                {fitLabel(line, selectedComponentPopup.w - 34, compact)}
              </text>
            ))}
          </g>
        ) : null}

        {/* markers across the whole schematic */}
        {hasWater && (
          <g>
            <line x1={sidePad} y1={waterY} x2={W - sidePad} y2={waterY} stroke="rgba(59,130,246,0.75)" strokeWidth="2" />
            <rect x={holeX + 10} y={waterY - 16} width={holeW - 20} height={22} rx="8" fill="rgba(255,255,255,0.92)" stroke="rgba(15,23,42,0.15)" />
            <text x={holeX + holeW / 2} y={waterY - 1} textAnchor="middle" fontSize={compact ? "10" : "11"} fill="rgba(15,23,42,0.95)">
              Water level {water.toFixed(1)}m
            </text>
          </g>
        )}

        {hasActual && (
          <g>
            <line x1={sidePad} y1={actualY} x2={W - sidePad} y2={actualY} stroke="rgba(16,185,129,0.65)" strokeWidth="1.5" />
            <text x={W - sidePad} y={actualY - 4} textAnchor="end" fontSize="10" fill="rgba(226,232,240,0.9)">
              Actual {actual}m
            </text>
          </g>
        )}

        {hasPlanned && (
          <g>
            <line x1={sidePad} y1={plannedY} x2={W - sidePad} y2={plannedY} stroke="rgba(99,102,241,0.65)" strokeWidth="1.5" />
            <text x={W - sidePad} y={plannedY - 4} textAnchor="end" fontSize="10" fill="rgba(226,232,240,0.9)">
              Planned {planned}m
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}