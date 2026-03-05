"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { EditIconButton } from "@/app/components/ActionIconButton";

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "AUD" }).format(n);
}

function formatRatePeriod(p) {
  if (!p) return "—";
  const map = { hourly: "Hourly", daily: "Daily", weekly: "Weekly", monthly: "Monthly" };
  return map[p] || p;
}

function formatRateBasis(row) {
  if (!row?.billable) return "—";
  const mode = row?.rate_mode || "time";
  if (mode === "unit") return row?.rate_unit_name?.trim() || "Unit";
  return "Time";
}

function ActivityTypeModal({ form, setForm, saving, onClose, onSave, isEditing, plodTypes }) {
  const billable = !!form.billable;
  const timeBasedRate = (form.rate_mode || "time") === "time";

  const selected = useMemo(() => new Set(form.plod_type_ids || []), [form.plod_type_ids]);

  const toggle = (id) => {
    setForm((f) => {
      const cur = new Set(f.plod_type_ids || []);
      if (cur.has(id)) cur.delete(id);
      else cur.add(id);
      return { ...f, plod_type_ids: Array.from(cur) };
    });
  };

  const selectAll = () => setForm((f) => ({ ...f, plod_type_ids: (plodTypes || []).map((x) => x.id) }));
  const clearAll = () => setForm((f) => ({ ...f, plod_type_ids: [] }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-100">
            {isEditing ? "Edit Activity Type" : "New Activity Type"}
          </h2>
          <button className="btn" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <form
          className="grid grid-cols-1 gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSave();
          }}
        >
          <label className="block text-sm">
            Activity Type
            <input
              className="input w-full"
              value={form.activity_type}
              onChange={(e) => setForm((f) => ({ ...f, activity_type: e.target.value }))}
              placeholder="e.g. Standby"
              required
            />
          </label>

          <div className="block text-sm">
            <div className="flex items-center justify-between">
              <div>Plod Types</div>
              <div className="flex gap-2">
                <button type="button" className="text-xs underline text-slate-300/80" onClick={selectAll}>
                  Select all
                </button>
                <button type="button" className="text-xs underline text-slate-300/80" onClick={clearAll}>
                  Clear
                </button>
              </div>
            </div>

            <div className="mt-2 rounded-lg border border-white/10 bg-slate-900/40 p-2 max-h-[180px] overflow-auto">
              {(plodTypes || []).length === 0 ? (
                <div className="text-xs text-slate-300/70">No plod types found for this organisation.</div>
              ) : (
                (plodTypes || []).map((pt) => (
                  <label key={pt.id} className="flex items-start gap-2 py-1 cursor-pointer">
                    <input type="checkbox" checked={selected.has(pt.id)} onChange={() => toggle(pt.id)} className="mt-1" />
                    <span className="flex-1">
                      <div className="text-sm text-slate-100">{pt.name}</div>
                      {pt.description ? <div className="text-xs text-slate-400">{pt.description}</div> : null}
                    </span>
                  </label>
                ))
              )}
            </div>

            <div className="mt-1 text-xs text-slate-400">
              Select one or more plod types this activity can be used for.
            </div>
          </div>

          <label className="block text-sm">
            Billable
            <select
              className="input w-full"
              value={billable ? "yes" : "no"}
              onChange={(e) => {
                const nextBillable = e.target.value === "yes";
                setForm((f) => ({
                  ...f,
                  billable: nextBillable,
                  rate: nextBillable ? f.rate : "",
                  rate_mode: nextBillable ? f.rate_mode || "time" : "time",
                  rate_period: nextBillable ? f.rate_period || "hourly" : "",
                  rate_unit_name: nextBillable ? f.rate_unit_name || "" : "",
                  rate_unit_interval: nextBillable ? f.rate_unit_interval || 1 : "",
                }));
              }}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              Rate
              <input
                className="input w-full"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                disabled={!billable}
                value={form.rate ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))}
                placeholder="0.00"
              />
            </label>

            <label className="block text-sm">
              Time based rate
              <select
                className="input w-full"
                disabled={!billable}
                value={timeBasedRate ? "yes" : "no"}
                onChange={(e) => {
                  const isTimeBased = e.target.value === "yes";
                  setForm((f) => ({
                    ...f,
                    rate_mode: isTimeBased ? "time" : "unit",
                    rate_period: isTimeBased ? f.rate_period || "hourly" : "",
                    rate_unit_name: isTimeBased ? "" : f.rate_unit_name || "",
                    rate_unit_interval: isTimeBased ? "" : f.rate_unit_interval || 1,
                  }));
                }}
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
          </div>

          {billable && timeBasedRate && (
            <label className="block text-sm">
              Rate Period
              <select
                className="input w-full"
                value={form.rate_period || "hourly"}
                onChange={(e) => setForm((f) => ({ ...f, rate_period: e.target.value }))}
              >
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
          )}

          {billable && !timeBasedRate && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                Unit name
                <input
                  className="input w-full"
                  value={form.rate_unit_name ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, rate_unit_name: e.target.value }))}
                  placeholder="e.g. metre"
                />
              </label>

              <label className="block text-sm">
                Unit interval
                <input
                  className="input w-full"
                  type="number"
                  inputMode="decimal"
                  step="0.0001"
                  min="0.0001"
                  value={form.rate_unit_interval ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, rate_unit_interval: e.target.value }))}
                  placeholder="1"
                />
              </label>
            </div>
          )}

          <label className="block text-sm">
            Description (optional)
            <textarea
              className="input w-full"
              rows={4}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Optional notes…"
            />
          </label>

          <div className="flex gap-2 justify-end pt-2">
            <button type="button" className="btn" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || !form.activity_type.trim() || !(form.plod_type_ids || []).length}
            >
              {saving ? "Saving…" : isEditing ? "Save" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function formatPlodTypes(names) {
  if (!names || !Array.isArray(names) || names.length === 0) return "—";
  return names.join(", ");
}

export function ActivityTypesAdminPanel({ activityTypes, setActivityTypes, orgLoading, orgId }) {
  const supabase = supabaseBrowser();

  const emptyActivityType = {
    activity_type: "",
    description: "",
    group: "",
    label: "",
    billable: false,
    rate: "",
    rate_period: "",
    rate_mode: "time",
    rate_unit_name: "",
    rate_unit_interval: "",
    plod_type_ids: [], // <-- NEW
  };

  const [plodTypes, setPlodTypes] = useState([]);
  const [activityPlodTypeNames, setActivityPlodTypeNames] = useState({}); // activity_type_id -> [name]

  const [editingActivityTypeId, setEditingActivityTypeId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newActivityType, setNewActivityType] = useState(emptyActivityType);

  // Load plod types + mapping for display
  useEffect(() => {
    if (!orgId) {
      setPlodTypes([]);
      setActivityPlodTypeNames({});
      return;
    }

    let alive = true;

    (async () => {
      const { data: pts, error: ptErr } = await supabase
        .from("plod_types")
        .select("id,name,description,sort_order,is_active")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (!alive) return;

      if (ptErr) {
        console.error("load plod_types", ptErr);
        setPlodTypes([]);
      } else {
        setPlodTypes(pts || []);
      }

      // mapping: activity_type_id -> [plod type names]
      const { data: links, error: linkErr } = await supabase
        .from("plod_type_activity_types")
        .select("activity_type_id, plod_types(name)")
        .in(
          "activity_type_id",
          (activityTypes || []).map((x) => x.id)
        );

      if (!alive) return;

      if (linkErr) {
        console.error("load plod_type_activity_types", linkErr);
        setActivityPlodTypeNames({});
      } else {
        const map = {};
        for (const row of links || []) {
          const id = row.activity_type_id;
          const nm = row.plod_types?.name;
          if (!id || !nm) continue;
          map[id] = map[id] || [];
          map[id].push(nm);
        }
        // sort names for stable display
        Object.keys(map).forEach((k) => map[k].sort((a, b) => a.localeCompare(b)));
        setActivityPlodTypeNames(map);
      }
    })();

    return () => {
      alive = false;
    };
  }, [orgId, supabase, activityTypes]);

  const openCreateActivityType = () => {
    setEditingActivityTypeId(null);
    setNewActivityType(emptyActivityType);
    setShowModal(true);
  };

  const handleEditClick = async (row) => {
    setEditingActivityTypeId(row.id);

    // load selected plod types for this activity type
    const { data: links, error } = await supabase
      .from("plod_type_activity_types")
      .select("plod_type_id")
      .eq("activity_type_id", row.id);

    if (error) {
      console.error("load links for edit", error);
      toast.error("Could not load plod types for this activity type");
    }

    setNewActivityType({
      ...emptyActivityType,
      activity_type: row.activity_type ?? "",
      description: row.description ?? "",
      group: row.group ?? "",
      label: row.label ?? "",
      billable: !!row.billable,
      rate: row.rate ?? "",
      rate_period: row.rate_period ?? (row.billable ? "hourly" : ""),
      rate_mode: row.rate_mode || "time",
      rate_unit_name: row.rate_unit_name ?? "",
      rate_unit_interval: row.rate_unit_interval ?? "",
      plod_type_ids: (links || []).map((x) => x.plod_type_id).filter(Boolean),
    });

    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingActivityTypeId(null);
    setNewActivityType(emptyActivityType);
  };

  const saveActivityType = async () => {
    if (!orgId) return toast.error("Organisation not ready yet");
    if (!newActivityType.activity_type.trim()) return;
    if (!(newActivityType.plod_type_ids || []).length) return toast.error("Select at least one plod type");

    setSaving(true);
    try {
      const billable = !!newActivityType.billable;

      const rateNum =
        newActivityType.rate === "" || newActivityType.rate === null || newActivityType.rate === undefined
          ? null
          : Number(newActivityType.rate);

      const unitIntervalNum =
        newActivityType.rate_unit_interval === "" ||
        newActivityType.rate_unit_interval === null ||
        newActivityType.rate_unit_interval === undefined
          ? null
          : Number(newActivityType.rate_unit_interval);

      const rateMode = billable ? newActivityType.rate_mode || "time" : "time";

      // keep legacy column harmless (do not depend on it). Leave as ['all'] to avoid older constraints.
      const payload = {
        organization_id: orgId,
        activity_type: newActivityType.activity_type.trim(),
        description: newActivityType.description?.trim() || null,
        group: newActivityType.group?.trim() || null,
        label: newActivityType.label?.trim() || null,
        plod_type_scope: ["all"],
        billable,
        rate: billable && Number.isFinite(rateNum) ? rateNum : null,
        rate_mode: rateMode,
        rate_period: billable && rateMode === "time" ? newActivityType.rate_period || "hourly" : null,
        rate_unit_name: billable && rateMode === "unit" ? newActivityType.rate_unit_name?.trim() || null : null,
        rate_unit_interval:
          billable &&
          rateMode === "unit" &&
          Number.isFinite(unitIntervalNum) &&
          unitIntervalNum > 0
            ? unitIntervalNum
            : null,
      };

      if (billable && rateMode === "unit" && !(payload.rate_unit_name || "").trim()) {
        toast.error("Enter a unit name for non-time-based rates");
        setSaving(false);
        return;
      }

      if (billable && rateMode === "unit" && !payload.rate_unit_interval) {
        toast.error("Enter a valid unit interval greater than 0");
        setSaving(false);
        return;
      }

      const returning =
        'id, organization_id, activity_type, description, "group", label, plod_type_scope, billable, rate, rate_mode, rate_period, rate_unit_name, rate_unit_interval';

      let saved;

      if (editingActivityTypeId) {
        const res = await supabase
          .from("plod_activity_types")
          .update(payload)
          .eq("id", editingActivityTypeId)
          .eq("organization_id", orgId)
          .select(returning)
          .single();

        if (res.error) throw res.error;
        saved = res.data;

        setActivityTypes?.((arr) => (arr || []).map((x) => (x.id === saved.id ? saved : x)));
        toast.success("Activity type updated");
      } else {
        const res = await supabase.from("plod_activity_types").insert(payload).select(returning).single();
        if (res.error) throw res.error;
        saved = res.data;

        setActivityTypes?.((arr) => [saved, ...(arr || [])]);
        toast.success("Activity type added");
      }

      // Replace join rows for this activity type
      {
        const { error: delErr } = await supabase
          .from("plod_type_activity_types")
          .delete()
          .eq("activity_type_id", saved.id);

        if (delErr) throw delErr;

        const rows = (newActivityType.plod_type_ids || []).map((plod_type_id) => ({
          plod_type_id,
          activity_type_id: saved.id,
        }));

        const { error: insErr } = await supabase.from("plod_type_activity_types").insert(rows);
        if (insErr) throw insErr;
      }

      closeModal();
    } catch (e) {
      console.error("save activity type error", e);
      toast.error(e?.message || "Could not save activity type");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-slate-300/70">
          {(activityTypes?.length || 0)} item{(activityTypes?.length || 0) === 1 ? "" : "s"}
        </div>

        <button type="button" className="btn btn-primary" disabled={orgLoading || !orgId} onClick={openCreateActivityType}>
          Add Activity Type
        </button>
      </div>

      <div className="card p-4">
        <div className="overflow-x-auto -mx-2 md:mx-0">
          <table className="w-full text-xs md:text-sm min-w-[920px]">
            <thead>
              <tr className="text-left bg-slate-900/40 text-slate-200 border-b border-white/10">
                <th className="p-2 font-medium">Activity Type</th>
                <th className="p-2 font-medium">Plod Types</th>
                <th className="p-2 font-medium">Billable</th>
                <th className="p-2 font-medium">Rate</th>
                <th className="p-2 font-medium">Rate Basis</th>
                <th className="p-2 font-medium">Interval</th>
                <th className="p-2 font-medium">Description</th>
                <th className="p-2 font-medium w-[1%]"></th>
              </tr>
            </thead>

            <tbody>
              {(activityTypes || []).map((t) => (
                <tr key={t.id} className="border-b border-white/10 last:border-b-0 hover:bg-white/5">
                  <td className="p-2 font-medium">{t.activity_type}</td>
                  <td className="p-2">{formatPlodTypes(activityPlodTypeNames[t.id])}</td>
                  <td className="p-2">{t.billable ? "Yes" : "No"}</td>
                  <td className="p-2">{t.billable ? formatMoney(t.rate) : "—"}</td>
                  <td className="p-2">
                    {!t.billable
                      ? "—"
                      : (t.rate_mode || "time") === "time"
                      ? formatRatePeriod(t.rate_period)
                      : formatRateBasis(t)}
                  </td>
                  <td className="p-2">
                    {!t.billable
                      ? "—"
                      : (t.rate_mode || "time") === "unit"
                      ? Number(t.rate_unit_interval) || "—"
                      : "—"}
                  </td>
                  <td className="p-2">{t.description || "—"}</td>
                  <td className="p-2 text-right">
                    <EditIconButton onClick={() => handleEditClick(t)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <ActivityTypeModal
          form={newActivityType}
          setForm={setNewActivityType}
          saving={saving}
          onClose={closeModal}
          onSave={saveActivityType}
          isEditing={!!editingActivityTypeId}
          plodTypes={plodTypes}
        />
      )}
    </div>
  );
}