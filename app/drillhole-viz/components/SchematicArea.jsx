"use client";

import { useEffect, useMemo, useState } from "react";
import DepthAxisBar from "./DepthAxisBar";
import BoreholeSchematicPreview from "./BoreholeSchematicPreview";

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
}) {
  const svgPxHeight = 620;
  const [selectedComponentId, setSelectedComponentId] = useState("");

  useEffect(() => {
    setSelectedComponentId("");
  }, [selectedHole?.id]);

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

  return (
    <div className="min-w-0 flex-1 overflow-hidden bg-slate-950/40">
      <div className="h-full overflow-auto p-3 md:p-5">
        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/55 shadow-[0_24px_80px_rgba(2,6,23,0.32)] backdrop-blur-xl">
          <div className="border-b border-white/10 px-4 py-4 md:px-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Schematic Preview</div>
                <div className="mt-1 text-lg font-semibold text-white">Borehole layout</div>
              </div>
              <div className="text-sm text-slate-300">
                {selectedHole ? `Inspecting ${selectedHole.hole_id}` : "Select a hole to preview the schematic."}
              </div>
            </div>
          </div>

          <div className="p-3 md:p-5">
          {!selectedHole ? (
            <div className="text-sm text-slate-300">Select a hole to preview the schematic.</div>
          ) : (
            <div className="space-y-2">
              <div className="text-sm text-slate-200">Borehole schematic (V1)</div>
              <div className="text-xs text-slate-400">
                One shared depth axis. Geology outer panels, annulus band, construction in-hole.
              </div>

              {/* EXPORT ROOT (axis + schematic) */}
              <div className="overflow-x-auto rounded-[24px] border border-white/10 bg-slate-950/40 p-3 pb-1 md:p-5">
                <div id="schematic-export-root" className="w-full min-w-max">
                  <div className="flex md:hidden gap-2 items-start">
                    <DepthAxisBar
                      plannedDepth={selectedHole.planned_depth}
                      actualDepth={selectedHole.depth}
                      waterLevel={selectedHole.water_level_m}
                      svgPxHeight={svgPxHeight}
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
                      svgPxHeight={svgPxHeight}
                      compact
                      selectedComponentId={selectedComponentId}
                      onSelectComponent={(component) => setSelectedComponentId(component?.id || "")}
                    />
                  </div>

                  <div className="hidden md:inline-flex gap-3 items-start">
                    <DepthAxisBar
                      plannedDepth={selectedHole.planned_depth}
                      actualDepth={selectedHole.depth}
                      waterLevel={selectedHole.water_level_m}
                      svgPxHeight={svgPxHeight}
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
                      svgPxHeight={svgPxHeight}
                      selectedComponentId={selectedComponentId}
                      onSelectComponent={(component) => setSelectedComponentId(component?.id || "")}
                    />
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
            </div>
          )}
        </div>
        </div>

        <div className="mt-4 text-xs text-slate-500">Note: This is a UI preview only (PDF export later).</div>
      </div>
    </div>
  );
}
