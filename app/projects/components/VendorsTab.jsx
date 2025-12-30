"use client";

import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useOrg } from "@/lib/OrgContext";
import VendorsTable from "./VendorsTable";
import VendorModal from "./VendorModal";
import NewConnectionModal from "./NewConnectionModal"; // <-- ADD

function PermissionsSummary({ permissions }) {
  const enabled = useMemo(() => {
    const p = permissions || {};
    return Object.entries(p)
      .filter(([, v]) => v === true)
      .map(([k]) => k);
  }, [permissions]);

  if (!enabled.length) return <span className="text-slate-400">None</span>;

  const label = (k) =>
    ({
      share_project_details: "Project details",
      share_plods: "Plods",
      share_rates: "Rates",
      allow_invoicing: "Invoicing",
    }[k] || k);

  return (
    <div className="flex flex-wrap gap-1">
      {enabled.map((k) => (
        <span key={k} className="text-[11px] px-2 py-0.5 rounded border border-white/10 bg-white/5">
          {label(k)}
        </span>
      ))}
    </div>
  );
}

function OrganizationConnectionsTab({ orgId }) {
  const supabase = supabaseBrowser();

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [showNewConnection, setShowNewConnection] = useState(false); // <-- ADD

  const refresh = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      // Pull both directions where current org is either client or vendor.
      // Includes organization names for display.
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
    } catch (e) {
      console.error("load organization_relationships", e);
      toast.error(e?.message || "Failed to load connections");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const incomingInvites = rows.filter((r) => r.vendor_organization_id === orgId && r.status === "pending");
  const outgoingInvites = rows.filter((r) => r.client_organization_id === orgId && r.status === "pending");
  const activeConnections = rows.filter((r) => r.status === "active");

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
    } catch (e) {
      console.error("update organization_relationships status", e);
      toast.error(e?.message || "Action failed");
    }
  };

  const StatusBadge = ({ status }) => {
    const cls =
      status === "active"
        ? "bg-emerald-500/15 text-emerald-200 border-emerald-400/20"
        : status === "pending"
        ? "bg-amber-500/15 text-amber-200 border-amber-400/20"
        : status === "rejected"
        ? "bg-rose-500/15 text-rose-200 border-rose-400/20"
        : "bg-slate-500/15 text-slate-200 border-slate-400/20";
    return <span className={`text-[11px] px-2 py-0.5 rounded border ${cls}`}>{status}</span>;
  };

  const RelationshipRow = ({ r, mode }) => {
    const clientName = r.client?.name || "Client org";
    const vendorName = r.vendor?.name || "Vendor org";
    const title =
      mode === "incoming" ? `${clientName} → ${vendorName}` : mode === "outgoing" ? `${clientName} → ${vendorName}` : `${clientName} ↔ ${vendorName}`;

    return (
      <div className="flex items-start justify-between gap-3 border-b border-white/10 py-3 last:border-b-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-medium text-slate-100 truncate">{title}</div>
            <StatusBadge status={r.status} />
          </div>

          <div className="text-xs text-slate-400 mt-1">
            Invited: {r.invited_at ? new Date(r.invited_at).toLocaleString() : "—"}
            {r.accepted_at ? ` • Accepted: ${new Date(r.accepted_at).toLocaleString()}` : ""}
          </div>

          <div className="mt-2">
            <div className="text-xs text-slate-400 mb-1">Permissions</div>
            <PermissionsSummary permissions={r.permissions} />
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          {mode === "incoming" && r.status === "pending" && (
            <>
              <button type="button" className="btn btn-primary" onClick={() => updateStatus(r.id, "active")}>
                Accept
              </button>
              <button type="button" className="btn" onClick={() => updateStatus(r.id, "rejected")}>
                Reject
              </button>
            </>
          )}

          {mode === "outgoing" && r.status === "pending" && (
            <button type="button" className="btn" onClick={() => updateStatus(r.id, "revoked")}>
              Withdraw
            </button>
          )}

          {mode === "active" && r.status === "active" && (
            <button type="button" className="btn" onClick={() => updateStatus(r.id, "revoked")}>
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
              incomingInvites.map((r) => <RelationshipRow key={r.id} r={r} mode="incoming" />)
            )}
          </div>

          <div className="card p-4">
            <div className="text-sm font-medium text-slate-100 mb-3">
              Outgoing invites <span className="text-slate-400">({outgoingInvites.length})</span>
            </div>
            {outgoingInvites.length === 0 ? (
              <div className="text-sm text-slate-400">No outgoing invites.</div>
            ) : (
              outgoingInvites.map((r) => <RelationshipRow key={r.id} r={r} mode="outgoing" />)
            )}
          </div>

          <div className="card p-4">
            <div className="text-sm font-medium text-slate-100 mb-3">
              Active connections <span className="text-slate-400">({activeConnections.length})</span>
            </div>
            {activeConnections.length === 0 ? (
              <div className="text-sm text-slate-400">No active connections yet.</div>
            ) : (
              activeConnections.map((r) => <RelationshipRow key={r.id} r={r} mode="active" />)
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
    </div>
  );
}

export default function VendorsTab({
  orgId: orgIdProp,
  vendors,
  setVendors,
  orgLoading,
}) {
  const { orgId: ctxOrgId } = useOrg(); // <-- ADD
  const orgId = orgIdProp ?? ctxOrgId;  // <-- ADD (fallback to context)

  const [subTab, setSubTab] = useState("vendors"); // 'vendors' | 'connections'
  const [showVendorModal, setShowVendorModal] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2">
          <button
            type="button"
            className={`btn ${subTab === "vendors" ? "btn-primary" : ""}`}
            onClick={() => setSubTab("vendors")}
          >
            Vendors
          </button>
          <button
            type="button"
            className={`btn ${subTab === "connections" ? "btn-primary" : ""}`}
            onClick={() => setSubTab("connections")}
          >
            Connections
          </button>
        </div>

        {subTab === "vendors" && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowVendorModal(true)}
            disabled={orgLoading || !orgId}
          >
            Add Vendor
          </button>
        )}
      </div>

      {subTab === "vendors" && (
        <VendorsTable vendors={vendors || []} />
      )}

      {subTab === "connections" && <OrganizationConnectionsTab orgId={orgId} />}

      {showVendorModal && (
        <VendorModal
          orgId={orgId}
          onClose={() => setShowVendorModal(false)}
          onCreated={(created) => {
            if (typeof setVendors === "function") {
              setVendors((arr) => [created, ...(arr || [])]);
            }
            setShowVendorModal(false);
          }}
        />
      )}
    </div>
  );
}