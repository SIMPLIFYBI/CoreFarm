export const DEFAULT_TASK_TYPE_DEFS = [
  { key: "orientation", name: "Orientation", color: "#38bdf8", sortOrder: 10 },
  { key: "magnetic_susceptibility", name: "Magnetic Susceptibility", color: "#8b5cf6", sortOrder: 20 },
  { key: "whole_core_sampling", name: "Whole Core Sampling", color: "#22c55e", sortOrder: 30 },
  { key: "cutting", name: "Cutting", color: "#f97316", sortOrder: 40 },
  { key: "rqd", name: "RQD", color: "#f59e0b", sortOrder: 50 },
  { key: "specific_gravity", name: "Specific Gravity", color: "#14b8a6", sortOrder: 60 },
];

export const TASK_TYPES = DEFAULT_TASK_TYPE_DEFS.map((task) => task.key);

export async function fetchOrgTaskTypes(supabase, orgId) {
  if (!supabase || !orgId) return DEFAULT_TASK_TYPE_DEFS;

  const { data, error } = await supabase
    .from("hole_task_types")
    .select("key, name, color, sort_order, is_active")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;
  if (!data || data.length === 0) return DEFAULT_TASK_TYPE_DEFS;

  return data.map((row, index) => ({
    key: row.key,
    name: row.name || row.key,
    color: row.color || DEFAULT_TASK_TYPE_DEFS[index % DEFAULT_TASK_TYPE_DEFS.length]?.color || "#64748b",
    sortOrder: row.sort_order ?? index,
  }));
}
