"use client";

function IconButton({ label, onClick, children, variant = "default" }) {
  const base =
    "inline-flex items-center justify-center h-8 w-8 rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/60";
  const styles =
    variant === "danger"
      ? "border-red-500/20 bg-red-500/10 text-red-200 hover:bg-red-500/20"
      : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10";

  return (
    <button
      type="button"
      className={`${base} ${styles}`}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function PencilIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
    </svg>
  );
}

function TrashIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

export default function VendorsTable({
  loading,
  vendors,
  onEdit,
  onDelete,
  TABLE_HEAD_ROW,
  TABLE_ROW,
}) {
  return (
    <div className="card p-4">
      {loading ? (
        <div className="text-sm text-slate-300/70">Loading…</div>
      ) : vendors.length === 0 ? (
        <div className="text-sm text-slate-300/70">No vendors found.</div>
      ) : (
        <div className="overflow-x-auto -mx-2 md:mx-0">
          <table className="w-full text-xs md:text-sm min-w-[760px]">
            <thead>
              <tr className={TABLE_HEAD_ROW}>
                <th className="p-2 font-medium">Name</th>
                <th className="p-2 font-medium">Contact</th>
                <th className="p-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.id} className={TABLE_ROW}>
                  <td className="p-2 font-medium">{v.name}</td>
                  <td className="p-2">{v.contact || "—"}</td>
                  <td className="p-2 text-right">
                    <div className="inline-flex items-center gap-2">
                      <IconButton label="Edit" onClick={() => onEdit(v)}>
                        <PencilIcon className="h-4 w-4" />
                      </IconButton>
                      <IconButton label="Delete" variant="danger" onClick={() => onDelete(v)}>
                        <TrashIcon className="h-4 w-4" />
                      </IconButton>
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