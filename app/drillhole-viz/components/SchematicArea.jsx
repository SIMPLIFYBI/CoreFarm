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
  onExportPdf,
  exportDisabledReason,
}) {
  const svgPxHeight = 620;

  return (
    <div className="flex-1 h-full overflow-hidden">
      <div className="h-full flex flex-col">
        <div className="p-3 border-b border-white/10 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-slate-100 font-semibold truncate">
              {selectedHole ? `Schematic: ${selectedHole.hole_id}` : "Schematic"}
            </div>
            <div className="text-[11px] text-slate-400">
              {selectedHole ? "Unified schematic preview (SVG V1)" : "Select a hole to begin"}
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary text-xs"
            onClick={onExportPdf}
            disabled={!!exportDisabledReason}
            title={exportDisabledReason || "Export PDF"}
          >
            Export PDF
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="card p-4">
            {!selectedHole ? (
              <div className="text-sm text-slate-300">Select a hole to preview the schematic.</div>
            ) : (
              <div className="space-y-2">
                <div className="text-sm text-slate-200">Borehole schematic (V1)</div>
                <div className="text-xs text-slate-400">
                  One shared depth axis. Geology outer panels, annulus band, construction in-hole.
                </div>

                <div className="flex gap-3 items-start">
                  <DepthAxisBar
                    plannedDepth={selectedHole.planned_depth}
                    actualDepth={selectedHole.depth}
                    waterLevel={selectedHole.water_level_m}
                    svgPxHeight={svgPxHeight}
                  />

                  <div className="min-w-0 flex-1">
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
            )}
          </div>

          <div className="mt-4 text-xs text-slate-500">Note: This is a UI preview only (PDF export later).</div>
        </div>
      </div>
    </div>
  );
}
