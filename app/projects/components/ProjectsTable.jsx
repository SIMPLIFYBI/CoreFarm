"use client";

export default function ProjectsTable({ loading, projects, onEdit, onDelete }) {
  return (
    <div className="card p-4">
      <div className="text-sm font-medium mb-3">Project List</div>

      {loading ? (
        <div className="text-sm text-slate-300/70">Loading…</div>
      ) : projects.length === 0 ? (
        <div className="text-sm text-slate-300/70">No projects yet. Create your first one.</div>
      ) : (
        <div className="overflow-x-auto -mx-2 md:mx-0">
          <table className="w-full text-xs md:text-sm min-w-[640px]">
            <thead>
              <tr className="text-left bg-slate-900/40 text-slate-200 border-b border-white/10">
                <th className="p-2 font-medium">Name</th>
                <th className="p-2 font-medium">Start</th>
                <th className="p-2 font-medium">Finish</th>
                <th className="p-2 hidden md:table-cell font-medium">Cost Code</th>
                <th className="p-2 hidden md:table-cell font-medium">WBS</th>
                <th className="p-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-b last:border-b-0 hover:bg-indigo-50/10">
                  <td className="p-2 font-medium">{p.name}</td>
                  <td className="p-2 whitespace-nowrap">{p.start_date || "—"}</td>
                  <td className="p-2 whitespace-nowrap">{p.finish_date || "—"}</td>
                  <td className="p-2 hidden md:table-cell">{p.cost_code || "—"}</td>
                  <td className="p-2 hidden md:table-cell">{p.wbs_code || "—"}</td>
                  <td className="p-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="btn btn-xs" onClick={() => onEdit(p)}>
                        Edit
                      </button>
                      <button className="btn btn-xs btn-danger" onClick={() => onDelete(p)}>
                        Del
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}