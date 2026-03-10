"use client";

import DepthAxisBar from "./DepthAxisBar";
import BoreholeSchematicPreview from "./BoreholeSchematicPreview";

export default function SchematicArea({
  selectedHole,
  geoRows,
  lithById,
  constructionRows,
  constructionById,
  annulusRows,
  annulusById,
}) {
  const svgPxHeight = 620;

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
                      annulusIntervals={annulusRows}
                      annulusById={annulusById}
                      constructionIntervals={constructionRows}
                      constructionById={constructionById}
                      svgPxHeight={svgPxHeight}
                      compact
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
                      annulusIntervals={annulusRows}
                      annulusById={annulusById}
                      constructionIntervals={constructionRows}
                      constructionById={constructionById}
                      svgPxHeight={svgPxHeight}
                    />
                  </div>
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
