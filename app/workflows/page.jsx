"use client";

import Link from "next/link";
import { useMemo } from "react";
import { IconWorkflow } from "@/app/components/icons";
import WorkflowStudioPanel from "@/app/projects/components/WorkflowStudioPanel";
import { useOrg } from "@/lib/OrgContext";

export default function WorkflowsPage() {
  const { orgId, memberships } = useOrg();

  const currentOrgName = useMemo(() => {
    if (!orgId) return "";
    const membership = memberships.find((item) => item.organization_id === orgId);
    return membership?.organizations?.name || "";
  }, [memberships, orgId]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute left-[-10%] top-[-12%] h-[28rem] w-[28rem] rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute right-[-8%] top-[10%] h-[24rem] w-[24rem] rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute bottom-[-10%] left-[22%] h-[22rem] w-[22rem] rounded-full bg-sky-300/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
        <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(8,47,73,0.86),rgba(2,6,23,0.96)_52%,rgba(6,78,59,0.92))] p-6 shadow-[0_30px_120px_rgba(2,6,23,0.42)] md:p-8">
          <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(125,211,252,0.18),transparent_58%)]" />
          <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_320px] lg:items-end">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-cyan-100">
                <IconWorkflow />
                Workflow Studio
              </div>
              <div>
                <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-white md:text-5xl">Design project and hole workflows as a visual operating system.</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200/80 md:text-base">
                  Create reusable stage-gate templates, shape the sequence visually, and keep current workflow status separate from drilling state.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-200/75 md:text-sm">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Reusable templates</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Project and hole workflows</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Current stage only</span>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-black/20 p-5 backdrop-blur-xl">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-300/70">Active organisation</div>
              <div className="mt-2 text-xl font-semibold text-white">{currentOrgName || "No organisation selected"}</div>
              <p className="mt-2 text-sm leading-6 text-slate-300/80">
                {orgId
                  ? "Workflow templates are scoped to the currently selected organisation."
                  : "Choose an organisation first so the studio can load the right workflow library."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/projects?tab=workflows" className="btn btn-3d-glass">
                  Projects Tab View
                </Link>
                <Link href="/team" className="btn btn-3d-glass">
                  Change Organisation
                </Link>
              </div>
            </div>
          </div>
        </section>

        {!orgId ? (
          <section className="card rounded-[28px] p-6 text-sm text-slate-300">
            Select an organisation to start creating workflows. The studio uses your current organisation context for both definitions and stage assignments.
          </section>
        ) : (
          <WorkflowStudioPanel orgId={orgId} />
        )}
      </div>
    </main>
  );
}