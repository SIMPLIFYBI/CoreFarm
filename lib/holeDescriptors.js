export function normalizeHoleDescriptorKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function parseHoleDescriptorTokens(value) {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((item) => String(item || "").trim())
          .filter(Boolean)
      )
    );
  }

  return Array.from(
    new Set(
      String(value || "")
        .split(/[|;,\n]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

export async function fetchOrgHoleDescriptors(supabase, orgId, { includeInactive = false } = {}) {
  if (!orgId) return [];

  let query = supabase
    .from("hole_descriptors")
    .select("id,organization_id,key,name,category,sort_order,is_active")
    .eq("organization_id", orgId)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export function buildHoleDescriptorLookup(descriptors) {
  const byId = new Map();
  const byToken = new Map();

  (descriptors || []).forEach((descriptor) => {
    if (!descriptor?.id) return;
    byId.set(descriptor.id, descriptor);

    const rawTokens = [descriptor.id, descriptor.key, descriptor.name];
    rawTokens.forEach((token) => {
      const text = String(token || "").trim();
      const normalized = normalizeHoleDescriptorKey(token);

      if (text) byToken.set(text.toLowerCase(), descriptor);
      if (normalized) byToken.set(normalized, descriptor);
    });
  });

  return { byId, byToken };
}

export function resolveHoleDescriptorTokens(value, descriptors) {
  const tokens = parseHoleDescriptorTokens(value);
  const { byToken } = buildHoleDescriptorLookup(descriptors);
  const matchedDescriptors = [];
  const unmatchedTokens = [];
  const seenIds = new Set();

  tokens.forEach((token) => {
    const normalized = normalizeHoleDescriptorKey(token);
    const descriptor = byToken.get(String(token).toLowerCase()) || byToken.get(normalized) || null;

    if (!descriptor) {
      unmatchedTokens.push(token);
      return;
    }

    if (seenIds.has(descriptor.id)) return;
    seenIds.add(descriptor.id);
    matchedDescriptors.push(descriptor);
  });

  return {
    tokens,
    matchedDescriptors,
    descriptorIds: matchedDescriptors.map((descriptor) => descriptor.id),
    unmatchedTokens,
  };
}

export async function fetchHoleDescriptorAssignments(supabase, holeIds) {
  if (!holeIds?.length) return new Map();

  const { data: assignmentRows, error: assignmentError } = await supabase
    .from("hole_descriptor_assignments")
    .select("hole_id,descriptor_id")
    .in("hole_id", holeIds);

  if (assignmentError) throw assignmentError;

  const descriptorIds = Array.from(new Set((assignmentRows || []).map((row) => row.descriptor_id).filter(Boolean)));
  if (!descriptorIds.length) return new Map();

  const { data: descriptorRows, error: descriptorError } = await supabase
    .from("hole_descriptors")
    .select("id,organization_id,key,name,category,sort_order,is_active")
    .in("id", descriptorIds)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (descriptorError) throw descriptorError;

  const descriptorById = new Map((descriptorRows || []).map((descriptor) => [descriptor.id, descriptor]));
  const descriptorsByHole = new Map();

  (assignmentRows || []).forEach((row) => {
    const descriptor = descriptorById.get(row.descriptor_id);
    if (!descriptor) return;
    const current = descriptorsByHole.get(row.hole_id) || [];
    current.push(descriptor);
    descriptorsByHole.set(row.hole_id, current);
  });

  return descriptorsByHole;
}

export function attachHoleDescriptors(rows, descriptorsByHole) {
  return (rows || []).map((row) => {
    const descriptors = descriptorsByHole.get(row.id) || [];
    return {
      ...row,
      descriptors,
      descriptor_ids: descriptors.map((descriptor) => descriptor.id),
      descriptor_names: descriptors.map((descriptor) => descriptor.name),
      descriptor_names_text: descriptors.map((descriptor) => descriptor.name).join(" "),
    };
  });
}

export async function replaceHoleDescriptorAssignments(supabase, { orgId, holeId, descriptorIds }) {
  if (!orgId || !holeId) return;

  const uniqueDescriptorIds = Array.from(new Set((descriptorIds || []).filter(Boolean)));
  const { error: deleteError } = await supabase
    .from("hole_descriptor_assignments")
    .delete()
    .eq("organization_id", orgId)
    .eq("hole_id", holeId);

  if (deleteError) throw deleteError;
  if (!uniqueDescriptorIds.length) return;

  const { error: insertError } = await supabase.from("hole_descriptor_assignments").insert(
    uniqueDescriptorIds.map((descriptorId) => ({
      organization_id: orgId,
      hole_id: holeId,
      descriptor_id: descriptorId,
    }))
  );

  if (insertError) throw insertError;
}

export async function replaceManyHoleDescriptorAssignments(supabase, { orgId, holeIds, descriptorIds }) {
  const uniqueHoleIds = Array.from(new Set((holeIds || []).filter(Boolean)));
  if (!orgId || !uniqueHoleIds.length) return;

  const uniqueDescriptorIds = Array.from(new Set((descriptorIds || []).filter(Boolean)));
  const { error: deleteError } = await supabase
    .from("hole_descriptor_assignments")
    .delete()
    .eq("organization_id", orgId)
    .in("hole_id", uniqueHoleIds);

  if (deleteError) throw deleteError;
  if (!uniqueDescriptorIds.length) return;

  const rows = [];
  uniqueHoleIds.forEach((holeId) => {
    uniqueDescriptorIds.forEach((descriptorId) => {
      rows.push({
        organization_id: orgId,
        hole_id: holeId,
        descriptor_id: descriptorId,
      });
    });
  });

  const { error: insertError } = await supabase.from("hole_descriptor_assignments").insert(rows);
  if (insertError) throw insertError;
}