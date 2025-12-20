"use client";

export default function TenementsTable({ loading, tenements, onEdit, onDelete }) {
  return (
    <div className="card p-4">
      <div className="text-sm font-medium mb-3">Tenements</div>

      {loading ? (
        <div className="text-sm text-slate-300/70">Loading…</div>
      ) : tenements.length === 0 ? (
        <div className="text-sm text-slate-300/70">No tenements yet. Create your first one.</div>
      ) : (
        <div className="overflow-x-auto -mx-2 md:mx-0">
          <table className="w-full text-xs md:text-sm min-w-[800px]">
            <thead>
              <tr className="text-left bg-slate-900/40 text-slate-200 border-b border-white/10">
                <th className="p-2 font-medium">Tenement #</th>
                <th className="p-2 font-medium">Type</th>
                <th className="p-2 font-medium">Status</th>
                <th className="p-2 font-medium">Applied</th>
                <th className="p-2 font-medium">Granted</th>
                <th className="p-2 font-medium">Renewal</th>
                <th className="p-2 hidden md:table-cell font-medium">Expenditure</th>
                <th className="p-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenements.map((t) => (
                <tr key={t.id} className="border-b last:border-b-0 hover:bg-indigo-50/10">
                  <td className="p-2 font-medium">{t.tenement_number}</td>
                  <td className="p-2">{t.tenement_type || "—"}</td>
                  <td className="p-2">{t.status || "—"}</td>
                  <td className="p-2 whitespace-nowrap">{t.date_applied || "—"}</td>
                  <td className="p-2 whitespace-nowrap">{t.date_granted || "—"}</td>
                  <td className="p-2 whitespace-nowrap">{t.renewal_date || "—"}</td>
                  <td className="p-2 hidden md:table-cell">
                    {t.expenditure_commitment ? Number(t.expenditure_commitment).toFixed(2) : "—"}
                  </td>
                  <td className="p-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="btn btn-xs" onClick={() => onEdit(t)}>
                        Edit
                      </button>
                      <button className="btn btn-xs btn-danger" onClick={() => onDelete(t)}>
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