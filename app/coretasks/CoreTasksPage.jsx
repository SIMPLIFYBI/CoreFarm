"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import CoreTaskPanelHeader from "./CoreTaskPanelHeader";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useOrg } from "@/lib/OrgContext";
import { DEFAULT_TASK_TYPE_DEFS } from "@/lib/taskTypes";

const DEFAULT_TASK_KEYS = new Set(DEFAULT_TASK_TYPE_DEFS.map((task) => task.key));
const DEFAULT_NEW_TASK_COLOR = "#f43f5e";

function slugifyTaskKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

export default function CoreTasksPage() {
  const supabase = supabaseBrowser();
  const { orgId } = useOrg();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [toggleTaskId, setToggleTaskId] = useState(null);
  const [keyTouched, setKeyTouched] = useState(false);
  const [form, setForm] = useState({
    name: "",
    key: "",
    description: "",
    color: DEFAULT_NEW_TASK_COLOR,
    sortOrder: "",
  });

  const loadTasks = async () => {
    if (!orgId) {
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("hole_task_types")
      .select("id, key, name, description, color, sort_order, is_active, created_at")
      .eq("organization_id", orgId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      toast.error(error.message);
      setTasks([]);
    } else {
      setTasks(data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadTasks();
  }, [orgId]);

  useEffect(() => {
    if (keyTouched) return;
    setForm((prev) => ({ ...prev, key: slugifyTaskKey(prev.name) }));
  }, [form.name, keyTouched]);

  const stats = useMemo(() => {
    const activeCount = tasks.filter((task) => task.is_active).length;
    const customCount = tasks.filter((task) => !DEFAULT_TASK_KEYS.has(task.key)).length;
    return [
      { label: "total tasks", value: tasks.length },
      { label: "active", value: activeCount },
      { label: "custom", value: customCount },
    ];
  }, [tasks]);

  const nextSuggestedSortOrder = useMemo(() => {
    const highest = tasks.reduce((max, task) => Math.max(max, Number(task.sort_order) || 0), 0);
    return highest + 10;
  }, [tasks]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setEditingTaskId(null);
    setForm({
      name: "",
      key: "",
      description: "",
      color: DEFAULT_NEW_TASK_COLOR,
      sortOrder: "",
    });
    setKeyTouched(false);
  };

  const startEditingTask = (task) => {
    setEditingTaskId(task.id);
    setForm({
      name: task.name || "",
      key: task.key || "",
      description: task.description || "",
      color: task.color || DEFAULT_NEW_TASK_COLOR,
      sortOrder: String(task.sort_order ?? ""),
    });
    setKeyTouched(true);
  };

  const toggleTaskActive = async (task) => {
    setToggleTaskId(task.id);
    const nextActiveState = !task.is_active;
    const { error } = await supabase
      .from("hole_task_types")
      .update({ is_active: nextActiveState })
      .eq("id", task.id);

    setToggleTaskId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(nextActiveState ? "Task reactivated." : "Task deactivated.");
    await loadTasks();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!orgId) {
      toast.error("Select an organization first.");
      return;
    }

    const name = form.name.trim();
    const key = slugifyTaskKey(form.key || form.name);
    const description = form.description.trim();
    const sortOrder = form.sortOrder === "" ? nextSuggestedSortOrder : Number(form.sortOrder);

    if (!name) {
      toast.error("Task name is required.");
      return;
    }

    if (!key) {
      toast.error("Task key must contain letters or numbers.");
      return;
    }

    if (!Number.isFinite(sortOrder)) {
      toast.error("Sort order must be a number.");
      return;
    }

    setSaving(true);
    const payload = {
      name,
      description: description || null,
      color: form.color || null,
      sort_order: sortOrder,
    };

    const { error } = editingTaskId
      ? await supabase.from("hole_task_types").update(payload).eq("id", editingTaskId)
      : await supabase.from("hole_task_types").insert({
          organization_id: orgId,
          key,
          is_active: true,
          ...payload,
        });

    setSaving(false);

    if (error) {
      if (error.code === "23505") {
        toast.error("That task name or key already exists for this organization.");
      } else {
        toast.error(error.message);
      }
      return;
    }

    toast.success(editingTaskId ? "Core task updated." : "Core task added.");
    resetForm();
    await loadTasks();
  };

  return (
    <div className="p-4 md:p-5 space-y-4">
      <CoreTaskPanelHeader
        eyebrow="Core Tasks"
        title=""
        stats={stats}
        actions={
          <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] text-emerald-100">
            New tasks added here will appear in dashboard filters.
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
        <section className="rounded-[28px] border border-white/10 bg-slate-950/40 p-4 shadow-[0_20px_60px_rgba(2,6,23,0.26)]">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-white">{editingTaskId ? "Edit task" : "Add custom task"}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              {editingTaskId
                ? "Update the display details here. The machine key stays locked so historical task records keep matching cleanly."
                : "Start with a name and we will keep the key machine-safe for future logging and integrations."}
            </p>
          </div>

          <form className="space-y-3" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1 block text-xs text-slate-300">Task name</label>
              <input
                type="text"
                value={form.name}
                onChange={(event) => handleChange("name", event.target.value)}
                className="input w-full"
                placeholder="e.g. Density Logging"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-300">Task key</label>
              <input
                type="text"
                value={form.key}
                onChange={(event) => {
                  setKeyTouched(true);
                  handleChange("key", event.target.value);
                }}
                className="input w-full font-mono text-sm disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="density_logging"
                disabled={!!editingTaskId}
              />
              <div className="mt-1 text-[11px] text-slate-500">
                {editingTaskId ? "Keys cannot be changed after creation." : "Lowercase letters, numbers, and underscores work best."}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-300">Description</label>
              <textarea
                value={form.description}
                onChange={(event) => handleChange("description", event.target.value)}
                className="textarea min-h-[92px] w-full"
                placeholder="Optional note for what this task is used for"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
              <div>
                <label className="mb-1 block text-xs text-slate-300">Color</label>
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/70 px-3 py-2.5">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(event) => handleChange("color", event.target.value)}
                    className="h-9 w-10 cursor-pointer rounded border border-white/10 bg-transparent"
                  />
                  <span className="font-mono text-xs text-slate-300">{form.color || "None"}</span>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-300">Sort order</label>
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(event) => handleChange("sortOrder", event.target.value)}
                  className="input w-full"
                  placeholder={String(nextSuggestedSortOrder)}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-3 py-3 text-xs text-slate-300">
              <div className="font-medium text-slate-100">Preview</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5"
                  style={{ backgroundColor: `${form.color || DEFAULT_NEW_TASK_COLOR}22` }}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: form.color || DEFAULT_NEW_TASK_COLOR }}
                  />
                  {form.name.trim() || "New Task"}
                </span>
                <span className="font-mono text-[11px] text-slate-500">{slugifyTaskKey(form.key || form.name) || "new_task"}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="submit" className="btn btn-3d-primary" disabled={saving}>
                {saving ? (editingTaskId ? "Saving..." : "Adding...") : editingTaskId ? "Save Changes" : "Add Task"}
              </button>
              <button type="button" className="btn btn-3d-glass" onClick={resetForm} disabled={saving}>
                {editingTaskId ? "Cancel" : "Clear"}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-slate-950/40 p-4 shadow-[0_20px_60px_rgba(2,6,23,0.26)]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Current tasks</h2>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Defaults stay available, and any custom tasks you add here are scoped to the current organization.
              </p>
            </div>
            <button type="button" className="btn btn-3d-glass" onClick={loadTasks} disabled={loading}>
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-sm text-slate-400">Loading tasks...</div>
          ) : tasks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-sm text-slate-400">No tasks found for this organization yet.</div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => {
                const isDefault = DEFAULT_TASK_KEYS.has(task.key);
                return (
                  <article key={task.id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-sm text-slate-100">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: task.color || "#64748b" }}
                            />
                            {task.name}
                          </span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] ${isDefault ? "bg-sky-500/15 text-sky-100" : "bg-rose-500/15 text-rose-100"}`}>
                            {isDefault ? "Default" : "Custom"}
                          </span>
                          {!task.is_active ? <span className="rounded-full bg-slate-700/70 px-2.5 py-1 text-[11px] text-slate-200">Inactive</span> : null}
                        </div>
                        <div className="mt-2 font-mono text-[11px] text-slate-500">{task.key}</div>
                        {task.description ? <p className="mt-2 text-sm leading-6 text-slate-300">{task.description}</p> : null}
                      </div>

                      <div className="grid shrink-0 gap-2 text-xs text-slate-400 sm:text-right">
                        <div>Sort order: <span className="text-slate-200">{task.sort_order ?? 0}</span></div>
                        <div>Color: <span className="font-mono text-slate-200">{task.color || "-"}</span></div>
                        <div className="flex flex-wrap justify-end gap-2 pt-1">
                          <button
                            type="button"
                            className="btn btn-3d-glass btn-xs"
                            onClick={() => startEditingTask(task)}
                            disabled={saving || toggleTaskId === task.id}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className={`btn btn-xs ${task.is_active ? "btn-3d-glass" : "btn-3d-primary"}`}
                            onClick={() => toggleTaskActive(task)}
                            disabled={saving || toggleTaskId === task.id}
                          >
                            {toggleTaskId === task.id ? "Updating..." : task.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
