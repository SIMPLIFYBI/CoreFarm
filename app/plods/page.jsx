"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useOrg } from "@/lib/OrgContext";
import { IconPlods } from "../components/icons";
import { HistoryTable } from "./components/HistoryTable";
import { PlodCreateSheet } from "./components/PlodCreateSheet";
import { PlodDetailsModal } from "./components/PlodDetailsModal";

export default function Page() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const { orgId: orgIdCtx, loading: orgLoadingCtx } = useOrg();

  const [vendors, setVendors] = useState([]);
  const [activityTypes, setActivityTypes] = useState([]);
  const [holes, setHoles] = useState([]);

  const [message, setMessage] = useState(null);
  const [enteredBy, setEnteredBy] = useState("");
  const [showCreatePlod, setShowCreatePlod] = useState(false);

  const [plods, setPlods] = useState([]);
  const [plodsLoading, setPlodsLoading] = useState(false);
  const [selectedPlod, setSelectedPlod] = useState(null);
  const [decisionSaving, setDecisionSaving] = useState(false);
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });

  const loadPlods = async () => {
    if (!orgIdCtx) return;

    setPlodsLoading(true);
    const sb = supabase;

    try {
      let q = sb
        .from("plods")
        .select(`
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
            hole_id,
            started_at,
            finished_at,
            machine_hours,
            notes,
            activity_types:activity_type_id(activity_type),
            holes:hole_id(hole_id)
          )
        `)
        .eq("organization_id", orgIdCtx)
        .order("shift_date", { ascending: false })
        .order("started_at", { ascending: false })
        .limit(100);

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
          .from("profiles")
          .select("id,full_name,email")
          .in("id", userIds);

        profileById = (profiles || []).reduce((acc, profile) => {
          acc[profile.id] = profile;
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
      .select('id,activity_type,"group",description') // legacy plod_type_scope no longer needed here
      .order("activity_type", { ascending: true })
      .limit(200);
    const hQuery = sb.from("holes").select("id,hole_id").limit(200);

    if (orgIdCtx) {
      vQuery.eq("organization_id", orgIdCtx);
      aQuery.eq("organization_id", orgIdCtx);
      hQuery.eq("organization_id", orgIdCtx);
    }

    Promise.all([vQuery, aQuery, hQuery]).then(([vRes, aRes, hRes]) => {
      if (vRes?.error) setMessage({ type: "error", text: vRes.error.message });
      else setVendors(vRes?.data || []);

      if (aRes?.error) setMessage({ type: "error", text: aRes.error.message });
      else setActivityTypes(aRes?.data || []);

      if (hRes?.error) setMessage({ type: "error", text: hRes.error.message });
      else setHoles(hRes?.data || []);
    });

    if (orgIdCtx) loadPlods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgIdCtx]);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white">
              <IconPlods />
            </span>
            Plods
          </h1>
          <p className="text-sm text-slate-300 mt-2">
            Record a shift. Choose plod type, fill header fields, then add activities.
          </p>
        </div>

        <button type="button" onClick={() => setShowCreatePlod(true)} className="btn btn-primary whitespace-nowrap">
          New Plod
        </button>
      </header>

      <div className="card overflow-hidden">
        <section className="p-6">
          {message && (
            <div
              className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
                message.type === "error"
                  ? "bg-red-500/10 text-red-200 border-red-500/20"
                  : "bg-emerald-500/10 text-emerald-200 border-emerald-500/20"
              }`}
            >
              {message.text}
            </div>
          )}

          <HistoryTable
            plods={plods}
            plodsLoading={plodsLoading}
            dateRange={dateRange}
            onDateChange={(k, v) => setDateRange((s) => ({ ...s, [k]: v }))}
            onRefresh={loadPlods}
            onSelectPlod={setSelectedPlod}
          />
        </section>
      </div>

      <PlodCreateSheet
        open={showCreatePlod}
        onClose={() => setShowCreatePlod(false)}
        orgId={orgIdCtx}
        enteredBy={enteredBy}
        vendors={vendors}
        holes={holes}
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
