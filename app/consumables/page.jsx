"use client";
import { useEffect, useMemo, useState } from "react";
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
  const [tab, setTab] = useState("inventory"); // 'inventory' | 'requests'

  // Inventory
  const [items, setItems] = useState([]); // list of {key,label,count}
  const [loadingItems, setLoadingItems] = useState(false);
  const [orderNumbers, setOrderNumbers] = useState({}); // per-inventory-item order number input

  // Purchase requests
  const [poList, setPoList] = useState([]); // {id, po_number, status, ordered_date, received_date, comments}
  const [poItems, setPoItems] = useState([]); // items across POs
  const [poFilter, setPoFilter] = useState(""); // po_number or ""
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'outstanding' | 'ordered' | 'received'
  const [assigning, setAssigning] = useState({}); // id->loading
  const [poLoading, setPoLoading] = useState(false);

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
    const order_number = (orderNumbers[key] || "").trim();
    if (!order_number) {
      return toast.error("Enter an order number first");
    }
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
        .insert({ organization_id: orgId, po_id: null, order_number, item_key: item.key, label: item.label, quantity, status: "outstanding" });
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
          .select("id, po_number, status, ordered_date, received_date, comments")
          .eq("organization_id", org)
          .order("created_at", { ascending: false }),
        supabase
          .from("purchase_order_items")
      .select("id, po_id, order_number, item_key, label, quantity, status")
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

  const requestGroups = useMemo(() => {
    const groups = {};
    for (const it of poItems) {
      if (it.po_id == null) {
        const key = (it.order_number || "").trim();
        if (!groups[key]) groups[key] = [];
        groups[key].push(it);
      }
    }
    return groups;
  }, [poItems]);
  const visiblePoItems = useMemo(() => {
    let items = poItems.filter((i) => i.po_id && filteredPoIds.includes(i.po_id));
    if (statusFilter !== "all") items = items.filter((i) => i.status === statusFilter);
    return items;
  }, [poItems, filteredPoIds, statusFilter]);

  const ensurePoForAssign = async (poNumberInput) => {
    // Find or create a PO by provided number; when creating, set status to 'ordered'
    const po_number = (poNumberInput || "").trim();
    if (!po_number) throw new Error("PO number required");
    const { data: existing } = await supabase
      .from("purchase_orders")
      .select("id")
      .eq("organization_id", orgId)
      .eq("po_number", po_number)
      .maybeSingle();
    if (existing?.id) return existing.id;
    const { data: created, error } = await supabase
      .from("purchase_orders")
      .insert({ organization_id: orgId, po_number, status: "ordered", ordered_date: new Date().toISOString().slice(0,10) })
      .select("id")
      .single();
    if (error) throw error;
    return created.id;
  };

  const assignItemToPo = async (itemId) => {
    const poNum = prompt("Enter PO number to assign this item");
    if (!poNum) return;
    setAssigning((m) => ({ ...m, [itemId]: true }));
    try {
      const poId = await ensurePoForAssign(poNum);
      const { error } = await supabase
        .from("purchase_order_items")
        .update({ po_id: poId, status: "ordered" })
        .eq("id", itemId)
        .eq("organization_id", orgId);
      if (error) throw error;
      setPoItems((arr) => arr.map((i) => (i.id === itemId ? { ...i, po_id: poId, status: "ordered" } : i)));
      toast.success("Assigned to PO");
    } catch (e) {
      toast.error("Could not assign to PO");
    } finally {
      setAssigning((m) => ({ ...m, [itemId]: false }));
    }
  };

  const placeOrderForGroup = async (groupOrderNumber) => {
    const ord = (groupOrderNumber || "").trim();
    const itemsInGroup = requestGroups[ord] || [];
    if (itemsInGroup.length === 0) return;
    try {
      // Create a PO with status 'ordered' and no PO number yet
      const { data: created, error: poErr } = await supabase
        .from("purchase_orders")
        .insert({ organization_id: orgId, status: "ordered", ordered_date: new Date().toISOString().slice(0,10) })
        .select("id")
        .single();
      if (poErr) throw poErr;
      const poId = created.id;
      // Move all items in the group onto the PO and mark ordered
      const ids = itemsInGroup.map((i) => i.id);
      const { error: updErr } = await supabase
        .from("purchase_order_items")
        .update({ po_id: poId, status: "ordered" })
        .in("id", ids)
        .eq("organization_id", orgId);
      if (updErr) throw updErr;
      // Update local state
      setPoItems((arr) => arr.map((i) => (ids.includes(i.id) ? { ...i, po_id: poId, status: "ordered" } : i)));
      await loadPurchaseData(orgId);
      toast.success("Order placed; items moved to PO");
    } catch {
      toast.error("Failed to place order");
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
    try {
      const { error } = await supabase
        .from("purchase_order_items")
        .update({ status })
        .eq("id", id)
        .eq("organization_id", orgId);
      if (error) throw error;
      setPoItems((arr) => arr.map((i) => (i.id === id ? { ...i, status } : i)));
    } catch {
      /* ignore */
    }
  };

  const assignPoNumber = async (poId, value) => {
    const po_number = value || null;
    await updatePoMeta(poId, { po_number });
  };

  const orderedStatuses = ["not_ordered", "ordered", "received"];

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2">
        <button className={`btn ${tab === "inventory" ? "btn-primary" : ""}`} onClick={() => setTab("inventory")}>
          Current inventory
        </button>
        <button className={`btn ${tab === "requests" ? "btn-primary" : ""}`} onClick={() => setTab("requests")}>
          Purchase requests
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
                    <th className="w-36">Order #</th>
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
                        <input
                          type="text"
                          className="input input-sm w-32"
                          placeholder="Order number"
                          value={orderNumbers[it.key] || ""}
                          onChange={(e) => setOrderNumbers((m) => ({ ...m, [it.key]: e.target.value }))}
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
          {/* Requested items grouped by Order # (pre-PO) */}
          {Object.keys(requestGroups).length === 0 ? (
            <div className="card p-4 text-sm text-gray-500">No requested items yet. Add items with an Order # from the Inventory tab.</div>
          ) : (
            Object.entries(requestGroups).map(([ord, list]) => (
              <div key={ord || 'no-order'} className="card p-4">
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="font-medium">Order number: {ord || '(none)'}</h3>
                  <button className="btn text-xs ml-auto" onClick={() => placeOrderForGroup(ord)}>
                    Place order (create PO)
                  </button>
                </div>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th className="w-20 text-right">Qty</th>
                        <th className="w-28">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((it) => (
                        <tr key={it.id}>
                          <td>{it.label}</td>
                          <td className="text-right">{it.quantity}</td>
                          <td className="text-xs capitalize">{it.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}

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

          {filteredPoIds.length === 0 ? (
            <div className="card p-4 text-sm text-gray-500">No purchase orders to show.</div>
          ) : (
            filteredPoIds.map((pid) => {
              const po = poList.find((p) => p.id === pid) || {};
              const items = visiblePoItems.filter((i) => i.po_id === pid);
              return (
                <div key={pid} className="card p-4">
                  <div className="flex flex-wrap items-center gap-3 mb-3">
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
                          const num = po.po_number || prompt('Enter PO number to mark as ordered');
                          if (!num) return;
                          await updatePoMeta(pid, { po_number: num, status: 'ordered', ordered_date: new Date().toISOString().slice(0,10) });
                        }}
                      >
                        Order placed
                      </button>
                      <button
                        className="btn text-xs"
                        onClick={async () => {
                          const date = prompt('Enter received date (YYYY-MM-DD)');
                          if (!date) return;
                          await updatePoMeta(pid, { status: 'received', received_date: date });
                        }}
                      >
                        PO received
                      </button>
                    </div>
                  </div>

                  <div className="mb-3">
                    <textarea
                      className="textarea"
                      rows={2}
                      placeholder="PO comments"
                      defaultValue={po.comments || ""}
                      onBlur={(e) => updatePoMeta(pid, { comments: e.target.value })}
                    />
                  </div>

                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th className="w-20 text-right">Qty</th>
                          <th className="w-36">Mark</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((it) => (
                          <tr key={it.id}>
                            <td>{it.label}</td>
                            <td className="text-right">{it.quantity}</td>
                            <td>
                              <div className="flex gap-2">
                                <button className="btn text-xs" onClick={() => markItemStatus(it.id, "outstanding")}>Outstanding</button>
                                <button className="btn text-xs" onClick={() => markItemStatus(it.id, "ordered")}>Ordered</button>
                                <button className="btn text-xs" onClick={() => markItemStatus(it.id, "received")}>Received</button>
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
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
