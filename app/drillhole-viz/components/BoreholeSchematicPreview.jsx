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

function getIntervalRenderKey(prefix, interval, index) {
  return interval?.id || `${prefix}-${interval?.typeId || "type"}-${interval?.from}-${interval?.to}-${index}`;
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getConstructionVisualSpec(typeName) {
  const value = String(typeName || "").trim().toLowerCase();

  if (/(headworks|wellhead|surface)/.test(value)) {
    return { kind: "headworks" };
  }

  if (/collar/.test(value)) {
    return { kind: "collar" };
  }

  if (/(screen|slotted)/.test(value)) {
    return { kind: "screen" };
  }

  if (/(shoe|drive shoe)/.test(value)) {
    return { kind: "shoe" };
  }

  if (/(plug|cement|grout|seal|bentonite|backfill)/.test(value)) {
    return { kind: "plug" };
  }

  if (/(casing|liner|riser|standpipe|pipe|tube|pvc|steel)/.test(value)) {
    return { kind: "tube" };
  }

  return { kind: "tube" };
}

export default function BoreholeSchematicPreview({
  holeState,
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
  const isDrillingActive = String(holeState || "").toLowerCase() === "in_progress" && hasActual;

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
  const drillBitGlowId = `drillBitGlow-${uid}`;
  const drillBitBodyGradientId = `drillBitBodyGradient-${uid}`;
  const drillBitCrownGradientId = `drillBitCrownGradient-${uid}`;
  const drillBitBoreGradientId = `drillBitBoreGradient-${uid}`;
  const boreVoidFill = "none";
  const boreVoidStroke = compact ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.12)";

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
  const boreInset = compact ? 6 : 10;
  const drillStringWidth = compact ? 8 : 12;
  const bitHeight = compact ? 24 : 36;
  const bitHalfWidth = compact ? 11 : 16;
  const drillTopY = padTop + (compact ? 4 : 6);
  const drillBitShoulderY = actualY != null ? Math.max(drillTopY + 8, actualY - bitHeight) : null;
  const drillStringHeight = drillBitShoulderY != null ? Math.max(0, drillBitShoulderY - drillTopY) : 0;

  const compactLeftPanelW = 130;
  const compactHoleX = sidePad + compactLeftPanelW + spacing + annulusBandW;

  const holeX = compact ? compactHoleX : 420;
  const boreInnerX = holeX + boreInset;
  const boreInnerW = holeW - boreInset * 2;

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
  const rodJointYs = useMemo(() => {
    if (!isDrillingActive || !hasActual || drillBitShoulderY == null) return [];

    const joints = [];
    for (let depthMark = 6; depthMark < actual; depthMark += 6) {
      const y = yForDepth(depthMark);
      if (y > drillTopY + 2 && y < drillBitShoulderY - 2) {
        joints.push(y);
      }
    }

    return joints;
  }, [actual, drillBitShoulderY, drillTopY, hasActual, isDrillingActive]);

  const fitLabel = (text, panelWidth, isCompact) => {
    const raw = String(text || "").trim();
    if (!raw) return "";
    const approxCharPx = isCompact ? 5.3 : 6.1;
    const maxChars = Math.max(5, Math.floor((panelWidth - 16) / approxCharPx));
    if (raw.length <= maxChars) return raw;
    return `${raw.slice(0, Math.max(0, maxChars - 1))}…`;
  };

  const geologyLabels = useMemo(() => {
    const labelFontSize = compact ? 10 : 11;
    const labelHeight = compact ? 14 : 16;
    const minGap = compact ? 4 : 6;
    const leftState = { nextY: padTop + 4 };
    const rightState = { nextY: padTop + 4 };

    return normGeology
      .map((it, index) => {
        const key = getIntervalRenderKey("g", it, index);
        const type = lithById?.get?.(it.typeId);
        const rawLabel = type?.name || "Geology";
        const y1 = yForDepth(it.from);
        const y2 = yForDepth(it.to);
        const height = Math.max(0, y2 - y1);
        if (height < 18) return [key, null];

        const candidates = [
          {
            side: "left",
            state: leftState,
            boxX: geologyLeftX + 6,
            textX: geologyLeftX + 13,
            panelWidth: geologyLeftW,
          },
        ];

        if (showRightGeology && geologyRightW > 28) {
          candidates.push({
            side: "right",
            state: rightState,
            boxX: geologyRightX + 6,
            textX: geologyRightX + 13,
            panelWidth: geologyRightW,
          });
        }

        const viablePlacements = candidates
          .map((candidate) => {
            const fittedLabel = fitLabel(rawLabel, candidate.panelWidth, compact);
            const labelWidth = Math.min(
              candidate.panelWidth - 12,
              Math.max(48, fittedLabel.length * (compact ? 5.8 : 6.4) + 14)
            );
            const minY = y1 + 4;
            const maxY = y2 - labelHeight - 2;
            if (maxY < minY) return null;

            const boxY = Math.max(minY, candidate.state.nextY);
            if (boxY > maxY) return null;

            return {
              ...candidate,
              fittedLabel,
              labelWidth,
              boxY,
            };
          })
          .filter(Boolean)
          .sort((a, b) => a.boxY - b.boxY || (a.side === "left" ? -1 : 1));

        const placement = viablePlacements[0];
        if (!placement) return [key, null];

        placement.state.nextY = placement.boxY + labelHeight + minGap;

        return [
          key,
          {
            boxX: placement.boxX,
            boxY: placement.boxY,
            textX: placement.textX,
            textY: placement.boxY + labelHeight - (compact ? 3.5 : 4),
            labelWidth: placement.labelWidth,
            labelHeight,
            labelFontSize,
            fittedLabel: placement.fittedLabel,
          },
        ];
      })
      .reduce((map, [key, placement]) => {
        map.set(key, placement);
        return map;
      }, new Map());
  }, [compact, geologyLeftW, geologyLeftX, geologyRightW, geologyRightX, lithById, normGeology, padTop, showRightGeology]);

  const constructionCallouts = useMemo(() => {
    const leftMinX = Math.max(sidePad + 8, geologyLeftX + 8);
    const leftMaxW = Math.max(76, geologyLeftW - 16);
    const rightMinX = geologyRightX + 8;
    const rightMaxW = Math.max(76, geologyRightW - 16);
    const leftState = { nextY: padTop + 8 };
    const rightState = { nextY: padTop + 8 };
    const minGap = compact ? 22 : 26;
    const boxH = compact ? 18 : 20;

    return normConstruction.map((it, index) => {
      const type = constructionById?.get?.(it.typeId);
      const label = type?.name || "Construction";
      const y1 = yForDepth(it.from);
      const y2 = yForDepth(it.to);
      const centerY = y1 + Math.max(0, y2 - y1) / 2;
      const preferRight = !compact && index % 2 === 1 && showRightGeology && rightMaxW >= 100;
      const side = preferRight ? "right" : "left";
      const sideState = side === "right" ? rightState : leftState;
      const maxBoxW = side === "right" ? rightMaxW : leftMaxW;
      const boxW = clamp(maxBoxW, compact ? 76 : 104, compact ? 112 : 176);
      let boxY = clamp(centerY - boxH / 2, padTop + 4, H - padBottom - boxH - 4);
      if (boxY < sideState.nextY) {
        boxY = Math.min(H - padBottom - boxH - 4, sideState.nextY);
      }
      sideState.nextY = boxY + minGap;

      const boxX = side === "right" ? rightMinX : leftMinX + Math.max(0, leftMaxW - boxW);
      const lineStartX = side === "right" ? holeX + holeW + annulusBandW - 1 : holeX - annulusBandW + 1;
      const lineBendX = side === "right" ? boxX - 10 : boxX + boxW + 10;
      const lineEndX = side === "right" ? boxX : boxX + boxW;
      const lineY = boxY + boxH / 2;

      return {
        key: it.id || `construction-callout-${it.typeId}-${it.from}-${it.to}-${index}`,
        side,
        boxX,
        boxY,
        boxW,
        boxH,
        lineStartX,
        lineBendX,
        lineEndX,
        lineY,
        anchorY: centerY,
        color: type?.color || "#64748b",
        label: fitLabel(label, boxW - 18, compact),
      };
    });
  }, [H, annulusBandW, compact, constructionById, geologyLeftW, geologyLeftX, geologyRightW, geologyRightX, holeW, holeX, normConstruction, padBottom, padTop, showRightGeology, sidePad]);

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
          <linearGradient id={drillBitBodyGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="40%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
          <linearGradient id={drillBitCrownGradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fef3c7" />
            <stop offset="45%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>
          <linearGradient id={drillBitBoreGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(30,41,59,0.96)" />
            <stop offset="100%" stopColor="rgba(15,23,42,0.98)" />
          </linearGradient>
          <filter id={drillBitGlowId} x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation={compact ? "2.4" : "3.6"} result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0.98 0 1 0 0 0.63 0 0 1 0 0.12 0 0 0 0.75 0"
              result="glow"
            />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
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
          fill="none"
          stroke="rgba(255,255,255,0.18)"
        />
        <rect
          x={boreInnerX}
          y={padTop + 2}
          width={boreInnerW}
          height={H - padTop - padBottom - 4}
          rx={compact ? 8 : 10}
          fill={boreVoidFill}
          stroke={boreVoidStroke}
        />
        <line
          x1={holeX + holeW / 2}
          y1={padTop + 4}
          x2={holeX + holeW / 2}
          y2={H - padBottom - 4}
          stroke="rgba(255,255,255,0.08)"
          strokeDasharray={compact ? "5 6" : "6 7"}
          strokeWidth="1"
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
            const renderKey = getIntervalRenderKey("g", it, i);
            const t = lithById?.get?.(it.typeId);
            const color = t?.color || "#64748b";
            const label = t?.name || "Geology";
            const patternKey = normalizeLithologyPatternKey(t?.pattern_key);
            const fill = patternKey === "solid" ? color : `url(#${getLithologyPatternId(uid, it.typeId, patternKey)})`;
            const labelPlacement = geologyLabels.get(renderKey);

            const y1 = yForDepth(it.from);
            const y2 = yForDepth(it.to);
            const h = Math.max(0, y2 - y1);
            if (h <= 0.5) return null;

            return (
              <g key={renderKey}>
                <rect x={geologyLeftX + 2} y={y1} width={geologyLeftW - 4} height={h} fill={fill} fillOpacity={patternKey === "solid" ? "0.75" : undefined}>
                  <title>
                    {label} · {it.from.toFixed(1)}–{it.to.toFixed(1)}m{it.notes ? ` · ${it.notes}` : ""}
                  </title>
                </rect>
                {showRightGeology && <rect x={geologyRightX + 2} y={y1} width={geologyRightW - 4} height={h} fill={fill} fillOpacity={patternKey === "solid" ? "0.75" : undefined} />}
                {labelPlacement && (
                  <g>
                    <rect
                      x={labelPlacement.boxX}
                      y={labelPlacement.boxY}
                      width={labelPlacement.labelWidth}
                      height={labelPlacement.labelHeight}
                      rx={compact ? 5 : 6}
                      fill="rgba(2,6,23,0.58)"
                      stroke="rgba(255,255,255,0.14)"
                    />
                    <text
                      x={labelPlacement.textX}
                      y={labelPlacement.textY}
                      textAnchor="start"
                      fontSize={String(labelPlacement.labelFontSize)}
                      fontWeight="600"
                      fill="rgba(248,250,252,0.98)"
                      stroke="rgba(2,6,23,0.4)"
                      strokeWidth="0.45"
                      paintOrder="stroke"
                    >
                      {labelPlacement.fittedLabel}
                    </text>
                  </g>
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
            const spec = getConstructionVisualSpec(label);

            const y1 = yForDepth(it.from);
            const y2 = yForDepth(it.to);
            const h = Math.max(0, y2 - y1);
            if (h <= 0.5) return null;

            const wallOuterInset = compact ? 6 : 10;
            const centerGapW = clamp(holeW * (compact ? 0.36 : 0.4), compact ? 18 : 32, holeW - wallOuterInset * 2 - (compact ? 10 : 16));
            const wallW = Math.max(4, (holeW - wallOuterInset * 2 - centerGapW) / 2);
            const leftWallX = holeX + wallOuterInset;
            const rightWallX = holeX + holeW - wallOuterInset - wallW;
            const wallRadius = Math.min(wallW / 2, compact ? 6 : 8);
            const wallHighlightInset = Math.max(1.2, Math.min(3.5, wallW * 0.2));

            const slotCount = spec.kind === "screen" ? Math.max(2, Math.min(8, Math.floor(h / (compact ? 18 : 16)))) : 0;
            const slotYs = Array.from({ length: slotCount }, (_, slotIndex) => y1 + ((slotIndex + 1) * h) / (slotCount + 1));
            const plugBandCount = spec.kind === "plug" ? Math.max(2, Math.min(6, Math.floor(h / (compact ? 20 : 18)))) : 0;
            const plugBandYs = Array.from({ length: plugBandCount }, (_, bandIndex) => y1 + ((bandIndex + 1) * h) / (plugBandCount + 1));

            return (
              <g key={it.id || `c-${it.typeId}-${it.from}-${it.to}-${i}`}>
                <title>
                  {label} · {it.from.toFixed(1)}–{it.to.toFixed(1)}m{it.notes ? ` · ${it.notes}` : ""}
                </title>

                <>
                  <rect
                    x={leftWallX}
                    y={y1}
                    width={wallW}
                    height={h}
                    rx={wallRadius}
                    fill={color}
                    fillOpacity={spec.kind === "headworks" ? "0.82" : spec.kind === "plug" ? "0.84" : "0.78"}
                    stroke="rgba(255,255,255,0.28)"
                    strokeWidth={spec.kind === "headworks" ? "1.4" : "1.1"}
                  />
                  <rect
                    x={rightWallX}
                    y={y1}
                    width={wallW}
                    height={h}
                    rx={wallRadius}
                    fill={color}
                    fillOpacity={spec.kind === "headworks" ? "0.82" : spec.kind === "plug" ? "0.84" : "0.78"}
                    stroke="rgba(255,255,255,0.28)"
                    strokeWidth={spec.kind === "headworks" ? "1.4" : "1.1"}
                  />

                  {(spec.kind === "tube" || spec.kind === "screen" || spec.kind === "collar" || spec.kind === "headworks" || spec.kind === "shoe") && (
                  <>
                    {(spec.kind === "tube" || spec.kind === "screen") && (
                      <>
                        <line
                          x1={leftWallX + wallHighlightInset}
                          y1={y1 + 1}
                          x2={leftWallX + wallHighlightInset}
                          y2={y2 - 1}
                          stroke="rgba(255,255,255,0.22)"
                          strokeWidth="0.9"
                        />
                        <line
                          x1={leftWallX + wallW - wallHighlightInset}
                          y1={y1 + 1}
                          x2={leftWallX + wallW - wallHighlightInset}
                          y2={y2 - 1}
                          stroke="rgba(15,23,42,0.28)"
                          strokeWidth="0.9"
                        />
                        <line
                          x1={rightWallX + wallHighlightInset}
                          y1={y1 + 1}
                          x2={rightWallX + wallHighlightInset}
                          y2={y2 - 1}
                          stroke="rgba(255,255,255,0.22)"
                          strokeWidth="0.9"
                        />
                        <line
                          x1={rightWallX + wallW - wallHighlightInset}
                          y1={y1 + 1}
                          x2={rightWallX + wallW - wallHighlightInset}
                          y2={y2 - 1}
                          stroke="rgba(15,23,42,0.28)"
                          strokeWidth="0.9"
                        />
                      </>
                    )}

                    {spec.kind === "screen" &&
                      slotYs.map((slotY) => (
                        <g key={`${it.id || i}-${slotY}`}>
                          <line
                            x1={leftWallX + 1.5}
                            y1={slotY}
                            x2={leftWallX + wallW - 1.5}
                            y2={slotY}
                            stroke="rgba(15,23,42,0.45)"
                            strokeWidth="1.1"
                            strokeLinecap="round"
                          />
                          <line
                            x1={rightWallX + 1.5}
                            y1={slotY}
                            x2={rightWallX + wallW - 1.5}
                            y2={slotY}
                            stroke="rgba(15,23,42,0.45)"
                            strokeWidth="1.1"
                            strokeLinecap="round"
                          />
                        </g>
                      ))}

                    {spec.kind === "headworks" && (
                      <>
                        <rect
                          x={leftWallX - (compact ? 2 : 4)}
                          y={y1}
                          width={wallW + (compact ? 4 : 8)}
                          height={Math.min(h, compact ? 12 : 14)}
                          rx={compact ? 5 : 6}
                          fill={color}
                          fillOpacity="0.96"
                          stroke="rgba(255,255,255,0.34)"
                          strokeWidth="1.1"
                        />
                        <rect
                          x={rightWallX - (compact ? 2 : 4)}
                          y={y1}
                          width={wallW + (compact ? 4 : 8)}
                          height={Math.min(h, compact ? 12 : 14)}
                          rx={compact ? 5 : 6}
                          fill={color}
                          fillOpacity="0.96"
                          stroke="rgba(255,255,255,0.34)"
                          strokeWidth="1.1"
                        />
                        <line
                          x1={leftWallX + wallW / 2}
                          y1={y1 + Math.min(h, compact ? 12 : 14) / 2}
                          x2={rightWallX + wallW / 2}
                          y2={y1 + Math.min(h, compact ? 12 : 14) / 2}
                          stroke="rgba(255,255,255,0.18)"
                          strokeWidth="1"
                          strokeDasharray={compact ? "4 5" : "5 6"}
                        />
                      </>
                    )}

                    {spec.kind === "collar" && h >= 8 && (
                      <>
                        <line
                          x1={leftWallX + 1}
                          y1={y1 + 3}
                          x2={leftWallX + wallW - 1}
                          y2={y1 + 3}
                          stroke="rgba(255,255,255,0.3)"
                          strokeWidth="1"
                          strokeLinecap="round"
                        />
                        <line
                          x1={rightWallX + 1}
                          y1={y1 + 3}
                          x2={rightWallX + wallW - 1}
                          y2={y1 + 3}
                          stroke="rgba(255,255,255,0.3)"
                          strokeWidth="1"
                          strokeLinecap="round"
                        />
                      </>
                    )}

                    {spec.kind === "shoe" && h >= 10 && (
                      <>
                        <path
                          d={`M ${leftWallX + 1.5} ${y2 - 2} L ${leftWallX + wallW / 2} ${y2 + (compact ? 4 : 6)} L ${leftWallX + wallW - 1.5} ${y2 - 2}`}
                          fill={color}
                          fillOpacity="0.88"
                          stroke="rgba(255,255,255,0.22)"
                          strokeWidth="1"
                          strokeLinejoin="round"
                        />
                        <path
                          d={`M ${rightWallX + 1.5} ${y2 - 2} L ${rightWallX + wallW / 2} ${y2 + (compact ? 4 : 6)} L ${rightWallX + wallW - 1.5} ${y2 - 2}`}
                          fill={color}
                          fillOpacity="0.88"
                          stroke="rgba(255,255,255,0.22)"
                          strokeWidth="1"
                          strokeLinejoin="round"
                        />
                      </>
                    )}
                  </>
                  )}
                  {spec.kind === "plug" &&
                    plugBandYs.map((bandY) => (
                      <g key={`${it.id || i}-plug-${bandY}`}>
                        <line
                          x1={leftWallX + 1.5}
                          y1={bandY}
                          x2={leftWallX + wallW - 1.5}
                          y2={bandY}
                          stroke="rgba(15,23,42,0.42)"
                          strokeWidth="1.1"
                          strokeLinecap="round"
                        />
                        <line
                          x1={rightWallX + 1.5}
                          y1={bandY}
                          x2={rightWallX + wallW - 1.5}
                          y2={bandY}
                          stroke="rgba(15,23,42,0.42)"
                          strokeWidth="1.1"
                          strokeLinecap="round"
                        />
                      </g>
                    ))}
                </>

              </g>
            );
          })}

          {isDrillingActive && actualY != null ? (
            <g aria-label="Active drilling status">
              {(() => {
                const centerX = holeX + holeW / 2;
                const shoulderY = drillBitShoulderY;
                const crownTopY = shoulderY + bitHeight * 0.7;
                const crownBaseY = actualY - bitHeight * 0.12;
                const bodyMidY = shoulderY + bitHeight * 0.42;
                const boreHalfWidth = bitHalfWidth * 0.32;
                const innerCrownHalfWidth = boreHalfWidth * 1.16;
                const outerPath = [
                  `M ${centerX - bitHalfWidth * 0.56} ${shoulderY}`,
                  `L ${centerX + bitHalfWidth * 0.56} ${shoulderY}`,
                  `L ${centerX + bitHalfWidth * 0.56} ${bodyMidY}`,
                  `L ${centerX + bitHalfWidth * 0.42} ${crownTopY}`,
                  `L ${centerX + bitHalfWidth} ${crownTopY}`,
                  `L ${centerX + bitHalfWidth} ${crownBaseY}`,
                  `L ${centerX + bitHalfWidth * 0.72} ${crownBaseY}`,
                  `L ${centerX + bitHalfWidth * 0.34} ${actualY - bitHeight * 0.08}`,
                  `L ${centerX} ${actualY}`,
                  `L ${centerX - bitHalfWidth * 0.34} ${actualY - bitHeight * 0.08}`,
                  `L ${centerX - bitHalfWidth * 0.72} ${crownBaseY}`,
                  `L ${centerX - bitHalfWidth} ${crownBaseY}`,
                  `L ${centerX - bitHalfWidth} ${crownTopY}`,
                  `L ${centerX - bitHalfWidth * 0.42} ${crownTopY}`,
                  `L ${centerX - bitHalfWidth * 0.56} ${bodyMidY}`,
                  "Z",
                ].join(" ");
                const borePath = [
                  `M ${centerX - boreHalfWidth} ${shoulderY + bitHeight * 0.04}`,
                  `L ${centerX + boreHalfWidth} ${shoulderY + bitHeight * 0.04}`,
                  `L ${centerX + boreHalfWidth} ${shoulderY + bitHeight * 0.62}`,
                  `L ${centerX + innerCrownHalfWidth} ${crownTopY}`,
                  `L ${centerX + innerCrownHalfWidth} ${crownBaseY}`,
                  `L ${centerX - innerCrownHalfWidth} ${crownBaseY}`,
                  `L ${centerX - innerCrownHalfWidth} ${crownTopY}`,
                  `L ${centerX - boreHalfWidth} ${shoulderY + bitHeight * 0.62}`,
                  "Z",
                ].join(" ");
                const crownY = crownTopY;
                const crownHeight = crownBaseY - crownTopY;
                const hatchStartY = shoulderY + bitHeight * 0.18;
                const hatchEndY = crownTopY - bitHeight * 0.05;
                const leftWaterwayX = centerX - bitHalfWidth * 0.92;
                const leftInnerWaterwayX = centerX - bitHalfWidth * 0.42;
                const rightInnerWaterwayX = centerX + bitHalfWidth * 0.2;
                const rightWaterwayX = centerX + bitHalfWidth * 0.66;
                const outerWaterwayW = compact ? 2.3 : 3.2;
                const innerWaterwayW = compact ? 2 : 2.8;
                const crownDiamondPoints = [-0.64, -0.22, 0.22, 0.64];

                return (
                  <g filter={`url(#${drillBitGlowId})`}>
                    <ellipse
                      cx={centerX}
                      cy={actualY - bitHeight * 0.24}
                      rx={bitHalfWidth * 1.18}
                      ry={compact ? 9 : 13}
                      fill="rgba(251,191,36,0.18)"
                    />
                    <path
                      d={outerPath}
                      fill={`url(#${drillBitBodyGradientId})`}
                      stroke="rgba(120,53,15,0.56)"
                      strokeWidth={compact ? "0.9" : "1.15"}
                      strokeLinejoin="round"
                    />
                    <path
                      d={borePath}
                      fill={`url(#${drillBitBoreGradientId})`}
                      stroke="rgba(255,248,220,0.20)"
                      strokeWidth={compact ? "0.65" : "0.9"}
                      strokeLinejoin="round"
                    />
                    {[0.14, 0.28, 0.42].map((offset) => {
                      const y = shoulderY + bitHeight * offset;
                      return (
                        <line
                          key={`bit-thread-${offset}`}
                          x1={centerX - bitHalfWidth * 0.52}
                          y1={y}
                          x2={centerX + bitHalfWidth * 0.52}
                          y2={y}
                          stroke="rgba(120,53,15,0.44)"
                          strokeWidth={compact ? "0.7" : "0.9"}
                          strokeLinecap="round"
                        />
                      );
                    })}
                    <rect
                      x={centerX - bitHalfWidth}
                      y={crownY}
                      width={bitHalfWidth * 2}
                      height={crownHeight}
                      fill={`url(#${drillBitCrownGradientId})`}
                      stroke="rgba(120,53,15,0.58)"
                      strokeWidth={compact ? "0.9" : "1.1"}
                    />
                    <rect x={leftWaterwayX} y={crownY + crownHeight * 0.08} width={outerWaterwayW} height={crownHeight * 0.92} fill="rgba(255,244,214,0.88)" stroke="rgba(120,53,15,0.34)" strokeWidth="0.6" />
                    <rect x={leftInnerWaterwayX} y={crownY + crownHeight * 0.18} width={innerWaterwayW} height={crownHeight * 0.82} fill="rgba(255,244,214,0.88)" stroke="rgba(120,53,15,0.34)" strokeWidth="0.6" />
                    <rect x={rightInnerWaterwayX} y={crownY + crownHeight * 0.18} width={innerWaterwayW} height={crownHeight * 0.82} fill="rgba(255,244,214,0.88)" stroke="rgba(120,53,15,0.34)" strokeWidth="0.6" />
                    <rect x={rightWaterwayX} y={crownY + crownHeight * 0.08} width={outerWaterwayW} height={crownHeight * 0.92} fill="rgba(255,244,214,0.88)" stroke="rgba(120,53,15,0.34)" strokeWidth="0.6" />
                    {[0, 1, 2].map((index) => {
                      const startY = hatchStartY + index * ((hatchEndY - hatchStartY) / 2.4);
                      return (
                        <g key={`bit-hatch-${index}`}>
                          <line
                            x1={centerX - bitHalfWidth * 0.9}
                            y1={startY}
                            x2={centerX - bitHalfWidth * 0.46}
                            y2={startY + bitHeight * 0.16}
                            stroke="rgba(120,53,15,0.24)"
                            strokeWidth={compact ? "0.6" : "0.75"}
                          />
                          <line
                            x1={centerX + bitHalfWidth * 0.46}
                            y1={startY + bitHeight * 0.16}
                            x2={centerX + bitHalfWidth * 0.9}
                            y2={startY}
                            stroke="rgba(120,53,15,0.24)"
                            strokeWidth={compact ? "0.6" : "0.75"}
                          />
                        </g>
                      );
                    })}
                    {crownDiamondPoints.map((point, index) => {
                      const diamondCx = centerX + bitHalfWidth * point;
                      const diamondCy = crownY + crownHeight * (index % 2 === 0 ? 0.34 : 0.58);
                      const diamondR = compact ? 1.2 : 1.7;
                      return (
                        <polygon
                          key={`bit-diamond-${point}`}
                          points={[
                            `${diamondCx},${diamondCy - diamondR}`,
                            `${diamondCx + diamondR},${diamondCy}`,
                            `${diamondCx},${diamondCy + diamondR}`,
                            `${diamondCx - diamondR},${diamondCy}`,
                          ].join(" ")}
                          fill="rgba(255,251,235,0.95)"
                          stroke="rgba(217,119,6,0.70)"
                          strokeWidth="0.55"
                        />
                      );
                    })}
                    <line
                      x1={centerX - innerCrownHalfWidth}
                      y1={crownBaseY}
                      x2={centerX + innerCrownHalfWidth}
                      y2={crownBaseY}
                      stroke="rgba(255,247,200,0.42)"
                      strokeWidth={compact ? "0.75" : "1"}
                      strokeLinecap="round"
                    />
                    <path
                      d={`M ${centerX - bitHalfWidth * 0.56} ${crownY + crownHeight * 0.08} L ${centerX} ${actualY - bitHeight * 0.1} L ${centerX + bitHalfWidth * 0.56} ${crownY + crownHeight * 0.08}`}
                      fill="none"
                      stroke="rgba(255,247,200,0.55)"
                      strokeWidth={compact ? "0.95" : "1.35"}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                );
              })()}
              <rect
                x={holeX + holeW / 2 - drillStringWidth / 2}
                y={drillTopY}
                width={drillStringWidth}
                height={drillStringHeight}
                rx={drillStringWidth / 2}
                fill="rgba(71,85,105,0.96)"
                stroke="rgba(248,250,252,0.18)"
                strokeWidth="1"
              />
              <line
                x1={holeX + holeW / 2 - drillStringWidth / 4}
                y1={drillTopY + 2}
                x2={holeX + holeW / 2 - drillStringWidth / 4}
                y2={drillBitShoulderY}
                stroke="rgba(255,255,255,0.32)"
                strokeWidth={compact ? "0.9" : "1.2"}
                strokeLinecap="round"
              />
              {rodJointYs.map((jointY) => (
                <line
                  key={`rod-joint-${jointY}`}
                  x1={holeX + holeW / 2 - drillStringWidth / 2 - (compact ? 0.5 : 1)}
                  y1={jointY}
                  x2={holeX + holeW / 2 + drillStringWidth / 2 + (compact ? 0.5 : 1)}
                  y2={jointY}
                  stroke="rgba(226,232,240,0.72)"
                  strokeWidth={compact ? "1" : "1.2"}
                  strokeLinecap="round"
                />
              ))}
            </g>
          ) : null}

          {constructionCallouts.map((callout) => (
            <g key={callout.key}>
              <path
                d={`M ${callout.lineStartX} ${callout.anchorY} L ${callout.lineBendX} ${callout.anchorY} L ${callout.lineEndX} ${callout.lineY}`}
                fill="none"
                stroke="rgba(226,232,240,0.42)"
                strokeWidth="1.15"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect
                x={callout.boxX}
                y={callout.boxY}
                width={callout.boxW}
                height={callout.boxH}
                rx={compact ? 8 : 9}
                fill="rgba(2,6,23,0.78)"
                stroke="rgba(255,255,255,0.14)"
              />
              <rect
                x={callout.side === "right" ? callout.boxX + callout.boxW - 7 : callout.boxX + 3}
                y={callout.boxY + 3}
                width="4"
                height={callout.boxH - 6}
                rx="2"
                fill={callout.color}
              />
              <text
                x={callout.side === "right" ? callout.boxX + 8 : callout.boxX + 11}
                y={callout.boxY + callout.boxH / 2 + 3}
                textAnchor="start"
                fontSize={compact ? "8.5" : "9.5"}
                fill="rgba(241,245,249,0.94)"
                fontWeight="600"
              >
                {callout.label}
              </text>
            </g>
          ))}

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
            <text
              x={holeX + holeW / 2}
              y={waterY - 1}
              textAnchor="middle"
              fontSize={compact ? "10" : "11"}
              fontWeight="700"
              fill="rgba(239,246,255,0.98)"
              stroke="rgba(2,6,23,0.5)"
              strokeWidth="0.35"
              paintOrder="stroke"
            >
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