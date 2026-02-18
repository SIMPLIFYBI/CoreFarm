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
    <div className="flex-1 h-full overflow-hidden min-w-0">
      <div className="h-full overflow-auto p-2 md:p-4">
        <div className="card p-2 md:p-4">
          {!selectedHole ? (
            <div className="text-sm text-slate-300">Select a hole to preview the schematic.</div>
          ) : (
            <div className="space-y-2">
              <div className="text-sm text-slate-200">Borehole schematic (V1)</div>
              <div className="text-xs text-slate-400">
                One shared depth axis. Geology outer panels, annulus band, construction in-hole.
              </div>

              {/* EXPORT ROOT (axis + schematic) */}
              <div className="overflow-x-hidden">
                <div id="schematic-export-root" className="w-full">
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

        <div className="mt-4 text-xs text-slate-500">Note: This is a UI preview only (PDF export later).</div>
      </div>
    </div>
  );
}
