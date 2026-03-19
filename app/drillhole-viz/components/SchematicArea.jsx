"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import DepthAxisBar from "./DepthAxisBar";
import BoreholeSchematicPreview from "./BoreholeSchematicPreview";
import SchematicMarkupModal from "./SchematicMarkupModal";
import { computeMaxDepth } from "../utils/computeMaxDepth";
import { svgHeightForMaxDepth } from "../utils/depthScaleConfig";

export default function SchematicArea({
  selectedHole,
  geoRows,
  lithById,
  componentRows,
  componentById,
  constructionRows,
  constructionById,
  annulusRows,
  annulusById,
  onExportPdf,
  exportDisabledReason,
}) {
  const [selectedComponentId, setSelectedComponentId] = useState("");
  const [schematicZoom, setSchematicZoom] = useState(1);
  const [openingMarkup, setOpeningMarkup] = useState(false);
  const [markupSnapshot, setMarkupSnapshot] = useState(null);
  const [markupOpen, setMarkupOpen] = useState(false);

  const zoomPct = Math.round(schematicZoom * 100);
  const zoomOut = () => setSchematicZoom((prev) => Math.max(0.7, Math.round((prev - 0.15) * 100) / 100));
  const zoomIn = () => setSchematicZoom((prev) => Math.min(1.9, Math.round((prev + 0.15) * 100) / 100));
  const resetZoom = () => setSchematicZoom(1);

  useEffect(() => {
    setSelectedComponentId("");
  }, [selectedHole?.id]);

  const maxDepth = useMemo(() => {
    return computeMaxDepth({ plannedDepth: selectedHole?.planned_depth, actualDepth: selectedHole?.depth, minDepth: 30, step: 10 });
  }, [selectedHole?.depth, selectedHole?.planned_depth]);

  const schematicHeight = useMemo(() => svgHeightForMaxDepth(maxDepth), [maxDepth]);
  const mobileBaseWidth = 58 + 8 + 258;
  const desktopBaseWidth = 90 + 12 + 980;

  const selectedComponent = useMemo(() => {
    return (componentRows || []).find((row) => row.id === selectedComponentId) || null;
  }, [componentRows, selectedComponentId]);

  const selectedComponentType = selectedComponent?.component_type_id ? componentById?.get?.(selectedComponent.component_type_id) : null;

  const legendTypes = useMemo(() => {
    const seen = new Set();
    return (componentRows || [])
      .map((row) => componentById?.get?.(row.component_type_id))
      .filter((type) => {
        if (!type?.id || seen.has(type.id)) return false;
        seen.add(type.id);
        return true;
      })
      .sort((a, b) => (a?.sort_order || 0) - (b?.sort_order || 0) || String(a?.name || "").localeCompare(String(b?.name || "")));
  }, [componentById, componentRows]);

  const openMarkupMode = async () => {
    if (!selectedHole || openingMarkup) return;

    const element = document.getElementById("schematic-export-root");
    if (!element) {
      toast.error("Could not find the schematic snapshot.");
      return;
    }

    try {
      setOpeningMarkup(true);
      const { toPng } = await import("html-to-image");
      const src = await toPng(element, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: "#0b1220",
      });

      const probe = new Image();
      await new Promise((resolve, reject) => {
        probe.onload = resolve;
        probe.onerror = reject;
        probe.src = src;
      });

      setMarkupSnapshot({ src, width: probe.width, height: probe.height });
      setMarkupOpen(true);
    } catch (error) {
      console.error(error);
      toast.error(error?.message || "Failed to open markup mode.");
    } finally {
      setOpeningMarkup(false);
    }
  };

  const closeMarkupMode = () => {
    setMarkupOpen(false);
    setMarkupSnapshot(null);
  };

  return (
    <>
    <div className="min-w-0 flex-1 overflow-hidden bg-slate-950/40">
      <div className="h-full overflow-auto p-3 md:p-5">
        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/55 shadow-[0_24px_80px_rgba(2,6,23,0.32)] backdrop-blur-xl">
          <div className="border-b border-white/10 px-4 py-4 md:px-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Schematic Preview</div>
                <div className="mt-1 text-lg font-semibold text-white">Borehole layout with orientation</div>
              </div>
              <div className="text-sm text-slate-300">
                {selectedHole ? `Inspecting ${selectedHole.hole_id}` : "Select a hole to preview the schematic."}
              </div>
            </div>
          </div>

          <div className="space-y-4 p-3 md:p-5">
            {!selectedHole ? (
              <div className="text-sm text-slate-300">Select a hole to preview the schematic.</div>
            ) : (
              <>
                <div id="schematic-export-root" className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 xl:gap-4">
                    <CompassOrientationCard azimuth={selectedHole.azimuth} />
                    <DipOrientationCard dip={selectedHole.dip} />
                  </div>

                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-sm text-slate-200">Borehole schematic</div>
                      <div className="text-xs text-slate-400">
                        The depth-true schematic stays intact while azimuth and dip are shown as companion orientation cues.
                      </div>
                    </div>

                    <div className="inline-flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-2 text-xs text-slate-300">
                      <button type="button" className="btn btn-xs" onClick={openMarkupMode} disabled={!selectedHole || openingMarkup}>
                        {openingMarkup ? "Opening markup..." : "Markup mode"}
                      </button>
                      <button type="button" className="btn btn-xs btn-primary" onClick={onExportPdf} disabled={!!exportDisabledReason} title={exportDisabledReason || "Export PDF"}>
                        Export PDF
                      </button>
                      <span className="text-slate-500">Zoom</span>
                      <button type="button" className="btn btn-xs h-7 min-h-0 px-2" onClick={zoomOut} aria-label="Zoom out schematic">
                        -
                      </button>
                      <button type="button" className="btn btn-xs h-7 min-h-0 px-2.5" onClick={resetZoom}>
                        {zoomPct}%
                      </button>
                      <button type="button" className="btn btn-xs h-7 min-h-0 px-2" onClick={zoomIn} aria-label="Zoom in schematic">
                        +
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-[24px] border border-white/10 bg-slate-950/40 p-3 pb-1 md:p-5">
                    <div className="w-full min-w-max">
                      <div className="md:hidden" style={{ width: `${mobileBaseWidth * schematicZoom}px`, height: `${schematicHeight * schematicZoom}px` }}>
                        <div className="flex gap-2 items-start origin-top-left" style={{ transform: `scale(${schematicZoom})` }}>
                          <DepthAxisBar
                            plannedDepth={selectedHole.planned_depth}
                            actualDepth={selectedHole.depth}
                            waterLevel={selectedHole.water_level_m}
                            compact
                          />

                          <BoreholeSchematicPreview
                            plannedDepth={selectedHole.planned_depth}
                            actualDepth={selectedHole.depth}
                            waterLevel={selectedHole.water_level_m}
                            geologyIntervals={geoRows}
                            lithById={lithById}
                            componentRows={componentRows}
                            componentById={componentById}
                            annulusIntervals={annulusRows}
                            annulusById={annulusById}
                            constructionIntervals={constructionRows}
                            constructionById={constructionById}
                            compact
                            selectedComponentId={selectedComponentId}
                            onSelectComponent={(component) => setSelectedComponentId(component?.id || "")}
                          />
                        </div>
                      </div>

                      <div className="hidden md:block" style={{ width: `${desktopBaseWidth * schematicZoom}px`, height: `${schematicHeight * schematicZoom}px` }}>
                        <div className="inline-flex gap-3 items-start origin-top-left" style={{ transform: `scale(${schematicZoom})` }}>
                          <DepthAxisBar
                            plannedDepth={selectedHole.planned_depth}
                            actualDepth={selectedHole.depth}
                            waterLevel={selectedHole.water_level_m}
                          />

                          <BoreholeSchematicPreview
                            plannedDepth={selectedHole.planned_depth}
                            actualDepth={selectedHole.depth}
                            waterLevel={selectedHole.water_level_m}
                            geologyIntervals={geoRows}
                            lithById={lithById}
                            componentRows={componentRows}
                            componentById={componentById}
                            annulusIntervals={annulusRows}
                            annulusById={annulusById}
                            constructionIntervals={constructionRows}
                            constructionById={constructionById}
                            selectedComponentId={selectedComponentId}
                            onSelectComponent={(component) => setSelectedComponentId(component?.id || "")}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
                  <div className="rounded-[20px] border border-white/10 bg-slate-950/30 px-4 py-3 text-xs text-slate-400">
                    {selectedComponent ? (
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <span className="text-slate-200">Selected:</span>{" "}
                          <span className="font-medium text-white">{selectedComponent.label || selectedComponentType?.name || "Downhole component"}</span>{" "}
                          <span className="text-slate-400">at {selectedComponent.depth_m}m</span>
                        </div>
                        <button
                          type="button"
                          className="btn btn-xs self-start"
                          onClick={() => setSelectedComponentId("")}
                        >
                          Clear selection
                        </button>
                      </div>
                    ) : (
                      "Click a component marker on the schematic to inspect its details."
                    )}
                  </div>

                  <div className="rounded-[20px] border border-white/10 bg-slate-950/30 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Legend</div>
                        <div className="mt-1 text-sm font-medium text-white">Installed component types</div>
                      </div>
                      <div className="text-[11px] text-slate-500">{legendTypes.length} shown</div>
                    </div>

                    {legendTypes.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {legendTypes.map((type) => (
                          <div key={type.id} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-200">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: type.color || "#38bdf8" }} />
                            <span>{type.name}</span>
                            {type.category ? <span className="text-slate-500">{type.category}</span> : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 text-xs text-slate-500">Add components to this hole to build out the legend.</div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 text-xs text-slate-500">Orientation is shown as a companion overlay, not a trajectory deformation of the schematic.</div>
      </div>
    </div>
    <SchematicMarkupModal open={markupOpen} snapshot={markupSnapshot} hole={selectedHole} onClose={closeMarkupMode} />
    </>
  );
}

function formatAngle(value, suffix = "°") {
  const num = Number(value);
  if (!Number.isFinite(num)) return "Not set";
  return `${num.toFixed(1).replace(/\.0$/, "")}${suffix}`;
}

function CompassOrientationCard({ azimuth }) {
  const hasValue = Number.isFinite(Number(azimuth));
  const rotation = hasValue ? Number(azimuth) : 0;

  return (
    <div className="rounded-[22px] border border-cyan-300/15 bg-[linear-gradient(135deg,rgba(15,23,42,0.88),rgba(8,47,73,0.58)_52%,rgba(15,23,42,0.9))] p-3 md:rounded-[24px] md:p-4 shadow-[0_18px_50px_rgba(2,6,23,0.28)]">
      <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/80">Azimuth</div>
      <div className="mt-3 flex flex-col items-start gap-3 md:gap-4 min-[520px]:flex-row min-[520px]:items-center">
        <div className="relative h-16 w-16 shrink-0 rounded-full border border-white/10 bg-slate-950/55 md:h-20 md:w-20">
          <svg viewBox="0 0 100 100" className="h-full w-full">
            <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(148,163,184,0.22)" strokeWidth="2" />
            <circle cx="50" cy="50" r="28" fill="none" stroke="rgba(148,163,184,0.14)" strokeWidth="1.5" />
            <path d="M50 12 L54 24 L50 21 L46 24 Z" fill="#f8fafc" opacity="0.9" />
            <line x1="50" y1="16" x2="50" y2="84" stroke="rgba(148,163,184,0.25)" strokeWidth="1" />
            <line x1="16" y1="50" x2="84" y2="50" stroke="rgba(148,163,184,0.18)" strokeWidth="1" />
            <g transform={`rotate(${rotation} 50 50)`}>
              <line x1="50" y1="50" x2="50" y2="20" stroke="#22d3ee" strokeWidth="4" strokeLinecap="round" />
              <path d="M50 12 L56 26 L50 23 L44 26 Z" fill="#22d3ee" />
              <circle cx="50" cy="50" r="4.5" fill="#f8fafc" />
            </g>
          </svg>
          <div className="pointer-events-none absolute inset-x-0 top-1 text-center text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-400 md:text-[10px] md:tracking-[0.24em]">N</div>
        </div>
        <div className="min-w-0">
          <div className="text-lg font-semibold text-white md:text-2xl">{formatAngle(azimuth)}</div>
          <div className="mt-1 text-xs text-slate-300 md:text-sm">Bearing from north</div>
          <div className="mt-2 inline-flex rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] text-slate-300 md:px-3 md:text-xs">
            {hasValue ? "Hole-level orientation" : "Add azimuth in Attributes"}
          </div>
        </div>
      </div>
    </div>
  );
}

function DipOrientationCard({ dip }) {
  const hasValue = Number.isFinite(Number(dip));
  const clamped = hasValue ? Math.max(-90, Math.min(90, Number(dip))) : 0;

  return (
    <div className="rounded-[22px] border border-amber-300/15 bg-[linear-gradient(135deg,rgba(15,23,42,0.92),rgba(120,53,15,0.36)_58%,rgba(15,23,42,0.92))] p-3 md:rounded-[24px] md:p-4 shadow-[0_18px_50px_rgba(2,6,23,0.28)]">
      <div className="text-[11px] uppercase tracking-[0.22em] text-amber-100/80">Dip</div>
      <div className="mt-3 flex flex-col items-start gap-3 md:gap-4 min-[520px]:flex-row min-[520px]:items-center">
        <div className="relative flex h-16 w-20 shrink-0 items-center justify-center rounded-[18px] border border-white/10 bg-slate-950/55 md:h-20 md:w-24 md:rounded-[20px]">
          <svg viewBox="0 0 120 80" className="h-full w-full">
            <line x1="18" y1="62" x2="102" y2="62" stroke="rgba(148,163,184,0.24)" strokeWidth="2" />
            <line x1="28" y1="12" x2="28" y2="68" stroke="rgba(148,163,184,0.18)" strokeWidth="2" />
            <g transform={`rotate(${clamped} 60 40)`}>
              <line x1="28" y1="40" x2="92" y2="40" stroke="#f59e0b" strokeWidth="5" strokeLinecap="round" />
              <path d="M92 40 L80 34 L80 46 Z" fill="#f59e0b" />
            </g>
          </svg>
        </div>
        <div className="min-w-0">
          <div className="text-lg font-semibold text-white md:text-2xl">{formatAngle(dip)}</div>
          <div className="mt-1 text-xs text-slate-300 md:text-sm">Inclination from horizontal</div>
          <div className="mt-2 inline-flex rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] text-slate-300 md:px-3 md:text-xs">
            {hasValue ? "Negative values trend downward" : "Add dip in Attributes"}
          </div>
        </div>
      </div>
    </div>
  );
}
