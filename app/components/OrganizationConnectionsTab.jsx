"use client";

import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { supabaseBrowser } from "@/lib/supabaseClient";
import NewConnectionModal from "@/app/projects/components/NewConnectionModal";

function PermissionsSummary({ permissions }) {
  const enabled = useMemo(() => {
    const p = permissions || {};
    return Object.entries(p)
      .filter(([, value]) => value === true)
      .map(([key]) => key);
  }, [permissions]);

  if (!enabled.length) return <span className="text-slate-400">None</span>;

  const label = (key) =>
    ({
      share_project_details: "Project details",
      share_plods: "Plods",
      share_rates: "Rates",
      allow_invoicing: "Invoicing",
    }[key] || key);

  return (
    <div className="flex flex-wrap gap-1">
      {enabled.map((key) => (
        <span key={key} className="text-[11px] px-2 py-0.5 rounded border border-white/10 bg-white/5">
          {label(key)}
        </span>
      ))}
    </div>
  );
}

function ConnectionDetailsModal({ relationship, orgId, canManageSharedProjects, onClose, onSaved }) {
  const supabase = supabaseBrowser();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState(new Set());
  const [permissionsDraft, setPermissionsDraft] = useState(relationship?.permissions || {});

  const isClientSide = relationship?.client_organization_id === orgId;
  const canEdit = !!canManageSharedProjects && isClientSide;
  const shareProjectDetailsEnabled = !!permissionsDraft?.share_project_details;

  useEffect(() => {
    setPermissionsDraft(relationship?.permissions || {});
  }, [relationship?.id, relationship?.permissions]);

  const loadData = async () => {
    if (!relationship?.id) return;
    setLoading(true);
    try {
      const { data: projectRows, error: projectErr } = await supabase
        .from("projects")
        .select("id,name")
        .eq("organization_id", relationship.client_organization_id)
        .order("name", { ascending: true });
      if (projectErr) throw projectErr;

      const { data: sharedRows, error: sharedErr } = await supabase
        .from("organization_shared_projects")
        .select("project_id")
        .eq("relationship_id", relationship.id);
      if (sharedErr) throw sharedErr;

      setProjects(projectRows || []);
      setSelectedProjectIds(new Set((sharedRows || []).map((row) => row.project_id).filter(Boolean)));
    } catch (error) {
      console.error("load shared projects", error);
      toast.error(error?.message || "Could not load shared projects");
      setProjects([]);
      setSelectedProjectIds(new Set());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [relationship?.id]);

  const toggleProject = (projectId) => {
    if (!canEdit || !shareProjectDetailsEnabled) return;
    setSelectedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  const saveShares = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const { error: permissionsErr } = await supabase
        .from("organization_relationships")
        .update({
          permissions: {
            ...permissionsDraft,
            share_project_details: shareProjectDetailsEnabled,
          },
        })
        .eq("id", relationship.id);
      if (permissionsErr) throw permissionsErr;

      if (!shareProjectDetailsEnabled) {
        toast.success("Connection permissions updated");
        onSaved?.();
        return;
      }

      const { data: existingRows, error: existingErr } = await supabase
        .from("organization_shared_projects")
        .select("project_id")
        .eq("relationship_id", relationship.id);
      if (existingErr) throw existingErr;

      const existingSet = new Set((existingRows || []).map((row) => row.project_id).filter(Boolean));
      const toAdd = Array.from(selectedProjectIds).filter((id) => !existingSet.has(id));
      const toRemove = Array.from(existingSet).filter((id) => !selectedProjectIds.has(id));

      if (toAdd.length > 0) {
        const { error: addErr } = await supabase.from("organization_shared_projects").insert(
          toAdd.map((project_id) => ({
            relationship_id: relationship.id,
            project_id,
          }))
        );
        if (addErr) throw addErr;
      }

      if (toRemove.length > 0) {
        const { error: removeErr } = await supabase
          .from("organization_shared_projects")
          .delete()
          .eq("relationship_id", relationship.id)
          .in("project_id", toRemove);
        if (removeErr) throw removeErr;
      }

      toast.success("Connection permissions and shared projects updated");
      onSaved?.();
    } catch (error) {
      console.error("save shared projects", error);
      toast.error(error?.message || "Could not save shared projects");
    } finally {
      setSaving(false);
    }
  };

  const clientName = relationship?.client?.name || "Client org";
  const vendorName = relationship?.vendor?.name || "Vendor org";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="card w-full max-w-2xl p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-slate-100">Connection details</h2>
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            Close
          </button>
        </div>

        <div className="space-y-3">
          <div className="text-sm text-slate-200">{clientName} ↔ {vendorName}</div>
          <div className="text-xs text-slate-400">
            Invited: {relationship?.invited_at ? new Date(relationship.invited_at).toLocaleString() : "—"}
            {relationship?.accepted_at ? ` • Accepted: ${new Date(relationship.accepted_at).toLocaleString()}` : ""}
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-1">Permissions</div>
            <PermissionsSummary permissions={permissionsDraft} />
          </div>
        </div>

        {canEdit && (
          <div className="mt-4 rounded border border-white/10 p-3">
            <label className="inline-flex items-center gap-2 text-sm text-slate-100">
              <input
                type="checkbox"
                checked={shareProjectDetailsEnabled}
                disabled={saving}
                onChange={(e) =>
                  setPermissionsDraft((prev) => ({
                    ...(prev || {}),
                    share_project_details: e.target.checked,
                  }))
                }
              />
              Enable project details sharing
            </label>
            <div className="mt-1 text-xs text-slate-400">
              Turn this on to allow selecting specific projects to share with this connected org.
            </div>
          </div>
        )}

        {!shareProjectDetailsEnabled && (
          <div className="mt-4 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
            Project sharing is disabled for this connection. Enable <strong>share_project_details</strong> first.
          </div>
        )}

        {shareProjectDetailsEnabled && !canEdit && (
          <div className="mt-4 rounded border border-slate-500/30 bg-slate-500/10 p-3 text-sm text-slate-200">
            Read-only view. Only admins in the client organization can change shared projects.
          </div>
        )}

        <div className="mt-4">
          <div className="text-sm font-medium text-slate-100 mb-2">Shared projects</div>
          {loading ? (
            <div className="text-sm text-slate-300">Loading…</div>
          ) : projects.length === 0 ? (
            <div className="text-sm text-slate-400">No projects found in the client organization.</div>
          ) : (
            <div className="max-h-[45vh] overflow-y-auto rounded border border-white/10 divide-y divide-white/10">
              {projects.map((project) => {
                const checked = selectedProjectIds.has(project.id);
                return (
                  <label key={project.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-white/5">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!canEdit || !shareProjectDetailsEnabled || saving}
                      onChange={() => toggleProject(project.id)}
                    />
                    <span className="text-sm text-slate-100">{project.name || "(unnamed project)"}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={saveShares}
            disabled={saving || loading || !canEdit || !shareProjectDetailsEnabled}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OrganizationConnectionsTab({ orgId, canManageSharedProjects = false }) {
  const supabase = supabaseBrowser();

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [showNewConnection, setShowNewConnection] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState(null);

  const refresh = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("organization_relationships")
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
        .or(`client_organization_id.eq.${orgId},vendor_organization_id.eq.${orgId}`)
        .order("invited_at", { ascending: false });

      if (error) throw error;
      setRows(data || []);
    } catch (error) {
      console.error("load organization_relationships", error);
      toast.error(error?.message || "Failed to load connections");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [orgId]);

  const incomingInvites = rows.filter((row) => row.vendor_organization_id === orgId && row.status === "pending");
  const outgoingInvites = rows.filter((row) => row.client_organization_id === orgId && row.status === "pending");
  const activeConnections = rows.filter((row) => row.status === "active");

  const updateStatus = async (id, nextStatus) => {
    try {
      const { error } = await supabase.from("organization_relationships").update({ status: nextStatus }).eq("id", id);
      if (error) throw error;

      toast.success(
        nextStatus === "active"
          ? "Connection accepted"
          : nextStatus === "rejected"
          ? "Invite rejected"
          : "Connection revoked"
      );
      refresh();
    } catch (error) {
      console.error("update organization_relationships status", error);
      toast.error(error?.message || "Action failed");
    }
  };

  const StatusBadge = ({ status }) => {
    const classes =
      status === "active"
        ? "bg-emerald-500/15 text-emerald-200 border-emerald-400/20"
        : status === "pending"
        ? "bg-amber-500/15 text-amber-200 border-amber-400/20"
        : status === "rejected"
        ? "bg-rose-500/15 text-rose-200 border-rose-400/20"
        : "bg-slate-500/15 text-slate-200 border-slate-400/20";
    return <span className={`text-[11px] px-2 py-0.5 rounded border ${classes}`}>{status}</span>;
  };

  const RelationshipRow = ({ row, mode }) => {
    const clientName = row.client?.name || "Client org";
    const vendorName = row.vendor?.name || "Vendor org";
    const title =
      mode === "incoming"
        ? `${clientName} → ${vendorName}`
        : mode === "outgoing"
        ? `${clientName} → ${vendorName}`
        : `${clientName} ↔ ${vendorName}`;

    return (
      <div className="flex items-start justify-between gap-3 border-b border-white/10 py-3 last:border-b-0">
        <button
          type="button"
          className={`min-w-0 text-left ${mode === "active" ? "cursor-pointer" : "cursor-default"}`}
          onClick={() => {
            if (mode === "active" && row.status === "active") setSelectedConnection(row);
          }}
          disabled={!(mode === "active" && row.status === "active")}
        >
          <div className="flex items-center gap-2">
            <div className="font-medium text-slate-100 truncate">{title}</div>
            <StatusBadge status={row.status} />
            {mode === "active" && row.status === "active" && (
              <span className="text-[11px] text-indigo-300 underline underline-offset-2">View</span>
            )}
          </div>

          <div className="text-xs text-slate-400 mt-1">
            Invited: {row.invited_at ? new Date(row.invited_at).toLocaleString() : "—"}
            {row.accepted_at ? ` • Accepted: ${new Date(row.accepted_at).toLocaleString()}` : ""}
          </div>

          <div className="mt-2">
            <div className="text-xs text-slate-400 mb-1">Permissions</div>
            <PermissionsSummary permissions={row.permissions} />
          </div>
        </button>

        <div className="flex gap-2 shrink-0">
          {mode === "incoming" && row.status === "pending" && (
            <>
              <button type="button" className="btn btn-primary" onClick={() => updateStatus(row.id, "active")}>
                Accept
              </button>
              <button type="button" className="btn" onClick={() => updateStatus(row.id, "rejected")}>
                Reject
              </button>
            </>
          )}

          {mode === "outgoing" && row.status === "pending" && (
            <button type="button" className="btn" onClick={() => updateStatus(row.id, "revoked")}>
              Withdraw
            </button>
          )}

          {mode === "active" && row.status === "active" && (
            <button type="button" className="btn" onClick={() => updateStatus(row.id, "revoked")}>
              Revoke
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-slate-300/70">Invites and active client↔vendor connections</div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowNewConnection(true)}
            disabled={!orgId}
          >
            New Connection
          </button>
          <button type="button" className="btn" onClick={refresh} disabled={loading || !orgId}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {!orgId && <div className="card p-4 text-sm text-slate-300">Select an organisation to view connections.</div>}

      {!!orgId && (
        <>
          <div className="card p-4">
            <div className="text-sm font-medium text-slate-100 mb-3">
              Incoming invites <span className="text-slate-400">({incomingInvites.length})</span>
            </div>
            {incomingInvites.length === 0 ? (
              <div className="text-sm text-slate-400">No incoming invites.</div>
            ) : (
              incomingInvites.map((row) => <RelationshipRow key={row.id} row={row} mode="incoming" />)
            )}
          </div>

          <div className="card p-4">
            <div className="text-sm font-medium text-slate-100 mb-3">
              Outgoing invites <span className="text-slate-400">({outgoingInvites.length})</span>
            </div>
            {outgoingInvites.length === 0 ? (
              <div className="text-sm text-slate-400">No outgoing invites.</div>
            ) : (
              outgoingInvites.map((row) => <RelationshipRow key={row.id} row={row} mode="outgoing" />)
            )}
          </div>

          <div className="card p-4">
            <div className="text-sm font-medium text-slate-100 mb-3">
              Active connections <span className="text-slate-400">({activeConnections.length})</span>
            </div>
            {activeConnections.length === 0 ? (
              <div className="text-sm text-slate-400">No active connections yet.</div>
            ) : (
              activeConnections.map((row) => <RelationshipRow key={row.id} row={row} mode="active" />)
            )}
          </div>
        </>
      )}

      {showNewConnection && (
        <NewConnectionModal
          orgId={orgId}
          onClose={() => setShowNewConnection(false)}
          onCreated={() => {
            setShowNewConnection(false);
            refresh();
          }}
        />
      )}

      {selectedConnection && (
        <ConnectionDetailsModal
          relationship={selectedConnection}
          orgId={orgId}
          canManageSharedProjects={canManageSharedProjects}
          onClose={() => setSelectedConnection(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
