"use client";

import { useEffect, useState } from "react";
import { EditIconButton, DeleteIconButton } from "@/app/components/ActionIconButton";
import { getWorkflowAssignmentLabel, getWorkflowBadgeStyle, getWorkflowStatusMeta } from "@/lib/workflows";

function WorkflowStageBadge({ project }) {
  const label = getWorkflowAssignmentLabel(project);
  if (label === "No workflow") return <span className="text-slate-400">—</span>;
  const status = getWorkflowStatusMeta(project?.current_workflow_status_key);

  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-medium"
      style={getWorkflowBadgeStyle(status.color)}
    >
      {label}
    </span>
  );
}

function ProjectAccordionToggle({ open, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-label={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.08]"
    >
      <svg viewBox="0 0 24 24" fill="none" className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}>
        <path d="M7 10.5 12 15.5 17 10.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function HoleStatePill({ state }) {
  const tone = state === "drilled"
    ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100"
    : state === "in_progress"
      ? "border-amber-300/20 bg-amber-400/10 text-amber-100"
      : "border-cyan-300/18 bg-cyan-400/10 text-cyan-100";

  return <span className={`rounded-full border px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] ${tone}`}>{String(state || "proposed").replace(/_/g, " ")}</span>;
}

export default function ProjectsTable({ loading, projects, onEdit, onDelete }) {
  const [expandedProjectIds, setExpandedProjectIds] = useState({});

  useEffect(() => {
    setExpandedProjectIds((current) => {
      const next = {};
      (projects || []).forEach((project) => {
        if (current[project.id]) next[project.id] = true;
      });
      return next;
    });
  }, [projects]);

  const toggleProject = (projectId) => {
    setExpandedProjectIds((current) => ({
      ...current,
      [projectId]: !current[projectId],
    }));
  };

  return (
    <div className="card p-4">
      <div className="text-sm font-medium mb-3">Project List</div>

      {loading ? (
        <div className="text-sm text-slate-300/70">Loading…</div>
      ) : projects.length === 0 ? (
        <div className="text-sm text-slate-300/70">No projects yet. Create your first one.</div>
      ) : (
        <div className="overflow-x-auto -mx-2 md:mx-0">
          <table className="w-full text-xs md:text-sm min-w-[760px]">
            <thead>
              <tr className="text-left bg-slate-900/40 text-slate-200 border-b border-white/10">
                <th className="p-2 w-12 font-medium"></th>
                <th className="p-2 font-medium">Name</th>
                <th className="p-2 font-medium">Contents</th>
                <th className="p-2 font-medium">Workflow</th>
                <th className="p-2 hidden lg:table-cell font-medium">CRS</th>
                <th className="p-2 font-medium">Start</th>
                <th className="p-2 font-medium">Finish</th>
                <th className="p-2 hidden md:table-cell font-medium">Cost Code</th>
                <th className="p-2 hidden md:table-cell font-medium">WBS</th>
                <th className="p-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <>
                  <tr key={p.id} className="border-b border-white/10 hover:bg-indigo-50/10">
                    <td className="p-2 align-top">
                      <ProjectAccordionToggle
                        open={!!expandedProjectIds[p.id]}
                        onClick={() => toggleProject(p.id)}
                        label={`${expandedProjectIds[p.id] ? "Collapse" : "Expand"} ${p.name}`}
                      />
                    </td>
                    <td className="p-2 font-medium align-top">{p.name}</td>
                    <td className="p-2 align-top text-slate-300/85">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-cyan-300/18 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-medium text-cyan-100">
                          {p.holeCount || 0} hole{p.holeCount === 1 ? "" : "s"}
                        </span>
                        <span className="rounded-full border border-rose-300/18 bg-rose-400/10 px-2.5 py-1 text-[11px] font-medium text-rose-100">
                          {p.assetCount || 0} asset{p.assetCount === 1 ? "" : "s"}
                        </span>
                      </div>
                    </td>
                    <td className="p-2 align-top"><WorkflowStageBadge project={p} /></td>
                    <td className="p-2 hidden lg:table-cell text-slate-300/80 align-top">{p.coordinate_crs_code || p.coordinate_crs_name || "-"}</td>
                    <td className="p-2 whitespace-nowrap align-top">{p.start_date || "—"}</td>
                    <td className="p-2 whitespace-nowrap align-top">{p.finish_date || "—"}</td>
                    <td className="p-2 hidden md:table-cell align-top">{p.cost_code || "—"}</td>
                    <td className="p-2 hidden md:table-cell align-top">{p.wbs_code || "—"}</td>
                    <td className="p-2 text-right align-top">
                      <div className="flex items-center justify-end gap-2">
                        <EditIconButton onClick={() => onEdit(p)} />
                        <DeleteIconButton onClick={() => onDelete(p)} />
                      </div>
                    </td>
                  </tr>
                  {expandedProjectIds[p.id] ? (
                    <tr className="border-b last:border-b-0 border-white/10 bg-slate-950/28">
                      <td colSpan={9} className="p-3 md:p-4">
                        <div className="grid gap-4 lg:grid-cols-2">
                          <div className="rounded-[22px] border border-cyan-300/14 bg-cyan-400/[0.04] p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-100/80">Holes</div>
                                <div className="mt-1 text-sm text-slate-300">All holes assigned to this project.</div>
                              </div>
                              <span className="rounded-full border border-cyan-300/18 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-medium text-cyan-100">
                                {p.holeCount || 0}
                              </span>
                            </div>

                            {p.holes?.length ? (
                              <div className="mt-3 space-y-2">
                                {p.holes.map((hole) => (
                                  <div key={hole.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/45 px-3 py-2.5">
                                    <div className="min-w-0">
                                      <div className="text-sm font-medium text-slate-100">{hole.hole_id || "Unnamed hole"}</div>
                                      <div className="mt-1 text-[11px] text-slate-400">
                                        Depth {hole.depth ?? hole.planned_depth ?? "—"} m
                                      </div>
                                    </div>
                                    <HoleStatePill state={hole.state} />
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="mt-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-4 text-sm text-slate-400">
                                No holes assigned to this project yet.
                              </div>
                            )}
                          </div>

                          <div className="rounded-[22px] border border-rose-300/14 bg-rose-400/[0.04] p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-[11px] uppercase tracking-[0.2em] text-rose-100/80">Assets</div>
                                <div className="mt-1 text-sm text-slate-300">All mapped assets linked to this project.</div>
                              </div>
                              <span className="rounded-full border border-rose-300/18 bg-rose-400/10 px-2.5 py-1 text-[11px] font-medium text-rose-100">
                                {p.assetCount || 0}
                              </span>
                            </div>

                            {p.assets?.length ? (
                              <div className="mt-3 space-y-2">
                                {p.assets.map((asset) => (
                                  <div key={asset.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/45 px-3 py-2.5">
                                    <div className="min-w-0">
                                      <div className="text-sm font-medium text-slate-100">{asset.name || "Unnamed asset"}</div>
                                      <div className="mt-1 text-[11px] text-slate-400">
                                        {asset.asset_types?.name || "Unclassified asset"}
                                      </div>
                                    </div>
                                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-200">
                                      {asset.status || "Unknown"}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="mt-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-4 text-sm text-slate-400">
                                No assets assigned to this project yet.
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}