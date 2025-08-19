"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { DEFAULT_CONSUMABLE_ITEMS } from "@/lib/consumablesDefaults";
import toast from "react-hot-toast";

// Data model (Supabase suggested tables):
// consumable_items: { id, organization_id, key, label, count, updated_at }
// purchase_orders: { id, organization_id, po_number, status ('not_ordered'|'ordered'|'received'), ordered_date, received_date, comments, created_at }
// purchase_order_items: { id, organization_id, po_id, item_key, label, quantity, status ('outstanding'|'ordered'|'received'), created_at }

export default function ConsumablesPage() {
  const supabase = supabaseBrowser();
  const [user, setUser] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [orgId, setOrgId] = useState("");
  const [tab, setTab] = useState("inventory"); // 'inventory' | 'requests' | 'orders'

  // Inventory
  const [items, setItems] = useState([]); // list of {key,label,count}
  const [loadingItems, setLoadingItems] = useState(false);
  // No order number captured at inventory level anymore

  // Purchase requests
  const [poList, setPoList] = useState([]); // {id, name, po_number, status, ordered_date, received_date, comments}
  const [poItems, setPoItems] = useState([]); // items across POs
  const [poFilter, setPoFilter] = useState(""); // po_number or ""
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'outstanding' | 'ordered' | 'received'
  const [assigning, setAssigning] = useState({}); // id->loading
  const [poLoading, setPoLoading] = useState(false);
  const [creatingPo, setCreatingPo] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState({}); // poId -> bool for accordion
  const [marking, setMarking] = useState({}); // itemId -> loading
  const [receiveModal, setReceiveModal] = useState({ open: false, poId: null, date: "" });
  const [receiveSubmitting, setReceiveSubmitting] = useState(false);
  const [historyEditing, setHistoryEditing] = useState({}); // poId -> bool
  const [historyDraft, setHistoryDraft] = useState({}); // poId -> {po_number, ordered_date, received_date}
  const [savingHistory, setSavingHistory] = useState({}); // poId -> bool

  // Load user and orgs
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    })();
  }, [supabase]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: ms } = await supabase
        .from("organization_members")
        .select("organization_id, organizations(name)")
        .eq("user_id", user.id);
      setMemberships(ms || []);
      if ((ms || []).length > 0) setOrgId(ms[0].organization_id);
    })();
  }, [user, supabase]);

  // Seed inventory if empty and then load
  const loadInventory = async (org) => {
    setLoadingItems(true);
    try {
      // Try load existing
      const { data: existing } = await supabase
        .from("consumable_items")
        .select("key, label, count")
        .eq("organization_id", org);
      if ((existing || []).length > 0) {
        setItems(existing);
        return;
      }
      // Seed defaults
      const seedRows = DEFAULT_CONSUMABLE_ITEMS.map((d) => ({
        organization_id: org,
        key: d.key,
        label: d.label,
        count: 0,
      }));
      const { error: seedErr } = await supabase.from("consumable_items").insert(seedRows);
      if (seedErr) throw seedErr;
      setItems(seedRows.map(({ organization_id, ...rest }) => rest));
    } catch (e) {
      // Fallback to client-only state if table doesn’t exist
      setItems(DEFAULT_CONSUMABLE_ITEMS.map((d) => ({ key: d.key, label: d.label, count: 0 })));
    } finally {
      setLoadingItems(false);
    }
  };

  const saveItemCount = async (key, count) => {
    setItems((arr) => arr.map((it) => (it.key === key ? { ...it, count } : it)));
    if (!orgId) return;
    try {
      const { error } = await supabase
        .from("consumable_items")
        .upsert({ organization_id: orgId, key, label: items.find((i) => i.key === key)?.label || key, count }, { onConflict: "organization_id,key" });
      if (error) throw error;
    } catch {
      // swallow for now, optimistic UI
    }
  };

  const addToPurchaseRequest = async (key) => {
    const qty = prompt("Quantity to request?");
    if (!qty) return;
    const quantity = parseInt(qty, 10);
    if (!Number.isFinite(quantity) || quantity <= 0) return toast.error("Enter a valid quantity");
    const item = items.find((i) => i.key === key);
    if (!item) return;
    // Insert as a pre-PO requested item, grouped by order_number
    try {
      const { error: itemErr } = await supabase
        .from("purchase_order_items")
        .insert({ organization_id: orgId, po_id: null, item_key: item.key, label: item.label, quantity, status: "outstanding" });
      if (itemErr) throw itemErr;
      toast.success("Added to order");
      await loadPurchaseData(orgId);
      setTab("requests");
    } catch {
      toast.error("Could not add to order (check setup)");
    }
  };

  const loadPurchaseData = async (org) => {
    setPoLoading(true);
    try {
    const [{ data: pos }, { data: items }] = await Promise.all([
        supabase
          .from("purchase_orders")
          .select("id, name, po_number, status, ordered_date, received_date, comments")
          .eq("organization_id", org)
          .order("created_at", { ascending: false }),
        supabase
          .from("purchase_order_items")
      .select("id, po_id, item_key, label, quantity, status")
          .eq("organization_id", org),
      ]);
      setPoList(pos || []);
      setPoItems(items || []);
    } catch {
      setPoList([]);
      setPoItems([]);
    } finally {
      setPoLoading(false);
    }
  };

  useEffect(() => {
    if (!orgId) return;
    loadInventory(orgId);
    loadPurchaseData(orgId);
  }, [orgId]);

  const filteredPoIds = useMemo(() => {
    let ids = poList.map((p) => p.id);
    if (poFilter) {
      const p = poList.find((x) => (x.po_number || "").toString() === poFilter);
      ids = p ? [p.id] : [];
    }
    return ids;
  }, [poFilter, poList]);

  const unassignedItems = useMemo(() => poItems.filter((i) => i.po_id == null), [poItems]);
  const visiblePoItems = useMemo(() => {
    let items = poItems.filter((i) => i.po_id && filteredPoIds.includes(i.po_id));
    if (statusFilter !== "all") items = items.filter((i) => i.status === statusFilter);
    return items;
  }, [poItems, filteredPoIds, statusFilter]);

  // History section: ordered and received POs
  const historyPos = useMemo(
    () => poList.filter((p) => p.status === "ordered" || p.status === "received"),
    [poList]
  );
  const toggleHistoryPo = (poId) =>
    setExpandedHistory((m) => ({ ...m, [poId]: !m[poId] }));

  // no longer auto-creating POs on assign; POs are created explicitly and selected by name

  const assignItemToPo = async (itemId, poId) => {
    if (!poId) return toast.error('Select a PO first');
    setAssigning((m) => ({ ...m, [itemId]: true }));
    try {
      const { error } = await supabase
        .from("purchase_order_items")
        .update({ po_id: poId, status: "outstanding" })
        .eq("id", itemId)
        .eq("organization_id", orgId);
      if (error) throw error;
      setPoItems((arr) => arr.map((i) => (i.id === itemId ? { ...i, po_id: poId, status: "outstanding" } : i)));
      toast.success("Added to PO");
    } catch (e) {
      toast.error("Could not add to PO");
    } finally {
      setAssigning((m) => ({ ...m, [itemId]: false }));
    }
  };

  const createNewPo = async () => {
    const name = prompt('Enter a name for the new PO');
    if (!name) return;
    setCreatingPo(true);
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .insert({ organization_id: orgId, name: name.trim(), status: 'not_ordered' })
        .select('id')
        .single();
      if (error) throw error;
      setPoList((arr) => [{ id: data.id, name: name.trim(), status: 'not_ordered' }, ...arr]);
      toast.success('PO created');
    } catch {
      toast.error('Failed to create PO');
    } finally {
      setCreatingPo(false);
    }
  };

  const updatePoMeta = async (poId, fields) => {
    try {
      const { error } = await supabase
        .from("purchase_orders")
        .update(fields)
        .eq("id", poId)
        .eq("organization_id", orgId);
      if (error) throw error;
      setPoList((arr) => arr.map((p) => (p.id === poId ? { ...p, ...fields } : p)));
    } catch {
      /* ignore */
    }
  };

  const markItemStatus = async (id, status) => {
    setMarking((m) => ({ ...m, [id]: true }));
    const prev = poItems.find((i) => i.id === id)?.status;
    // Optimistic update
    setPoItems((arr) => arr.map((i) => (i.id === id ? { ...i, status } : i)));
    try {
      const { error } = await supabase
        .from("purchase_order_items")
        .update({ status })
        .eq("id", id)
        .eq("organization_id", orgId);
      if (error) throw error;
      toast.success(status === 'received' ? 'Marked received' : 'Marked outstanding');
    } catch (e) {
      console.error('Failed to update item status', e);
      // Revert on failure
      if (prev) setPoItems((arr) => arr.map((i) => (i.id === id ? { ...i, status: prev } : i)));
      toast.error('Could not update item status');
    } finally {
      setMarking((m) => ({ ...m, [id]: false }));
    }
  };

  const assignPoNumber = async (poId, value) => {
    const po_number = value || null;
    await updatePoMeta(poId, { po_number });
  };

  const orderedStatuses = ["not_ordered", "ordered", "received"];

  const openReceiveModal = (poId) => {
    setReceiveModal({ open: true, poId, date: new Date().toISOString().slice(0, 10) });
  };
  const closeReceiveModal = () => setReceiveModal({ open: false, poId: null, date: "" });
  const confirmReceive = async () => {
    if (!receiveModal.poId || !receiveModal.date) return;
    setReceiveSubmitting(true);
    try {
      await updatePoMeta(receiveModal.poId, { status: 'received', received_date: receiveModal.date });
      toast.success('PO marked as received');
      closeReceiveModal();
    } catch (e) {
      toast.error('Failed to mark as received');
    } finally {
      setReceiveSubmitting(false);
    }
  };

  const startEditHistory = (po) => {
    setHistoryEditing((m) => ({ ...m, [po.id]: true }));
    setHistoryDraft((m) => ({
      ...m,
      [po.id]: {
        po_number: po.po_number || "",
        ordered_date: po.ordered_date || "",
        received_date: po.received_date || "",
      },
    }));
  };
  const cancelEditHistory = (poId) => {
    setHistoryEditing((m) => ({ ...m, [poId]: false }));
    setHistoryDraft((m) => {
      const { [poId]: _, ...rest } = m;
      return rest;
    });
  };
  const saveEditHistory = async (poId) => {
    const draft = historyDraft[poId] || {};
    setSavingHistory((m) => ({ ...m, [poId]: true }));
    try {
      await updatePoMeta(poId, {
        po_number: (draft.po_number || null),
        ordered_date: (draft.ordered_date || null),
        received_date: (draft.received_date || null),
      });
      toast.success('PO updated');
      setHistoryEditing((m) => ({ ...m, [poId]: false }));
    } catch (e) {
      toast.error('Failed to update PO');
    } finally {
      setSavingHistory((m) => ({ ...m, [poId]: false }));
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2">
        <button className={`btn ${tab === "inventory" ? "btn-primary" : ""}`} onClick={() => setTab("inventory")}>
          Current inventory
        </button>
        <button className={`btn ${tab === "requests" ? "btn-primary" : ""}`} onClick={() => setTab("requests")}>
          Purchase requests
        </button>
        <button className={`btn ${tab === "orders" ? "btn-primary" : ""}`} onClick={() => setTab("orders")}>
          Purchase Orders
        </button>
        {memberships.length > 1 && (
          <>
            <span className="ml-4 text-sm text-gray-600">Organization</span>
            <select className="select input-sm text-sm w-auto" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
              {memberships.map((m) => (
                <option key={m.organization_id} value={m.organization_id}>{m.organizations?.name || m.organization_id}</option>
              ))}
            </select>
          </>
        )}
      </div>

      {tab === "inventory" && (
        <div className="card p-4">
          <h2 className="font-medium mb-3">Inventory</h2>
          {loadingItems ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="w-32">Count</th>
                    <th className="w-40">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.key}>
                      <td>{it.label}</td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          className="input input-sm text-right"
                          value={it.count}
                          onChange={(e) => saveItemCount(it.key, Math.max(0, parseInt(e.target.value || "0", 10)))}
                        />
                      </td>
                      <td>
                        <button className="btn text-xs" onClick={() => addToPurchaseRequest(it.key)}>
                          Add to Order
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "requests" && (
        <div className="space-y-4">
          {/* Requested items not yet assigned to a PO */}
          <div className="card p-4">
            <h3 className="font-medium mb-3">Requested items</h3>
            {unassignedItems.length === 0 ? (
              <div className="text-sm text-gray-500">No requested items yet.</div>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th className="w-20 text-right">Qty</th>
                      <th className="w-72">Add to PO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unassignedItems.map((it) => (
                      <tr key={it.id}>
                        <td>{it.label}</td>
                        <td className="text-right">{it.quantity}</td>
                        <td>
                          {poList.filter((p) => (p.status === 'not_ordered')).length === 0 ? (
                            <span className="text-xs text-gray-500">Create a PO on the Purchase Orders tab before assigning items.</span>
                          ) : (
                            <AssignToPoRow item={it} poList={poList} onAssign={assignItemToPo} assigning={assigning} />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "orders" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button className="btn" disabled={creatingPo} onClick={createNewPo}>{creatingPo ? 'Creating…' : 'Create New PO'}</button>
            <span className="text-sm text-gray-600">Active POs (not yet ordered)</span>
          </div>
          <div className="card p-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm text-gray-700">Filter by PO</label>
              <select className="select input-sm text-sm w-auto" value={poFilter} onChange={(e) => setPoFilter(e.target.value)}>
                <option value="">All</option>
                {poList
                  .filter((p) => p.po_number)
                  .map((p) => (
                    <option key={p.id} value={String(p.po_number)}>{p.po_number}</option>
                  ))}
              </select>
              <label className="text-sm text-gray-700 ml-4">Items status</label>
              <select className="select input-sm text-sm w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="outstanding">Outstanding</option>
                <option value="ordered">Ordered</option>
                <option value="received">Received</option>
              </select>
            </div>
          </div>

          {(() => {
            const baseIds = poFilter
              ? filteredPoIds
              : poList.filter((p) => p.status === 'not_ordered').map((p) => p.id);
            return baseIds;
          })().length === 0 ? (
            <div className="card p-4 text-sm text-gray-500">No purchase orders to show.</div>
          ) : (
            (() => {
              const baseIds = poFilter
                ? filteredPoIds
                : poList.filter((p) => p.status === 'not_ordered').map((p) => p.id);
              return baseIds;
            })().map((pid) => {
              const po = poList.find((p) => p.id === pid) || {};
              const items = visiblePoItems.filter((i) => i.po_id === pid);
              return (
                <div key={pid} className="card p-4">
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">PO Name</span>
                      <input
                        className="input input-sm w-56"
                        placeholder="Enter PO name"
                        defaultValue={po.name || ""}
                        onBlur={(e) => updatePoMeta(pid, { name: e.target.value || null })}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">PO #</span>
                      <input
                        className="input input-sm w-40"
                        placeholder="Enter PO number"
                        defaultValue={po.po_number || ""}
                        onBlur={(e) => assignPoNumber(pid, e.target.value.trim())}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Status</span>
                      <select
                        className="select input-sm text-sm w-auto"
                        value={po.status || "not_ordered"}
                        onChange={(e) => updatePoMeta(pid, { status: e.target.value })}
                      >
                        {orderedStatuses.map((s) => (
                          <option key={s} value={s}>{s.replace('_', ' ')}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Ordered</span>
                      <input
                        type="date"
                        className="input input-sm w-44"
                        defaultValue={po.ordered_date || ""}
                        onBlur={(e) => updatePoMeta(pid, { ordered_date: e.target.value || null })}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Received</span>
                      <input
                        type="date"
                        className="input input-sm w-44"
                        defaultValue={po.received_date || ""}
                        onBlur={(e) => updatePoMeta(pid, { received_date: e.target.value || null })}
                      />
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                      <button
                        className="btn text-xs"
                        onClick={async () => {
                          let num = po.po_number;
                          if (!num) {
                            num = prompt('Enter PO number before marking as ordered');
                          }
                          if (!num) return;
                          await updatePoMeta(pid, { po_number: num, status: 'ordered', ordered_date: new Date().toISOString().slice(0,10) });
                        }}
                      >
                        Order placed
                      </button>
                      <button
                        className="btn text-xs"
                        onClick={() => openReceiveModal(pid)}
                      >
                        PO received
                      </button>
                    </div>
                  </div>

                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th className="w-20 text-right">Qty</th>
                          <th className="w-40">Mark</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((it) => (
                          <tr key={it.id}>
                            <td>{it.label}</td>
                            <td className="text-right">{it.quantity}</td>
                            <td>
                              <div className="flex gap-2">
                                <button
                                  className={`btn text-xs ${it.status === 'outstanding' ? 'btn-warning' : ''}`}
                                  title="Mark item as outstanding"
                                  disabled={!!marking[it.id]}
                                  onClick={() => markItemStatus(it.id, 'outstanding')}
                                >
                                  Outstanding
                                </button>
                                <button
                                  className={`btn text-xs ${it.status === 'received' ? 'btn-success' : ''}`}
                                  title="Mark item as received"
                                  disabled={!!marking[it.id]}
                                  onClick={() => markItemStatus(it.id, 'received')}
                                >
                                  {marking[it.id] ? 'Saving…' : 'Received'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {items.length === 0 && (
                          <tr>
                            <td colSpan={3} className="text-sm text-gray-500 text-center">No items on this PO.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3">
                    <textarea
                      className="textarea"
                      rows={2}
                      placeholder="PO comments"
                      defaultValue={po.comments || ""}
                      onBlur={(e) => updatePoMeta(pid, { comments: e.target.value })}
                    />
                  </div>
                </div>
              );
            })
          )}

          {/* History accordion: ordered and received POs */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">In-progress and received POs</h3>
              <span className="text-xs text-gray-500">{historyPos.length} total</span>
            </div>
            {historyPos.length === 0 ? (
              <div className="text-sm text-gray-500">No ordered or received POs yet.</div>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="w-10" aria-label="expand" />
                      <th>PO Name</th>
                      <th className="w-40">PO #</th>
                      <th className="w-32">Status</th>
                      <th className="w-32">Ordered</th>
                      <th className="w-32">Received</th>
                      <th className="w-24 text-right">Items</th>
                      <th className="w-28" aria-label="actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {historyPos.map((p) => {
                      const isOpen = !!expandedHistory[p.id];
                      const items = poItems.filter((i) => i.po_id === p.id);
                      return (
                        <Fragment key={p.id}>
                          <tr>
                            <td>
                              <button
                                className="btn text-xs"
                                onClick={() => toggleHistoryPo(p.id)}
                                aria-expanded={isOpen}
                                aria-controls={`po-details-${p.id}`}
                              >
                                {isOpen ? "-" : "+"}
                              </button>
                            </td>
                            <td>{p.name || "(unnamed PO)"}</td>
                            <td>{p.po_number || "—"}</td>
                            <td>
                              <span className={`badge ${p.status === 'received' ? 'badge-green' : p.status === 'ordered' ? 'badge-blue' : 'badge-gray'} capitalize`}>
                                {p.status?.replace('_', ' ')}
                              </span>
                            </td>
                            <td>{p.ordered_date || ""}</td>
                            <td>{p.received_date || ""}</td>
                            <td className="text-right">{items.length}</td>
                            <td className="w-28 text-right">
                              {p.status !== 'not_ordered' && (
                                <button className="btn text-xs" onClick={() => startEditHistory(p)}>
                                  Edit
                                </button>
                              )}
                            </td>
                          </tr>
                          {isOpen && (
                            <tr key={`${p.id}-details`}>
                              <td colSpan={8} id={`po-details-${p.id}`}>
                                <div className="p-3 bg-gray-50 rounded border border-gray-200">
                                  {historyEditing[p.id] ? (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm mb-3">
                                      <div className="flex items-center gap-2">
                                        <span className="text-gray-600">PO #</span>
                                        <input
                                          className="input input-sm w-44"
                                          value={historyDraft[p.id]?.po_number || ''}
                                          onChange={(e) => setHistoryDraft((m) => ({ ...m, [p.id]: { ...m[p.id], po_number: e.target.value } }))}
                                        />
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-gray-600">Ordered</span>
                                        <input
                                          type="date"
                                          className="input input-sm w-44"
                                          value={historyDraft[p.id]?.ordered_date || ''}
                                          onChange={(e) => setHistoryDraft((m) => ({ ...m, [p.id]: { ...m[p.id], ordered_date: e.target.value } }))}
                                        />
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-gray-600">Received</span>
                                        <input
                                          type="date"
                                          className="input input-sm w-44"
                                          value={historyDraft[p.id]?.received_date || ''}
                                          onChange={(e) => setHistoryDraft((m) => ({ ...m, [p.id]: { ...m[p.id], received_date: e.target.value } }))}
                                        />
                                      </div>
                                      <div className="md:col-span-3 flex justify-end gap-2">
                                        <button className="btn text-xs" onClick={() => cancelEditHistory(p.id)} disabled={!!savingHistory[p.id]}>Cancel</button>
                                        <button className="btn btn-primary text-xs" onClick={() => saveEditHistory(p.id)} disabled={!!savingHistory[p.id]}>
                                          {savingHistory[p.id] ? 'Saving…' : 'Save'}
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm mb-3">
                                      <div><span className="text-gray-600">PO Name:</span> {p.name || "(unnamed PO)"}</div>
                                      <div><span className="text-gray-600">PO #:</span> {p.po_number || "—"}</div>
                                      <div><span className="text-gray-600">Status:</span> {p.status}</div>
                                      <div><span className="text-gray-600">Ordered:</span> {p.ordered_date || ""}</div>
                                      <div><span className="text-gray-600">Received:</span> {p.received_date || ""}</div>
                                    </div>
                                  )}
                                  <div className="table-container">
                                    <table className="table">
                                      <thead>
                                        <tr>
                                          <th>Item</th>
                                          <th className="w-24 text-right">Qty</th>
                                          <th className="w-32">Status</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {items.map((it) => (
                                          <tr key={it.id}>
                                            <td>{it.label}</td>
                                            <td className="text-right">{it.quantity}</td>
                                            <td>
                                              <span className={`badge ${it.status === 'received' ? 'badge-green' : it.status === 'outstanding' ? 'badge-amber' : it.status === 'ordered' ? 'badge-blue' : 'badge-gray'} capitalize`}>
                                                {it.status.replace('_', ' ')}
                                              </span>
                                            </td>
                                          </tr>
                                        ))}
                                        {items.length === 0 && (
                                          <tr>
                                            <td colSpan={3} className="text-sm text-gray-500 text-center">No items on this PO.</td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                  {p.comments && (
                                    <div className="mt-3 text-sm"><span className="text-gray-600">Comments:</span> {p.comments}</div>
                                  )}
                                </div>
                              </td>
              </tr>
                          )}
            </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      {receiveModal.open && (
        <div className="modal-overlay">
          <div className="card p-4" role="dialog" aria-modal="true" aria-labelledby="rcv-title">
            <h3 id="rcv-title" className="font-medium mb-3">Mark PO as received</h3>
            <div className="flex items-center gap-3 mb-4">
              <label className="text-sm text-gray-700" htmlFor="rcv-date">Received date</label>
              <input
                id="rcv-date"
                type="date"
                className="input input-sm w-44"
                value={receiveModal.date}
                onChange={(e) => setReceiveModal((m) => ({ ...m, date: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn text-xs" onClick={closeReceiveModal} disabled={receiveSubmitting}>Cancel</button>
              <button className="btn btn-primary text-xs" onClick={confirmReceive} disabled={receiveSubmitting || !receiveModal.date}>
                {receiveSubmitting ? 'Saving…' : 'Mark received'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AssignToPoRow({ item, poList, onAssign, assigning }) {
  const [sel, setSel] = useState("");
  const active = useMemo(() => poList.filter((p) => p.status === 'not_ordered'), [poList]);
  return (
    <div className="flex items-center gap-2">
      <select className="select input-sm text-sm w-56" value={sel} onChange={(e) => setSel(e.target.value)}>
        <option value="">Select a PO…</option>
        {active.map((p) => (
          <option key={p.id} value={p.id}>{p.name || '(unnamed PO)'}{p.po_number ? ` — ${p.po_number}` : ''}</option>
        ))}
      </select>
      <button className="btn text-xs" disabled={assigning[item.id] || !sel} onClick={() => onAssign(item.id, sel)}>
        {assigning[item.id] ? 'Adding…' : 'Add to PO'}
      </button>
    </div>
  );
}
