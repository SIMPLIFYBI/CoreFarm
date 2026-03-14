"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const LESSONS = [
  {
    id: "start",
    title: "Start With Projects",
    duration: "5 min",
    href: "/projects",
    summary: "Set up the operating structure first so holes, assets, and activity all land in the right place.",
    goals: [
      "Create a project and basic metadata",
      "Set the project coordinate system",
      "Add locations, tenements, and supporting reference data",
    ],
    steps: [
      "Open Projects and create the project record you want the team to work in.",
      "Set the project CRS before loading any projected coordinates such as easting and northing.",
      "Add the supporting records your crew will use later, including tenements, locations, vendors, and resources.",
    ],
    tip: "If coordinates matter, configure the CRS first. It avoids cleanup later when importing holes or assets.",
  },
  {
    id: "holes",
    title: "Load Holes Into Drilling",
    duration: "8 min",
    href: "/coretasks",
    summary: "Build the hole register, bulk upload planned holes, and keep each hole tied to a project.",
    goals: [
      "Add single holes or bulk import many at once",
      "Use project-linked coordinate handling",
      "Bulk edit, filter, and manage the hole list",
    ],
    steps: [
      "Go to Drilling and open Hole Details to add a hole manually or use the bulk uploader.",
      "Choose the destination project before importing so every hole is assigned correctly.",
      "Use filters and row selection to bulk update status, diameter, or contractor across multiple holes.",
    ],
    tip: "Bulk uploads now require a project selection. Keep one import per project for the cleanest workflow.",
  },
  {
    id: "viz",
    title: "Use Drillhole Viz",
    duration: "10 min",
    href: "/drillhole-viz",
    summary: "Review hole attributes, geology, construction, and completion details in one visual workspace.",
    goals: [
      "Inspect collar and planning data",
      "Log geology and construction intervals",
      "Review the hole schematic and completion state",
    ],
    steps: [
      "Open Drillhole Viz and choose a project or hole to inspect.",
      "Use the tabs to enter attributes, geology intervals, annulus intervals, and construction data.",
      "Confirm planned depth, collar information, and completion details before the hole is considered ready for reporting.",
    ],
    tip: "If a hole cannot save additional attributes, confirm it has already been assigned to a project in Hole Details.",
  },
  {
    id: "map",
    title: "Navigate With Map",
    duration: "6 min",
    href: "/map",
    summary: "Visualize holes spatially, inspect assets, and move quickly between projects in the field view.",
    goals: [
      "See holes on the map",
      "Use project filters to focus the workspace",
      "Open supporting details without losing location context",
    ],
    steps: [
      "Open Map and filter to the project or set of holes you want to inspect.",
      "Use the hole list and map markers together to jump between locations and records.",
      "Switch to the mobile map when you need the lighter field workflow on smaller screens.",
    ],
    tip: "Map visibility depends on valid collar coordinates. If a hole is missing, check its saved coordinates and project CRS.",
  },
  {
    id: "dispatch",
    title: "Prepare Sample Dispatch",
    duration: "7 min",
    href: "/coretasks",
    summary: "Turn logged intervals into dispatch-ready sample runs with a clear chain of movement.",
    goals: [
      "Find eligible core intervals",
      "Build a dispatch with pallets and lab destination",
      "Track what has been sent",
    ],
    steps: [
      "Open the Sample Dispatch area inside Drilling and review eligible core intervals.",
      "Filter by hole when needed, then add the intervals you are sending.",
      "Set the dispatch date, pallet count, destination, and consignment number before saving.",
    ],
    tip: "Use the hole filter when preparing dispatches for a single program so the interval list stays manageable.",
  },
  {
    id: "activity",
    title: "Capture Activity And Plods",
    duration: "9 min",
    href: "/activity",
    summary: "Record daily operational work, link it to assets and activity types, and review the resulting plods.",
    goals: [
      "Track operational activity by date and vendor",
      "Use plods for approval-ready summaries",
      "Review totals and costs in one place",
    ],
    steps: [
      "Set up activity types and plod types in Projects if your organization has not done that yet.",
      "Log activity against the relevant assets, vendors, or resources.",
      "Review the resulting plods and approvals to make sure the operational record is complete.",
    ],
    tip: "Activity setup pays off early. Spend a few minutes defining clean activity types before teams start logging heavily.",
  },
  {
    id: "consumables",
    title: "Manage Consumables",
    duration: "6 min",
    href: "/consumables",
    summary: "Keep inventory, requests, and purchase orders aligned so supply tracking stays current.",
    goals: [
      "Track inventory levels",
      "Create requests and purchase orders",
      "Filter order items by PO and status",
    ],
    steps: [
      "Use Inventory to keep quantities and reorder points up to date.",
      "Move into Requests and Orders when items need to be sourced or received.",
      "Use the order filters to review outstanding, ordered, or received items quickly.",
    ],
    tip: "Keep item naming consistent from the start. It makes reorder reporting and history much cleaner later on.",
  },
  {
    id: "team",
    title: "Set Up Team And Sharing",
    duration: "5 min",
    href: "/team",
    summary: "Invite users, manage roles, and configure organization sharing when client/vendor visibility is needed.",
    goals: [
      "Invite team members",
      "Control organization roles",
      "Share the right projects with connected organizations",
    ],
    steps: [
      "Open Team to invite users and assign the correct role for each person.",
      "Create organization connections when work needs to be shared across org boundaries.",
      "Choose exactly which projects should be visible through shared project access.",
    ],
    tip: "Only share the projects a connected organization actually needs. It keeps the client view tight and easier to support.",
  },
];

const QUICK_START = [
  "Create the project and set the CRS.",
  "Load holes into Drilling.",
  "Review data in Drillhole Viz and Map.",
  "Run dispatch, activity, and consumables workflows once the project is live.",
];

export default function HowToPage() {
  const [activeLessonId, setActiveLessonId] = useState(LESSONS[0].id);

  const activeLesson = useMemo(
    () => LESSONS.find((lesson) => lesson.id === activeLessonId) || LESSONS[0],
    [activeLessonId]
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-6 lg:py-8">
      <section className="card overflow-hidden p-0">
        <div className="relative isolate overflow-hidden rounded-[14px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(99,102,241,0.22),transparent_30%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(8,12,20,0.96))] px-5 py-6 md:px-8 md:py-8">
          <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[linear-gradient(135deg,rgba(34,211,238,0.08),rgba(99,102,241,0.03),transparent)] lg:block" />
          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <div className="inline-flex items-center rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                Platform Lessons
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight text-slate-50 md:text-4xl">How To Use CoreFarm</h1>
                <p className="max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                  Learn the platform as a connected workflow, from project setup through drilling, visualization, activity,
                  dispatch, and inventory. Each lesson is designed to get a team productive fast without guessing where data belongs.
                </p>
              </div>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-2 lg:max-w-xl">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Lessons</div>
                <div className="mt-2 text-3xl font-semibold text-white">{LESSONS.length}</div>
                <div className="mt-1 text-sm text-slate-300">Structured walkthroughs covering the full platform.</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Best For</div>
                <div className="mt-2 text-lg font-semibold text-white">New teams and refreshers</div>
                <div className="mt-1 text-sm text-slate-300">Use this page for onboarding, handover, or self-guided training.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-6">
          <div className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Quick Start</h2>
                <p className="mt-1 text-sm text-slate-400">If you only need the fastest setup path, start here.</p>
              </div>
              <Link href="/projects" className="btn btn-3d-glass text-xs">
                Open Projects
              </Link>
            </div>
            <ol className="mt-4 space-y-3">
              {QUICK_START.map((item, index) => (
                <li key={item} className="flex gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-400/10 text-sm font-semibold text-cyan-100">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-6 text-slate-300">{item}</p>
                </li>
              ))}
            </ol>
          </div>

          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Lessons</h2>
                <p className="mt-1 text-sm text-slate-400">Pick a topic to view the walkthrough.</p>
              </div>
            </div>
            <div className="space-y-2">
              {LESSONS.map((lesson, index) => {
                const active = lesson.id === activeLesson.id;
                return (
                  <button
                    key={lesson.id}
                    type="button"
                    onClick={() => setActiveLessonId(lesson.id)}
                    className={[
                      "w-full rounded-2xl border px-4 py-3 text-left transition-base",
                      active
                        ? "border-cyan-300/25 bg-[linear-gradient(135deg,rgba(34,211,238,0.14),rgba(15,23,42,0.88))] shadow-[0_12px_30px_rgba(34,211,238,0.14)]"
                        : "border-white/10 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05]",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Lesson {index + 1}</div>
                        <div className="mt-1 text-sm font-semibold text-slate-100">{lesson.title}</div>
                      </div>
                      <div className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-slate-300">{lesson.duration}</div>
                    </div>
                    <p className="mt-2 text-sm leading-5 text-slate-400">{lesson.summary}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <section className="space-y-6">
          <div className="card p-5 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-cyan-200/80">Current Lesson</div>
                <h2 className="mt-2 text-2xl font-semibold text-white md:text-3xl">{activeLesson.title}</h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">{activeLesson.summary}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300">
                  Estimated time: {activeLesson.duration}
                </div>
                <Link href={activeLesson.href} className="btn btn-3d-primary">
                  Open Lesson Area
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
            <div className="card p-5 md:p-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">What You Will Learn</h3>
                  <ul className="mt-4 space-y-3">
                    {activeLesson.goals.map((goal, index) => (
                      <li key={goal} className="flex gap-3 text-sm leading-6 text-slate-300">
                        <span className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-cyan-300/25 bg-cyan-400/10 text-[11px] text-cyan-100">
                          {index + 1}
                        </span>
                        <span>{goal}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">Recommended Steps</h3>
                  <ol className="mt-4 space-y-3">
                    {activeLesson.steps.map((step, index) => (
                      <li key={step} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Step {index + 1}</div>
                        <p className="mt-2 text-sm leading-6 text-slate-300">{step}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="card p-5">
                <h3 className="text-lg font-semibold text-slate-100">Field Tip</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{activeLesson.tip}</p>
              </div>

              <div className="card p-5">
                <h3 className="text-lg font-semibold text-slate-100">Suggested Next Lesson</h3>
                <p className="mt-2 text-sm text-slate-400">Keep moving through the workflow in order for the smoothest onboarding.</p>
                <div className="mt-4 space-y-2">
                  {LESSONS.filter((lesson) => lesson.id !== activeLesson.id)
                    .slice(0, 3)
                    .map((lesson) => (
                      <button
                        key={lesson.id}
                        type="button"
                        onClick={() => setActiveLessonId(lesson.id)}
                        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left transition-base hover:border-white/15 hover:bg-white/[0.05]"
                      >
                        <span className="text-sm text-slate-200">{lesson.title}</span>
                        <span className="text-xs text-slate-400">{lesson.duration}</span>
                      </button>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}
