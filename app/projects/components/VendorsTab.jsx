"use client";

import React, { useState } from "react";
import { useOrg } from "@/lib/OrgContext";
import VendorsTable from "./VendorsTable";
import VendorModal from "./VendorModal";

export default function VendorsTab({
  orgId: orgIdProp,
  vendors,
  setVendors,
  orgLoading,
}) {
  const { orgId: ctxOrgId } = useOrg();
  const orgId = orgIdProp ?? ctxOrgId;
  const [showVendorModal, setShowVendorModal] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-slate-300/70">Manage vendor organizations for this org.</div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowVendorModal(true)}
          disabled={orgLoading || !orgId}
        >
          Add Vendor
        </button>
      </div>

      <VendorsTable vendors={vendors || []} />

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