"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useOrg } from "@/lib/OrgContext";
import { IconPlods } from "../components/icons";
import { HistoryTable } from "./components/HistoryTable";
import { PlodCreateSheet } from "./components/PlodCreateSheet";
import { PlodDetailsModal } from "./components/PlodDetailsModal";

function FilterIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PlodFilterDrawer({ open, onClose, children }) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const animationFrame = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(animationFrame);
    }

    setVisible(false);
    const timeoutId = window.setTimeout(() => setMounted(false), 320);
    return () => window.clearTimeout(timeoutId);
  }, [open]);

  useEffect(() => {
    if (!mounted) return undefined;
    const handleEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [mounted, onClose]);

  if (!mounted) return null;

  return (
    <div
      className={[
        "fixed inset-0 z-[92] flex items-end backdrop-blur-sm transition-opacity duration-300 ease-out",
        visible ? "bg-slate-950/58 opacity-100" : "bg-slate-950/0 opacity-0",
      ].join(" ")}
      onClick={onClose}
    >
      <div
        className={[
          "flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.99))] shadow-[0_-24px_80px_rgba(2,6,23,0.48)] transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.18,0.9,0.22,1)]",
          visible ? "translate-y-0 opacity-100" : "translate-y-[18vh] opacity-0",
        ].join(" ")}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="plod-advanced-filters-title"
      >
        <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col overflow-y-auto overscroll-y-contain px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pt-3 md:px-6">
          <div className="mx-auto h-1.5 w-12 rounded-full bg-white/15" />
          {children}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const { orgId: orgIdCtx, loading: orgLoadingCtx } = useOrg();

  const [vendors, setVendors] = useState([]);
  const [activityTypes, setActivityTypes] = useState([]);
  const [holes, setHoles] = useState([]);
  const [projects, setProjects] = useState([]);

  const [message, setMessage] = useState(null);
  const [enteredBy, setEnteredBy] = useState("");
  const [showCreatePlod, setShowCreatePlod] = useState(false);

  const [plods, setPlods] = useState([]);
  const [plodsLoading, setPlodsLoading] = useState(false);
  const [plodScope, setPlodScope] = useState("my"); // 'my' | 'client'
  const [selectedPlod, setSelectedPlod] = useState(null);
  const [decisionSaving, setDecisionSaving] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });
  const [advancedFilters, setAdvancedFilters] = useState({
    status: "",
    vendorId: "",
    plodType: "",
    projectId: "",
    holeId: "",
    submitter: "",
  });

  const filterOptions = useMemo(() => {
    const typeMap = new Map();
    const vendorMap = new Map();
    const projectMap = new Map();
    const holeMap = new Map();
    const submitterMap = new Map();

    for (const plod of plods) {
      const typeLabel = plod.plod_types?.name ?? plod.plod_type ?? "";
      if (typeLabel) typeMap.set(typeLabel, typeLabel);

      if (plod.vendors?.name) vendorMap.set(plod.vendors.name, { value: plod.vendors.name, label: plod.vendors.name });

      const submitterLabel = plod.submitted_by_profile?.display_name
        || plod.submitted_by_profile?.full_name
        || plod.submitted_by_profile?.email
        || "";
      if (submitterLabel) submitterMap.set(submitterLabel, submitterLabel);

      const activities = Array.isArray(plod.plod_activities) ? plod.plod_activities : [];
      for (const activity of activities) {
        if (activity.projects?.name && activity.project_id) {
          projectMap.set(activity.project_id, { value: activity.project_id, label: activity.projects.name });
        }
        if (activity.holes?.hole_id && activity.hole_id) {
          holeMap.set(activity.hole_id, { value: activity.hole_id, label: activity.holes.hole_id });
        }
      }
    }

    return {
      plodTypes: Array.from(typeMap.values()).sort((a, b) => a.localeCompare(b)),
      vendors: Array.from(vendorMap.values()).sort((a, b) => a.label.localeCompare(b.label)),
      projects: Array.from(projectMap.values()).sort((a, b) => a.label.localeCompare(b.label)),
      holes: Array.from(holeMap.values()).sort((a, b) => a.label.localeCompare(b.label)),
      submitters: Array.from(submitterMap.values()).sort((a, b) => a.localeCompare(b)),
    };
  }, [plods]);

  const filteredPlods = useMemo(() => {
    return plods.filter((plod) => {
      const status = String(plod?.approval_status || "submitted").toLowerCase();
      if (advancedFilters.status && status !== advancedFilters.status) return false;

      const vendorName = plod.vendors?.name || "";
      if (advancedFilters.vendorId && vendorName !== advancedFilters.vendorId) return false;

      const plodType = plod.plod_types?.name ?? plod.plod_type ?? "";
      if (advancedFilters.plodType && plodType !== advancedFilters.plodType) return false;

      const submitterLabel = plod.submitted_by_profile?.display_name
        || plod.submitted_by_profile?.full_name
        || plod.submitted_by_profile?.email
        || "";
      if (advancedFilters.submitter && submitterLabel !== advancedFilters.submitter) return false;

      const activities = Array.isArray(plod.plod_activities) ? plod.plod_activities : [];
      if (advancedFilters.projectId && !activities.some((activity) => activity.project_id === advancedFilters.projectId)) return false;
      if (advancedFilters.holeId && !activities.some((activity) => activity.hole_id === advancedFilters.holeId)) return false;

      return true;
    });
  }, [advancedFilters, plods]);

  const activeAdvancedFilterCount = useMemo(() => {
    let count = 0;
    Object.values(advancedFilters).forEach((value) => {
      if (typeof value === "string" && value) count += 1;
    });
    return count;
  }, [advancedFilters]);

  const historyMetrics = useMemo(() => {
    const total = filteredPlods.length;
    let pending = 0;
    let approved = 0;

    for (const plod of filteredPlods) {
      const status = String(plod?.approval_status || "submitted").toLowerCase();
      if (status === "approved") approved += 1;
      else if (status !== "rejected") pending += 1;
    }

    return { total, pending, approved };
  }, [filteredPlods]);

  const updateAdvancedFilter = (key, value) => {
    setAdvancedFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const clearAdvancedFilters = () => {
    setAdvancedFilters({
      status: "",
      vendorId: "",
      plodType: "",
      projectId: "",
      holeId: "",
      submitter: "",
    });
  };

  const loadPlods = async () => {
    if (!orgIdCtx) return;

    setPlodsLoading(true);
    const sb = supabase;

    try {
      const baseSelect = `
          id,
          shift_date,
          plod_type_id,
          plod_type,
          started_at,
          finished_at,
          notes,
          approval_status,
          submitted_at,
          submitted_by,
          decision_at,
          decision_by,
          decision_comment,
          vendors:vendor_id(name),
          plod_types:plod_type_id(name),
          plod_activities(
            id,
            activity_type_id,
            project_id,
            hole_id,
            started_at,
            finished_at,
            machine_hours,
            unit_quantity,
            notes,
            activity_types:activity_type_id(activity_type, rate_mode, rate_unit_name, rate_unit_interval),
            projects:project_id(name),
            holes:hole_id(hole_id)
          )
        `;

      let q = sb
        .from("plods")
        .select(baseSelect)
        .order("shift_date", { ascending: false })
        .order("started_at", { ascending: false })
        .limit(100);

      if (plodScope === "my") {
        q = q.eq("organization_id", orgIdCtx);
      } else {
        const { data: ownProjectRows, error: ownProjectErr } = await sb
          .from("projects")
          .select("id")
          .eq("organization_id", orgIdCtx)
          .limit(5000);

        if (ownProjectErr) {
          setMessage({ type: "error", text: ownProjectErr.message });
          setPlods([]);
          return [];
        }

        const ownProjectIds = (ownProjectRows || []).map((row) => row.id).filter(Boolean);
        if (ownProjectIds.length === 0) {
          setPlods([]);
          return [];
        }

        const { data: plodActivityRows, error: plodActivityErr } = await sb
          .from("plod_activities")
          .select("plod_id")
          .in("project_id", ownProjectIds)
          .limit(10000);

        if (plodActivityErr) {
          setMessage({ type: "error", text: plodActivityErr.message });
          setPlods([]);
          return [];
        }

        const candidatePlodIds = Array.from(new Set((plodActivityRows || []).map((row) => row.plod_id).filter(Boolean)));
        if (candidatePlodIds.length === 0) {
          setPlods([]);
          return [];
        }

        q = q.in("id", candidatePlodIds).neq("organization_id", orgIdCtx);
      }

      if (dateRange.from) q = q.gte("shift_date", dateRange.from);
      if (dateRange.to) q = q.lte("shift_date", dateRange.to);

      const { data, error } = await q;

      if (error) {
        setMessage({ type: "error", text: error.message });
        return [];
      }

      const rows = data || [];
      const userIds = Array.from(
        new Set(rows.flatMap((p) => [p.submitted_by, p.decision_by]).filter(Boolean))
      );

      let profileById = {};
      if (userIds.length > 0) {
        const { data: profiles } = await sb
          .from("user_profiles")
          .select("user_id,display_name,email")
          .in("user_id", userIds);

        profileById = (profiles || []).reduce((acc, profile) => {
          acc[profile.user_id] = profile;
          return acc;
        }, {});
      }

      const enriched = rows.map((row) => ({
        ...row,
        submitted_by_profile: row.submitted_by ? profileById[row.submitted_by] ?? null : null,
        decision_by_profile: row.decision_by ? profileById[row.decision_by] ?? null : null,
      }));

      setPlods(enriched);
      return enriched;
    } catch (_err) {
      setMessage({ type: "error", text: "Failed to load plods history" });
      return [];
    } finally {
      setPlodsLoading(false);
    }
  };

  const handleDecision = async (plodId, action, comment) => {
    if (!plodId || decisionSaving) return;

    setDecisionSaving(true);
    setMessage(null);

    try {
      const rpcName = action === "approve" ? "approve_plod" : "reject_plod";
      const { error } = await supabase.rpc(rpcName, {
        p_plod_id: plodId,
        p_comment: comment || null,
      });

      if (error) {
        setMessage({ type: "error", text: error.message || `Failed to ${action} plod` });
        return;
      }

      const refreshed = await loadPlods();
      const updated = refreshed.find((p) => p.id === plodId) || null;
      setSelectedPlod(updated);
      setMessage({ type: "success", text: `Plod ${action === "approve" ? "approved" : "rejected"}.` });
    } catch (_err) {
      setMessage({ type: "error", text: `Failed to ${action} plod` });
    } finally {
      setDecisionSaving(false);
    }
  };

  useEffect(() => {
    const sb = supabase;

    // enteredBy
    (async () => {
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) return;

      const { data } = await sb.from("profiles").select("full_name,email").eq("id", user.id).single();
      const name = data?.full_name || data?.email || user.email || "";
      setEnteredBy(name);
    })();

    // org-scoped reference data
    const vQuery = sb.from("vendors").select("id,name").limit(100);
    const aQuery = sb
      .from("plod_activity_types")
      .select('id,activity_type,"group",description,billable,rate_mode,rate_unit_name,rate_unit_interval') // legacy plod_type_scope no longer needed here
      .order("activity_type", { ascending: true })
      .limit(200);
    const ownProjectsQuery = sb
      .from("projects")
      .select("id,name,organization_id")
      .order("name", { ascending: true })
      .limit(300);

    const sharedProjectsQuery = sb
      .from("organization_shared_projects")
      .select("project_id, relationship:relationship_id(client_organization_id,vendor_organization_id,status,permissions)")
      .limit(1000);

    if (orgIdCtx) {
      vQuery.eq("organization_id", orgIdCtx);
      aQuery.eq("organization_id", orgIdCtx);
      ownProjectsQuery.eq("organization_id", orgIdCtx);
    }

    Promise.all([vQuery, aQuery, ownProjectsQuery, sharedProjectsQuery]).then(async ([vRes, aRes, ownProjectsRes, sharedRes]) => {
      if (vRes?.error) setMessage({ type: "error", text: vRes.error.message });
      else setVendors(vRes?.data || []);

      if (aRes?.error) setMessage({ type: "error", text: aRes.error.message });
      else setActivityTypes(aRes?.data || []);

      const ownProjects = (ownProjectsRes?.data || []).map((p) => ({ ...p, source: "own" }));

      let sharedProjects = [];
      if (sharedRes?.error) {
        setMessage({ type: "error", text: sharedRes.error.message });
      } else {
        const allowedSharedProjectIds = (sharedRes?.data || [])
          .filter((row) => {
            const rel = row.relationship;
            if (!rel) return false;
            const status = (rel.status || "").toString();
            const isAccepted = status === "active" || status === "accepted";
            const hasPermission = !!rel.permissions?.share_project_details;
            const isForCurrentOrg = rel.vendor_organization_id === orgIdCtx;
            return isAccepted && hasPermission && isForCurrentOrg;
          })
          .map((row) => row.project_id)
          .filter(Boolean);

        if (allowedSharedProjectIds.length > 0) {
          const { data: sharedProjectRows, error: sharedProjectErr } = await sb
            .from("projects")
            .select("id,name,organization_id")
            .in("id", Array.from(new Set(allowedSharedProjectIds)))
            .order("name", { ascending: true });
          if (sharedProjectErr) {
            setMessage({ type: "error", text: sharedProjectErr.message });
          } else {
            sharedProjects = (sharedProjectRows || []).map((p) => ({ ...p, source: "shared" }));
          }
        }
      }

      const projectById = new Map();
      [...ownProjects, ...sharedProjects].forEach((project) => {
        if (!projectById.has(project.id)) projectById.set(project.id, project);
      });

      const mergedProjects = Array.from(projectById.values()).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setProjects(mergedProjects);

      if (mergedProjects.length === 0) {
        setHoles([]);
      } else {
        const { data: holesRes, error: holesErr } = await sb
          .from("holes")
          .select("id,hole_id,project_id,organization_id")
          .in("project_id", mergedProjects.map((p) => p.id))
          .limit(1000);

        if (holesErr) setMessage({ type: "error", text: holesErr.message });
        else setHoles(holesRes || []);
      }
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgIdCtx]);

  useEffect(() => {
    if (!orgIdCtx) return;
    loadPlods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgIdCtx, plodScope, dateRange.from, dateRange.to]);

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6 space-y-5">
      <button
        type="button"
        aria-label="Open filters"
        title="Open filters"
        className="fixed right-3 top-[calc(env(safe-area-inset-top,0px)+5.25rem)] z-30 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-slate-950/88 text-slate-100 shadow-[0_18px_42px_rgba(2,6,23,0.3)] backdrop-blur-xl transition hover:bg-slate-900/92 md:right-4 md:top-[calc(env(safe-area-inset-top,0px)+5.75rem)]"
        onClick={() => setShowAdvancedFilters(true)}
      >
        <FilterIcon className="h-[18px] w-[18px] text-cyan-200" />
        {activeAdvancedFilterCount ? (
          <span className="absolute -right-1.5 -top-1.5 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">
            {activeAdvancedFilterCount}
          </span>
        ) : null}
      </button>

      <section className="card p-4 md:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100 flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(135deg,#22d3ee,#0f766e)] text-slate-950 shadow-[0_12px_28px_rgba(34,211,238,0.2)]">
                <IconPlods />
              </span>
              Plods
            </h1>
            <p className="text-sm text-slate-300 mt-1">
              Record, review, and approve shift-level PLOD submissions in the same operational style as Activity.
            </p>
          </div>

          <button type="button" onClick={() => setShowCreatePlod(true)} className="btn btn-primary whitespace-nowrap">
            New Plod
          </button>
        </div>
      </section>

      {message ? (
        <section className="card p-4">
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              message.type === "error"
                ? "bg-red-500/10 text-red-200 border-red-500/20"
                : "bg-emerald-500/10 text-emerald-200 border-emerald-500/20"
            }`}
          >
            {message.text}
          </div>
        </section>
      ) : null}

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="glass rounded-xl border border-white/10 p-4">
          <div className="text-xs text-slate-300">Plods In Range</div>
          <div className="text-2xl font-semibold text-slate-100">{historyMetrics.total}</div>
        </div>
        <div className="glass rounded-xl border border-white/10 p-4">
          <div className="text-xs text-slate-300">Pending Review</div>
          <div className="text-2xl font-semibold text-slate-100">{historyMetrics.pending}</div>
        </div>
        <div className="glass rounded-xl border border-white/10 p-4">
          <div className="text-xs text-slate-300">Approved</div>
          <div className="text-2xl font-semibold text-slate-100">{historyMetrics.approved}</div>
        </div>
      </section>

      <HistoryTable
        plods={filteredPlods}
        plodsLoading={plodsLoading}
        plodScope={plodScope}
        onPlodScopeChange={setPlodScope}
        dateRange={dateRange}
        onDateChange={(k, v) => setDateRange((s) => ({ ...s, [k]: v }))}
        onSelectPlod={setSelectedPlod}
      />

      <PlodFilterDrawer open={showAdvancedFilters} onClose={() => setShowAdvancedFilters(false)}>
        <div className="mt-3 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.82),rgba(2,6,23,0.94))] p-3 shadow-[0_24px_80px_rgba(2,6,23,0.36)] backdrop-blur-xl md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div id="plod-advanced-filters-title" className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/75">Detailed Filters</div>
              <p className="mt-2 max-w-2xl text-[13px] leading-5 text-slate-300 md:text-sm md:leading-6">
                Narrow plods by scope, date, approval status, vendor, type, project, hole, and submitter without leaving the page.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 self-start">
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-[11px] font-medium text-slate-200 md:px-3 md:text-xs">
                {activeAdvancedFilterCount} active filter{activeAdvancedFilterCount === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-[11px] font-medium text-slate-100 transition hover:bg-white/[0.1] md:px-3 md:text-xs"
                onClick={clearAdvancedFilters}
              >
                Clear all
              </button>
              <button
                type="button"
                className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-[11px] font-medium text-slate-100 transition hover:bg-white/[0.1] md:px-3 md:text-xs"
                onClick={() => setShowAdvancedFilters(false)}
              >
                Close
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="min-w-0 rounded-[24px] border border-white/10 bg-white/[0.03] p-3 md:p-4 xl:col-span-2">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-300">History Window</div>
              <div className="mt-3 grid gap-3 md:grid-cols-[auto_repeat(2,minmax(180px,220px))] md:items-end">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Scope</div>
                  <div className="mt-2 inline-flex rounded-full border border-white/10 bg-slate-900/40 p-1 gap-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <button
                      type="button"
                      className={`rounded-full px-4 py-2 text-xs font-medium transition-base ${plodScope === "my" ? "bg-[linear-gradient(135deg,#22d3ee,#0f766e)] text-slate-950 shadow-[0_12px_24px_rgba(34,211,238,0.22)]" : "text-slate-200 hover:bg-white/10"}`}
                      onClick={() => setPlodScope("my")}
                    >
                      My Plods
                    </button>
                    <button
                      type="button"
                      className={`rounded-full px-4 py-2 text-xs font-medium transition-base ${plodScope === "client" ? "bg-[linear-gradient(135deg,#22d3ee,#0f766e)] text-slate-950 shadow-[0_12px_24px_rgba(34,211,238,0.22)]" : "text-slate-200 hover:bg-white/10"}`}
                      onClick={() => setPlodScope("client")}
                    >
                      Client Plods
                    </button>
                  </div>
                </div>

                <label className="block text-xs text-slate-300">
                  Date From
                  <input
                    type="date"
                    className="input mt-1 h-10 text-[11px]"
                    value={dateRange?.from || ""}
                    onChange={(e) => setDateRange((s) => ({ ...s, from: e.target.value }))}
                  />
                </label>

                <label className="block text-xs text-slate-300">
                  Date To
                  <input
                    type="date"
                    className="input mt-1 h-10 text-[11px]"
                    value={dateRange?.to || ""}
                    onChange={(e) => setDateRange((s) => ({ ...s, to: e.target.value }))}
                  />
                </label>
              </div>
            </div>

            <div className="min-w-0 rounded-[24px] border border-cyan-300/14 bg-cyan-400/[0.04] p-3 md:p-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-100/80">Plod Details</div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Status
                  <select
                    value={advancedFilters.status}
                    onChange={(event) => updateAdvancedFilter("status", event.target.value)}
                    className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-slate-950/55 px-3 text-[13px] font-medium normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/40 md:px-4 md:text-sm"
                  >
                    <option value="">All statuses</option>
                    <option value="submitted">Submitted</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </label>
                <label className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Type
                  <select
                    value={advancedFilters.plodType}
                    onChange={(event) => updateAdvancedFilter("plodType", event.target.value)}
                    className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-slate-950/55 px-3 text-[13px] font-medium normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/40 md:px-4 md:text-sm"
                  >
                    <option value="">All plod types</option>
                    {filterOptions.plodTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Vendor
                  <select
                    value={advancedFilters.vendorId}
                    onChange={(event) => updateAdvancedFilter("vendorId", event.target.value)}
                    className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-slate-950/55 px-3 text-[13px] font-medium normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/40 md:px-4 md:text-sm"
                  >
                    <option value="">All vendors</option>
                    {filterOptions.vendors.map((vendor) => (
                      <option key={vendor.value} value={vendor.value}>{vendor.label}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Submitter
                  <select
                    value={advancedFilters.submitter}
                    onChange={(event) => updateAdvancedFilter("submitter", event.target.value)}
                    className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-slate-950/55 px-3 text-[13px] font-medium normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/40 md:px-4 md:text-sm"
                  >
                    <option value="">All submitters</option>
                    {filterOptions.submitters.map((submitter) => (
                      <option key={submitter} value={submitter}>{submitter}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="min-w-0 rounded-[24px] border border-rose-300/14 bg-rose-400/[0.04] p-3 md:p-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-rose-100/80">Activity Context</div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Project
                  <select
                    value={advancedFilters.projectId}
                    onChange={(event) => updateAdvancedFilter("projectId", event.target.value)}
                    className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-slate-950/55 px-3 text-[13px] font-medium normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/40 md:px-4 md:text-sm"
                  >
                    <option value="">All projects</option>
                    {filterOptions.projects.map((project) => (
                      <option key={project.value} value={project.value}>{project.label}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Hole
                  <select
                    value={advancedFilters.holeId}
                    onChange={(event) => updateAdvancedFilter("holeId", event.target.value)}
                    className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-slate-950/55 px-3 text-[13px] font-medium normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/40 md:px-4 md:text-sm"
                  >
                    <option value="">All holes</option>
                    {filterOptions.holes.map((hole) => (
                      <option key={hole.value} value={hole.value}>{hole.label}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </div>
        </div>
      </PlodFilterDrawer>

      <PlodCreateSheet
        open={showCreatePlod}
        onClose={() => setShowCreatePlod(false)}
        orgId={orgIdCtx}
        enteredBy={enteredBy}
        vendors={vendors}
        holes={holes}
        projects={projects}
        activityTypes={activityTypes}
        onCreated={loadPlods}
        orgLoading={orgLoadingCtx}
      />

      <PlodDetailsModal
        plod={selectedPlod}
        onClose={() => setSelectedPlod(null)}
        onDecision={handleDecision}
        decisionSaving={decisionSaving}
      />
    </div>
  );
}
