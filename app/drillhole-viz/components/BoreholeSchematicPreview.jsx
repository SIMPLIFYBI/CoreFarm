"use client";

import { useId, useMemo } from "react";
import { computeMaxDepth } from "../utils/computeMaxDepth";
import { DEPTH_PAD_TOP, DEPTH_PAD_BOTTOM, PX_PER_M, svgHeightForMaxDepth } from "../utils/depthScaleConfig";

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

  const renderComponentIcon = (icon, cx, cy, selected) => {
    const key = String(icon || "dot").toLowerCase();
    const stroke = "rgba(255,255,255,0.96)";
    const baseProps = { stroke, strokeWidth: selected ? 1.9 : 1.6, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" };

    if (key.includes("pump")) {
      return (
        <g>
          <path d={`M ${cx - 3.5} ${cy + 3.5} L ${cx + 4.2} ${cy} L ${cx - 3.5} ${cy - 3.5} Z`} fill={stroke} opacity="0.95" />
          <line x1={cx - 5.5} y1={cy} x2={cx - 1.8} y2={cy} {...baseProps} />
        </g>
      );
    }

    if (key.includes("seal") || key.includes("packer")) {
      return <rect x={cx - 3.2} y={cy - 3.2} width={6.4} height={6.4} transform={`rotate(45 ${cx} ${cy})`} fill={stroke} opacity="0.95" />;
    }

    if (key.includes("wave") || key.includes("level")) {
      return <path d={`M ${cx - 4.5} ${cy + 1.4} Q ${cx - 2.8} ${cy - 1.4} ${cx - 1.1} ${cy + 1.4} T ${cx + 2.3} ${cy + 1.4} T ${cx + 5.7} ${cy + 1.4}`} {...baseProps} />;
    }

    if (key.includes("valve")) {
      return (
        <g>
          <rect x={cx - 3.8} y={cy - 3.1} width={7.6} height={6.2} rx="1.5" fill={stroke} opacity="0.92" />
          <line x1={cx} y1={cy - 5.4} x2={cx} y2={cy + 5.4} stroke="rgba(15,23,42,0.9)" strokeWidth="1.2" />
        </g>
      );
    }

    if (key.includes("gauge") || key.includes("sensor")) {
      return (
        <g>
          <circle cx={cx} cy={cy} r={3.5} {...baseProps} />
          <line x1={cx} y1={cy} x2={cx + 2.2} y2={cy - 2.2} {...baseProps} />
        </g>
      );
    }

    return <circle cx={cx} cy={cy} r={2.7} fill={stroke} opacity="0.95" />;
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
            const fittedLabel = fitLabel(label, geologyLeftW, compact);

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
                {showRightGeology && <rect x={geologyRightX + 2} y={y1} width={geologyRightW - 4} height={h} fill={color} fillOpacity="0.75" />}
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
                    r={isSelected ? 10 : 8}
                    fill={color}
                    stroke={isSelected ? "rgba(255,255,255,0.95)" : "rgba(15,23,42,0.55)"}
                    strokeWidth={isSelected ? "3" : "2"}
                  >
                    <title>
                      {label} . {it.depth.toFixed(1)}m{it.notes ? ` . ${it.notes}` : ""}
                    </title>
                  </circle>
                  {renderComponentIcon(t?.icon, componentRailX, y, isSelected)}
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