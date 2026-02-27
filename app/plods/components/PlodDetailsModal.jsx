"use client";

import React, { useEffect } from "react";

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function formatDuration(startedAt, finishedAt) {
  if (!startedAt || !finishedAt) return "—";
  const s = new Date(startedAt).getTime();
  const f = new Date(finishedAt).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(f) || f <= s) return "—";
  const totalMinutes = Math.round((f - s) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function getStatusStyle(status) {
  const value = (status || "submitted").toLowerCase();
  if (value === "approved") return "bg-emerald-500/15 text-emerald-200 border-emerald-500/25";
  if (value === "rejected") return "bg-rose-500/15 text-rose-200 border-rose-500/25";
  return "bg-amber-500/15 text-amber-200 border-amber-500/25";
}

function getUserLabel(profile, fallbackId) {
  if (profile?.full_name) return profile.full_name;
  if (profile?.email) return profile.email;
  if (fallbackId) return String(fallbackId).slice(0, 8);
  return "—";
}

export function PlodDetailsModal({ plod, onClose, onDecision, decisionSaving = false }) {
  const [comment, setComment] = React.useState("");

  useEffect(() => {
    if (!plod) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [plod, onClose]);

  useEffect(() => {
    setComment(plod?.decision_comment || "");
  }, [plod]);

  if (!plod) return null;

  const activities = Array.isArray(plod.plod_activities) ? plod.plod_activities : [];
  const status = (plod.approval_status || "submitted").toLowerCase();
  const canDecide = status === "submitted";

  const submitDecision = async (action) => {
    await onDecision?.(plod.id, action, comment);
  };

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-label="Close plod details"
        onClick={onClose}
      />

      <div className="absolute inset-x-0 top-8 mx-auto w-[min(980px,94vw)] rounded-2xl border border-white/15 bg-slate-950/95 shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Plod Details</h2>
            <p className="mt-1 text-xs text-slate-300">Review this plod and all recorded activities.</p>
          </div>
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="max-h-[78vh] overflow-y-auto p-5 space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-100">Approval</h3>
              <span
                className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${getStatusStyle(
                  status
                )}`}
              >
                {status}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Submitted By</p>
                <p className="mt-1 text-sm text-slate-100">
                  {getUserLabel(plod.submitted_by_profile, plod.submitted_by)}
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Submitted At</p>
                <p className="mt-1 text-sm text-slate-100">{formatDate(plod.submitted_at)}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Decision By</p>
                <p className="mt-1 text-sm text-slate-100">{getUserLabel(plod.decision_by_profile, plod.decision_by)}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Decision At</p>
                <p className="mt-1 text-sm text-slate-100">{formatDate(plod.decision_at)}</p>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              <label className="text-[11px] uppercase tracking-wide text-slate-400">Approval Comment</label>
              <textarea
                className="input min-h-[84px]"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment for approval/rejection"
                disabled={!canDecide || decisionSaving}
              />
            </div>

            {canDecide && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => submitDecision("approve")}
                  disabled={decisionSaving}
                >
                  {decisionSaving ? "Saving..." : "Approve"}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => submitDecision("reject")}
                  disabled={decisionSaving}
                >
                  {decisionSaving ? "Saving..." : "Reject"}
                </button>
              </div>
            )}

            {!canDecide && (
              <p className="mt-3 text-xs text-slate-300">This plod has already been finalized.</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Type</p>
              <p className="mt-1 text-sm text-slate-100">{plod.plod_types?.name ?? plod.plod_type ?? "—"}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Vendor</p>
              <p className="mt-1 text-sm text-slate-100">{plod.vendors?.name ?? "—"}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Shift Date</p>
              <p className="mt-1 text-sm text-slate-100">{plod.shift_date ?? "—"}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Started</p>
              <p className="mt-1 text-sm text-slate-100">{formatDate(plod.started_at)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Finished</p>
              <p className="mt-1 text-sm text-slate-100">{formatDate(plod.finished_at)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Activities</p>
              <p className="mt-1 text-sm text-slate-100">{activities.length}</p>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Notes</p>
            <p className="mt-1 text-sm text-slate-200 whitespace-pre-wrap">{plod.notes || "—"}</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-100">Activities</h3>
            </div>

            {activities.length === 0 ? (
              <p className="text-sm text-slate-300">No activities on this plod.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Activity</th>
                      <th>Hole</th>
                      <th>Start</th>
                      <th>Finish</th>
                      <th>Duration</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activities.map((activity) => (
                      <tr key={activity.id}>
                        <td>{activity.activity_types?.activity_type ?? activity.activity_type_id ?? "—"}</td>
                        <td>{activity.holes?.hole_id ?? activity.hole_id ?? "—"}</td>
                        <td>{formatDate(activity.started_at)}</td>
                        <td>{formatDate(activity.finished_at)}</td>
                        <td>{formatDuration(activity.started_at, activity.finished_at)}</td>
                        <td>{activity.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
