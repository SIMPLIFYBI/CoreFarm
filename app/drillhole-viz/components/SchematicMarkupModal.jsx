/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { exportMarkedupSchematicPdf } from "../utils/exportMarkedupSchematicPdf";

const COLOR_OPTIONS = ["#f8fafc", "#ef4444", "#f59e0b", "#22c55e", "#38bdf8", "#a855f7"];
const SIZE_OPTIONS = [2, 4, 6, 10];
const TOOL_OPTIONS = [
  ["pen", "Pen"],
  ["highlighter", "Highlight"],
  ["arrow", "Arrow"],
  ["rect", "Box"],
  ["text", "Text"],
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getPointFromEvent(svgEl, event, imageWidth, imageHeight) {
  if (!svgEl) return null;
  const rect = svgEl.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const x = ((event.clientX - rect.left) / rect.width) * imageWidth;
  const y = ((event.clientY - rect.top) / rect.height) * imageHeight;
  return {
    x: clamp(x, 0, imageWidth),
    y: clamp(y, 0, imageHeight),
  };
}

function pointsToString(points) {
  return (points || []).map((point) => `${point.x},${point.y}`).join(" ");
}

function arrowPath(start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const angle = Math.atan2(dy, dx);
  const head = 16;
  const left = {
    x: end.x - head * Math.cos(angle - Math.PI / 6),
    y: end.y - head * Math.sin(angle - Math.PI / 6),
  };
  const right = {
    x: end.x - head * Math.cos(angle + Math.PI / 6),
    y: end.y - head * Math.sin(angle + Math.PI / 6),
  };
  return `M ${start.x} ${start.y} L ${end.x} ${end.y} M ${left.x} ${left.y} L ${end.x} ${end.y} L ${right.x} ${right.y}`;
}

function normalizeRect(start, end) {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

function renderAnnotation(annotation) {
  if (annotation.type === "pen" || annotation.type === "highlighter") {
    return (
      <polyline
        points={pointsToString(annotation.points)}
        fill="none"
        stroke={annotation.color}
        strokeWidth={annotation.size}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={annotation.type === "highlighter" ? 0.35 : 1}
      />
    );
  }

  if (annotation.type === "arrow") {
    return (
      <path
        d={arrowPath(annotation.start, annotation.end)}
        fill="none"
        stroke={annotation.color}
        strokeWidth={annotation.size}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }

  if (annotation.type === "rect") {
    const rect = normalizeRect(annotation.start, annotation.end);
    return <rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill="none" stroke={annotation.color} strokeWidth={annotation.size} rx="10" />;
  }

  if (annotation.type === "text") {
    return (
      <text x={annotation.x} y={annotation.y} fill={annotation.color} fontSize={annotation.fontSize} fontWeight="700">
        {annotation.text}
      </text>
    );
  }

  return null;
}

function AnnotationPreview({ annotation }) {
  if (!annotation) return null;
  return <>{renderAnnotation(annotation)}</>;
}

export default function SchematicMarkupModal({ open, snapshot, hole, onClose }) {
  const svgRef = useRef(null);
  const stageRef = useRef(null);
  const viewportRef = useRef(null);
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState(COLOR_OPTIONS[1]);
  const [size, setSize] = useState(4);
  const [annotations, setAnnotations] = useState([]);
  const [draft, setDraft] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [textValue, setTextValue] = useState("Note");
  const [exporting, setExporting] = useState(false);
  const [availableStageArea, setAvailableStageArea] = useState({ width: 1400, height: 900 });

  useEffect(() => {
    if (!open) {
      setAnnotations([]);
      setDraft(null);
      setIsDrawing(false);
      setTool("pen");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const updateAvailableArea = () => {
      const rect = viewportRef.current?.getBoundingClientRect?.();
      if (!rect?.width || !rect?.height) return;
      setAvailableStageArea({
        width: rect.width,
        height: rect.height,
      });
    };

    updateAvailableArea();

    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateAvailableArea) : null;
    if (observer && viewportRef.current) {
      observer.observe(viewportRef.current);
    }

    window.addEventListener("resize", updateAvailableArea);
    return () => {
      window.removeEventListener("resize", updateAvailableArea);
      observer?.disconnect();
    };
  }, [open]);

  const stageStyle = useMemo(() => {
    if (!snapshot?.width || !snapshot?.height) return { width: "100%", aspectRatio: "1 / 1" };
    const compactViewport = availableStageArea.width < 768 || availableStageArea.height < 720;
    const stageInset = compactViewport ? 8 : 24;
    const maxWidth = Math.max(120, availableStageArea.width - stageInset);
    const maxHeight = Math.max(120, availableStageArea.height - stageInset);
    const scale = Math.min(maxWidth / snapshot.width, maxHeight / snapshot.height, 1);
    return {
      width: `${snapshot.width * scale}px`,
      height: `${snapshot.height * scale}px`,
      maxWidth: "100%",
      maxHeight: "100%",
    };
  }, [availableStageArea.height, availableStageArea.width, snapshot?.height, snapshot?.width]);

  if (!open || !snapshot?.src) return null;

  const beginDraw = (event) => {
    if (!snapshot?.width || !snapshot?.height) return;
    const point = getPointFromEvent(svgRef.current, event, snapshot.width, snapshot.height);
    if (!point) return;

    if (tool === "text") {
      const value = String(textValue || "").trim();
      if (!value) {
        toast.error("Enter text before placing a note.");
        return;
      }
      setAnnotations((prev) => [...prev, { type: "text", x: point.x, y: point.y, text: value, color, fontSize: 20 + size * 2 }]);
      return;
    }

    setIsDrawing(true);
    if (tool === "pen" || tool === "highlighter") {
      setDraft({ type: tool, color, size: tool === "highlighter" ? Math.max(10, size * 3) : size, points: [point] });
      return;
    }

    setDraft({ type: tool, color, size, start: point, end: point });
  };

  const moveDraw = (event) => {
    if (!isDrawing || !draft || !snapshot?.width || !snapshot?.height) return;
    const point = getPointFromEvent(svgRef.current, event, snapshot.width, snapshot.height);
    if (!point) return;

    if (draft.type === "pen" || draft.type === "highlighter") {
      setDraft((prev) => (prev ? { ...prev, points: [...prev.points, point] } : prev));
      return;
    }

    setDraft((prev) => (prev ? { ...prev, end: point } : prev));
  };

  const endDraw = () => {
    if (!isDrawing || !draft) return;

    const next = draft;
    setIsDrawing(false);
    setDraft(null);

    if ((next.type === "pen" || next.type === "highlighter") && (next.points || []).length < 2) return;
    if ((next.type === "arrow" || next.type === "rect") && (!next.start || !next.end)) return;

    setAnnotations((prev) => [...prev, next]);
  };

  const undo = () => setAnnotations((prev) => prev.slice(0, -1));
  const clear = () => {
    setAnnotations([]);
    setDraft(null);
    setIsDrawing(false);
  };

  const onExport = async () => {
    if (!stageRef.current || exporting) return;
    try {
      setExporting(true);
      await exportMarkedupSchematicPdf({
        element: stageRef.current,
        filename: `Schematic-Markup-${hole?.hole_id || "hole"}.pdf`,
        title: `Schematic Markup${hole?.hole_id ? ` - ${hole.hole_id}` : ""}`,
        subtitle: `Generated ${new Date().toLocaleString()}`,
        backgroundColor: "#08111d",
        pixelRatio: 2.8,
      });
    } catch (error) {
      console.error(error);
      toast.error(error?.message || "Failed to export markup PDF.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-[rgba(2,6,23,0.86)] backdrop-blur-md">
      <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden px-2 py-2 md:h-full md:px-6 md:py-5">
        <div className="sticky top-0 z-20 shrink-0 rounded-[20px] border border-white/10 bg-slate-950/92 px-3 py-3 shadow-[0_24px_80px_rgba(2,6,23,0.42)] backdrop-blur-md md:hidden">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Markup Mode</div>
              <div className="mt-1 text-base font-semibold text-white">Static schematic review</div>
              <div className="mt-1 text-xs leading-5 text-slate-300">Markup the frozen schematic, then export the result.</div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button type="button" className="btn btn-xs btn-primary" onClick={onExport} disabled={exporting}>
                {exporting ? "Exporting..." : "Export"}
              </button>
              <button type="button" className="btn btn-xs" onClick={onClose}>
                Close
              </button>
            </div>
          </div>

          <div className="mt-3 overflow-x-auto pb-1">
            <div className="flex min-w-max items-center gap-2">
              {TOOL_OPTIONS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`btn btn-xs ${tool === value ? "btn-primary" : ""}`}
                  onClick={() => setTool(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-2 overflow-x-auto pb-1">
            <div className="flex min-w-max items-center gap-2">
              <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2 py-1">
                {COLOR_OPTIONS.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    className={`h-6 w-6 rounded-full border ${color === swatch ? "border-white" : "border-white/10"}`}
                    style={{ backgroundColor: swatch }}
                    onClick={() => setColor(swatch)}
                    aria-label={`Use ${swatch} annotation color`}
                  />
                ))}
              </div>

              <select className="select h-8 min-h-0 w-[88px]" value={size} onChange={(event) => setSize(Number(event.target.value))}>
                {SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    Size {option}
                  </option>
                ))}
              </select>

              <button type="button" className="btn btn-xs" onClick={undo} disabled={!annotations.length}>
                Undo
              </button>
              <button type="button" className="btn btn-xs" onClick={clear} disabled={!annotations.length && !draft}>
                Clear
              </button>
            </div>
          </div>

          {tool === "text" ? (
            <input
              className="input mt-2 h-9 min-h-0 w-full"
              value={textValue}
              onChange={(event) => setTextValue(event.target.value)}
              placeholder="Text to place"
            />
          ) : null}
        </div>

        <div className="sticky top-0 z-20 hidden shrink-0 rounded-[24px] border border-white/10 bg-slate-950/90 px-4 py-4 shadow-[0_24px_80px_rgba(2,6,23,0.42)] backdrop-blur-md md:block">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Markup Mode</div>
              <div className="mt-1 text-lg font-semibold text-white">Static schematic review layer</div>
              <div className="mt-1 text-sm text-slate-300">Annotate a frozen snapshot, then export the marked-up result as PDF.</div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {TOOL_OPTIONS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`btn btn-xs ${tool === value ? "btn-primary" : ""}`}
                  onClick={() => setTool(value)}
                >
                  {label}
                </button>
              ))}

              <div className="ml-0 flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 md:ml-2">
                {COLOR_OPTIONS.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    className={`h-6 w-6 rounded-full border ${color === swatch ? "border-white" : "border-white/10"}`}
                    style={{ backgroundColor: swatch }}
                    onClick={() => setColor(swatch)}
                    aria-label={`Use ${swatch} annotation color`}
                  />
                ))}
              </div>

              <select className="select h-8 min-h-0 w-[88px]" value={size} onChange={(event) => setSize(Number(event.target.value))}>
                {SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    Size {option}
                  </option>
                ))}
              </select>

              {tool === "text" ? (
                <input
                  className="input h-8 min-h-0 w-[180px]"
                  value={textValue}
                  onChange={(event) => setTextValue(event.target.value)}
                  placeholder="Text to place"
                />
              ) : null}

              <button type="button" className="btn btn-xs" onClick={undo} disabled={!annotations.length}>
                Undo
              </button>
              <button type="button" className="btn btn-xs" onClick={clear} disabled={!annotations.length && !draft}>
                Clear
              </button>
              <button type="button" className="btn btn-xs btn-primary" onClick={onExport} disabled={exporting}>
                {exporting ? "Exporting..." : "Export PDF"}
              </button>
              <button type="button" className="btn btn-xs" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>

        <div ref={viewportRef} className="mt-2 min-h-0 flex-1 overflow-auto rounded-[24px] border border-white/10 bg-slate-950/65 p-2 overscroll-contain md:mt-4 md:rounded-[28px] md:p-5">
          <div className="flex min-h-full items-start justify-center md:items-center">
            <div
              ref={stageRef}
              className="relative max-w-full max-h-full overflow-hidden rounded-[16px] border border-white/10 bg-[#08111d] shadow-[0_24px_80px_rgba(2,6,23,0.35)] md:rounded-[20px]"
              style={stageStyle}
            >
              <img src={snapshot.src} alt="Schematic snapshot for markup" className="block h-full w-full select-none object-contain" draggable={false} />
              <svg
                ref={svgRef}
                viewBox={`0 0 ${snapshot.width} ${snapshot.height}`}
                className="absolute inset-0 h-full w-full touch-none"
                onPointerDown={beginDraw}
                onPointerMove={moveDraw}
                onPointerUp={endDraw}
                onPointerLeave={endDraw}
              >
                {annotations.map((annotation, index) => (
                  <g key={`${annotation.type}-${index}`}>{renderAnnotation(annotation)}</g>
                ))}
                <AnnotationPreview annotation={draft} />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}