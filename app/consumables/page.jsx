"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { DEFAULT_CONSUMABLE_ITEMS } from "@/lib/consumablesDefaults";
import { useOrg } from "@/lib/OrgContext";
import toast from "react-hot-toast";

// Data model (Supabase suggested tables):
// consumable_items: { id, organization_id, key, label, count, updated_at }
// purchase_orders: { id, organization_id, po_number, status ('not_ordered'|'ordered'|'received'), ordered_date, received_date, comments, created_at }
// purchase_order_items: { id, organization_id, po_id, item_key, label, quantity, status ('outstanding'|'ordered'|'received'), created_at }

export default function ConsumablesPage() {
  const supabase = supabaseBrowser();
  const [user, setUser] = useState(null);
  const { orgId, setOrgId, memberships } = useOrg();
  const [tab, setTab] = useState("inventory"); // 'inventory' | 'requests' | 'orders'

  // Inventory
  const [items, setItems] = useState([]); // list of {id,key,label,count,include_in_report,reorder_value}
  const [loadingItems, setLoadingItems] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [savingItem, setSavingItem] = useState(false);
  const [editDraft, setEditDraft] = useState({ label: '', reorder_value: 0, cost_per_unit: 0, unit_size: 1 });
  // No order number captured at inventory level anymore

  // Purchase requests
  const [poList, setPoList] = useState([]); // {id, name, po_number, status, ordered_date, received_date, comments}
  const [poItems, setPoItems] = useState([]); // items across POs
  const [poFilter, setPoFilter] = useState(""); // po_number or ""
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'outstanding' | 'ordered' | 'received'
  const [assigning, setAssigning] = useState({}); // id->loading
  const [poLoading, setPoLoading] = useState(false);
  const [creatingPo, setCreatingPo] = useState(false);
  const [deletingPo, setDeletingPo] = useState({}); // poId -> loading
  const [createPoModal, setCreatePoModal] = useState({ open: false, name: "" });
  const [expandedHistory, setExpandedHistory] = useState({}); // poId -> bool for accordion
  const [marking, setMarking] = useState({}); // itemId -> loading
  const [receiveModal, setReceiveModal] = useState({ open: false, poId: null, date: "" });
  const [receiveSubmitting, setReceiveSubmitting] = useState(false);

  // Load user and orgs
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    })();
  }, [supabase]);

  // Memberships and org selection provided by OrgContext

  // Seed inventory if empty and then load
  const isAdmin = useMemo(() => memberships.some((m) => m.organization_id === orgId && m.role === 'admin'), [memberships, orgId]);

  const loadInventory = async (org, opts = {}) => {
    setLoadingItems(true);
    try {
      // Try load existing
      const { data: existing } = await supabase
        .from("consumable_items")
        .select("id, key, label, count, include_in_report, reorder_value, cost_per_unit, unit_size")
        .eq("organization_id", org);
      if ((existing || []).length > 0) {
        setItems(existing);
        return;
      }
      // If admin, seed defaults automatically (initial bootstrap)
      if (opts.allowSeed !== false && memberships.some((m)=> m.organization_id===org && m.role==='admin')) {
    const seedRows = DEFAULT_CONSUMABLE_ITEMS.map((d) => ({
          organization_id: org,
          key: d.key,
          label: d.label,
          count: 0,
        }));
  const { data: inserted, error: seedErr } = await supabase.from("consumable_items").insert(seedRows).select("id, key, label, count, include_in_report, reorder_value, cost_per_unit, unit_size");
        if (seedErr) throw seedErr;
        setItems(inserted || seedRows.map(({ organization_id, ...rest }) => rest));
        return;
      }
      // Non-admin and no items: show empty list until admin configures
    setItems([]);
    } catch (e) {
      // Fallback: if table not ready; show defaults client-side (read-only)
  setItems(DEFAULT_CONSUMABLE_ITEMS.map((d) => ({ id: `temp-${d.key}`, key: d.key, label: d.label, count: 0, include_in_report: false, reorder_value: 0, cost_per_unit:0, unit_size:1 })));
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

  const saveReorderValue = async (key, reorder_value) => {
    setItems(arr => arr.map(it => it.key === key ? { ...it, reorder_value } : it));
    if (!orgId) return;
    try {
      const { error } = await supabase
        .from('consumable_items')
        .upsert({ organization_id: orgId, key, label: items.find(i=>i.key===key)?.label || key, reorder_value }, { onConflict: 'organization_id,key' });
      if (error) throw error;
    } catch {
      /* ignore */
    }
  };

  // include_in_report toggle removed; dashboard derives low/reorder automatically.

  const addConsumableItem = async () => {
    if (!isAdmin) return;
    const label = prompt('New item label?');
    if (!label) return;
    let baseKey = label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'item';
    let key = baseKey;
    const existingKeys = new Set(items.map(i => i.key));
    let i = 1;
    while (existingKeys.has(key)) {
      key = `${baseKey}_${i++}`;
    }
    try {
  const { data, error } = await supabase.from('consumable_items').insert({ organization_id: orgId, key, label, count: 0, reorder_value: 0 }).select('id, key, label, count, include_in_report, reorder_value, cost_per_unit, unit_size').single();
      if (error) throw error;
      setItems(arr => [...arr, data]);
    } catch (e) {
      toast.error('Failed to add item');
    }
  };

  const startEditItem = (item) => {
    if (!isAdmin) return;
    if (!item || (item.id || '').startsWith('temp-')) return; // can't edit placeholder
    setEditItem(item);
    setEditDraft({
      label: item.label || '',
      reorder_value: item.reorder_value ?? 0,
      cost_per_unit: item.cost_per_unit ?? 0,
      unit_size: item.unit_size ?? 1,
    });
  };

  const saveEditItem = async () => {
    if (!editItem || !orgId) return;
    setSavingItem(true);
    try {
      const payload = {
        label: editDraft.label.trim() || editItem.label,
        reorder_value: Math.max(0, parseInt(editDraft.reorder_value, 10) || 0),
        cost_per_unit: Math.max(0, parseFloat(editDraft.cost_per_unit) || 0),
        unit_size: Math.max(1, parseInt(editDraft.unit_size, 10) || 1),
      };
      const { error } = await supabase
        .from('consumable_items')
        .update(payload)
        .eq('id', editItem.id)
        .eq('organization_id', orgId);
      if (error) throw error;
      setItems(arr => arr.map(i => i.id === editItem.id ? { ...i, ...payload } : i));
      toast.success('Item updated');
      setEditItem(null);
    } catch (e) {
      console.error(e);
      toast.error('Failed to save');
    } finally {
      setSavingItem(false);
    }
  };

  const deleteConsumableItem = async (id, key) => {
    if (!isAdmin) return;
    if (!confirm('Delete this item? This cannot be undone.')) return;
    const prev = items;
    setItems(arr => arr.filter(i => i.id !== id));
    try {
      const { error } = await supabase.from('consumable_items').delete().eq('organization_id', orgId).eq('key', key);
      if (error) throw error;
    } catch (e) {
      toast.error('Failed to delete item');
      setItems(prev); // revert
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

  const toggleHistoryPo = (poId) =>
    setExpandedHistory((m) => ({ ...m, [poId]: !m[poId] }));

  const visibleOrderPos = useMemo(() => {
    const ids = poFilter ? filteredPoIds : poList.map((p) => p.id);
    return ids
      .map((id) => poList.find((p) => p.id === id))
      .filter(Boolean);
  }, [poFilter, filteredPoIds, poList]);

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

  const openCreatePoModal = () => setCreatePoModal({ open: true, name: "" });
  const closeCreatePoModal = () => {
    if (creatingPo) return;
    setCreatePoModal({ open: false, name: "" });
  };

  const createNewPo = async () => {
    const name = (createPoModal.name || "").trim();
    if (!name) {
      toast.error("Enter a PO name");
      return;
    }
    setCreatingPo(true);
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .insert({ organization_id: orgId, name, status: 'not_ordered' })
        .select('id')
        .single();
      if (error) throw error;
      setPoList((arr) => [{ id: data.id, name, status: 'not_ordered' }, ...arr]);
      setCreatePoModal({ open: false, name: "" });
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

  const deletePo = async (poId) => {
    if (!poId) return;
    if (!confirm('Delete this PO? Linked items will be moved back to Purchase Requests.')) return;
    setDeletingPo((m) => ({ ...m, [poId]: true }));
    try {
      const { error: moveErr } = await supabase
        .from("purchase_order_items")
        .update({ po_id: null, status: "outstanding" })
        .eq("organization_id", orgId)
        .eq("po_id", poId);
      if (moveErr) throw moveErr;

      const { error: delErr } = await supabase
        .from("purchase_orders")
        .delete()
        .eq("organization_id", orgId)
        .eq("id", poId);
      if (delErr) throw delErr;

      setPoList((arr) => arr.filter((p) => p.id !== poId));
      setPoItems((arr) => arr.map((it) => (it.po_id === poId ? { ...it, po_id: null, status: 'outstanding' } : it)));
      setExpandedHistory((m) => {
        const next = { ...m };
        delete next[poId];
        return next;
      });
      toast.success('PO deleted');
    } catch (e) {
      toast.error('Failed to delete PO');
    } finally {
      setDeletingPo((m) => ({ ...m, [poId]: false }));
    }
  };

  const orderedStatuses = ["not_ordered", "ordered", "received"];
  const getPoStatusLabel = (status) => {
    if (status === 'not_ordered') return 'In Progress';
    if (status === 'ordered') return 'Ordered';
    if (status === 'received') return 'Received';
    return (status || '').replace('_', ' ');
  };
  const getPoStatusBadge = (status) => {
    if (status === 'received') return 'badge-green';
    if (status === 'ordered') return 'badge-blue';
    return 'badge-amber';
  };

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

  const renderPoExpandedBody = (pid, po, items) => (
    <div className="space-y-3 rounded-xl border border-slate-500/30 bg-slate-800/25 p-3 md:p-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
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
              className="select-gradient-sm w-auto"
              value={po.status || "not_ordered"}
              onChange={(e) => updatePoMeta(pid, { status: e.target.value })}
            >
              {orderedStatuses.map((s) => (
                <option key={s} value={s}>{getPoStatusLabel(s)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            className="btn btn-3d-primary text-xs"
            onClick={async () => {
              let num = po.po_number;
              if (!num) {
                num = prompt('Enter PO number before marking as ordered');
              }
              if (!num) return;
              await updatePoMeta(pid, { po_number: num, status: 'ordered', ordered_date: new Date().toISOString().slice(0,10) });
            }}
          >
            PO Submitted
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Ordered</span>
            <input
              type="date"
              className="input input-sm w-44"
              defaultValue={po.ordered_date || ""}
              onBlur={(e) => updatePoMeta(pid, { ordered_date: e.target.value || null })}
            />
          </div>

          <button
            className="btn btn-3d-glass text-xs"
            onClick={() => openReceiveModal(pid)}
          >
            PO received
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Received</span>
            <input
              type="date"
              className="input input-sm w-44"
              defaultValue={po.received_date || ""}
              onBlur={(e) => updatePoMeta(pid, { received_date: e.target.value || null })}
            />
          </div>
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

      <div>
        <textarea
          className="textarea"
          rows={2}
          placeholder="PO comments"
          defaultValue={po.comments || ""}
          onBlur={(e) => updatePoMeta(pid, { comments: e.target.value })}
        />
      </div>

      <div className="pt-1 flex justify-end">
        <button
          className="btn btn-danger text-xs"
          disabled={!!deletingPo[pid]}
          onClick={() => deletePo(pid)}
        >
          {deletingPo[pid] ? 'Deleting…' : 'Delete PO'}
        </button>
      </div>
    </div>
  );

  return (
  <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex gap-2 border-b mb-2">
        <button
          className={`px-4 py-2 -mb-px border-b-2 font-medium text-sm ${tab === 'inventory' ? 'border-indigo-500 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => setTab('inventory')}
        >
          Inventory
        </button>
        <button
          className={`px-4 py-2 -mb-px border-b-2 font-medium text-sm ${tab === 'requests' ? 'border-indigo-500 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => setTab('requests')}
        >
          Purchase Requests
        </button>
        <button
          className={`px-4 py-2 -mb-px border-b-2 font-medium text-sm ${tab === 'orders' ? 'border-indigo-500 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => setTab('orders')}
        >
          Purchase Orders
        </button>
      </div>

      {tab === "inventory" && (
        <div className="card p-4">
          <div className="flex items-center mb-3 gap-3">
            <h2 className="font-medium">Inventory</h2>
            {isAdmin && (
              <button className="btn btn-3d-primary text-xs" onClick={addConsumableItem}>Add Item</button>
            )}
          </div>
          {loadingItems ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : (
            <div className="table-container">
              <table className="table text-[11px] md:text-sm">
                <thead>
                  <tr>
                    <th className="text-xs md:text-sm">Item</th>
                    <th className="w-24 text-center text-[10px] md:text-xs hidden md:table-cell">Reorder @</th>
                    <th className="md:w-28 text-xs md:text-sm">Count</th>
                      <th className="md:w-24 text-xs md:text-sm">Status</th>
                      <th className="md:w-40 text-xs md:text-sm">Actions</th>
                    {isAdmin && <th className="w-10 hidden md:table-cell" />}
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id || it.key}>
                      <td className="align-middle py-1">
                        {isAdmin && !(it.id || '').startsWith('temp-') ? (
                          <button
                            type="button"
                            aria-label={`Edit item ${it.label}`}
                            onClick={() => startEditItem(it)}
                            className="block truncate max-w-[140px] md:max-w-none leading-snug text-left font-medium hover:underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
                          >{it.label}</button>
                        ) : (
                          <span className="block truncate max-w-[140px] md:max-w-none leading-snug">{it.label}</span>
                        )}
                      </td>
                      {/* Reorder threshold (desktop only) */}
                      <td className="align-middle py-1 hidden md:table-cell text-center">
                        {isAdmin ? (
                          <input
                            type="number"
                            min={0}
                            className="input input-sm w-20 text-right"
                            value={it.reorder_value ?? 0}
                            onFocus={(e)=>e.target.select()}
                            onChange={(e)=>{
                              const v=e.target.value;
                              if(v===''){ saveReorderValue(it.key,0); return; }
                              const num=Math.max(0, parseInt(v,10));
                              saveReorderValue(it.key, Number.isFinite(num)?num:0);
                            }}
                          />
                        ) : (
                          <span>{it.reorder_value ?? 0}</span>
                        )}
                      </td>
                      <td className="align-middle py-1">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          className="input input-sm text-right text-[11px] md:text-sm w-16 md:w-20"
                          value={it.count}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === "") {
                              setItems(arr => arr.map(x => x.key === it.key ? { ...x, count: "" } : x));
                              return;
                            }
                            const num = Math.max(0, parseInt(v, 10));
                            saveItemCount(it.key, Number.isFinite(num) ? num : 0);
                          }}
                          onBlur={(e) => { if (e.target.value === "") saveItemCount(it.key, 0); }}
                        />
                      </td>
                      <td className="align-middle py-1">
                        {(() => {
                          const rv = it.reorder_value || 0;
                          const c = Number(it.count) || 0;
                          let badgeClass = 'badge-gray';
                          let label = '—';
                          if (rv > 0) {
                            if (c <= rv) { badgeClass='badge-red'; label='Reorder'; }
                            else if (c <= rv * 1.5) { badgeClass='badge-amber'; label='Low'; }
                            else { badgeClass='badge-green'; label='OK'; }
                          }
                          return <span className={`badge ${badgeClass} text-[9px] md:text-[10px]`}>{label}</span>;
                        })()}
                      </td>
                      <td className="align-middle py-1">
                        <div className="flex gap-2 flex-wrap items-center">
                          <button
                            className="btn btn-xs md:btn-sm text-[10px] md:text-xs bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 border-0 shadow-sm"
                            onClick={() => addToPurchaseRequest(it.key)}
                          >Order More</button>
                          {/* Edit via clicking item name now; button removed */}
                        </div>
                      </td>
                      {isAdmin && (
                        <td className="hidden md:table-cell">
                          <button className="btn text-xs" title="Delete item" onClick={() => deleteConsumableItem(it.id, it.key)}>✕</button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 7} className="text-xs md:text-sm text-gray-500 text-center py-4">
                        {isAdmin ? 'No items yet. Add your first item.' : 'No consumable items configured. Ask an admin to add items.'}
                      </td>
                    </tr>
                  )}
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
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="font-medium">Requested items</h3>
              <button className="btn text-xs" disabled={creatingPo} onClick={openCreatePoModal}>
                {creatingPo ? 'Creating…' : 'Create New PO'}
              </button>
            </div>
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
                        <td className="text-right">
                          <input
                            type="number"
                            min={1}
                            className="input input-sm w-20 text-right"
                            value={it.quantity}
                            onChange={(e) => {
                              const v = e.target.value;
                              let num = parseInt(v, 10);
                              if (!Number.isFinite(num) || num < 1) num = 1;
                              // Optimistic local update
                              setUnassignedItems(arr => arr.map(x => x.id === it.id ? { ...x, quantity: num } : x));
                            }}
                            onBlur={async (e) => {
                              let num = parseInt(e.target.value, 10);
                              if (!Number.isFinite(num) || num < 1) num = 1;
                              try {
                                await supabase.from('purchase_order_items').update({ quantity: num }).eq('id', it.id);
                              } catch (err) {
                                toast.error('Failed to update quantity');
                              }
                            }}
                          />
                        </td>
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
            <button className="btn" disabled={creatingPo} onClick={openCreatePoModal}>{creatingPo ? 'Creating…' : 'Create New PO'}</button>
            <span className="text-sm text-gray-600">All purchase orders</span>
          </div>
          <div className="card p-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm text-gray-700">Filter by PO</label>
              <select className="select-gradient-sm w-auto" value={poFilter} onChange={(e) => setPoFilter(e.target.value)}>
                <option value="">All</option>
                {poList
                  .filter((p) => p.po_number)
                  .map((p) => (
                    <option key={p.id} value={String(p.po_number)}>{p.po_number}</option>
                  ))}
              </select>
              <label className="text-sm text-gray-700 ml-4">Items status</label>
              <select className="select-gradient-sm w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="outstanding">Outstanding</option>
                <option value="ordered">Ordered</option>
                <option value="received">Received</option>
              </select>
            </div>
          </div>

          {visibleOrderPos.length === 0 ? (
            <div className="card p-4 text-sm text-gray-500">No purchase orders to show.</div>
          ) : (
            <>
              <div className="card p-4 hidden md:block">
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
                      </tr>
                    </thead>
                    <tbody>
                      {visibleOrderPos.map((po) => {
                        const isOpen = !!expandedHistory[po.id];
                        const items = visiblePoItems.filter((i) => i.po_id === po.id);
                        const statusBadge = getPoStatusBadge(po.status || 'not_ordered');
                        return (
                          <Fragment key={po.id}>
                            <tr>
                              <td>
                                <button
                                  className="btn text-xs w-11 h-11 p-0 rounded-full"
                                  onClick={() => toggleHistoryPo(po.id)}
                                  aria-expanded={isOpen}
                                  aria-controls={`po-details-${po.id}`}
                                >
                                  {isOpen ? '-' : '+'}
                                </button>
                              </td>
                              <td>{po.name || '(unnamed PO)'}</td>
                              <td>{po.po_number || '—'}</td>
                              <td>
                                <span className={`badge ${statusBadge} capitalize`}>
                                  {getPoStatusLabel(po.status || 'not_ordered')}
                                </span>
                              </td>
                              <td>{po.ordered_date || ''}</td>
                              <td>{po.received_date || ''}</td>
                              <td className="text-right">{items.length}</td>
                            </tr>
                            {isOpen && (
                              <tr>
                                <td colSpan={7} id={`po-details-${po.id}`}>
                                  <div className="p-2">
                                    {renderPoExpandedBody(po.id, po, items)}
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
              </div>

              <div className="md:hidden space-y-3">
                {visibleOrderPos.map((po) => {
                  const isOpen = !!expandedHistory[po.id];
                  const items = visiblePoItems.filter((i) => i.po_id === po.id);
                  const statusBadge = getPoStatusBadge(po.status || 'not_ordered');
                  return (
                    <div key={po.id} className="card p-3">
                      <button
                        className="w-full flex items-start justify-between gap-3 text-left"
                        onClick={() => toggleHistoryPo(po.id)}
                        aria-expanded={isOpen}
                        aria-controls={`po-mobile-details-${po.id}`}
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="font-medium truncate">{po.name || '(unnamed PO)'}</div>
                          <div className="text-xs text-gray-400">PO # {po.po_number || '—'}</div>
                          <div className="text-xs text-gray-400">Ordered {po.ordered_date || '—'} · Received {po.received_date || '—'}</div>
                          <div className="text-xs text-gray-400">Items {items.length}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`badge ${statusBadge} capitalize`}>
                            {getPoStatusLabel(po.status || 'not_ordered')}
                          </span>
                          <span className="btn text-xs w-11 h-11 p-0 rounded-full" aria-hidden="true">{isOpen ? '-' : '+'}</span>
                        </div>
                      </button>
                      {isOpen && (
                        <div id={`po-mobile-details-${po.id}`} className="mt-3 border-t border-slate-600/40 pt-3">
                          {renderPoExpandedBody(po.id, po, items)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
      {createPoModal.open && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="create-po-title">
          <div className="card p-4 w-full max-w-md mx-auto">
            <h3 id="create-po-title" className="font-medium mb-3">Create New PO</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createNewPo();
              }}
              className="space-y-4"
            >
              <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-700" htmlFor="create-po-name">PO name</label>
                <input
                  id="create-po-name"
                  className="input input-sm"
                  placeholder="Enter a name for the new PO"
                  value={createPoModal.name}
                  onChange={(e) => setCreatePoModal((m) => ({ ...m, name: e.target.value }))}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn text-xs" onClick={closeCreatePoModal} disabled={creatingPo}>Cancel</button>
                <button type="submit" className="btn btn-primary text-xs" disabled={creatingPo || !createPoModal.name.trim()}>
                  {creatingPo ? 'Creating…' : 'Create PO'}
                </button>
              </div>
            </form>
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
      {editItem && (
        <div className="modal-overlay hidden md:flex" role="dialog" aria-modal="true" aria-labelledby="edit-item-title">
          <div className="card p-4 w-full max-w-md mx-auto">
            <h3 id="edit-item-title" className="font-medium mb-4">Edit Item</h3>
            <div className="space-y-3 text-sm">
              <div className="flex flex-col gap-1">
                <label className="text-gray-600">Label</label>
                <input className="input input-sm" value={editDraft.label} onChange={e => setEditDraft(d => ({ ...d, label: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-gray-600">Reorder threshold</label>
                <input type="number" min={0} className="input input-sm" value={editDraft.reorder_value} onChange={e => setEditDraft(d => ({ ...d, reorder_value: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-gray-600">Unit size (physical items per unit)</label>
                <input type="number" min={1} className="input input-sm" value={editDraft.unit_size} onChange={e => setEditDraft(d => ({ ...d, unit_size: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-gray-600">Cost per unit</label>
                <input type="number" min={0} step="0.01" className="input input-sm" value={editDraft.cost_per_unit} onChange={e => setEditDraft(d => ({ ...d, cost_per_unit: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button className="btn text-xs" disabled={savingItem} onClick={() => setEditItem(null)}>Cancel</button>
              <button className="btn btn-primary text-xs" disabled={savingItem} onClick={saveEditItem}>{savingItem ? 'Saving…' : 'Save'}</button>
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
  <select className="select-gradient-sm w-56" value={sel} onChange={(e) => setSel(e.target.value)}>
        <option value="">Select a PO…</option>
        {active.map((p) => (
          <option key={p.id} value={p.id}>{p.name || '(unnamed PO)'}{p.po_number ? ` — ${p.po_number}` : ''}</option>
        ))}
      </select>
      <button className="btn btn-3d-primary text-xs" disabled={assigning[item.id] || !sel} onClick={() => onAssign(item.id, sel)}>
        {assigning[item.id] ? 'Adding…' : 'Add'}
      </button>
    </div>
  );
}
