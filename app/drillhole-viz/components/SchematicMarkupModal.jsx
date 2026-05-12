"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { exportMarkedupSchematicPdf } from "../utils/exportMarkedupSchematicPdf";
import SchematicStage, { getSchematicStageMetrics } from "./SchematicStage";

const COLOR_OPTIONS = ["#f8fafc", "#ef4444", "#f59e0b", "#22c55e", "#38bdf8", "#a855f7"];
const SIZE_OPTIONS = [6, 12];
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

function getPointFromEvent(svgEl, event, stageWidth, stageHeight) {
  if (!svgEl) return null;
  const rect = svgEl.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const x = ((event.clientX - rect.left) / rect.width) * stageWidth;
  const y = ((event.clientY - rect.top) / rect.height) * stageHeight;
  return {
    x: clamp(x, 0, stageWidth),
    y: clamp(y, 0, stageHeight),
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

export default function SchematicMarkupModal({
  open,
  hole,
  geoRows,
  lithById,
  componentRows,
  componentById,
  constructionRows,
  constructionById,
  annulusRows,
  annulusById,
  onClose,
}) {
  const svgRef = useRef(null);
  const stageRef = useRef(null);
  const stageHostRef = useRef(null);
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState(COLOR_OPTIONS[1]);
  const [size, setSize] = useState(6);
  const [annotations, setAnnotations] = useState([]);
  const [draft, setDraft] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [textValue, setTextValue] = useState("Note");
  const [exporting, setExporting] = useState(false);
  const [availableStageWidth, setAvailableStageWidth] = useState(960);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [usesCoarsePointer, setUsesCoarsePointer] = useState(false);
  const [touchDrawingEnabled, setTouchDrawingEnabled] = useState(false);

  const drawingEnabled = !usesCoarsePointer || touchDrawingEnabled;

  useEffect(() => {
    if (!open) {
      setAnnotations([]);
      setDraft(null);
      setIsDrawing(false);
      setTool("pen");
      setTouchDrawingEnabled(false);
    }
  }, [open]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const syncViewport = (event) => {
      const matches = typeof event?.matches === "boolean" ? event.matches : mediaQuery.matches;
      setIsMobileViewport(matches);
    };

    syncViewport(mediaQuery);
    mediaQuery.addEventListener("change", syncViewport);

    return () => {
      mediaQuery.removeEventListener("change", syncViewport);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mediaQuery = window.matchMedia("(pointer: coarse)");
    const syncPointerMode = (event) => {
      const matches = typeof event?.matches === "boolean" ? event.matches : mediaQuery.matches;
      setUsesCoarsePointer(matches);
      if (!matches) {
        setTouchDrawingEnabled(false);
      }
    };

    syncPointerMode(mediaQuery);
    mediaQuery.addEventListener("change", syncPointerMode);

    return () => {
      mediaQuery.removeEventListener("change", syncPointerMode);
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const updateStageWidth = () => {
      const rect = stageHostRef.current?.getBoundingClientRect?.();
      if (!rect?.width) return;
      setAvailableStageWidth(rect.width);
    };

    updateStageWidth();

    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateStageWidth) : null;
    if (observer && stageHostRef.current) {
      observer.observe(stageHostRef.current);
    }

    window.addEventListener("resize", updateStageWidth);
    return () => {
      window.removeEventListener("resize", updateStageWidth);
      observer?.disconnect();
    };
  }, [open]);

	const stageMetrics = useMemo(() => getSchematicStageMetrics({ selectedHole: hole, compact: isMobileViewport }), [hole, isMobileViewport]);
	const stageFitScale = useMemo(() => {
		if (!stageMetrics?.baseWidth) return 1;
		const maxWidth = Math.max(240, availableStageWidth - (isMobileViewport ? 16 : 28));
		return Math.min(maxWidth / stageMetrics.baseWidth, 1);
	}, [availableStageWidth, isMobileViewport, stageMetrics?.baseWidth]);

  const stageStyle = useMemo(() => {
    if (!stageMetrics?.baseWidth || !stageMetrics?.height) return { width: "100%", aspectRatio: "1 / 1" };
    return {
      width: `${stageMetrics.baseWidth * stageFitScale}px`,
      height: `${stageMetrics.height * stageFitScale}px`,
      maxWidth: "100%",
    };
  }, [stageFitScale, stageMetrics?.baseWidth, stageMetrics?.height]);

  const annotationCount = annotations.length + (draft ? 1 : 0);
  const interactionMessage = usesCoarsePointer
    ? touchDrawingEnabled
      ? "Drawing is active inside the schematic viewport. Switch back to scroll when you need to move around."
      : "Scroll stays active on mobile. Turn drawing on only when you want to annotate the schematic."
    : "Use your mouse or stylus directly on the live schematic canvas to mark up the view.";

  if (!open || !hole) return null;

  const beginDraw = (event) => {
    if (!drawingEnabled) return;
    if (!stageMetrics?.baseWidth || !stageMetrics?.height) return;
    const point = getPointFromEvent(svgRef.current, event, stageMetrics.baseWidth, stageMetrics.height);
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
    if (!drawingEnabled) return;
    if (!isDrawing || !draft || !stageMetrics?.baseWidth || !stageMetrics?.height) return;
    const point = getPointFromEvent(svgRef.current, event, stageMetrics.baseWidth, stageMetrics.height);
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

  if (isMobileViewport) {
    return (
      <div className="fixed inset-0 z-[120] bg-[rgba(2,6,23,0.92)] backdrop-blur-md">
        <div className="flex h-full flex-col">
          <div className="border-b border-white/10 bg-[rgba(2,6,23,0.94)] px-4 pb-4 pt-5 shadow-[0_18px_50px_rgba(2,6,23,0.45)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.24em] text-cyan-100/70">Markup Studio</div>
                <h2 className="mt-2 text-lg font-semibold text-white">{hole?.hole_id || "Static schematic markup"}</h2>
                <p className="mt-1 text-xs leading-5 text-slate-300">Mobile markup keeps the schematic in a dedicated viewport with touch-safe drawing controls.</p>
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

            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-300">
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">{annotationCount} markups</span>
              {usesCoarsePointer ? (
                <button
                  type="button"
                  className={`btn btn-xs ${touchDrawingEnabled ? "btn-primary" : ""}`}
                  onClick={() => setTouchDrawingEnabled((prev) => !prev)}
                >
                  {touchDrawingEnabled ? "Scroll Mode" : "Enable Drawing"}
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3">
            <div className="mx-auto flex max-w-xl flex-col gap-3">
              <section className="rounded-[24px] border border-white/10 bg-slate-950/60 p-3 shadow-[0_20px_60px_rgba(2,6,23,0.32)]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Schematic</div>
                    <div className="mt-1 text-sm font-medium text-white">Touch-friendly markup viewport</div>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-slate-300">
                    {touchDrawingEnabled ? "Drawing on" : "Scroll on"}
                  </div>
                </div>

                <div className="rounded-[20px] border border-white/10 bg-[#08111d] p-2">
                  <div
                    ref={stageHostRef}
                    className="max-h-[58dvh] overflow-auto overscroll-contain rounded-[16px]"
                    style={{ touchAction: drawingEnabled ? "none" : "pan-x pan-y" }}
                  >
                    <div className="flex min-h-full min-w-full items-start justify-center">
                      <div
                        ref={stageRef}
                        className="relative overflow-hidden rounded-[16px] border border-white/10 bg-[#08111d] shadow-[0_24px_80px_rgba(2,6,23,0.35)]"
                        style={stageStyle}
                      >
            <SchematicStage
              selectedHole={hole}
              geoRows={geoRows}
              lithById={lithById}
              componentRows={componentRows}
              componentById={componentById}
              constructionRows={constructionRows}
              constructionById={constructionById}
              annulusRows={annulusRows}
              annulusById={annulusById}
              compact
              scale={stageFitScale}
              onSelectComponent={() => {}}
            />
                        <svg
                          ref={svgRef}
              viewBox={`0 0 ${stageMetrics.baseWidth} ${stageMetrics.height}`}
                          className={`absolute inset-0 h-full w-full ${drawingEnabled ? "pointer-events-auto touch-none" : "pointer-events-none"}`}
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

                <p className="mt-3 text-xs leading-5 text-slate-400">{interactionMessage}</p>
              </section>

              <section className="rounded-[24px] border border-white/10 bg-slate-950/60 p-4 shadow-[0_20px_60px_rgba(2,6,23,0.28)]">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Tools</div>
                <div className="mt-3 overflow-x-auto pb-1">
                  <div className="flex min-w-max gap-2">
                    {TOOL_OPTIONS.map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        className={`btn btn-xs whitespace-nowrap ${tool === value ? "btn-primary" : ""}`}
                        onClick={() => setTool(value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {tool === "text" ? (
                  <input
                    className="input mt-3"
                    value={textValue}
                    onChange={(event) => setTextValue(event.target.value)}
                    placeholder="Text to place"
                  />
                ) : null}

                <div className="mt-4 text-[11px] uppercase tracking-[0.22em] text-slate-400">Color</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      className={`h-10 w-10 rounded-full border-2 transition ${color === swatch ? "border-white shadow-[0_0_0_3px_rgba(255,255,255,0.14)]" : "border-white/10"}`}
                      style={{ backgroundColor: swatch }}
                      onClick={() => setColor(swatch)}
                      aria-label={`Use ${swatch} annotation color`}
                    />
                  ))}
                </div>

                <div className="mt-4 text-[11px] uppercase tracking-[0.22em] text-slate-400">Stroke</div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {SIZE_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`btn btn-xs justify-center ${size === option ? "btn-primary" : ""}`}
                      onClick={() => setSize(option)}
                    >
                      Size {option}
                    </button>
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button type="button" className="btn btn-xs justify-center" onClick={undo} disabled={!annotations.length}>
                    Undo
                  </button>
                  <button type="button" className="btn btn-xs justify-center" onClick={clear} disabled={!annotations.length && !draft}>
                    Clear
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[120] overflow-x-hidden overflow-y-auto bg-[rgba(2,6,23,0.86)] backdrop-blur-md">
      <div className="mx-auto min-h-[100dvh] w-full max-w-[1600px] px-3 py-3 md:px-6 md:py-6">
        <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] shadow-[0_30px_120px_rgba(2,6,23,0.55)]">
          <div className="rounded-t-[30px] border-b border-white/10 bg-[rgba(2,6,23,0.84)] px-4 py-4 backdrop-blur-xl md:px-6 md:py-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">Markup Studio</div>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-semibold text-white md:text-2xl">Static schematic markup</h2>
                  <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-slate-300">
                    {hole?.hole_id || "Unnamed hole"}
                  </div>
                  <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-slate-300">
                    {annotationCount} markups
                  </div>
                </div>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                  The marked-up schematic scales to fit the available width, and the page itself handles vertical scrolling.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
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

          <div className="grid gap-4 px-3 py-3 xl:grid-cols-[320px_minmax(0,1fr)] md:px-5 md:py-5">
            <aside className="space-y-4">
              <section className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_20px_60px_rgba(2,6,23,0.24)]">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Interaction</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {usesCoarsePointer ? (
                    <button
                      type="button"
                      className={`btn btn-xs ${touchDrawingEnabled ? "btn-primary" : ""}`}
                      onClick={() => setTouchDrawingEnabled((prev) => !prev)}
                    >
                      {touchDrawingEnabled ? "Switch To Scroll" : "Enable Drawing"}
                    </button>
                  ) : (
                    <div className="inline-flex rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-100">
                      Desktop drawing enabled
                    </div>
                  )}
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {interactionMessage}
                </p>
              </section>

              <section className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_20px_60px_rgba(2,6,23,0.24)]">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Tools</div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {TOOL_OPTIONS.map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={`btn btn-xs justify-center ${tool === value ? "btn-primary" : ""}`}
                      onClick={() => setTool(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {tool === "text" ? (
                  <input
                    className="input mt-3"
                    value={textValue}
                    onChange={(event) => setTextValue(event.target.value)}
                    placeholder="Text to place"
                  />
                ) : null}

                <div className="mt-4 text-[11px] uppercase tracking-[0.22em] text-slate-400">Color</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      className={`h-9 w-9 rounded-full border-2 transition ${color === swatch ? "border-white shadow-[0_0_0_3px_rgba(255,255,255,0.14)]" : "border-white/10"}`}
                      style={{ backgroundColor: swatch }}
                      onClick={() => setColor(swatch)}
                      aria-label={`Use ${swatch} annotation color`}
                    />
                  ))}
                </div>

                <div className="mt-4 text-[11px] uppercase tracking-[0.22em] text-slate-400">Stroke</div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {SIZE_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`btn btn-xs justify-center ${size === option ? "btn-primary" : ""}`}
                      onClick={() => setSize(option)}
                    >
                      Size {option}
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_20px_60px_rgba(2,6,23,0.24)]">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Export</div>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  Export captures the live schematic view with all current markup layers into a PDF, ready for sharing or review.
                </p>
              </section>
            </aside>

            <main className="space-y-4">
              <section ref={stageHostRef} className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/55 p-3 shadow-[0_24px_80px_rgba(2,6,23,0.28)] md:p-5">
                <div className="flex max-w-full items-start justify-center overflow-x-hidden p-2 md:p-4">
                  <div
                    ref={stageRef}
                    className="relative overflow-hidden rounded-[20px] border border-white/10 bg-[#08111d] shadow-[0_24px_80px_rgba(2,6,23,0.35)]"
                    style={stageStyle}
                  >
          <SchematicStage
            selectedHole={hole}
            geoRows={geoRows}
            lithById={lithById}
            componentRows={componentRows}
            componentById={componentById}
            constructionRows={constructionRows}
            constructionById={constructionById}
            annulusRows={annulusRows}
            annulusById={annulusById}
            scale={stageFitScale}
            onSelectComponent={() => {}}
          />
                    <svg
                      ref={svgRef}
            viewBox={`0 0 ${stageMetrics.baseWidth} ${stageMetrics.height}`}
                      className={`absolute inset-0 h-full w-full ${drawingEnabled ? "pointer-events-auto touch-none" : "pointer-events-none"}`}
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
              </section>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}