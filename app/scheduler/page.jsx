"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useOrg } from "@/lib/OrgContext";

const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS_VISIBLE = 21;
const UNASSIGNED_ROW_ID = "__unassigned__";
const RESOURCE_VIEW = "resource";
const TASK_VIEW = "task";

function startOfWeek(value) {
	const date = new Date(value);
	const day = date.getDay();
	const offset = day === 0 ? -6 : 1 - day;
	date.setHours(0, 0, 0, 0);
	date.setDate(date.getDate() + offset);
	return date;
}

function addDays(value, amount) {
	const date = new Date(value);
	date.setDate(date.getDate() + amount);
	return date;
}

function toIsoDate(value) {
	if (!value) return "";
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return date.toISOString().slice(0, 10);
}

function parseIsoDate(value) {
	if (!value) return null;
	const date = new Date(`${value}T00:00:00`);
	return Number.isNaN(date.getTime()) ? null : date;
}

function differenceInDays(left, right) {
	return Math.round((parseIsoDate(left) - parseIsoDate(right)) / DAY_MS);
}

function inclusiveDurationDays(startDate, finishDate) {
	if (!startDate || !finishDate) return 1;
	return Math.max(1, differenceInDays(finishDate, startDate) + 1);
}

function clampToWindowStart(value, windowStart) {
	return differenceInDays(value, windowStart) < 0 ? toIsoDate(windowStart) : value;
}

function formatHeaderDay(value) {
	return parseIsoDate(value)?.toLocaleDateString(undefined, { weekday: "short" }) || "";
}

function formatHeaderDate(value) {
	return parseIsoDate(value)?.toLocaleDateString(undefined, { day: "numeric", month: "short" }) || "";
}

function formatWindowLabel(startDate, dayCount) {
	const endDate = addDays(startDate, dayCount - 1);
	const sameMonth = startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear();
	if (sameMonth) {
		return `${startDate.toLocaleDateString(undefined, { month: "long" })} ${startDate.getDate()}-${endDate.getDate()}, ${startDate.getFullYear()}`;
	}
	return `${startDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${endDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}

function getTaskTone(taskGroup) {
	if (taskGroup === "drilling") {
		return {
			border: "border-cyan-300/24",
			background: "bg-cyan-400/12",
			text: "text-cyan-100",
			accent: "#67e8f9",
		};
	}

	if (taskGroup === "earthworks") {
		return {
			border: "border-amber-300/24",
			background: "bg-amber-400/12",
			text: "text-amber-100",
			accent: "#fbbf24",
		};
	}

	if (taskGroup === "rehab") {
		return {
			border: "border-emerald-300/24",
			background: "bg-emerald-400/12",
			text: "text-emerald-100",
			accent: "#34d399",
		};
	}

	return {
		border: "border-white/12",
		background: "bg-white/[0.06]",
		text: "text-slate-100",
		accent: "#cbd5e1",
	};
}

function SchedulerChip({ children, active = false, onClick }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${active ? "bg-cyan-300 text-slate-950" : "bg-white/[0.05] text-slate-200 hover:bg-white/[0.09]"}`}
		>
			{children}
		</button>
	);
}

function StatCard({ label, value, detail }) {
	return (
		<div className="rounded-[24px] border border-white/10 bg-white/[0.04] px-4 py-3 shadow-[0_18px_44px_rgba(2,6,23,0.18)]">
			<div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{label}</div>
			<div className="mt-2 text-2xl font-semibold text-white">{value}</div>
			<div className="mt-1 text-xs text-slate-400">{detail}</div>
		</div>
	);
}

function EmptySchedulerState({ title, body }) {
	return (
		<div className="rounded-[28px] border border-dashed border-white/12 bg-white/[0.03] px-5 py-10 text-center">
			<div className="text-base font-semibold text-white">{title}</div>
			<div className="mt-2 text-sm leading-6 text-slate-400">{body}</div>
		</div>
	);
}

function SchedulerCard({ item, leftPercent, widthPercent, onDragStart, onDragEnd }) {
	const tone = getTaskTone(item.task.task_group);

	return (
		<button
			type="button"
			draggable
			onDragStart={onDragStart}
			onDragEnd={onDragEnd}
			className={`absolute top-2 flex h-[52px] min-w-[120px] cursor-grab flex-col items-start justify-center overflow-hidden rounded-[18px] border px-3 py-2 text-left shadow-[0_16px_36px_rgba(2,6,23,0.24)] transition hover:brightness-105 active:cursor-grabbing ${tone.border} ${tone.background} ${tone.text}`}
			style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
			title={`${item.hole.hole_id} · ${item.task.task_name}`}
		>
			<div className="flex w-full items-center justify-between gap-2">
				<span className="truncate text-xs font-semibold">{item.hole.hole_id}</span>
				{item.isUndated ? <span className="rounded-full border border-white/12 bg-black/20 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.16em]">No dates</span> : null}
			</div>
			<div className="mt-0.5 flex w-full items-center justify-between gap-2 text-[10px] text-slate-200/90">
				<span className="truncate">{item.task.task_name}</span>
				<span className="truncate">{item.assignment?.resource?.name || "Unassigned"}</span>
			</div>
		</button>
	);
}

export default function SchedulerPage() {
	const supabase = useMemo(() => supabaseBrowser(), []);
	const { orgId } = useOrg();
	const [viewMode, setViewMode] = useState(RESOURCE_VIEW);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [tasks, setTasks] = useState([]);
	const [assignments, setAssignments] = useState([]);
	const [holes, setHoles] = useState([]);
	const [resources, setResources] = useState([]);
	const [windowStart, setWindowStart] = useState(() => startOfWeek(new Date()));
	const [projectFilter, setProjectFilter] = useState("all");
	const [resourceTypeFilter, setResourceTypeFilter] = useState("all");
	const [search, setSearch] = useState("");
	const [dragState, setDragState] = useState(null);
	const dragPayloadRef = useRef(null);

	const loadScheduler = async () => {
		if (!orgId) {
			setTasks([]);
			setAssignments([]);
			setHoles([]);
			setResources([]);
			setLoading(false);
			return;
		}

		setLoading(true);
		setError("");

		const [holeRes, taskRes, assignmentRes, resourceRes] = await Promise.all([
			supabase
				.from("holes")
				.select("id, hole_id, project_id, projects(name)")
				.eq("organization_id", orgId)
				.order("hole_id", { ascending: true }),
			supabase
				.from("hole_schedule_tasks")
				.select("id, organization_id, project_id, hole_id, task_code, task_name, task_group, required_resource_type, sequence_no, target_start_date, target_finish_date, planning_status, locked, notes, metadata")
				.eq("organization_id", orgId)
				.order("sequence_no", { ascending: true }),
			supabase
				.from("hole_schedule_task_assignments")
				.select("id, organization_id, project_id, hole_id, schedule_task_id, resource_id, planned_start_date, planned_finish_date, assignment_status, lane_rank, locked, notes")
				.eq("organization_id", orgId)
				.order("planned_start_date", { ascending: true }),
			supabase
				.from("resources")
				.select("id, name, resource_type")
				.eq("organization_id", orgId)
				.order("resource_type", { ascending: true })
				.order("name", { ascending: true }),
		]);

		const relationMissing = [taskRes.error, assignmentRes.error].some((entry) => entry?.code === "42P01");
		if (relationMissing) {
			setError("Scheduler tables were not found. Run the latest scheduling migration before using this page.");
			setTasks([]);
			setAssignments([]);
			setHoles(holeRes.data || []);
			setResources(resourceRes.data || []);
			setLoading(false);
			return;
		}

		if (holeRes.error || taskRes.error || assignmentRes.error || resourceRes.error) {
			console.error(holeRes.error || taskRes.error || assignmentRes.error || resourceRes.error);
			setError("Could not load the scheduler right now.");
			setTasks([]);
			setAssignments([]);
			setHoles([]);
			setResources([]);
			setLoading(false);
			return;
		}

		setHoles(holeRes.data || []);
		setTasks(taskRes.data || []);
		setAssignments(assignmentRes.data || []);
		setResources(resourceRes.data || []);
		setLoading(false);
	};

	useEffect(() => {
		void loadScheduler();
	}, [orgId]);

	const holesById = useMemo(() => new Map(holes.map((hole) => [hole.id, hole])), [holes]);
	const resourcesById = useMemo(() => new Map(resources.map((resource) => [resource.id, resource])), [resources]);
	const projects = useMemo(() => {
		const projectMap = new Map();
		holes.forEach((hole) => {
			if (hole.project_id) {
				projectMap.set(hole.project_id, hole.projects?.name || "Untitled project");
			}
		});
		return Array.from(projectMap.entries())
			.map(([id, name]) => ({ id, name }))
			.sort((left, right) => left.name.localeCompare(right.name));
	}, [holes]);

	const activeAssignmentsByTask = useMemo(() => {
		const map = new Map();
		assignments
			.filter((assignment) => assignment.assignment_status !== "cancelled")
			.forEach((assignment) => {
				const current = map.get(assignment.schedule_task_id) || [];
				current.push({ ...assignment, resource: resourcesById.get(assignment.resource_id) || null });
				map.set(assignment.schedule_task_id, current);
			});
		map.forEach((value) => value.sort((left, right) => String(left.planned_start_date).localeCompare(String(right.planned_start_date))));
		return map;
	}, [assignments, resourcesById]);

	const normalizedSearch = search.trim().toLowerCase();

	const filteredTasks = useMemo(() => {
		return tasks.filter((task) => {
			const hole = holesById.get(task.hole_id);
			if (!hole) return false;
			if (projectFilter !== "all" && task.project_id !== projectFilter) return false;
			if (resourceTypeFilter !== "all" && task.required_resource_type !== resourceTypeFilter) return false;
			if (!normalizedSearch) return true;

			const resourceNames = (activeAssignmentsByTask.get(task.id) || []).map((assignment) => assignment.resource?.name || "").join(" ").toLowerCase();
			const haystack = [
				hole.hole_id,
				hole.projects?.name,
				task.task_name,
				task.task_code,
				task.task_group,
				resourceNames,
			].join(" ").toLowerCase();

			return haystack.includes(normalizedSearch);
		});
	}, [activeAssignmentsByTask, holesById, normalizedSearch, projectFilter, resourceTypeFilter, tasks]);

	const windowDates = useMemo(
		() => Array.from({ length: DAYS_VISIBLE }, (_, index) => toIsoDate(addDays(windowStart, index))),
		[windowStart]
	);

	const visibleWindowEnd = windowDates[windowDates.length - 1] || toIsoDate(windowStart);

	const buildCardItem = (task, assignment = null) => {
		const hole = holesById.get(task.hole_id);
		if (!hole) return null;
		const startDate = assignment?.planned_start_date || task.target_start_date || toIsoDate(windowStart);
		const finishDate = assignment?.planned_finish_date || task.target_finish_date || startDate;
		return {
			key: assignment ? `assignment:${assignment.id}` : `task:${task.id}`,
			task,
			hole,
			assignment,
			startDate,
			finishDate,
			durationDays: inclusiveDurationDays(startDate, finishDate),
			isUndated: !assignment && (!task.target_start_date || !task.target_finish_date),
		};
	};

	const filteredResources = useMemo(() => {
		const rows = resources.filter((resource) => resourceTypeFilter === "all" || resource.resource_type === resourceTypeFilter);
		return rows;
	}, [resourceTypeFilter, resources]);

	const resourceRows = useMemo(() => {
		const tasksByResource = new Map();
		filteredResources.forEach((resource) => tasksByResource.set(resource.id, []));
		tasksByResource.set(UNASSIGNED_ROW_ID, []);

		filteredTasks.forEach((task) => {
			const taskAssignments = activeAssignmentsByTask.get(task.id) || [];
			if (!taskAssignments.length) {
				const item = buildCardItem(task, null);
				if (item) tasksByResource.get(UNASSIGNED_ROW_ID).push(item);
				return;
			}

			taskAssignments.forEach((assignment) => {
				const item = buildCardItem(task, assignment);
				if (!item) return;
				if (!tasksByResource.has(assignment.resource_id)) return;
				tasksByResource.get(assignment.resource_id).push(item);
			});
		});

		const rows = [
			{
				id: UNASSIGNED_ROW_ID,
				label: "Unassigned",
				sublabel: "Tasks with dates but no resource assignment",
				resource: null,
				items: (tasksByResource.get(UNASSIGNED_ROW_ID) || []).sort((left, right) => left.startDate.localeCompare(right.startDate)),
			},
			...filteredResources.map((resource) => ({
				id: resource.id,
				label: resource.name,
				sublabel: resource.resource_type || "Resource",
				resource,
				items: (tasksByResource.get(resource.id) || []).sort((left, right) => left.startDate.localeCompare(right.startDate)),
			})),
		];

		return rows;
	}, [activeAssignmentsByTask, filteredResources, filteredTasks, holesById, windowStart]);

	const taskRows = useMemo(() => {
		const grouped = new Map();
		filteredTasks.forEach((task) => {
			const hole = holesById.get(task.hole_id);
			if (!hole) return;
			const current = grouped.get(task.hole_id) || { hole, items: [] };
			const taskAssignments = activeAssignmentsByTask.get(task.id) || [];
			if (taskAssignments.length) {
				taskAssignments.forEach((assignment) => {
					const item = buildCardItem(task, assignment);
					if (item) current.items.push(item);
				});
			} else {
				const item = buildCardItem(task, null);
				if (item) current.items.push(item);
			}
			grouped.set(task.hole_id, current);
		});

		return Array.from(grouped.values())
			.sort((left, right) => left.hole.hole_id.localeCompare(right.hole.hole_id))
			.map((row) => ({
				...row,
				items: row.items.sort((left, right) => {
					const startCompare = left.startDate.localeCompare(right.startDate);
					if (startCompare !== 0) return startCompare;
					return left.task.sequence_no - right.task.sequence_no;
				}),
			}));
	}, [activeAssignmentsByTask, filteredTasks, holesById, windowStart]);

	const stats = useMemo(() => {
		const assignedCount = filteredTasks.filter((task) => (activeAssignmentsByTask.get(task.id) || []).length > 0).length;
		return {
			totalTasks: filteredTasks.length,
			assignedTasks: assignedCount,
			unassignedTasks: Math.max(0, filteredTasks.length - assignedCount),
			activeResources: resourceRows.filter((row) => row.id !== UNASSIGNED_ROW_ID && row.items.length > 0).length,
		};
	}, [activeAssignmentsByTask, filteredTasks, resourceRows]);

	const moveTaskWindow = async (taskId, nextStartDate, durationDays) => {
		const nextFinishDate = toIsoDate(addDays(parseIsoDate(nextStartDate), Math.max(0, durationDays - 1)));
		const { error: updateError } = await supabase
			.from("hole_schedule_tasks")
			.update({
				target_start_date: nextStartDate,
				target_finish_date: nextFinishDate,
				planning_status: "scheduled",
			})
			.eq("id", taskId);
		if (updateError) throw updateError;
		return nextFinishDate;
	};

	const handleDrop = async ({ dropType, dropId, dropDate, taskId, assignmentId, durationDays, sourceHoleId }) => {
		if (!taskId) return;
		if (!dropDate) return;

		const task = tasks.find((entry) => entry.id === taskId);
		if (!task) return;
		if (dropType === TASK_VIEW && sourceHoleId && sourceHoleId !== task.hole_id) return;

		try {
			setSaving(true);
			const nextFinishDate = await moveTaskWindow(taskId, dropDate, durationDays);

			if (dropType === RESOURCE_VIEW) {
				if (dropId === UNASSIGNED_ROW_ID) {
					if (assignmentId) {
						const { error: deleteError } = await supabase.from("hole_schedule_task_assignments").delete().eq("id", assignmentId);
						if (deleteError) throw deleteError;
					}
				} else if (assignmentId) {
					const { error: updateError } = await supabase
						.from("hole_schedule_task_assignments")
						.update({
							resource_id: dropId,
							planned_start_date: dropDate,
							planned_finish_date: nextFinishDate,
							assignment_status: "scheduled",
						})
						.eq("id", assignmentId);
					if (updateError) throw updateError;
				} else {
					const { error: insertError } = await supabase.from("hole_schedule_task_assignments").insert({
						schedule_task_id: taskId,
						resource_id: dropId,
						planned_start_date: dropDate,
						planned_finish_date: nextFinishDate,
						assignment_status: "scheduled",
					});
					if (insertError) throw insertError;
				}
			} else if (assignmentId) {
				const { error: updateError } = await supabase
					.from("hole_schedule_task_assignments")
					.update({
						planned_start_date: dropDate,
						planned_finish_date: nextFinishDate,
					})
					.eq("id", assignmentId);
				if (updateError) throw updateError;
			}

			await loadScheduler();
			toast.success(dropType === RESOURCE_VIEW && dropId === UNASSIGNED_ROW_ID ? "Task unassigned" : "Schedule updated");
		} catch (mutationError) {
			console.error(mutationError);
			toast.error(mutationError?.message || "Could not update the schedule");
		} finally {
			setSaving(false);
			setDragState(null);
			dragPayloadRef.current = null;
		}
	};

	const handleDragStart = (item, rowType, rowId) => (event) => {
		event.dataTransfer.effectAllowed = "move";
		dragPayloadRef.current = {
			taskId: item.task.id,
			assignmentId: item.assignment?.id || null,
			durationDays: item.durationDays,
		};
		setDragState({
			taskId: item.task.id,
			rowType,
			rowId,
			hoveredRowId: rowId,
			hoveredDate: item.startDate,
		});
	};

	const handleDragEnd = () => {
		setDragState(null);
		dragPayloadRef.current = null;
	};

	const renderTimelineRow = (row, rowType) => {
		const items = row.items.filter((item) => {
			if (item.isUndated) return true;
			return !(item.finishDate < windowDates[0] || item.startDate > visibleWindowEnd);
		});

		return (
			<div key={row.id} className="grid grid-cols-[240px_minmax(0,1fr)] border-b border-white/8 last:border-b-0">
				<div className="sticky left-0 z-10 border-r border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(15,23,42,0.95))] px-4 py-3">
					<div className="truncate text-sm font-medium text-white">{row.label}</div>
					<div className="mt-1 text-xs text-slate-400">{row.sublabel}</div>
				</div>
				<div className="relative min-h-[72px] bg-[linear-gradient(180deg,rgba(15,23,42,0.72),rgba(2,6,23,0.82))]">
					<div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${DAYS_VISIBLE}, minmax(0, 1fr))` }}>
						{windowDates.map((date) => (
							(() => {
								const isDropTarget = dragState?.hoveredRowId === row.id && dragState?.hoveredDate === date;
								const isSameRow = dragState?.hoveredRowId === row.id;
								return (
							<div
								key={`${row.id}-${date}`}
								onDragOver={(event) => {
									event.preventDefault();
									if (!dragPayloadRef.current) return;
									setDragState((current) => {
										if (!current || (current.hoveredRowId === row.id && current.hoveredDate === date)) {
											return current;
										}
										return { ...current, hoveredRowId: row.id, hoveredDate: date };
									});
								}}
								onDrop={(event) => {
									event.preventDefault();
									const payload = dragPayloadRef.current;
									if (!payload) return;
									void handleDrop({
										dropType: rowType,
										dropId: row.id,
										dropDate: date,
										taskId: payload.taskId,
										assignmentId: payload.assignmentId,
										durationDays: payload.durationDays,
										sourceHoleId: row.hole?.id || null,
									});
								}}
								className={`border-l first:border-l-0 ${isDropTarget ? "border-cyan-300/60 bg-cyan-300/16 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.35)]" : isSameRow ? "border-white/10 bg-white/[0.02]" : "border-white/6"}`}
							/>
								);
							})()
						))}
					</div>

					<div className="relative h-[72px]">
						{dragState?.hoveredRowId === row.id && dragState?.hoveredDate ? (
							<div className="pointer-events-none absolute inset-y-0 z-10 flex items-start" style={{ left: `${(Math.max(0, differenceInDays(dragState.hoveredDate, windowDates[0])) / DAYS_VISIBLE) * 100}%`, width: `${100 / DAYS_VISIBLE}%` }}>
								<div className="mt-1 ml-1 rounded-full border border-cyan-300/40 bg-cyan-300/16 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-cyan-100">
									{formatHeaderDate(dragState.hoveredDate)}
								</div>
							</div>
						) : null}
						{items.map((item) => {
							const clampedStart = item.isUndated ? windowDates[0] : clampToWindowStart(item.startDate, windowStart);
							const startOffset = Math.max(0, differenceInDays(clampedStart, windowDates[0]));
							const hiddenDays = item.isUndated ? 0 : Math.max(0, differenceInDays(item.startDate, clampedStart));
							const visibleDuration = Math.max(1, item.durationDays - hiddenDays);
							const widthDays = Math.min(visibleDuration, DAYS_VISIBLE - startOffset);
							const leftPercent = (startOffset / DAYS_VISIBLE) * 100;
							const widthPercent = (widthDays / DAYS_VISIBLE) * 100;

							return (
								<SchedulerCard
									key={item.key}
									item={item}
									leftPercent={leftPercent}
									widthPercent={widthPercent}
									onDragStart={handleDragStart(item, rowType, row.id)}
									onDragEnd={handleDragEnd}
								/>
							);
						})}
					</div>
				</div>
			</div>
		);
	};

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(251,191,36,0.12),transparent_22%),linear-gradient(180deg,#020617,#0f172a_42%,#111827)] px-4 py-6 md:px-6">
			<div className="mx-auto max-w-[1600px] space-y-5">
				<section className="overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,6,23,0.9))] shadow-[0_34px_100px_rgba(2,6,23,0.44)] backdrop-blur-xl">
					<div className="relative overflow-hidden px-5 py-5 md:px-6 md:py-6">
						<div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.16),transparent_58%)]" />
						<div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
							<div>
								<div className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/75">Scheduler Studio</div>
								<h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-[2.2rem]">Hole planning and resource assignment</h1>
								<p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
									Plan hole work by day, switch between resource and task perspectives, and drag assignments between crews without leaving the schedule.
								</p>
							</div>

							<div className="grid gap-3 sm:grid-cols-2 xl:w-[540px]">
								<StatCard label="Visible tasks" value={loading ? "..." : stats.totalTasks} detail="Filtered by your current view" />
								<StatCard label="Assigned" value={loading ? "..." : stats.assignedTasks} detail="Tasks already placed on a resource" />
								<StatCard label="Unassigned" value={loading ? "..." : stats.unassignedTasks} detail="Shown in the unassigned schedule row" />
								<StatCard label="Active resources" value={loading ? "..." : stats.activeResources} detail="Rows carrying planned work in the current window" />
							</div>
						</div>
					</div>
				</section>

				<section className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
					<aside className="rounded-[30px] border border-white/10 bg-slate-950/62 p-4 shadow-[0_26px_80px_rgba(2,6,23,0.34)] backdrop-blur-xl">
						<div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Views</div>
						<div className="mt-3 flex flex-wrap gap-2">
							<SchedulerChip active={viewMode === RESOURCE_VIEW} onClick={() => setViewMode(RESOURCE_VIEW)}>Resource view</SchedulerChip>
							<SchedulerChip active={viewMode === TASK_VIEW} onClick={() => setViewMode(TASK_VIEW)}>Task view</SchedulerChip>
						</div>

						<div className="mt-5 text-[11px] uppercase tracking-[0.22em] text-slate-400">Window</div>
						<div className="mt-3 rounded-[24px] border border-white/10 bg-white/[0.04] p-3">
							<div className="text-sm font-medium text-white">{formatWindowLabel(windowStart, DAYS_VISIBLE)}</div>
							<div className="mt-3 flex items-center gap-2">
								<button type="button" className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-slate-100 transition hover:bg-white/[0.1]" onClick={() => setWindowStart((current) => addDays(current, -7))}>Previous</button>
								<button type="button" className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-100 transition hover:bg-cyan-400/16" onClick={() => setWindowStart(startOfWeek(new Date()))}>Today</button>
								<button type="button" className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-slate-100 transition hover:bg-white/[0.1]" onClick={() => setWindowStart((current) => addDays(current, 7))}>Next</button>
							</div>
						</div>

						<div className="mt-5 text-[11px] uppercase tracking-[0.22em] text-slate-400">Filters</div>
						<div className="mt-3 space-y-3">
							<label className="block text-sm text-slate-300">
								<div className="mb-1.5 text-xs uppercase tracking-[0.18em] text-slate-500">Search</div>
								<input
									value={search}
									onChange={(event) => setSearch(event.target.value)}
									placeholder="Hole, task, project, resource"
									className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/30"
								/>
							</label>

							<label className="block text-sm text-slate-300">
								<div className="mb-1.5 text-xs uppercase tracking-[0.18em] text-slate-500">Project</div>
								<select
									value={projectFilter}
									onChange={(event) => setProjectFilter(event.target.value)}
									className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300/30"
								>
									<option value="all">All projects</option>
									{projects.map((project) => (
										<option key={project.id} value={project.id}>{project.name}</option>
									))}
								</select>
							</label>

							<label className="block text-sm text-slate-300">
								<div className="mb-1.5 text-xs uppercase tracking-[0.18em] text-slate-500">Required resource</div>
								<select
									value={resourceTypeFilter}
									onChange={(event) => setResourceTypeFilter(event.target.value)}
									className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300/30"
								>
									<option value="all">All resource types</option>
									{Array.from(new Set(resources.map((resource) => resource.resource_type).filter(Boolean).concat(tasks.map((task) => task.required_resource_type).filter(Boolean)))).sort().map((type) => (
										<option key={type} value={type}>{type}</option>
									))}
								</select>
							</label>
						</div>

						<div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-300">
							<div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">How drag works</div>
							<div className="mt-2">Grab any task card and drag it left or right across the day grid to move it backward or forward in time.</div>
							<div className="mt-1">Dropping on a new day updates the task planned start and finish dates, and assigned cards keep their resource booking in sync.</div>
							<div className="mt-1">Drop onto a different resource row to reassign the task, or onto the unassigned row to remove the resource while keeping the task on the plan.</div>
						</div>
					</aside>

					<section className="rounded-[30px] border border-white/10 bg-slate-950/62 shadow-[0_26px_80px_rgba(2,6,23,0.34)] backdrop-blur-xl">
						<div className="border-b border-white/10 px-4 py-4 md:px-5">
							<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
								<div>
									<div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Timeline</div>
									<div className="mt-1 text-lg font-semibold text-white">{viewMode === RESOURCE_VIEW ? "Resource allocation board" : "Hole task board"}</div>
								</div>
								{saving ? <div className="text-sm text-cyan-100">Saving changes…</div> : null}
							</div>
						</div>

						{error ? (
							<div className="p-4 md:p-5">
								<EmptySchedulerState title="Scheduler unavailable" body={error} />
							</div>
						) : loading ? (
							<div className="p-4 md:p-5">
								<EmptySchedulerState title="Loading scheduler" body="Pulling holes, tasks, resources, and assignments into the planning canvas." />
							</div>
						) : (viewMode === RESOURCE_VIEW ? resourceRows : taskRows).length === 0 ? (
							<div className="p-4 md:p-5">
								<EmptySchedulerState title="Nothing matches the current filters" body="Try broadening the project, resource, or search filters to bring tasks back into view." />
							</div>
						) : (
							<div className="overflow-x-auto">
								<div className="min-w-[1280px]">
									<div className="grid grid-cols-[240px_minmax(0,1fr)] border-b border-white/10">
										<div className="sticky left-0 z-10 border-r border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(15,23,42,0.95))] px-4 py-3 text-[11px] uppercase tracking-[0.22em] text-slate-400">
											{viewMode === RESOURCE_VIEW ? "Resources" : "Holes"}
										</div>
										<div className="grid" style={{ gridTemplateColumns: `repeat(${DAYS_VISIBLE}, minmax(0, 1fr))` }}>
											{windowDates.map((date) => (
												<div key={date} className="border-l border-white/8 px-2 py-3 first:border-l-0">
													<div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{formatHeaderDay(date)}</div>
													<div className="mt-1 text-sm font-medium text-white">{formatHeaderDate(date)}</div>
												</div>
											))}
										</div>
									</div>

									<div>
										{(viewMode === RESOURCE_VIEW ? resourceRows : taskRows).map((row) => renderTimelineRow(row, viewMode))}
									</div>
								</div>
							</div>
						)}
					</section>
				</section>
			</div>
		</div>
	);
}

