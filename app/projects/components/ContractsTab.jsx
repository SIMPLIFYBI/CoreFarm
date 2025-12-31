"use client";

import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { supabaseBrowser } from "@/lib/supabaseClient";
import ContractDetailsModal from "./ContractDetailsModal"; // <-- ADD

export default function ContractsTab({ orgId, orgLoading }) {
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [loading, setLoading] = useState(false);
  const [contracts, setContracts] = useState([]);

  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [vendorOptions, setVendorOptions] = useState([]);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    name: "",
    vendor_organization_id: "",
    contract_number: "",
    status: "active",
  });

  const [selectedContract, setSelectedContract] = useState(null); // <-- ADD

  const resetForm = () => {
    setEditingId(null);
    setForm({ name: "", vendor_organization_id: "", contract_number: "", status: "active" });
  };

  const loadContracts = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("contracts")
        .select(
          `
          id,
          client_organization_id,
          vendor_organization_id,
          name,
          status,
          contract_number,
          created_at,
          client:client_organization_id ( id, name ),
          vendor:vendor_organization_id ( id, name )
        `
        )
        .or(`client_organization_id.eq.${orgId},vendor_organization_id.eq.${orgId}`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setContracts(data || []);
    } catch (e) {
      console.error("load contracts", e);
      toast.error(e?.message || "Failed to load contracts");
      setContracts([]);
    } finally {
      setLoading(false);
    }
  };

  const loadVendorOptions = async () => {
    if (!orgId) return;
    setConnectionsLoading(true);
    try {
      const { data, error } = await supabase
        .from("organization_relationships")
        .select(`id,status,vendor:vendor_organization_id ( id, name )`)
        .eq("client_organization_id", orgId)
        .in("status", ["active", "pending"])
        .order("invited_at", { ascending: false });

      if (error) throw error;

      const opts =
        (data || [])
          .map((r) => r.vendor)
          .filter(Boolean)
          .filter((v, idx, arr) => arr.findIndex((x) => x.id === v.id) === idx)
          .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

      setVendorOptions(opts);
    } catch (e) {
      console.error("load vendor options", e);
      toast.error(e?.message || "Failed to load connected organisations");
      setVendorOptions([]);
    } finally {
      setConnectionsLoading(false);
    }
  };

  useEffect(() => {
    loadContracts();
    loadVendorOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (c) => {
    setEditingId(c.id);
    setForm({
      name: c.name || "",
      vendor_organization_id: c.vendor_organization_id || "",
      contract_number: c.contract_number || "",
      status: c.status || "active",
    });
    setShowForm(true);
  };

  const upsertContract = async () => {
    if (!orgId) return toast.error("Organisation not ready");
    if (!form.name.trim()) return toast.error("Contract name is required");
    if (!editingId && !form.vendor_organization_id) return toast.error("Select a vendor organisation");

    setSaving(true);
    try {
      if (editingId) {
        const payload = {
          name: form.name.trim(),
          contract_number: form.contract_number.trim() || null,
          status: form.status || "active",
        };

        const { error } = await supabase.from("contracts").update(payload).eq("id", editingId);
        if (error) throw error;

        toast.success("Contract updated");
      } else {
        const payload = {
          client_organization_id: orgId,
          vendor_organization_id: form.vendor_organization_id,
          name: form.name.trim(),
          contract_number: form.contract_number.trim() || null,
          status: form.status || "active",
        };

        const { error } = await supabase.from("contracts").insert(payload);
        if (error) throw error;

        toast.success("Contract created");
      }

      setShowForm(false);
      resetForm();
      await loadContracts();
    } catch (e) {
      console.error("save contract", e);
      toast.error(e?.message || "Could not save contract");
    } finally {
      setSaving(false);
    }
  };

  const updateContract = async (id, payload) => {
    try {
      const { error } = await supabase.from("contracts").update(payload).eq("id", id);
      if (error) throw error;
      toast.success("Contract updated");
      await loadContracts();
      // keep modal data in sync
      setSelectedContract((prev) => (prev?.id === id ? { ...prev, ...payload } : prev));
    } catch (e) {
      console.error("update contract", e);
      toast.error(e?.message || "Could not update contract");
      throw e;
    }
  };

  const deleteContractById = async (id, name) => {
    if (!id) return;
    const ok = window.confirm(`Delete contract "${name || "Unnamed"}"? This cannot be undone.`);
    if (!ok) return;

    try {
      const { error } = await supabase.from("contracts").delete().eq("id", id);
      if (error) throw error;
      toast.success("Contract deleted");
      setSelectedContract(null);
      await loadContracts();
    } catch (e) {
      console.error("delete contract", e);
      toast.error(e?.message || "Could not delete contract");
      throw e;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-slate-300/70">
          Contracts link your org (client) to a vendor org for plods/resources/invoicing.
        </div>

        <div className="flex gap-2">
          <button type="button" className="btn" onClick={loadContracts} disabled={!orgId || loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>

          <button type="button" className="btn btn-primary" onClick={openCreate} disabled={orgLoading || !orgId}>
            New Contract
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-slate-100">{editingId ? "Edit contract" : "Create contract"}</div>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              disabled={saving}
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block text-sm">
              Contract name
              <input
                className="input w-full"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>

            <label className="block text-sm">
              Vendor organisation
              <select
                className="input w-full"
                value={form.vendor_organization_id}
                onChange={(e) => setForm((f) => ({ ...f, vendor_organization_id: e.target.value }))}
                disabled={connectionsLoading || !!editingId}
                title={editingId ? "Vendor org is locked after creation" : undefined}
              >
                <option value="">
                  {connectionsLoading ? "Loading…" : vendorOptions.length ? "Select…" : "No connections"}
                </option>
                {vendorOptions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              Contract #
              <input
                className="input w-full"
                value={form.contract_number}
                onChange={(e) => setForm((f) => ({ ...f, contract_number: e.target.value }))}
              />
            </label>

            <label className="block text-sm">
              Status
              <select
                className="input w-full"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="draft">draft</option>
                <option value="active">active</option>
                <option value="paused">paused</option>
                <option value="closed">closed</option>
                <option value="cancelled">cancelled</option>
              </select>
            </label>
          </div>

          <div className="flex justify-between items-center gap-2 mt-4">
            <div>
              {editingId && (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => {
                    const current = contracts.find((c) => c.id === editingId);
                    deleteContractById(editingId, current?.name);
                  }}
                  disabled={saving}
                >
                  Delete contract…
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={upsertContract}
                disabled={saving || !form.name.trim() || (!editingId && !form.vendor_organization_id)}
              >
                {saving ? "Saving…" : editingId ? "Save changes" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card p-4">
        {loading ? (
          <div className="text-sm text-slate-300/70">Loading…</div>
        ) : contracts.length === 0 ? (
          <div className="text-sm text-slate-300/70">No contracts yet.</div>
        ) : (
          <div className="overflow-x-auto -mx-2 md:mx-0">
            <table className="w-full text-xs md:text-sm min-w-[980px]">
              <thead>
                <tr className="text-left bg-slate-900/40 text-slate-200 border-b border-white/10">
                  <th className="p-2 font-medium">My role</th>
                  <th className="p-2 font-medium">Other party</th>
                  <th className="p-2 font-medium">Name</th>
                  <th className="p-2 font-medium">Status</th>
                  <th className="p-2 font-medium">Contract #</th>
                  <th className="p-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => {
                  const myRole = orgId === c.client_organization_id ? "Client (owner)" : "Vendor";
                  const otherPartyName =
                    orgId === c.client_organization_id ? (c.vendor?.name || "—") : (c.client?.name || "—");

                  return (
                    <tr
                      key={c.id}
                      className="border-b border-white/10 last:border-b-0 hover:bg-white/5 cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedContract(c)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") setSelectedContract(c);
                      }}
                      title="Open contract"
                    >
                      <td className="p-2">{myRole}</td>
                      <td className="p-2 font-medium">{otherPartyName}</td>
                      <td className="p-2">{c.name || "—"}</td>
                      <td className="p-2">{c.status || "—"}</td>
                      <td className="p-2">{c.contract_number || "—"}</td>
                      <td className="p-2">{c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedContract && (
        <ContractDetailsModal
          contract={selectedContract}
          orgId={orgId}
          onClose={() => setSelectedContract(null)}
          onSave={updateContract}
          onDelete={deleteContractById}
        />
      )}
    </div>
  );
}