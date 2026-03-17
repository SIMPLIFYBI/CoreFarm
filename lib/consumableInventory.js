export function getConsumableStatusMeta(count, reorderValue) {
  const numericCount = Number(count) || 0;
  const numericReorder = Number(reorderValue) || 0;

  if (numericReorder <= 0) {
    return { badgeClass: "badge-gray", label: "-", isLow: false };
  }

  if (numericCount <= numericReorder) {
    return { badgeClass: "badge-red", label: "Reorder", isLow: true };
  }

  if (numericCount <= numericReorder * 1.5) {
    return { badgeClass: "badge-amber", label: "Low", isLow: true };
  }

  return { badgeClass: "badge-green", label: "OK", isLow: false };
}

export function buildConsumableInventoryRows(items, inventoryRows, selectedLocationId = "all") {
  const rowsByItemId = new Map();

  for (const row of inventoryRows || []) {
    const itemRows = rowsByItemId.get(row.consumable_item_id) || [];
    itemRows.push(row);
    rowsByItemId.set(row.consumable_item_id, itemRows);
  }

  return (items || []).map((item) => {
    const itemRows = rowsByItemId.get(item.id) || [];

    if (selectedLocationId === "all") {
      if (itemRows.length > 0) {
        const totalCount = itemRows.reduce((sum, row) => sum + (Number(row.count) || 0), 0);
        const totalReorder = itemRows.reduce((sum, row) => sum + (Number(row.reorder_value) || 0), 0);
        return {
          ...item,
          count: totalCount,
          reorder_value: totalReorder,
          inventory_mode: "aggregate",
          has_location_rows: true,
          assigned_location_count: itemRows.length,
          location_inventory_id: null,
        };
      }

      return {
        ...item,
        count: Number(item.count) || 0,
        reorder_value: Number(item.reorder_value) || 0,
        inventory_mode: "legacy",
        has_location_rows: false,
        assigned_location_count: 0,
        location_inventory_id: null,
      };
    }

    const locationRow = itemRows.find((row) => row.location_id === selectedLocationId) || null;
    if (locationRow) {
      return {
        ...item,
        count: Number(locationRow.count) || 0,
        reorder_value: Number(locationRow.reorder_value) || 0,
        inventory_mode: "location",
        has_location_rows: true,
        assigned_location_count: itemRows.length,
        location_inventory_id: locationRow.id || null,
      };
    }

    return {
      ...item,
      count: 0,
      reorder_value: 0,
      inventory_mode: "location-empty",
      has_location_rows: itemRows.length > 0,
      assigned_location_count: itemRows.length,
      location_inventory_id: null,
    };
  });
}

export function buildLowConsumableRows(items, inventoryRows) {
  const rowsByItemId = new Map();

  for (const row of inventoryRows || []) {
    const itemRows = rowsByItemId.get(row.consumable_item_id) || [];
    itemRows.push(row);
    rowsByItemId.set(row.consumable_item_id, itemRows);
  }

  const lowRows = [];

  for (const item of items || []) {
    const itemRows = rowsByItemId.get(item.id) || [];

    if (itemRows.length > 0) {
      for (const row of itemRows) {
        const status = getConsumableStatusMeta(row.count, row.reorder_value);
        if (!status.isLow) continue;
        lowRows.push({
          id: row.id || `${item.id}:${row.location_id}`,
          key: item.key,
          label: item.label,
          count: Number(row.count) || 0,
          reorder_value: Number(row.reorder_value) || 0,
          location_id: row.location_id || null,
          location_name: row.asset_locations?.name || row.location_name || "Unassigned location",
          cost_per_unit: item.cost_per_unit,
          unit_size: item.unit_size,
        });
      }
      continue;
    }

    const status = getConsumableStatusMeta(item.count, item.reorder_value);
    if (!status.isLow) continue;
    lowRows.push({
      id: item.id || item.key,
      key: item.key,
      label: item.label,
      count: Number(item.count) || 0,
      reorder_value: Number(item.reorder_value) || 0,
      location_id: null,
      location_name: "All locations",
      cost_per_unit: item.cost_per_unit,
      unit_size: item.unit_size,
    });
  }

  return lowRows.sort((left, right) => {
    const locationCompare = String(left.location_name || "").localeCompare(String(right.location_name || ""));
    if (locationCompare !== 0) return locationCompare;
    return String(left.label || "").localeCompare(String(right.label || ""));
  });
}