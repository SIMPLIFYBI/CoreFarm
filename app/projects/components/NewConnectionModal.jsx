"use client";

import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { supabaseBrowser } from "@/lib/supabaseClient";

export default function NewConnectionModal({ orgId, onClose, onCreated }) {
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [saving, setSaving] = useState(false);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [orgResults, setOrgResults] = useState([]);

  const [form, setForm] = useState({
    other_org_id: "",
    iAmClient: true,
    status: "pending", // allow pending/active for now
  });

  const searchOrgs = async (q) => {
    if (!q || q.trim().length < 2) {
      setOrgResults([]);
      return;
    }
    setSearching(true);
    try {
      const { data, error } = await supabase
        .from("organizations")
        .select("id,name")
        .ilike("name", `%${q.trim()}%`)
        .limit(10);

      if (error) throw error;
      setOrgResults(data || []);
    } catch (e) {
      console.error("search organizations", e);
      // If RLS blocks this in prod, user can still paste UUID manually.
      setOrgResults([]);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => searchOrgs(query), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const createConnection = async () => {
    if (!orgId) return toast.error("Organisation not ready");
    if (!form.other_org_id) return toast.error("Select or paste an organisation");
    if (form.other_org_id === orgId) return toast.error("Cannot connect an organisation to itself");

    setSaving(true);
    try {
      const payload = form.iAmClient
        ? {
            client_organization_id: orgId,
            vendor_organization_id: form.other_org_id,
            status: form.status,
            invited_at: new Date().toISOString(),
            permissions: {},
          }
        : {
            client_organization_id: form.other_org_id,
            vendor_organization_id: orgId,
            status: form.status,
            invited_at: new Date().toISOString(),
            permissions: {},
          };

      const { data, error } = await supabase
        .from("organization_relationships")
        .insert(payload)
        .select(
          `
          id,
          client_organization_id,
          vendor_organization_id,
          status,
          permissions,
          invited_at,
          accepted_at,
          client:client_organization_id ( id, name ),
          vendor:vendor_organization_id ( id, name )
        `
        )
        .single();

      if (error) throw error;

      toast.success("Connection created");
      onCreated?.(data);
      onClose?.();
    } catch (e) {
      console.error("create organization_relationships", e);
      toast.error(e?.message || "Could not create connection");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-100">New Connection</h2>
          <button className="btn" onClick={onClose} type="button" disabled={saving}>
            Close
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <label className="block text-sm">
            Find organisation (optional)
            <input
              className="input w-full"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type 2+ characters to search…"
            />
            <div className="text-xs text-slate-400 mt-1">
              If search is blocked, paste the organisation UUID below.
            </div>
          </label>

          {(searching || orgResults.length > 0) && (
            <div className="border border-white/10 rounded p-2 max-h-44 overflow-auto bg-black/10">
              {searching && <div className="text-xs text-slate-400 p-1">Searching…</div>}
              {!searching &&
                orgResults.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    className="w-full text-left text-sm px-2 py-1 rounded hover:bg-white/5"
                    onClick={() => setForm((f) => ({ ...f, other_org_id: o.id }))}
                  >
                    <div className="font-medium text-slate-100">{o.name}</div>
                    <div className="text-xs text-slate-400">{o.id}</div>
                  </button>
                ))}
              {!searching && orgResults.length === 0 && <div className="text-xs text-slate-400 p-1">No matches.</div>}
            </div>
          )}

          <label className="block text-sm">
            Other organisation ID (UUID)
            <input
              className="input w-full"
              value={form.other_org_id}
              onChange={(e) => setForm((f) => ({ ...f, other_org_id: e.target.value.trim() }))}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </label>

          <div className="flex gap-2 flex-wrap items-center">
            <label className="text-sm flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.iAmClient}
                onChange={(e) => setForm((f) => ({ ...f, iAmClient: e.target.checked }))}
              />
              My org is the client (unchecked = my org is the vendor)
            </label>
          </div>

          <label className="block text-sm">
            Status
            <select
              className="input w-full"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="pending">pending (invite)</option>
              <option value="active">active (testing)</option>
            </select>
            <div className="text-xs text-slate-400 mt-1">
              Use <span className="font-medium">active</span> for testing if the other org can’t accept yet.
            </div>
          </label>
        </div>

        <div className="flex gap-2 justify-end pt-4">
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={createConnection} disabled={saving || !form.other_org_id}>
            {saving ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}