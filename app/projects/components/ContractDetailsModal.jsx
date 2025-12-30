"use client";

import React, { useState } from "react";
import toast from "react-hot-toast";

export default function ContractDetailsModal({
  contract,
  orgId,
  onClose,
  onSave,   // async (id, payload)
  onDelete, // async (id, name)
}) {
  const isOwner = orgId && contract?.client_organization_id === orgId;

  const [mode, setMode] = useState("view"); // 'view' | 'edit'
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: contract?.name || "",
    status: contract?.status || "active",
    contract_number: contract?.contract_number || "",
  });

  const save = async () => {
    if (!isOwner) return;
    if (!form.name.trim()) return toast.error("Contract name is required");

    setSaving(true);
    try {
      await onSave?.(contract.id, {
        name: form.name.trim(),
        status: form.status || "active",
        contract_number: form.contract_number.trim() || null,
      });
      setMode("view");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-2xl p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <div className="text-lg font-semibold text-slate-100">Contract</div>
            <div className="text-xs text-slate-400">{contract?.id}</div>
          </div>
          <button className="btn" onClick={onClose} type="button" disabled={saving}>
            Close
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="text-sm">
            <div className="text-xs text-slate-400">Client (owner)</div>
            <div className="text-slate-100 font-medium">{contract?.client?.name || "—"}</div>
          </div>

          <div className="text-sm">
            <div className="text-xs text-slate-400">Vendor</div>
            <div className="text-slate-100 font-medium">{contract?.vendor?.name || "—"}</div>
          </div>

          <div className="md:col-span-2 border-t border-white/10 pt-3" />

          <label className="block text-sm md:col-span-2">
            Name
            <input
              className="input w-full"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              disabled={mode !== "edit" || !isOwner}
            />
          </label>

          <label className="block text-sm">
            Status
            <select
              className="input w-full"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              disabled={mode !== "edit" || !isOwner}
            >
              <option value="draft">draft</option>
              <option value="active">active</option>
              <option value="paused">paused</option>
              <option value="closed">closed</option>
              <option value="cancelled">cancelled</option>
            </select>
          </label>

          <label className="block text-sm">
            Contract #
            <input
              className="input w-full"
              value={form.contract_number}
              onChange={(e) => setForm((f) => ({ ...f, contract_number: e.target.value }))}
              disabled={mode !== "edit" || !isOwner}
            />
          </label>

          <div className="md:col-span-2 text-xs text-slate-400">
            Created: {contract?.created_at ? new Date(contract.created_at).toLocaleString() : "—"}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 mt-5">
          <div>
            {isOwner && mode === "edit" && (
              <button
                type="button"
                className="btn btn-danger"
                disabled={saving}
                onClick={() => onDelete?.(contract.id, contract.name)}
              >
                Delete contract…
              </button>
            )}
          </div>

          <div className="flex gap-2">
            {isOwner ? (
              mode === "view" ? (
                <button type="button" className="btn btn-primary" onClick={() => setMode("edit")}>
                  Edit
                </button>
              ) : (
                <>
                  <button type="button" className="btn" onClick={() => setMode("view")} disabled={saving}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
                    {saving ? "Saving…" : "Save"}
                  </button>
                </>
              )
            ) : (
              <div className="text-xs text-slate-400">Read-only (vendor)</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}