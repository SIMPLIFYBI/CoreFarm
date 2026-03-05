"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "../../../lib/supabaseClient";
import { EditIconButton } from "@/app/components/ActionIconButton";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

function toISOFromDateAndTime(dateStr, timeStr) {
  return `${dateStr}T${timeStr.length === 5 ? `${timeStr}:00` : timeStr}`;
}

function snapTimeToQuarter(timeStr) {
  if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr)) return timeStr;
  const [h, m] = timeStr.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return timeStr;

  const totalMinutes = h * 60 + m;
  const snapped = Math.round(totalMinutes / 15) * 15;
  const safe = Math.max(0, Math.min(23 * 60 + 59, snapped));
  const outH = String(Math.floor(safe / 60)).padStart(2, "0");
  const outM = String(safe % 60).padStart(2, "0");
  return `${outH}:${outM}`;
}

function getTimeParts(timeStr) {
  if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr)) {
    return { hour12: "12", minute: "00", period: "AM" };
  }

  const [hourRaw, minute] = timeStr.split(":");
  const hour24 = Number(hourRaw);
  if (!Number.isFinite(hour24)) {
    return { hour12: "12", minute: "00", period: "AM" };
  }

  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12Num = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour12: String(hour12Num).padStart(2, "0"), minute, period };
}

function build24HourTime(hour12, minute, period) {
  const parsedHour = Number(hour12);
  if (!Number.isFinite(parsedHour) || parsedHour < 1 || parsedHour > 12) return "";
  if (!["00", "15", "30", "45"].includes(minute)) return "";

  let hour24 = parsedHour % 12;
  if (period === "PM") hour24 += 12;
  return `${String(hour24).padStart(2, "0")}:${minute}`;
}

function format12HourLabel(timeStr) {
  if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr)) return "--:--";
  const [hourRaw, minute] = timeStr.split(":");
  const hour24 = Number(hourRaw);
  if (!Number.isFinite(hour24)) return "--:--";
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${String(hour12).padStart(2, "0")}:${minute} ${period}`;
}

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const MINUTE_OPTIONS = ["00", "15", "30", "45"];

function QuarterHourPicker({ label, value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value || "00:00");

  useEffect(() => {
    if (!open) return;
    setDraft(value || "00:00");
  }, [open, value]);

  const parts = getTimeParts(draft);

  const setPart = (part, next) => {
    const hour12 = part === "hour12" ? next : parts.hour12;
    const minute = part === "minute" ? next : parts.minute;
    const period = part === "period" ? next : parts.period;
    setDraft(build24HourTime(hour12, minute, period));
  };

  return (
    <div>
      <label className="block text-sm font-medium text-slate-200">{label}</label>
      <button
        type="button"
        className="input mt-1 text-left"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        {value ? format12HourLabel(value) : "Select time…"}
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-xs p-5">
            <div className="text-[11px] tracking-widest uppercase text-slate-300">Select Time</div>
            <div className="mt-2 text-5xl font-light text-slate-100">{format12HourLabel(draft)}</div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <select className="select" value={parts.hour12} onChange={(e) => setPart("hour12", e.target.value)}>
                {HOUR_OPTIONS.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              <select className="select" value={parts.minute} onChange={(e) => setPart("minute", e.target.value)}>
                {MINUTE_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <div className="grid grid-cols-1 gap-1">
                <button
                  type="button"
                  className={`btn !min-h-0 py-1 text-xs ${parts.period === "AM" ? "btn-3d-primary" : "btn-3d-glass"}`}
                  onClick={() => setPart("period", "AM")}
                >
                  AM
                </button>
                <button
                  type="button"
                  className={`btn !min-h-0 py-1 text-xs ${parts.period === "PM" ? "btn-3d-primary" : "btn-3d-glass"}`}
                  onClick={() => setPart("period", "PM")}
                >
                  PM
                </button>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn btn-3d-glass" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-3d-primary"
                onClick={() => {
                  onChange(snapTimeToQuarter(draft));
                  setOpen(false);
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function PlodCreateSheet({ open, onClose, orgId, enteredBy, vendors = [], holes = [], projects = [], activityTypes = [], onCreated }) {
  const [step, setStep] = useState(1);

  const [plodTypes, setPlodTypes] = useState([]);
  const [plodTypeId, setPlodTypeId] = useState("");

  const [shiftDate, setShiftDate] = useState(new Date().toISOString().slice(0, 10));
  const [vendorId, setVendorId] = useState("");
  const [notes, setNotes] = useState("");

  const [activities, setActivities] = useState([]);
  const [editingIdx, setEditingIdx] = useState(null);

  const [activityForm, setActivityForm] = useState({
    activity_type_id: "",
    project_source: "own",
    project_id: "",
    hole_id: "",
    start_time: "",
    end_time: "",
    machine_hours: "",
    unit_quantity: "",
    notes: "",
  });

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const [allowedActivityTypeIds, setAllowedActivityTypeIds] = useState(null); // null = not loaded yet

  // Load plod types when opened
  useEffect(() => {
    if (!open || !orgId) return;

    let alive = true;
    (async () => {
      const sb = supabaseBrowser();
      const { data, error } = await sb
        .from("plod_types")
        .select("id,name,description,sort_order")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (!alive) return;

      if (error) {
        console.error("load plod_types", error);
        setPlodTypes([]);
      } else {
        setPlodTypes(data || []);
      }
    })();

    return () => {
      alive = false;
    };
  }, [open, orgId]);

  // Load allowed activity type ids for selected plod type
  useEffect(() => {
    if (!open || !orgId || !plodTypeId) {
      setAllowedActivityTypeIds(null);
      return;
    }

    let alive = true;
    (async () => {
      const sb = supabaseBrowser();
      const { data, error } = await sb
        .from("plod_type_activity_types")
        .select("activity_type_id")
        .eq("plod_type_id", plodTypeId);

      if (!alive) return;

      if (error) {
        console.error("load plod_type_activity_types", error);
        setAllowedActivityTypeIds(new Set()); // fail closed
      } else {
        setAllowedActivityTypeIds(new Set((data || []).map((x) => x.activity_type_id)));
      }
    })();

    return () => {
      alive = false;
    };
  }, [open, orgId, plodTypeId]);

  const filteredActivityTypes = useMemo(() => {
    if (!plodTypeId) return activityTypes || [];
    if (!allowedActivityTypeIds) return [];
    return (activityTypes || []).filter((t) => allowedActivityTypeIds.has(t.id));
  }, [activityTypes, plodTypeId, allowedActivityTypeIds]);

  const selectedActivityType = useMemo(
    () => (filteredActivityTypes || []).find((t) => t.id === activityForm.activity_type_id) || null,
    [filteredActivityTypes, activityForm.activity_type_id]
  );

  const projectNameById = useMemo(() => {
    const map = {};
    (projects || []).forEach((p) => {
      if (p?.id) map[p.id] = p.name || "(unnamed project)";
    });
    return map;
  }, [projects]);

  const ownProjects = useMemo(() => (projects || []).filter((p) => (p.source || "own") === "own"), [projects]);
  const sharedProjects = useMemo(() => (projects || []).filter((p) => p.source === "shared"), [projects]);
  const visibleProjects = activityForm.project_source === "shared" ? sharedProjects : ownProjects;
  const visibleProjectIdSet = useMemo(() => new Set((visibleProjects || []).map((p) => p.id)), [visibleProjects]);

  const filteredHoles = useMemo(() => {
    if (!activityForm.project_id) return holes || [];
    return (holes || []).filter((h) => h.project_id === activityForm.project_id);
  }, [holes, activityForm.project_id]);

  const scopedHoles = useMemo(() => {
    if (activityForm.project_id) return filteredHoles;
    return (holes || []).filter((h) => visibleProjectIdSet.has(h.project_id));
  }, [holes, filteredHoles, activityForm.project_id, visibleProjectIdSet]);

  const isSelectedUnitMode = !!selectedActivityType && selectedActivityType.billable && (selectedActivityType.rate_mode || "time") === "unit";

  const canGoNextFromType = !!plodTypeId;
  const canGoNextFromHeader = !!shiftDate;

  const canJumpToStep = (target) => {
    if (target <= step) return true;
    if (target === 2) return canGoNextFromType;
    if (target === 3) return canGoNextFromType && canGoNextFromHeader;
    return false;
  };

  const jumpToStep = (target) => {
    setMsg(null);
    if (!canJumpToStep(target)) {
      if (target === 2 && !canGoNextFromType) setMsg({ type: "error", text: "Select a plod type first." });
      else if (target === 3 && (!canGoNextFromType || !canGoNextFromHeader))
        setMsg({ type: "error", text: "Complete Type and Header first." });
      return;
    }
    setStep(target);
  };

  const resetAll = () => {
    setStep(1);
    setPlodTypeId("");
    setShiftDate(new Date().toISOString().slice(0, 10));
    setVendorId("");
    setNotes("");
    setActivities([]);
    setEditingIdx(null);
    setActivityForm({ activity_type_id: "", project_source: "own", project_id: "", hole_id: "", start_time: "", end_time: "", machine_hours: "", unit_quantity: "", notes: "" });
    setMsg(null);
    setAllowedActivityTypeIds(null);
  };

  const close = () => {
    if (saving) return;
    resetAll();
    onClose?.();
  };

  const addOrUpdateActivity = () => {
    setMsg(null);

    const snappedStartTime = snapTimeToQuarter(activityForm.start_time);
    const snappedEndTime = snapTimeToQuarter(activityForm.end_time);

    if (!activityForm.activity_type_id || !snappedStartTime || !snappedEndTime) {
      setMsg({ type: "error", text: "Select an activity type and enter start/end times." });
      return;
    }

    if (isSelectedUnitMode) {
      const qty = Number(activityForm.unit_quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        const unitLabel = selectedActivityType?.rate_unit_name?.trim() || "unit";
        setMsg({ type: "error", text: `Enter a valid ${unitLabel} quantity greater than 0.` });
        return;
      }
    }

    const startISO = toISOFromDateAndTime(shiftDate, snappedStartTime);
    let endISO = toISOFromDateAndTime(shiftDate, snappedEndTime);

    const selectedHole = (holes || []).find((h) => h.id === activityForm.hole_id) || null;
    const derivedProjectId = activityForm.project_id || selectedHole?.project_id || null;

    if (selectedHole?.project_id && derivedProjectId && selectedHole.project_id !== derivedProjectId) {
      setMsg({ type: "error", text: "Selected hole does not belong to the selected project." });
      return;
    }

    const startMs = new Date(startISO).getTime();
    const endMsSameDay = new Date(endISO).getTime();
    if (endMsSameDay < startMs) {
      const next = new Date(shiftDate);
      next.setDate(next.getDate() + 1);
      const nextDay = next.toISOString().slice(0, 10);
      endISO = toISOFromDateAndTime(nextDay, snappedEndTime);
    }

    const row = {
      activity_type_id: activityForm.activity_type_id,
      project_id: derivedProjectId,
      hole_id: activityForm.hole_id || null,
      started_at: startISO,
      finished_at: endISO,
      machine_hours:
        activityForm.machine_hours === "" || activityForm.machine_hours === null
          ? null
          : Number(activityForm.machine_hours),
      unit_quantity:
        activityForm.unit_quantity === "" || activityForm.unit_quantity === null
          ? null
          : Number(activityForm.unit_quantity),
      notes: activityForm.notes || null,
    };

    const nextStartTime = snappedEndTime || "";

    if (editingIdx !== null) {
      setActivities((cur) => cur.map((x, i) => (i === editingIdx ? row : x)));
      setEditingIdx(null);
    } else {
      setActivities((cur) => [...cur, row]);
    }

    setActivityForm({
      activity_type_id: "",
      project_source: "own",
      project_id: "",
      hole_id: "",
      start_time: nextStartTime,
      end_time: "",
      machine_hours: "",
      unit_quantity: "",
      notes: "",
    });
  };

  const beginEdit = (idx) => {
    const a = activities[idx];
    const startTime = snapTimeToQuarter(new Date(a.started_at).toISOString().slice(11, 16));
    const endTime = snapTimeToQuarter(new Date(a.finished_at).toISOString().slice(11, 16));
    setActivityForm({
      activity_type_id: a.activity_type_id,
      project_source: ((projects || []).find((p) => p.id === a.project_id)?.source || "own"),
      project_id: a.project_id || ((holes || []).find((h) => h.id === a.hole_id)?.project_id || ""),
      hole_id: a.hole_id || "",
      start_time: startTime,
      end_time: endTime,
      machine_hours: a.machine_hours ?? "",
      unit_quantity: a.unit_quantity ?? "",
      notes: a.notes || "",
    });
    setEditingIdx(idx);
    setStep(3);
  };

  const removeActivity = (idx) => {
    setActivities((cur) => cur.filter((_, i) => i !== idx));
    if (editingIdx === idx) {
      setEditingIdx(null);
      setActivityForm({ activity_type_id: "", project_source: "own", project_id: "", hole_id: "", start_time: "", end_time: "", machine_hours: "", unit_quantity: "", notes: "" });
    }
  };

  const submit = async () => {
    setMsg(null);

    if (!orgId) return setMsg({ type: "error", text: "No organization selected." });
    if (!plodTypeId) return setMsg({ type: "error", text: "Select a plod type." });
    if (!shiftDate) return setMsg({ type: "error", text: "Select a date." });
    if (activities.length === 0) return setMsg({ type: "error", text: "Add at least one activity." });

    const startTimes = activities.map((a) => new Date(a.started_at).getTime());
    const endTimes = activities.map((a) => new Date(a.finished_at).getTime());
    const earliestStart = new Date(Math.min(...startTimes)).toISOString();
    const latestEnd = new Date(Math.max(...endTimes)).toISOString();

    setSaving(true);
    try {
      const sb = supabaseBrowser();

      const plodPayload = {
        organization_id: orgId,
        plod_type_id: plodTypeId,
        vendor_id: vendorId || null,
        shift_date: shiftDate, // <-- keep this (now matches DB)
        started_at: earliestStart,
        finished_at: latestEnd,
        notes: notes || null,
      };

      const { data: plod, error: plodError } = await sb.from("plods").insert(plodPayload).select("id").single();
      if (plodError) throw plodError;

      const activitiesPayload = activities.map((a) => ({
        plod_id: plod.id,
        activity_type_id: a.activity_type_id,
        project_id: a.project_id || null,
        hole_id: a.hole_id || null,
        started_at: a.started_at,
        finished_at: a.finished_at,
        machine_hours: a.machine_hours ?? null,
        unit_quantity: a.unit_quantity ?? null,
        notes: a.notes || null,
      }));

      const { error: actError } = await sb.from("plod_activities").insert(activitiesPayload);
      if (actError) throw actError;

      const { error: pricingError } = await sb.rpc("lock_plod_pricing_snapshot", {
        p_plod_id: plod.id,
        p_rounding_mode: "nearest",
        p_block_minutes: 15,
      });
      if (pricingError) throw pricingError;

      setMsg({ type: "success", text: "Plod created." });
      onCreated?.();
      close();
    } catch (e) {
      setMsg({ type: "error", text: e?.message || "Failed to create plod." });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div onClick={close} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div className="fixed right-0 top-0 h-[100dvh] max-h-[100dvh] w-full sm:w-[720px] bg-slate-950 border-l border-white/10 flex flex-col">
        <div className="shrink-0 px-4 py-3 border-b border-white/10">
          <div>
            <div className="text-sm text-slate-300">Create</div>
            <div className="text-lg font-semibold text-slate-100">New Plod</div>
          </div>
          <button type="button" onClick={close} className="btn" disabled={saving}>
            Close
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
          <div className="space-y-4">
            {msg && (
              <div
                className={classNames(
                  "rounded-lg border px-4 py-3 text-sm",
                  msg.type === "error"
                    ? "bg-red-500/10 text-red-200 border-red-500/20"
                    : "bg-emerald-500/10 text-emerald-200 border-emerald-500/20"
                )}
              >
                {msg.text}
              </div>
            )}

            <div className="flex items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => jumpToStep(1)}
                className={classNames(
                  "px-3 py-2 rounded-lg border transition-base !min-h-0",
                  step === 1 ? "bg-indigo-600 text-white border-indigo-500" : "bg-slate-900/60 text-slate-200 border-white/10 hover:bg-slate-900"
                )}
              >
                1. Type
              </button>

              <button
                type="button"
                onClick={() => jumpToStep(2)}
                disabled={!canJumpToStep(2)}
                className={classNames(
                  "px-3 py-2 rounded-lg border transition-base !min-h-0 disabled:opacity-50 disabled:cursor-not-allowed",
                  step === 2 ? "bg-indigo-600 text-white border-indigo-500" : "bg-slate-900/60 text-slate-200 border-white/10 hover:bg-slate-900"
                )}
              >
                2. Header
              </button>

              <button
                type="button"
                onClick={() => jumpToStep(3)}
                disabled={!canJumpToStep(3)}
                className={classNames(
                  "px-3 py-2 rounded-lg border transition-base !min-h-0 disabled:opacity-50 disabled:cursor-not-allowed",
                  step === 3 ? "bg-indigo-600 text-white border-indigo-500" : "bg-slate-900/60 text-slate-200 border-white/10 hover:bg-slate-900"
                )}
              >
                3. Activities
              </button>
            </div>

            {step === 1 && (
              <div className="grid grid-cols-1 gap-3">
                {plodTypes.length === 0 ? (
                  <div className="text-sm text-slate-300/70">No plod types found for this organisation.</div>
                ) : (
                  plodTypes.map((t) => {
                    const selected = plodTypeId === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setPlodTypeId(t.id)}
                        className={classNames(
                          "text-left rounded-xl border p-4 transition-base",
                          selected ? "border-indigo-400 bg-indigo-500/10" : "border-white/10 bg-slate-900/40 hover:bg-slate-900/70"
                        )}
                      >
                        <div className="font-semibold text-slate-100">{t.name}</div>
                        <div className="text-sm text-slate-300 mt-1">{t.description || ""}</div>
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-200">Shift date</label>
                  <input type="date" className="input mt-1" value={shiftDate} onChange={(e) => setShiftDate(e.target.value)} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200">Vendor (optional)</label>
                  <select className="select mt-1" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
                    <option value="">—</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200">Notes (optional)</label>
                  <textarea className="textarea mt-1" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="card p-4">
                  <div className="font-semibold text-slate-100">Add activity</div>

                  <div className="grid grid-cols-1 gap-3 mt-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-200">Activity type *</label>
                      <select
                        className="select mt-1"
                        value={activityForm.activity_type_id || ""}
                        onChange={(e) =>
                          setActivityForm((f) => ({
                            ...f,
                            activity_type_id: e.target.value,
                            project_source: "own",
                            project_id: "",
                            hole_id: "",
                            unit_quantity: "",
                          }))
                        }
                      >
                        <option value="">Select…</option>
                        {filteredActivityTypes.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.activity_type}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-200">Project source</label>
                      <div className="mt-1 inline-flex rounded-lg border border-white/10 bg-slate-900/40 p-1 gap-1">
                        <button
                          type="button"
                          className={`px-3 py-1.5 text-xs rounded-md transition-base ${activityForm.project_source === "own" ? "bg-indigo-600 text-white" : "text-slate-200 hover:bg-white/10"}`}
                          onClick={() =>
                            setActivityForm((s) => ({
                              ...s,
                              project_source: "own",
                              project_id: "",
                              hole_id: "",
                            }))
                          }
                        >
                          My projects
                        </button>
                        <button
                          type="button"
                          className={`px-3 py-1.5 text-xs rounded-md transition-base ${activityForm.project_source === "shared" ? "bg-indigo-600 text-white" : "text-slate-200 hover:bg-white/10"}`}
                          onClick={() =>
                            setActivityForm((s) => ({
                              ...s,
                              project_source: "shared",
                              project_id: "",
                              hole_id: "",
                            }))
                          }
                          disabled={sharedProjects.length === 0}
                        >
                          Client shared
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-200">Project (optional)</label>
                      <select
                        className="select mt-1"
                        value={activityForm.project_id}
                        onChange={(e) => {
                          const nextProjectId = e.target.value;
                          setActivityForm((s) => {
                            const selectedHole = (holes || []).find((h) => h.id === s.hole_id);
                            const keepHole = !nextProjectId || !selectedHole?.project_id || selectedHole.project_id === nextProjectId;
                            return {
                              ...s,
                              project_id: nextProjectId,
                              hole_id: keepHole ? s.hole_id : "",
                            };
                          });
                        }}
                      >
                        <option value="">—</option>
                        {visibleProjects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name || "(unnamed project)"}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-200">Hole (optional)</label>
                      <select
                        className="select mt-1"
                        value={activityForm.hole_id}
                        onChange={(e) => {
                          const nextHoleId = e.target.value;
                          const selectedHole = (holes || []).find((h) => h.id === nextHoleId) || null;
                          setActivityForm((s) => ({
                            ...s,
                            hole_id: nextHoleId,
                            project_id: selectedHole?.project_id || s.project_id,
                          }));
                        }}
                      >
                        <option value="">—</option>
                        {scopedHoles.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.hole_id}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <QuarterHourPicker
                        label="Start *"
                        value={activityForm.start_time}
                        onChange={(nextTime) => setActivityForm((s) => ({ ...s, start_time: nextTime }))}
                        disabled={saving}
                      />
                      <QuarterHourPicker
                        label="End *"
                        value={activityForm.end_time}
                        onChange={(nextTime) => setActivityForm((s) => ({ ...s, end_time: nextTime }))}
                        disabled={saving}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-200">Machine hours (optional)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        className="input mt-1"
                        value={activityForm.machine_hours}
                        onChange={(e) => setActivityForm((s) => ({ ...s, machine_hours: e.target.value }))}
                        placeholder="0.00"
                      />
                    </div>

                    {isSelectedUnitMode && (
                      <div>
                        <label className="block text-sm font-medium text-slate-200">
                          {`${selectedActivityType?.rate_unit_name?.trim() || "Unit"} quantity *`}
                        </label>
                        <input
                          type="number"
                          min="0.0001"
                          step="0.0001"
                          className="input mt-1"
                          value={activityForm.unit_quantity}
                          onChange={(e) => setActivityForm((s) => ({ ...s, unit_quantity: e.target.value }))}
                          placeholder="1"
                        />
                        <div className="mt-1 text-xs text-slate-400">
                          Rate applies per {selectedActivityType?.rate_unit_interval || 1} {selectedActivityType?.rate_unit_name?.trim() || "unit"}.
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-slate-200">Notes (optional)</label>
                      <input
                        className="input mt-1"
                        value={activityForm.notes}
                        onChange={(e) => setActivityForm((s) => ({ ...s, notes: e.target.value }))}
                        placeholder="Short note…"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={addOrUpdateActivity}
                        className="btn btn-primary"
                        disabled={saving}
                      >
                        {editingIdx !== null ? "Update activity" : "Add activity"}
                      </button>
                      {editingIdx !== null && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingIdx(null);
                            setActivityForm({ activity_type_id: "", project_source: "own", project_id: "", hole_id: "", start_time: "", end_time: "", machine_hours: "", unit_quantity: "", notes: "" });
                          }}
                          className="btn"
                          disabled={saving}
                        >
                          Cancel edit
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="card p-4">
                  <div className="font-semibold text-slate-100">Activities ({activities.length})</div>
                  <div className="mt-3 max-h-[45dvh] overflow-y-auto pr-1">
                    {activities.length === 0 ? (
                      <div className="text-sm text-slate-300">No activities added yet.</div>
                    ) : (
                      activities.map((a, idx) => {
                        const type = activityTypes.find((t) => t.id === a.activity_type_id)?.activity_type || "Activity";
                        return (
                          <div key={idx} className="flex items-start justify-between gap-3 rounded-lg border border-white/10 bg-slate-900/40 p-3">
                            <div>
                              <div className="font-medium text-slate-100">{type}</div>
                              <div className="text-sm text-slate-300">
                                {new Date(a.started_at).toLocaleString()} → {new Date(a.finished_at).toLocaleString()}
                              </div>
                              {a.project_id && (
                                <div className="text-sm text-slate-300 mt-1">Project: {projectNameById[a.project_id] || "(unnamed project)"}</div>
                              )}
                              {a.machine_hours !== null && a.machine_hours !== undefined && a.machine_hours !== "" && (
                                <div className="text-sm text-slate-300 mt-1">Machine hours: {a.machine_hours}</div>
                              )}
                              {a.unit_quantity !== null && a.unit_quantity !== undefined && a.unit_quantity !== "" && (
                                <div className="text-sm text-slate-300 mt-1">Unit quantity: {a.unit_quantity}</div>
                              )}
                              {a.notes && <div className="text-sm text-slate-300 mt-1">{a.notes}</div>}
                            </div>
                            <div className="flex gap-2">
                              <EditIconButton onClick={() => beginEdit(idx)} />
                              <button type="button" className="text-sm rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-slate-100 hover:bg-slate-900 transition-base !min-h-0" onClick={() => removeActivity(idx)}>
                                Remove
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 px-4 py-3 border-t border-white/10">
          <div className="pt-2 flex items-center justify-between">
            <button type="button" className="btn" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={saving || step === 1}>
              Back
            </button>

            <div className="flex items-center gap-2">
              {step < 3 ? (
                <button
                  type="button"
                  className="btn btn-primary disabled:opacity-50"
                  onClick={() => setStep((s) => s + 1)}
                  disabled={saving || (step === 1 && !canGoNextFromType) || (step === 2 && !canGoNextFromHeader)}
                >
                  Continue
                </button>
              ) : (
                <button type="button" className="btn btn-primary disabled:opacity-50" onClick={submit} disabled={saving}>
                  {saving ? "Saving…" : "Create plod"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}