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
  const [deletingItem, setDeletingItem] = useState(false);
  const [editDraft, setEditDraft] = useState({ label: '', reorder_value: 0, cost_per_unit: 0, unit_size: 1 });
  const [addItemModal, setAddItemModal] = useState({
    open: false,
    label: "",
    reorder_value: 0,
    unit_size: 1,
    cost_per_unit: 0,
  });
  const [addingItem, setAddingItem] = useState(false);
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

  const formatMoney = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "AUD" }).format(n);
  };

  const addConsumableItem = async () => {
    if (!isAdmin) return;
    setAddItemModal({ open: true, label: "", reorder_value: 0, unit_size: 1, cost_per_unit: 0 });
  };

  const closeAddItemModal = () => {
    if (addingItem) return;
    setAddItemModal({ open: false, label: "", reorder_value: 0, unit_size: 1, cost_per_unit: 0 });
  };

  const submitAddConsumableItem = async () => {
    if (!isAdmin) return;
    const label = (addItemModal.label || "").trim();
    if (!label) return;

    let baseKey = label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'item';
    let key = baseKey;
    const existingKeys = new Set(items.map(i => i.key));
    let i = 1;
    while (existingKeys.has(key)) {
      key = `${baseKey}_${i++}`;
    }

    const reorderValue = Math.max(0, parseInt(addItemModal.reorder_value, 10) || 0);
    const unitSize = Math.max(1, parseInt(addItemModal.unit_size, 10) || 1);
    const costPerUnit = Math.max(0, parseFloat(addItemModal.cost_per_unit) || 0);

    setAddingItem(true);
    try {
      const { data, error } = await supabase
        .from('consumable_items')
        .insert({
          organization_id: orgId,
          key,
          label,
          count: 0,
          reorder_value: reorderValue,
          cost_per_unit: costPerUnit,
          unit_size: unitSize,
        })
        .select('id, key, label, count, include_in_report, reorder_value, cost_per_unit, unit_size')
        .single();
      if (error) throw error;
      setItems(arr => [...arr, data]);
      toast.success('Item added');
      closeAddItemModal();
    } catch (e) {
      toast.error('Failed to add item');
    } finally {
      setAddingItem(false);
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
    if (!isAdmin) {
      toast.error('Admins only');
      return;
    }
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
    if (!isAdmin) {
      toast.error('Admins only');
      return;
    }
    if (!confirm('Delete this item? This cannot be undone.')) return;
    const prev = items;
    setItems(arr => arr.filter(i => i.id !== id));
    setDeletingItem(true);
    try {
      const { error } = await supabase.from('consumable_items').delete().eq('organization_id', orgId).eq('key', key);
      if (error) throw error;
      if (editItem?.id === id) setEditItem(null);
      toast.success('Item deleted');
    } catch (e) {
      toast.error('Failed to delete item');
      setItems(prev); // revert
    } finally {
      setDeletingItem(false);
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

  const getInventoryStatusPillClass = (status) => {
    if (status === 'badge-red') {
      return 'border border-rose-300/45 bg-gradient-to-r from-rose-500/30 to-red-500/26 text-rose-50 shadow-[0_0_0_1px_rgba(251,113,133,0.18),0_10px_24px_rgba(190,24,93,0.22)]';
    }
    if (status === 'badge-amber') {
      return 'border border-amber-300/45 bg-gradient-to-r from-amber-400/30 to-orange-500/24 text-amber-50 shadow-[0_0_0_1px_rgba(251,191,36,0.18),0_10px_24px_rgba(217,119,6,0.2)]';
    }
    if (status === 'badge-green') {
      return 'border border-emerald-300/45 bg-gradient-to-r from-emerald-400/28 to-green-500/24 text-emerald-50 shadow-[0_0_0_1px_rgba(52,211,153,0.18),0_10px_24px_rgba(5,150,105,0.2)]';
    }
    return 'border border-slate-300/20 bg-slate-700/60 text-slate-100 shadow-[0_8px_18px_rgba(15,23,42,0.24)]';
  };

  const renderInventoryStatusIcon = (status) => {
    if (status === 'badge-red') {
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-3.5 w-3.5 shrink-0">
          <path d="M10 3.2 17 15.8H3L10 3.2Z" />
          <path d="M10 7.1v4.7" />
          <circle cx="10" cy="14.1" r="0.75" fill="currentColor" stroke="none" />
        </svg>
      );
    }

    if (status === 'badge-amber') {
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-3.5 w-3.5 shrink-0">
          <path d="M4 12.8c1.4-2.5 3.3-3.8 5.8-3.8 1.8 0 3.4.7 4.9 2.2" />
          <path d="m12.2 7.1 2.7 4.1-4.8.5" />
        </svg>
      );
    }

    if (status === 'badge-green') {
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.1" className="h-3.5 w-3.5 shrink-0">
          <path d="m4.6 10.2 3.3 3.3 7.5-7.4" />
        </svg>
      );
    }

    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-2.5 w-2.5 shrink-0 opacity-80">
        <circle cx="10" cy="10" r="4" />
      </svg>
    );
  };

  const getPoStatusPillClass = (status) => {
    if (status === 'badge-green') {
      return 'border border-emerald-300/45 bg-gradient-to-r from-emerald-400/28 to-green-500/24 text-emerald-50 shadow-[0_0_0_1px_rgba(52,211,153,0.18),0_10px_24px_rgba(5,150,105,0.2)]';
    }
    if (status === 'badge-blue') {
      return 'border border-sky-300/45 bg-gradient-to-r from-sky-400/28 to-indigo-500/26 text-sky-50 shadow-[0_0_0_1px_rgba(56,189,248,0.18),0_10px_24px_rgba(37,99,235,0.2)]';
    }
    return 'border border-amber-300/45 bg-gradient-to-r from-amber-400/30 to-orange-500/24 text-amber-50 shadow-[0_0_0_1px_rgba(251,191,36,0.18),0_10px_24px_rgba(217,119,6,0.2)]';
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
    <div className="space-y-3 rounded-[20px] border border-white/10 bg-slate-950/35 p-3 md:p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">PO Name</span>
            <input
              className="input input-sm w-56"
              placeholder="Enter PO name"
              defaultValue={po.name || ""}
              onBlur={(e) => updatePoMeta(pid, { name: e.target.value || null })}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">PO #</span>
            <input
              className="input input-sm w-40"
              placeholder="Enter PO number"
              defaultValue={po.po_number || ""}
              onBlur={(e) => assignPoNumber(pid, e.target.value.trim())}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Status</span>
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
            <span className="text-sm text-slate-400">Ordered</span>
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
            <span className="text-sm text-slate-400">Received</span>
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
                <td colSpan={3} className="text-sm text-slate-500 text-center">No items on this PO.</td>
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

  const tabButtonClass = (key) =>
    [
      "inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-medium transition-base",
      tab === key
        ? "border-cyan-300/35 bg-gradient-to-r from-cyan-400/20 via-sky-400/14 to-indigo-500/20 text-white shadow-[0_0_0_1px_rgba(34,211,238,0.14),0_12px_30px_rgba(14,116,144,0.18)]"
        : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/16 hover:bg-white/[0.06] hover:text-slate-200",
    ].join(" ");

  return (
  <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6 text-slate-200">
      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
        <button
          className={tabButtonClass('inventory')}
          onClick={() => setTab('inventory')}
        >
          Inventory
        </button>
        <button
          className={tabButtonClass('requests')}
          onClick={() => setTab('requests')}
        >
          Purchase Requests
        </button>
        <button
          className={tabButtonClass('orders')}
          onClick={() => setTab('orders')}
        >
          Purchase Orders
        </button>
      </div>

      {tab === "inventory" && (
        <div className="card p-4">
          <div className="flex items-center mb-3 gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Consumables</div>
              <h2 className="font-medium text-slate-50">Inventory</h2>
            </div>
            {isAdmin && (
              <button className="btn btn-3d-primary text-xs" onClick={addConsumableItem}>Add Item</button>
            )}
          </div>
          {loadingItems ? (
            <div className="text-sm text-slate-400">Loading…</div>
          ) : (
            <div className="table-container">
              <table className="table text-[11px] md:text-sm">
                <thead>
                  <tr>
                    <th className="text-xs md:text-sm">Item</th>
                    <th className="w-24 text-center text-[10px] md:text-xs hidden md:table-cell">Reorder @</th>
                    <th className="md:w-28 text-xs md:text-sm">Count</th>
                    <th className="md:w-28 text-xs md:text-sm text-right hidden md:table-cell">Cost / Unit</th>
                    <th className="md:w-32 text-xs md:text-sm text-right hidden md:table-cell">Stock Value</th>
                    <th className="md:w-24 text-xs md:text-sm">Status</th>
                    <th className="md:w-40 text-xs md:text-sm">Actions</th>
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
                            className="block truncate max-w-[140px] md:max-w-none leading-snug text-left font-medium text-slate-100 hover:text-cyan-200 hover:underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded"
                          >{it.label}</button>
                        ) : (
                          <span className="block truncate max-w-[140px] md:max-w-none leading-snug text-slate-100">{it.label}</span>
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
                          className="input input-sm no-spinner text-right text-[11px] md:text-sm w-16 md:w-20"
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
                      <td className="align-middle py-1 text-right hidden md:table-cell">
                        {formatMoney(it.cost_per_unit || 0)}
                      </td>
                      <td className="align-middle py-1 text-right hidden md:table-cell">
                        {formatMoney((Number(it.count) || 0) * (Number(it.cost_per_unit) || 0))}
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
                          return (
                            <span
                              className={[
                                'inline-flex h-7 min-w-[72px] whitespace-nowrap items-center justify-center gap-1.5 rounded-full px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] md:min-w-[84px] md:text-[9px]',
                                getInventoryStatusPillClass(badgeClass),
                              ].join(' ')}
                            >
                              {renderInventoryStatusIcon(badgeClass)}
                              {label}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="align-middle py-1">
                        <div className="flex gap-2 flex-wrap items-center">
                          <button
                            type="button"
                            aria-label={`Order more ${it.label}`}
                            title={`Order more ${it.label}`}
                            onClick={() => addToPurchaseRequest(it.key)}
                            className="inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-cyan-300/45 bg-gradient-to-br from-cyan-400/85 via-sky-400/82 to-teal-400/78 px-2 text-slate-950 shadow-[0_0_0_1px_rgba(34,211,238,0.28),0_12px_28px_rgba(8,145,178,0.34),inset_0_1px_0_rgba(255,255,255,0.42)] transition-base hover:from-cyan-300 hover:via-sky-300 hover:to-teal-300 hover:shadow-[0_0_0_1px_rgba(103,232,249,0.34),0_16px_34px_rgba(8,145,178,0.4),inset_0_1px_0_rgba(255,255,255,0.5)] focus:outline-none focus:ring-2 focus:ring-cyan-300/65 focus:ring-offset-2 focus:ring-offset-slate-950 active:translate-y-[1px]"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.9" className="h-4.5 w-4.5 drop-shadow-[0_1px_0_rgba(255,255,255,0.18)]">
                              <path d="M12 5v14" />
                              <path d="M5 12h14" />
                            </svg>
                          </button>
                          {/* Edit via clicking item name now; button removed */}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-xs md:text-sm text-slate-500 text-center py-4">
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

      {addItemModal.open && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="add-item-title">
          <div className="card p-4 w-full max-w-md mx-auto border border-white/10 bg-slate-950/90">
            <h3 id="add-item-title" className="font-medium mb-4 text-slate-50">Add Consumable Item</h3>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                submitAddConsumableItem();
              }}
            >
              <div className="flex flex-col gap-1">
                <label className="text-sm text-slate-300">Item label</label>
                <input
                  className="input input-sm"
                  placeholder="e.g. Core Tray"
                  value={addItemModal.label}
                  onChange={(e) => setAddItemModal((m) => ({ ...m, label: e.target.value }))}
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm text-slate-300">Reorder threshold</label>
                  <input
                    type="number"
                    min={0}
                    className="input input-sm"
                    value={addItemModal.reorder_value}
                    onChange={(e) => setAddItemModal((m) => ({ ...m, reorder_value: e.target.value }))}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm text-slate-300">Unit size</label>
                  <input
                    type="number"
                    min={1}
                    className="input input-sm"
                    value={addItemModal.unit_size}
                    onChange={(e) => setAddItemModal((m) => ({ ...m, unit_size: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm text-slate-300">Cost per unit</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="input input-sm"
                  placeholder="0.00"
                  value={addItemModal.cost_per_unit}
                  onChange={(e) => setAddItemModal((m) => ({ ...m, cost_per_unit: e.target.value }))}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn text-xs" onClick={closeAddItemModal} disabled={addingItem}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary text-xs"
                  disabled={addingItem || !(addItemModal.label || "").trim()}
                >
                  {addingItem ? 'Adding…' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {tab === "requests" && (
        <div className="space-y-4">
          {/* Requested items not yet assigned to a PO */}
          <div className="card p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Consumables</div>
                <h3 className="font-medium text-slate-50">Requested items</h3>
              </div>
              <button className="btn text-xs" disabled={creatingPo} onClick={openCreatePoModal}>
                {creatingPo ? 'Creating…' : 'Create New PO'}
              </button>
            </div>
            {unassignedItems.length === 0 ? (
              <div className="text-sm text-slate-500">No requested items yet.</div>
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
                            <span className="text-xs text-slate-500">Create a PO on the Purchase Orders tab before assigning items.</span>
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
            <span className="text-sm text-slate-400">All purchase orders</span>
          </div>
          <div className="card p-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm text-slate-300">Filter by PO</label>
              <select className="select-gradient-sm w-auto" value={poFilter} onChange={(e) => setPoFilter(e.target.value)}>
                <option value="">All</option>
                {poList
                  .filter((p) => p.po_number)
                  .map((p) => (
                    <option key={p.id} value={String(p.po_number)}>{p.po_number}</option>
                  ))}
              </select>
              <label className="text-sm text-slate-300 ml-4">Items status</label>
              <select className="select-gradient-sm w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="outstanding">Outstanding</option>
                <option value="ordered">Ordered</option>
                <option value="received">Received</option>
              </select>
            </div>
          </div>

          {visibleOrderPos.length === 0 ? (
            <div className="card p-4 text-sm text-slate-500">No purchase orders to show.</div>
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
                                <span className={[
                                  'inline-flex h-8 min-w-[108px] whitespace-nowrap items-center justify-center rounded-full px-3 py-1.5 text-[8px] font-semibold uppercase tracking-[0.14em] md:text-[9px]',
                                  getPoStatusPillClass(statusBadge),
                                ].join(' ')}>
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
                          <div className="font-medium truncate text-slate-100">{po.name || '(unnamed PO)'}</div>
                          <div className="text-xs text-slate-400">PO # {po.po_number || '—'}</div>
                          <div className="text-xs text-slate-400">Ordered {po.ordered_date || '—'} · Received {po.received_date || '—'}</div>
                          <div className="text-xs text-slate-400">Items {items.length}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={[
                            'inline-flex h-8 min-w-[96px] whitespace-nowrap items-center justify-center rounded-full px-3 py-1.5 text-[8px] font-semibold uppercase tracking-[0.14em] md:text-[9px]',
                            getPoStatusPillClass(statusBadge),
                          ].join(' ')}>
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
          <div className="card p-4 w-full max-w-md mx-auto border border-white/10 bg-slate-950/90">
            <h3 id="create-po-title" className="font-medium mb-3 text-slate-50">Create New PO</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createNewPo();
              }}
              className="space-y-4"
            >
              <div className="flex flex-col gap-1">
                <label className="text-sm text-slate-300" htmlFor="create-po-name">PO name</label>
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
          <div className="card p-4 border border-white/10 bg-slate-950/90" role="dialog" aria-modal="true" aria-labelledby="rcv-title">
            <h3 id="rcv-title" className="font-medium mb-3 text-slate-50">Mark PO as received</h3>
            <div className="flex items-center gap-3 mb-4">
              <label className="text-sm text-slate-300" htmlFor="rcv-date">Received date</label>
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
      {editItem && isAdmin && (
        <div className="modal-overlay hidden md:flex" role="dialog" aria-modal="true" aria-labelledby="edit-item-title">
          <div className="card p-4 w-full max-w-md mx-auto border border-white/10 bg-slate-950/90">
            <h3 id="edit-item-title" className="font-medium mb-4 text-slate-50">Edit Item</h3>
            <div className="space-y-3 text-sm">
              <div className="flex flex-col gap-1">
                <label className="text-slate-300">Label</label>
                <input className="input input-sm" value={editDraft.label} onChange={e => setEditDraft(d => ({ ...d, label: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-300">Reorder threshold</label>
                <input type="number" min={0} className="input input-sm" value={editDraft.reorder_value} onChange={e => setEditDraft(d => ({ ...d, reorder_value: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-300">Unit size (physical items per unit)</label>
                <input type="number" min={1} className="input input-sm" value={editDraft.unit_size} onChange={e => setEditDraft(d => ({ ...d, unit_size: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-300">Cost per unit</label>
                <input type="number" min={0} step="0.01" className="input input-sm" value={editDraft.cost_per_unit} onChange={e => setEditDraft(d => ({ ...d, cost_per_unit: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                className="btn btn-danger text-xs mr-auto"
                disabled={savingItem || deletingItem}
                onClick={() => deleteConsumableItem(editItem.id, editItem.key)}
              >
                {deletingItem ? 'Deleting…' : 'Delete item'}
              </button>
              <button className="btn text-xs" disabled={savingItem || deletingItem} onClick={() => setEditItem(null)}>Cancel</button>
              <button className="btn btn-primary text-xs" disabled={savingItem || deletingItem} onClick={saveEditItem}>{savingItem ? 'Saving…' : 'Save'}</button>
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
