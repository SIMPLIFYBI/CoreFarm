"use client";

import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useOrg } from "@/lib/OrgContext";
import { IconPlods } from "../components/icons";
import { HistoryTable } from "./components/HistoryTable";
import { PlodCreateSheet } from "./components/PlodCreateSheet";

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
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });

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

    // org-scoped data
    const vQuery = sb.from("vendors").select("id,name").limit(100);
    const aQuery = sb
      .from("plod_activity_types")
      .select('id,activity_type,"group",description,plod_type_scope')
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

  const loadPlods = async () => {
    if (!orgIdCtx) return;

    setPlodsLoading(true);
    const sb = supabase;

    try {
      const { data, error } = await sb
        .from("plods")
        .select(`
          id,
          plod_type,
          started_at,
          finished_at,
          notes,
          vendors:vendor_id(name),
          plod_activities(
            id,
            activity_type_id,
            hole_id,
            started_at,
            finished_at,
            notes,
            activity_types:activity_type_id(activity_type),
            holes:hole_id(hole_id)
          )
        `)
        .eq("organization_id", orgIdCtx)
        .gte("started_at", dateRange.from ? `${dateRange.from}T00:00:00` : null)
        .lte("started_at", dateRange.to ? `${dateRange.to}T23:59:59` : null)
        .order("started_at", { ascending: false })
        .limit(100);

      if (error) setMessage({ type: "error", text: error.message });
      else setPlods(data || []);
    } catch (err) {
      setMessage({ type: "error", text: "Failed to load plods history" });
    } finally {
      setPlodsLoading(false);
    }
  };

  const load = async () => {
    if (!orgIdCtx) return;
    setPlodsLoading(true);
    try {
      const { data, error } = await supabase
        .from("plod_activity_types")
        .select('id, organization_id, activity_type, description, "group", plod_type_scope')
        .eq("organization_id", orgIdCtx)
        .order("activity_type", { ascending: true });

      if (error) throw error;
      setPlods(data || []);
    } catch (e) {
      console.error("load plod_activity_types", e);
      toast.error(e?.message || "Failed to load activities");
      setPlods([]);
    } finally {
      setPlodsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgIdCtx]);

  const startCreate = () => {
    setEditing(null);
    setForm({ activity_type: "", description: "", plodTypeScope: "all" });
  };

  const startEdit = (r) => {
    setEditing(r);
    const scopeArr = Array.isArray(r?.plod_type_scope) ? r.plod_type_scope : [];
    const scopeValue = scopeArr?.[0] || "all";
    setForm({
      activity_type: r?.activity_type || "",
      description: r?.description || "",
      plodTypeScope: scopeValue,
    });
  };

  const save = async () => {
    if (!orgIdCtx) return toast.error("Organisation not ready");
    if (!form.activity_type.trim()) return toast.error("Activity type is required");

    setSaving(true);
    try {
      const payload = {
        organization_id: orgIdCtx,
        activity_type: form.activity_type.trim(),
        description: form.description?.trim() ? form.description.trim() : null,
        plod_type_scope: [form.plodTypeScope || "all"],
      };

      if (editing?.id) {
        const { error } = await supabase
          .from("plod_activity_types")
          .update({
            activity_type: payload.activity_type,
            description: payload.description,
            plod_type_scope: payload.plod_type_scope,
          })
          .eq("id", editing.id)
          .eq("organization_id", orgIdCtx);

        if (error) throw error;
        toast.success("Activity updated");
      } else {
        const { error } = await supabase.from("plod_activity_types").insert(payload);
        if (error) throw error;
        toast.success("Activity created");
      }

      await load();
      startCreate();
    } catch (e) {
      console.error("save plod_activity_types", e);
      toast.error(e?.message || "Failed to save activity");
    } finally {
      setSaving(false);
    }
  };

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
    </div>
  );
}
