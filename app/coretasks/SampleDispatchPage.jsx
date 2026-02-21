"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useOrg } from "@/lib/OrgContext";

function toNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function overlaps(aFrom, aTo, bFrom, bTo) {
  return aFrom < bTo && aTo > bFrom;
}

function isSegmentCovered(ranges, segFrom, segTo) {
  if (!ranges?.length) return false;
  const sorted = [...ranges].sort((a, b) => a.from_m - b.from_m);
  let cursor = segFrom;
  for (const range of sorted) {
    if (range.to_m <= cursor) continue;
    if (range.from_m > cursor) return false;
    cursor = Math.max(cursor, range.to_m);
    if (cursor >= segTo) return true;
  }
  return cursor >= segTo;
}

function mergeSegments(segments) {
  if (!segments.length) return [];
  const sorted = [...segments].sort((a, b) => a.from_m - b.from_m);
  const merged = [sorted[0]];
  for (let index = 1; index < sorted.length; index += 1) {
    const prev = merged[merged.length - 1];
    const current = sorted[index];
    if (Math.abs(prev.to_m - current.from_m) < 1e-9) {
      prev.to_m = current.to_m;
    } else {
      merged.push({ ...current });
    }
  }
  return merged;
}

function lineId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function SampleDispatchPage() {
  const supabase = supabaseBrowser();
  const { orgId } = useOrg();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);

  const [holes, setHoles] = useState([]);
  const [plannedIntervals, setPlannedIntervals] = useState([]);
  const [progressRows, setProgressRows] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [dispatchItems, setDispatchItems] = useState([]);

  const [editingDispatchId, setEditingDispatchId] = useState(null);
  const [dispatchDate, setDispatchDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [palletCount, setPalletCount] = useState("1");
  const [destinationLab, setDestinationLab] = useState("");
  const [consignmentNumber, setConsignmentNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([]);

  const [selectedHoleFilter, setSelectedHoleFilter] = useState("");
  const [expandedEligibleByHole, setExpandedEligibleByHole] = useState({});

  const resetForm = () => {
    setEditingDispatchId(null);
    setDispatchDate(new Date().toISOString().slice(0, 10));
    setPalletCount("1");
    setDestinationLab("");
    setConsignmentNumber("");
    setNotes("");
    setLines([]);
  };

  const reloadData = async () => {
    if (!orgId) {
      setHoles([]);
      setPlannedIntervals([]);
      setProgressRows([]);
      setDispatches([]);
      setDispatchItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const [
      holesRes,
      plannedRes,
      progressRes,
      dispatchesRes,
      dispatchItemsRes,
    ] = await Promise.all([
      supabase
        .from("holes")
        .select("id,hole_id,depth,project_id,projects(name)")
        .eq("organization_id", orgId)
        .order("hole_id", { ascending: true }),
      supabase
        .from("hole_task_intervals")
        .select("id,hole_id,task_type,from_m,to_m"),
      supabase
        .from("hole_task_progress")
        .select("id,hole_id,task_type,from_m,to_m"),
      supabase
        .from("dispatches")
        .select("id,dispatch_date,pallet_count,prepared_by_user_id,destination_lab,consignment_number,notes,created_at")
        .eq("organization_id", orgId)
        .order("dispatch_date", { ascending: false }),
      supabase
        .from("dispatch_items")
        .select("id,dispatch_id,hole_id,from_m,to_m,holes(hole_id)")
        .eq("organization_id", orgId),
    ]);

    if (holesRes.error || plannedRes.error || progressRes.error || dispatchesRes.error || dispatchItemsRes.error) {
      toast.error(
        holesRes.error?.message ||
          plannedRes.error?.message ||
          progressRes.error?.message ||
          dispatchesRes.error?.message ||
          dispatchItemsRes.error?.message ||
          "Failed to load dispatch data"
      );
      setLoading(false);
      return;
    }

    setHoles(holesRes.data || []);
    setPlannedIntervals(plannedRes.data || []);
    setProgressRows(progressRes.data || []);
    setDispatches(dispatchesRes.data || []);
    setDispatchItems(dispatchItemsRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    })();
  }, [supabase]);

  useEffect(() => {
    void reloadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const holeMap = useMemo(() => {
    const map = new Map();
    for (const hole of holes) map.set(hole.id, hole);
    return map;
  }, [holes]);

  const progressByHoleTask = useMemo(() => {
    const map = new Map();
    for (const row of progressRows) {
      if (!map.has(row.hole_id)) map.set(row.hole_id, new Map());
      const byTask = map.get(row.hole_id);
      if (!byTask.has(row.task_type)) byTask.set(row.task_type, []);
      byTask.get(row.task_type).push({
        from_m: Number(row.from_m),
        to_m: Number(row.to_m),
      });
    }
    return map;
  }, [progressRows]);

  const plannedByHole = useMemo(() => {
    const map = new Map();
    for (const row of plannedIntervals) {
      if (!map.has(row.hole_id)) map.set(row.hole_id, []);
      map.get(row.hole_id).push({
        task_type: row.task_type,
        from_m: Number(row.from_m),
        to_m: Number(row.to_m),
      });
    }
    return map;
  }, [plannedIntervals]);

  const lockedDispatchRangesByHole = useMemo(() => {
    const map = new Map();
    const items = dispatchItems.filter((item) => item.dispatch_id !== editingDispatchId);
    for (const item of items) {
      if (!map.has(item.hole_id)) map.set(item.hole_id, []);
      map.get(item.hole_id).push({
        from_m: Number(item.from_m),
        to_m: Number(item.to_m),
      });
    }
    return map;
  }, [dispatchItems, editingDispatchId]);

  const eligibleSegments = useMemo(() => {
    const result = [];

    for (const hole of holes) {
      const planned = plannedByHole.get(hole.id) || [];
      if (!planned.length) continue;

      const progressTaskMap = progressByHoleTask.get(hole.id) || new Map();
      const dispatchedRanges = lockedDispatchRangesByHole.get(hole.id) || [];

      const boundaries = Array.from(
        new Set(
          planned.flatMap((row) => [Number(row.from_m), Number(row.to_m)])
        )
      ).sort((a, b) => a - b);

      const holeSegments = [];

      for (let index = 0; index < boundaries.length - 1; index += 1) {
        const segFrom = boundaries[index];
        const segTo = boundaries[index + 1];
        if (!(segTo > segFrom)) continue;

        const overlappingPlanned = planned.filter((row) => overlaps(row.from_m, row.to_m, segFrom, segTo));
        if (!overlappingPlanned.length) continue;

        const overlapsDispatched = dispatchedRanges.some((range) => overlaps(range.from_m, range.to_m, segFrom, segTo));
        if (overlapsDispatched) continue;

        const allTasksCovered = overlappingPlanned.every((row) => {
          const progressRanges = progressTaskMap.get(row.task_type) || [];
          return isSegmentCovered(progressRanges, segFrom, segTo);
        });

        if (allTasksCovered) {
          holeSegments.push({
            hole_id: hole.id,
            hole_label: hole.hole_id,
            from_m: segFrom,
            to_m: segTo,
          });
        }
      }

      const merged = mergeSegments(holeSegments);
      result.push(
        ...merged.map((segment) => ({
          ...segment,
          project_name: hole.projects?.name || "",
        }))
      );
    }

    return result.sort((a, b) => {
      if (a.hole_label !== b.hole_label) return a.hole_label.localeCompare(b.hole_label);
      return a.from_m - b.from_m;
    });
  }, [holes, plannedByHole, progressByHoleTask, lockedDispatchRangesByHole]);

  const filteredEligibleSegments = useMemo(() => {
    if (!selectedHoleFilter) return eligibleSegments;
    return eligibleSegments.filter((segment) => segment.hole_id === selectedHoleFilter);
  }, [eligibleSegments, selectedHoleFilter]);

  const eligibleRangesByHole = useMemo(() => {
    const map = new Map();
    for (const segment of eligibleSegments) {
      if (!map.has(segment.hole_id)) map.set(segment.hole_id, []);
      map.get(segment.hole_id).push({
        from_m: Number(segment.from_m),
        to_m: Number(segment.to_m),
      });
    }
    for (const [holeId, ranges] of map.entries()) {
      map.set(holeId, mergeSegments(ranges));
    }
    return map;
  }, [eligibleSegments]);

  const groupedEligibleSegments = useMemo(() => {
    const map = new Map();
    for (const segment of filteredEligibleSegments) {
      if (!map.has(segment.hole_id)) {
        map.set(segment.hole_id, {
          hole_id: segment.hole_id,
          hole_label: segment.hole_label,
          project_name: segment.project_name || "",
          segments: [],
        });
      }
      map.get(segment.hole_id).segments.push(segment);
    }
    return Array.from(map.values()).sort((a, b) => a.hole_label.localeCompare(b.hole_label));
  }, [filteredEligibleSegments]);

  useEffect(() => {
    setExpandedEligibleByHole((prev) => {
      const next = { ...prev };
      for (const group of groupedEligibleSegments) {
        if (typeof next[group.hole_id] === "undefined") next[group.hole_id] = true;
      }
      return next;
    });
  }, [groupedEligibleSegments]);

  const lineErrorsById = useMemo(() => {
    const errors = {};
    for (const line of lines) {
      const fromM = toNum(line.from_m);
      const toM = toNum(line.to_m);

      if (!line.hole_id) {
        errors[line.local_id] = "Select a valid hole interval.";
        continue;
      }
      if (fromM == null || toM == null) {
        errors[line.local_id] = "From and To must be numeric.";
        continue;
      }
      if (toM <= fromM) {
        errors[line.local_id] = "To must be greater than From.";
        continue;
      }

      const eligibleRanges = eligibleRangesByHole.get(line.hole_id) || [];
      const covered = isSegmentCovered(eligibleRanges, fromM, toM);
      if (!covered) {
        errors[line.local_id] = "Range is not fully dispatch-eligible (incomplete tasks or already dispatched).";
      }
    }
    return errors;
  }, [lines, eligibleRangesByHole]);

  const hasLineErrors = useMemo(() => Object.keys(lineErrorsById).length > 0, [lineErrorsById]);

  const addSegmentToDispatch = (segment) => {
    setLines((prev) => [
      ...prev,
      {
        local_id: lineId(),
        hole_id: segment.hole_id,
        hole_label: segment.hole_label,
        from_m: String(segment.from_m),
        to_m: String(segment.to_m),
      },
    ]);
  };

  const updateLine = (localId, field, value) => {
    setLines((prev) => prev.map((line) => (line.local_id === localId ? { ...line, [field]: value } : line)));
  };

  const removeLine = (localId) => {
    setLines((prev) => prev.filter((line) => line.local_id !== localId));
  };

  const loadDispatchForEdit = (dispatchId) => {
    const header = dispatches.find((dispatch) => dispatch.id === dispatchId);
    if (!header) return;

    const items = dispatchItems
      .filter((item) => item.dispatch_id === dispatchId)
      .sort((a, b) => Number(a.from_m) - Number(b.from_m));

    setEditingDispatchId(dispatchId);
    setDispatchDate(header.dispatch_date || new Date().toISOString().slice(0, 10));
    setPalletCount(String(header.pallet_count || 1));
    setDestinationLab(header.destination_lab || "");
    setConsignmentNumber(header.consignment_number || "");
    setNotes(header.notes || "");
    setLines(
      items.map((item) => ({
        local_id: lineId(),
        hole_id: item.hole_id,
        hole_label: item.holes?.hole_id || holeMap.get(item.hole_id)?.hole_id || "Unknown",
        from_m: String(item.from_m),
        to_m: String(item.to_m),
      }))
    );
  };

  const saveDispatch = async () => {
    if (!user?.id) {
      toast.error("Sign in required");
      return;
    }
    if (!orgId) {
      toast.error("Organization not found");
      return;
    }

    const palletNum = Number(palletCount);
    if (!Number.isInteger(palletNum) || palletNum <= 0) {
      toast.error("Pallet count must be a positive whole number");
      return;
    }
    if (!destinationLab.trim()) {
      toast.error("Destination / lab is required");
      return;
    }
    if (!dispatchDate) {
      toast.error("Dispatch date is required");
      return;
    }

    if (hasLineErrors) {
      toast.error("Fix dispatch interval validation errors before saving");
      return;
    }

    const normalizedLines = lines
      .map((line) => ({
        hole_id: line.hole_id,
        from_m: toNum(line.from_m),
        to_m: toNum(line.to_m),
      }))
      .filter((line) => line.hole_id && line.from_m != null && line.to_m != null && line.to_m > line.from_m);

    if (!normalizedLines.length) {
      toast.error("Add at least one valid interval");
      return;
    }

    setSaving(true);

    try {
      let dispatchId = editingDispatchId;

      if (editingDispatchId) {
        const { error } = await supabase
          .from("dispatches")
          .update({
            dispatch_date: dispatchDate,
            pallet_count: palletNum,
            prepared_by_user_id: user.id,
            destination_lab: destinationLab.trim(),
            consignment_number: consignmentNumber.trim() || null,
            notes: notes.trim() || null,
          })
          .eq("id", editingDispatchId)
          .eq("organization_id", orgId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("dispatches")
          .insert({
            organization_id: orgId,
            dispatch_date: dispatchDate,
            pallet_count: palletNum,
            prepared_by_user_id: user.id,
            destination_lab: destinationLab.trim(),
            consignment_number: consignmentNumber.trim() || null,
            notes: notes.trim() || null,
            created_by: user.id,
          })
          .select("id")
          .single();

        if (error) throw error;
        dispatchId = data.id;
      }

      const { error: deleteError } = await supabase
        .from("dispatch_items")
        .delete()
        .eq("dispatch_id", dispatchId);
      if (deleteError) throw deleteError;

      const { error: insertError } = await supabase.from("dispatch_items").insert(
        normalizedLines.map((line) => ({
          dispatch_id: dispatchId,
          organization_id: orgId,
          hole_id: line.hole_id,
          from_m: line.from_m,
          to_m: line.to_m,
        }))
      );
      if (insertError) throw insertError;

      toast.success(editingDispatchId ? "Dispatch updated" : "Dispatch created");
      await reloadData();
      if (dispatchId) loadDispatchForEdit(dispatchId);
    } catch (error) {
      toast.error(error?.message || "Failed to save dispatch");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-5">
      <div className="card p-4 md:p-5">
        <h1 className="text-2xl font-semibold text-slate-100">Sample Dispatch</h1>
        <p className="text-sm text-slate-300 mt-1">Build dispatches from eligible core intervals across multiple holes.</p>
      </div>

      <div className="card p-4 md:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full lg:max-w-3xl">
            <label className="block text-sm">
              Dispatch Date
              <input
                type="date"
                value={dispatchDate}
                onChange={(event) => setDispatchDate(event.target.value)}
                className="input"
              />
            </label>
            <label className="block text-sm">
              Number of Pallets
              <input
                type="number"
                min="1"
                step="1"
                value={palletCount}
                onChange={(event) => setPalletCount(event.target.value)}
                className="input"
              />
            </label>
            <label className="block text-sm">
              Destination / Lab
              <input
                type="text"
                value={destinationLab}
                onChange={(event) => setDestinationLab(event.target.value)}
                className="input"
                placeholder="e.g. ALS Brisbane"
              />
            </label>
            <label className="block text-sm">
              Consignment Number
              <input
                type="text"
                value={consignmentNumber}
                onChange={(event) => setConsignmentNumber(event.target.value)}
                className="input"
                placeholder="Optional"
              />
            </label>
            <label className="block text-sm md:col-span-2">
              Notes
              <textarea
                rows={2}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="textarea"
                placeholder="Optional notes"
              />
            </label>
          </div>

          <div className="flex flex-col gap-2 lg:min-w-[220px]">
            <div className="text-xs text-slate-300">
              Prepared by
              <div className="text-sm text-slate-100 mt-1">{user?.email || "Not signed in"}</div>
            </div>
            <button type="button" className="btn btn-3d-primary" onClick={saveDispatch} disabled={saving || !user || hasLineErrors}>
              {saving ? "Saving…" : editingDispatchId ? "Update Dispatch" : "Create Dispatch"}
            </button>
            <button type="button" className="btn btn-3d-glass" onClick={resetForm} disabled={saving}>
              New Dispatch
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="card p-4 space-y-3 xl:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-medium">Eligible Core Intervals</h2>
            <select
              className="select-gradient-sm w-auto"
              value={selectedHoleFilter}
              onChange={(event) => setSelectedHoleFilter(event.target.value)}
            >
              <option value="">All holes</option>
              {holes.map((hole) => (
                <option key={hole.id} value={hole.id}>
                  {hole.hole_id}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <p>Loading…</p>
          ) : groupedEligibleSegments.length === 0 ? (
            <p className="text-sm text-slate-300">No dispatch-eligible intervals available.</p>
          ) : (
            <div className="space-y-3">
              {groupedEligibleSegments.map((group) => {
                const expanded = !!expandedEligibleByHole[group.hole_id];
                return (
                  <div key={group.hole_id} className="glass rounded-xl p-3 space-y-2">
                    <button
                      type="button"
                      className="w-full flex items-center justify-between text-left"
                      onClick={() => setExpandedEligibleByHole((prev) => ({ ...prev, [group.hole_id]: !expanded }))}
                    >
                      <span className="text-sm font-medium">
                        {group.hole_label}
                        <span className="text-slate-300 ml-2">{group.project_name || "—"}</span>
                      </span>
                      <span className="text-xs text-slate-300">{group.segments.length} eligible {expanded ? "−" : "+"}</span>
                    </button>

                    {expanded && (
                      <div className="table-container">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Interval (m)</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.segments.map((segment, index) => (
                              <tr key={`${segment.hole_id}-${segment.from_m}-${segment.to_m}-${index}`}>
                                <td>
                                  {segment.from_m} – {segment.to_m}
                                </td>
                                <td>
                                  <button type="button" className="btn btn-3d-primary btn-xs" onClick={() => addSegmentToDispatch(segment)}>
                                    Add
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card p-4 space-y-3">
          <h2 className="text-lg font-medium">Dispatch Intervals</h2>
          {lines.length === 0 ? (
            <p className="text-sm text-slate-300">No intervals selected.</p>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
              {lines.map((line) => (
                <div key={line.local_id} className="glass rounded-xl p-3 space-y-2">
                  <div className="text-sm text-slate-100 font-medium">{line.hole_label}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs">
                      From
                      <input
                        className="input input-sm"
                        value={line.from_m}
                        onChange={(event) => updateLine(line.local_id, "from_m", event.target.value)}
                      />
                    </label>
                    <label className="text-xs">
                      To
                      <input
                        className="input input-sm"
                        value={line.to_m}
                        onChange={(event) => updateLine(line.local_id, "to_m", event.target.value)}
                      />
                    </label>
                  </div>
                  {lineErrorsById[line.local_id] && (
                    <div className="text-[11px] text-amber-300">{lineErrorsById[line.local_id]}</div>
                  )}
                  <button type="button" className="btn btn-danger btn-xs" onClick={() => removeLine(line.local_id)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card p-4 md:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Recent Dispatches</h2>
        </div>
        {dispatches.length === 0 ? (
          <p className="text-sm text-slate-300">No dispatches yet.</p>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Pallets</th>
                  <th>Destination / Lab</th>
                  <th>Consignment</th>
                  <th>Prepared By</th>
                  <th>Intervals</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {dispatches.map((dispatch) => {
                  const count = dispatchItems.filter((item) => item.dispatch_id === dispatch.id).length;
                  const isEditing = editingDispatchId === dispatch.id;
                  return (
                    <tr key={dispatch.id} className={isEditing ? "row-selected" : ""}>
                      <td>{dispatch.dispatch_date}</td>
                      <td>{dispatch.pallet_count}</td>
                      <td>{dispatch.destination_lab}</td>
                      <td>{dispatch.consignment_number || "—"}</td>
                      <td className="text-xs">{dispatch.prepared_by_user_id?.slice?.(0, 8) || "—"}</td>
                      <td>{count}</td>
                      <td>
                        <button type="button" className="btn btn-3d-glass btn-xs" onClick={() => loadDispatchForEdit(dispatch.id)}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
