"use client";

export default function HoleTab({ selectedOrgId, projects, expandedProjects, selectedHoleId, onToggleProject, onSelectHole }) {
  return (
    <div className="space-y-2">
      {!selectedOrgId ? (
        <div className="text-sm text-slate-300">Select an organization.</div>
      ) : (projects || []).length === 0 ? (
        <div className="text-sm text-slate-300">No holes found.</div>
      ) : (
        (projects || []).map((p) => {
          const isOpen = !!expandedProjects?.[p.project_id];
          return (
            <div key={p.project_id} className="card p-2">
              <button
                type="button"
                className="w-full flex items-center justify-between text-left"
                onClick={() => onToggleProject?.(p.project_id)}
              >
                <div className="text-sm font-medium text-slate-100 truncate">{p.name}</div>
                <div className="text-xs text-slate-400">
                  {p.holes.length} {p.holes.length === 1 ? "hole" : "holes"} {isOpen ? "−" : "+"}
                </div>
              </button>

              {isOpen && (
                <div className="mt-2 space-y-1">
                  {p.holes.map((h) => {
                    const active = h.id === selectedHoleId;
                    return (
                      <button
                        key={h.id}
                        type="button"
                        className={[
                          "w-full flex items-center justify-between rounded px-2 py-2 text-left border",
                          active ? "border-indigo-500 bg-indigo-500/10" : "border-white/10 hover:bg-white/5",
                        ].join(" ")}
                        onClick={() => onSelectHole?.(h.id)}
                      >
                        <div className="min-w-0">
                          <div className="text-sm text-slate-100 truncate">{h.hole_id}</div>
                          <div className="text-[11px] text-slate-400">
                            State: {h.state || "—"} · Planned: {h.planned_depth ?? "—"}m · Actual: {h.depth ?? "—"}m
                          </div>
                        </div>
                        <div className="text-slate-400 text-xs">Select</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
