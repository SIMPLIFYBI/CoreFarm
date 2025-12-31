"use client";

import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useOrg } from "@/lib/OrgContext";
import { ActivityTypesAdminPanel } from "./ActivityTypesAdminPanel"; // <-- CHANGE (was plods/AdminPanel)

export default function ActivitiesTab({ orgId: orgIdProp, orgLoading: orgLoadingProp }) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const { orgId: orgIdCtx, loading: orgLoadingCtx } = useOrg();

  const orgId = orgIdProp ?? orgIdCtx;
  const orgLoading = orgLoadingProp ?? orgLoadingCtx;

  const [loading, setLoading] = useState(false);
  const [activityTypes, setActivityTypes] = useState([]);

  const load = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("plod_activity_types")
        .select('id, organization_id, activity_type, description, "group", label, plod_type_scope, billable, rate, rate_period')
        .eq("organization_id", orgId)
        .order("activity_type", { ascending: true });

      if (error) throw error;
      setActivityTypes(data || []);
    } catch (e) {
      console.error("load plod_activity_types", e);
      toast.error(e?.message || "Failed to load activity types");
      setActivityTypes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-sm text-slate-300/70">Manage activity types for plods (org-wide).</div>
        <button type="button" className="btn" onClick={load} disabled={!orgId || loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <ActivityTypesAdminPanel
        activityTypes={activityTypes}
        setActivityTypes={setActivityTypes}
        orgLoading={orgLoading}
        orgId={orgId}
      />
    </div>
  );
}