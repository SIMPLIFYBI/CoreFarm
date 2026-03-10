"use client";

export default function HoleTab({ selectedOrgId, projects, expandedProjects, selectedHoleId, onToggleProject, onSelectHole }) {
  return (
    <div className="space-y-3">
      {!selectedOrgId ? (
        <div className="text-sm text-slate-300">Select an organization.</div>
      ) : (projects || []).length === 0 ? (
        <div className="text-sm text-slate-300">No holes found.</div>
      ) : (
        (projects || []).map((p) => {
          const isOpen = !!expandedProjects?.[p.project_id];
          return (
            <div
              key={p.project_id}
              className="overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.66),rgba(2,6,23,0.92))]"
            >
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-white/[0.04]"
                onClick={() => onToggleProject?.(p.project_id)}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">{p.name}</div>
                  <div className="mt-1 text-xs text-slate-400">{p.holes.length} mapped hole{p.holes.length === 1 ? "" : "s"}</div>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs text-slate-300">
                  {isOpen ? "Hide" : "Show"}
                </div>
              </button>

              {isOpen && (
                <div className="space-y-2 border-t border-white/10 px-3 py-3">
                  {p.holes.map((h) => {
                    const active = h.id === selectedHoleId;
                    return (
                      <button
                        key={h.id}
                        type="button"
                        className={[
                          "grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border px-3 py-3 text-left transition",
                          active ? "border-amber-300/50 bg-amber-300/12 shadow-[0_10px_32px_rgba(251,191,36,0.14)]" : "border-white/8 bg-white/[0.03] hover:border-cyan-300/30 hover:bg-cyan-300/[0.06]",
                        ].join(" ")}
                        onClick={() => onSelectHole?.(h.id)}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-100">{h.hole_id}</div>
                          <div className="text-[11px] text-slate-400">
                            State: {h.state || "—"} · Planned: {h.planned_depth ?? "—"}m · Actual: {h.depth ?? "—"}m
                          </div>
                        </div>
                        <div className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-slate-300">Open</div>
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
