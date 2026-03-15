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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 md:px-6 lg:py-8">
      <section className="card p-6 md:p-7">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
            Platform Lessons
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-50 md:text-4xl">How To Use CoreFarm</h1>
            <p className="text-sm leading-6 text-slate-300 md:text-base">
              Start with the quick setup path, then use the lesson cards below whenever you need help with a specific area of the platform.
            </p>
          </div>
        </div>
      </section>

      <section className="card p-5 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Quick Start</h2>
            <p className="mt-1 text-sm text-slate-400">The shortest path to getting a project live.</p>
          </div>
          <Link href="/projects" className="btn btn-3d-glass w-full justify-center text-xs md:w-auto">
            Open Projects
          </Link>
        </div>
        <ol className="mt-5 grid gap-3 md:grid-cols-2">
          {QUICK_START.map((item, index) => (
            <li key={item} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-400/10 text-sm font-semibold text-cyan-100">
                {index + 1}
              </div>
              <p className="text-sm leading-6 text-slate-300">{item}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-slate-100">Lessons</h2>
          <p className="text-sm text-slate-400">Select a topic for a simple walkthrough and a direct link into the app.</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {LESSONS.map((lesson, index) => {
            const active = lesson.id === activeLesson.id;
            return (
              <button
                key={lesson.id}
                type="button"
                onClick={() => setActiveLessonId(lesson.id)}
                className={[
                  "rounded-2xl border p-4 text-left transition-base",
                  active
                    ? "border-cyan-300/25 bg-cyan-400/10"
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
                <p className="mt-3 text-sm leading-5 text-slate-400">{lesson.summary}</p>
              </button>
            );
          })}
        </div>

        <div className="card p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="max-w-3xl">
              <div className="text-xs uppercase tracking-[0.18em] text-cyan-200/80">Current Lesson</div>
              <h3 className="mt-2 text-2xl font-semibold text-white">{activeLesson.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-300 md:text-base">{activeLesson.summary}</p>
            </div>
            <Link href={activeLesson.href} className="btn btn-3d-primary w-full justify-center md:w-auto">
              Open Lesson Area
            </Link>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-6">
              <div>
                <h4 className="text-base font-semibold text-slate-100">What You Will Learn</h4>
                <ul className="mt-3 space-y-3">
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
                <h4 className="text-base font-semibold text-slate-100">Recommended Steps</h4>
                <ol className="mt-3 space-y-3">
                  {activeLesson.steps.map((step, index) => (
                    <li key={step} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Step {index + 1}</div>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{step}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Field Tip</div>
              <p className="mt-3 text-sm leading-6 text-slate-300">{activeLesson.tip}</p>
              <div className="mt-4 rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-300">
                Estimated time: {activeLesson.duration}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
