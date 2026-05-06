"use client";

import Link from "next/link";

const SETUP_ORDER = [
  {
    id: "org",
    step: "01",
    title: "Create or choose your organization",
    href: "/team",
    area: "Team",
    summary: "Everything in the app is scoped to an organization first. If the user is still in the demo org, they should create or join their real org before loading production data.",
    required: ["Organization membership", "User role"],
    outputs: ["Active org selected", "Admin/member access confirmed"],
  },
  {
    id: "projects",
    step: "02",
    title: "Create the project and set the CRS",
    href: "/projects",
    area: "Projects",
    summary: "Projects are the parent records for holes and assets. The coordinate reference system should be configured here before loading any projected locations.",
    required: ["Organization", "Project name"],
    outputs: ["Project record", "Coordinate CRS code or name", "Optional dates, cost code, WBS"],
  },
  {
    id: "references",
    step: "03",
    title: "Add supporting reference data",
    href: "/projects",
    area: "Projects and setup pages",
    summary: "Before field data starts arriving, set up the supporting records that downstream workflows expect to reference.",
    required: ["Project exists"],
    outputs: ["Tenements", "Asset locations", "Asset types", "Resources", "Vendors", "Activity and PLOD types when needed"],
  },
  {
    id: "holes-assets",
    step: "04",
    title: "Load holes and assets into the project",
    href: "/coretasks",
    area: "CoreYard and Map",
    summary: "Holes and assets should be attached to a project as early as possible. That keeps mapping, logging, scheduling, and reporting aligned.",
    required: ["Project", "CRS if using projected coordinates"],
    outputs: ["Hole register", "Mapped assets", "Project-linked field records"],
  },
  {
    id: "map",
    step: "05",
    title: "Use the map to verify and work spatially",
    href: "/map",
    area: "Map",
    summary: "Once holes and assets have coordinates, the map becomes the fastest way to inspect records, move locations, create new spatial records, and jump into CoreYard.",
    required: ["Hole collar longitude and latitude, or asset longitude and latitude"],
    outputs: ["Verified spatial layout", "Filtered project views", "Map-driven record access"],
  },
  {
    id: "coreyard",
    step: "06",
    title: "Run CoreYard workflows",
    href: "/coretasks",
    area: "CoreYard",
    summary: "CoreYard is where users manage holes, logging, dispatch, and core task progress. This area should be used after the project and hole register are in place.",
    required: ["Project-linked holes"],
    outputs: ["Updated hole attributes", "Logging progress", "Dispatch records", "Core task progress"],
  },
  {
    id: "ops",
    step: "07",
    title: "Capture operations, consumables, and schedule",
    href: "/activity",
    area: "Activity, Consumables, Scheduler",
    summary: "Operational workflows become reliable after org, project, hole, and resource structures are already in place.",
    required: ["Resources", "Vendors", "Projects", "Holes", "Activity types where relevant"],
    outputs: ["PLODs", "Consumable tracking", "Scheduled drilling tasks"],
  },
];

const DATA_ORDER = [
  {
    title: "Organization",
    where: "Team",
    why: "Controls access and data ownership.",
    before: "Everything",
  },
  {
    title: "Projects",
    where: "Projects",
    why: "Parent record for holes and assets.",
    before: "Holes, assets, map workflows, CoreYard work",
  },
  {
    title: "Coordinate system",
    where: "Projects",
    why: "Needed before importing projected easting and northing values.",
    before: "Bulk hole loading, mapped asset loading",
  },
  {
    title: "Holes",
    where: "CoreYard",
    why: "CoreYard, scheduling, drillhole viz, and map all depend on the hole register.",
    before: "Logging, dispatch, drillhole viz, scheduler, most drilling workflows",
  },
  {
    title: "Assets",
    where: "Map and assets workflows",
    why: "Required for mapped equipment, operational context, and some field actions.",
    before: "Asset map use, asset-linked activity capture",
  },
  {
    title: "Resources and vendors",
    where: "Setup and operational pages",
    why: "Required for scheduling and operational cost capture.",
    before: "Scheduler, realistic PLOD logging",
  },
  {
    title: "Core task types and progress",
    where: "CoreYard",
    why: "Used to record logging and core-processing progress against holes.",
    before: "Detailed core task tracking and dispatch readiness",
  },
  {
    title: "PLOD activity types and rates",
    where: "Operational setup",
    why: "Needed before users can capture consistent daily operational cost inputs.",
    before: "Reliable PLOD pricing and cost outputs",
  },
];

const MAP_TOOLS = [
  {
    name: "Project scope toggle",
    description: "Switches the workspace between My Projects and Client shared mode.",
  },
  {
    name: "Project and advanced filters",
    description: "Narrow the map by project, drilling type, hole status, completion status, asset type, asset location, and asset status.",
  },
  {
    name: "Holes and Assets navigator",
    description: "Lets users browse visible records from the left panel and frame them on the map.",
  },
  {
    name: "Attributes",
    description: "Opens the attributes drawer for the currently selected hole or asset.",
  },
  {
    name: "Core tasks",
    description: "Jumps straight from the selected hole into CoreYard logging for that hole.",
  },
  {
    name: "Full screen",
    description: "Expands the map canvas for larger-area review.",
  },
  {
    name: "Zoom and compass control",
    description: "The top-right map control handles zoom in, zoom out, and reset orientation or pitch.",
  },
  {
    name: "Open schematic",
    description: "Selection dock action for holes. Opens the drillhole schematic workflow for the selected hole.",
  },
  {
    name: "Move selected item",
    description: "Lets users reposition a selected hole or asset by clicking a new point on the map.",
  },
  {
    name: "Duplicate selected item",
    description: "Creates a copy workflow from the current selection.",
  },
  {
    name: "Propose location",
    description: "Creates or replaces a location proposal for the current hole or asset instead of directly overwriting its coordinates.",
  },
  {
    name: "Review pending proposal",
    description: "Appears when a selected entity already has a pending location proposal waiting for review.",
  },
];

const MAP_WORKFLOW = [
  "Start by selecting the right scope and project so the visible set is small and relevant.",
  "Use the navigator list and the map together. Clicking either a row or a marker will focus the same record.",
  "If a hole or asset is missing, first check that it is assigned to the correct project and has valid saved coordinates.",
  "Create on map is intended for My Projects mode. Users place a free point first, then save the hole or asset into a selected project.",
  "Use move or proposal actions when spatial correction is needed, rather than silently losing the previous location context.",
  "Use the Core tasks button when the user has selected a hole and wants to move directly into CoreYard work without searching again.",
];

const COREYARD_SECTIONS = [
  {
    title: "Core Workbench",
    description: "Best starting point for hole-by-hole work. Users review and edit the drillhole register inside the selected project scope.",
  },
  {
    title: "Add Core and Bulk Import",
    description: "Use Add Core for both one-by-one hole creation and spreadsheet imports. The bulk import mode is the fastest way to load an initial drillhole register into the correct project.",
  },
  {
    title: "Logging",
    description: "Used for recording hole task progress and day-to-day core logging work against selected holes.",
  },
  {
    title: "Sample Dispatch",
    description: "Turns logged or eligible intervals into dispatch-ready sample runs with shipment details.",
  },
  {
    title: "Core Tasks",
    description: "Maintains the task catalog that supports detailed progress tracking against holes.",
  },
];

const COREYARD_RULES = [
  "Create the project first, then load the holes into that project before asking users to log work.",
  "If the user came from the map, CoreYard can open focused on a single hole. That is ideal for field follow-up and quick logging.",
  "Keep project assignment clean. Most CoreYard flows are easier when each hole already belongs to the correct project.",
  "Use Bulk import for initial register setup, then use Logging and Sample Dispatch as the project becomes active.",
  "Core tasks should be treated as the progress layer on top of the hole register, not as a replacement for creating holes.",
];

const BULK_UPLOAD_CHAPTER = [
  {
    step: "01",
    title: "Set the destination project first",
    detail: "Open Add Core, switch to Bulk import, and choose the project before pasting any data. If you are using easting and northing values, make sure the project CRS is configured first.",
  },
  {
    step: "02",
    title: "Use the exact header row",
    detail: "The importer expects the first row to contain headers. The only required header is hole_id. Use the Copy headers or Download sample actions if you need a clean template.",
  },
  {
    step: "03",
    title: "Paste directly from Excel, CSV, or TSV",
    detail: "You can paste tab-delimited data from a spreadsheet or comma-delimited CSV content. The preview panel shows the first 200 rows so you can confirm the import shape before writing anything.",
  },
  {
    step: "04",
    title: "Resolve validation before importing",
    detail: "Fix missing headers, invalid azimuth or dip values, incomplete longitude and latitude pairs, missing CRS for projected coordinates, and unknown descriptor_keys before running the import.",
  },
  {
    step: "05",
    title: "Verify the result in CoreYard and on the map",
    detail: "After import, review the new holes in Add Core or Core Workbench and use the map to confirm that collar coordinates landed where expected.",
  },
];

const BULK_UPLOAD_NOTES = [
  "Required header: hole_id.",
  "Projected collar_easting and collar_northing require the selected project to already have a CRS.",
  "Longitude and latitude must be supplied as a pair, or both left blank.",
  "descriptor_keys can contain descriptor keys or names separated by |, ;, or line breaks.",
  "The importer writes holes into the selected project only; it does not guess the destination from the pasted data.",
];

function SectionBadge({ children }) {
  return (
    <div className="inline-flex items-center rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
      {children}
    </div>
  );
}

function OpenAreaButton({ href, children }) {
  return (
    <Link href={href} className="btn btn-3d-primary w-full justify-center md:w-auto">
      {children}
    </Link>
  );
}

export default function HowToPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-6 lg:py-8">
      <section className="card p-6 md:p-7">
        <div className="max-w-4xl space-y-4">
          <SectionBadge>Platform Guide</SectionBadge>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-50 md:text-4xl">How to use CoreYard efficiently</h1>
            <p className="text-sm leading-6 text-slate-300 md:text-base">
              CoreYard works best when data is loaded in the right order. Start with organization and project structure, then load holes and assets, use the map to verify spatial data, and move into CoreYard logging and operational workflows once the register is stable.
            </p>
          </div>
        </div>
      </section>

      <section className="card p-5 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Recommended setup order</h2>
            <p className="mt-1 text-sm text-slate-400">Follow this sequence to avoid rework and missing links between records.</p>
          </div>
          <OpenAreaButton href="/team">Start with Team</OpenAreaButton>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {SETUP_ORDER.map((item) => (
            <div key={item.id} className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Step {item.step}</div>
                  <h3 className="mt-1 text-base font-semibold text-slate-100">{item.title}</h3>
                  <div className="mt-1 text-xs text-cyan-100/80">{item.area}</div>
                </div>
                <Link href={item.href} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/[0.06]">
                  Open
                </Link>
              </div>

              <p className="mt-3 text-sm leading-6 text-slate-300">{item.summary}</p>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-white/8 bg-black/10 p-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Required first</div>
                  <div className="mt-2 space-y-1.5 text-sm text-slate-300">
                    {item.required.map((entry) => (
                      <div key={entry}>{entry}</div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-black/10 p-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Creates</div>
                  <div className="mt-2 space-y-1.5 text-sm text-slate-300">
                    {item.outputs.map((entry) => (
                      <div key={entry}>{entry}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-5 md:p-6">
        <div className="max-w-3xl">
          <h2 className="text-lg font-semibold text-slate-100">What data needs to exist, and in what order</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            This is the practical dependency chain taken from how the app loads records today. If users populate data out of order, they usually feel it first in the map, CoreYard, and scheduling flows.
          </p>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {DATA_ORDER.map((item) => (
            <div key={item.title} className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-100">{item.title}</h3>
                <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-slate-300">{item.where}</span>
              </div>
              <div className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                <div><span className="text-slate-500">Why:</span> {item.why}</div>
                <div><span className="text-slate-500">Needed before:</span> {item.before}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-5 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <h2 className="text-lg font-semibold text-slate-100">Map page explained</h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              The map is the spatial workspace for holes and assets. It is most useful after records already exist and have valid coordinates saved against them.
            </p>
          </div>
          <OpenAreaButton href="/map">Open Map</OpenAreaButton>
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <h3 className="text-base font-semibold text-slate-100">How to work on the map</h3>
            <div className="mt-3 space-y-3">
              {MAP_WORKFLOW.map((step, index) => (
                <div key={step} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Map step {index + 1}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Prerequisites</div>
            <div className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
              <div>Holes need collar longitude and latitude to appear reliably on the map.</div>
              <div>Assets need longitude and latitude to appear in the mapped asset view.</div>
              <div>Both holes and assets should already belong to the correct project so filters and navigators behave as expected.</div>
              <div>If using projected coordinates in upstream workflows, the project CRS should already be set.</div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-base font-semibold text-slate-100">Map controls and toolbar actions</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {MAP_TOOLS.map((tool) => (
              <div key={tool.name} className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                <div className="text-sm font-semibold text-slate-100">{tool.name}</div>
                <p className="mt-2 text-sm leading-6 text-slate-300">{tool.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card p-5 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <h2 className="text-lg font-semibold text-slate-100">CoreYard guide</h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              CoreYard is the place to work once the project exists and the hole register is in place. This is where users maintain holes, log progress, prepare dispatches, and manage core task definitions.
            </p>
          </div>
          <OpenAreaButton href="/coretasks">Open CoreYard</OpenAreaButton>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {COREYARD_SECTIONS.map((section) => (
            <div key={section.title} className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
              <div className="text-sm font-semibold text-slate-100">{section.title}</div>
              <p className="mt-2 text-sm leading-6 text-slate-300">{section.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-[24px] border border-cyan-300/14 bg-cyan-400/[0.04] p-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/80">CoreYard rules of thumb</div>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {COREYARD_RULES.map((rule, index) => (
              <div key={rule} className="rounded-2xl border border-white/10 bg-black/10 p-4 text-sm leading-6 text-slate-200">
                <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Rule {index + 1}</div>
                <div className="mt-2">{rule}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="bulk-uploading" className="card scroll-mt-24 p-5 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <h2 className="text-lg font-semibold text-slate-100">Bulk uploading chapter</h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              This is the clearest path for loading a new hole register from a spreadsheet. Use it when a project already exists and you want to create many holes in one pass.
            </p>
          </div>
          <OpenAreaButton href="/coretasks?tab=addcore">Open Add Core</OpenAreaButton>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {BULK_UPLOAD_CHAPTER.map((item) => (
            <div key={item.step} className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/75">Step {item.step}</div>
              <div className="mt-2 text-sm font-semibold text-slate-100">{item.title}</div>
              <p className="mt-2 text-sm leading-6 text-slate-300">{item.detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
            <h3 className="text-base font-semibold text-slate-100">What the importer validates</h3>
            <div className="mt-3 space-y-3 text-sm leading-6 text-slate-300">
              <div>Headers must be recognized. Extra unexpected column names are rejected.</div>
              <div>Numeric fields like azimuth, dip, and depths are checked before import.</div>
              <div>Coordinate pairs must be complete. Longitude and latitude belong together, and projected coordinates require a project CRS.</div>
              <div>Descriptor tokens are resolved against the org’s configured hole descriptors.</div>
            </div>
          </div>

          <div className="rounded-[24px] border border-cyan-300/14 bg-cyan-400/[0.04] p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/80">Key reminders</div>
            <div className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
              {BULK_UPLOAD_NOTES.map((item) => (
                <div key={item}>{item}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="card p-5 md:p-6">
        <h2 className="text-lg font-semibold text-slate-100">Fast path for a new real-world rollout</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Link href="/team" className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.05]">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Step 1</div>
            <div className="mt-2 text-sm font-semibold text-slate-100">Create the organization</div>
          </Link>
          <Link href="/projects" className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.05]">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Step 2</div>
            <div className="mt-2 text-sm font-semibold text-slate-100">Create the project and set CRS</div>
          </Link>
          <Link href="/coretasks" className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.05]">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Step 3</div>
            <div className="mt-2 text-sm font-semibold text-slate-100">Load holes into CoreYard</div>
          </Link>
          <Link href="/map" className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.05]">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Step 4</div>
            <div className="mt-2 text-sm font-semibold text-slate-100">Verify spatial data on the map</div>
          </Link>
        </div>
      </section>
    </div>
  );
}
