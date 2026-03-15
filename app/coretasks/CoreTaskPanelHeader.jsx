export default function CoreTaskPanelHeader({ eyebrow, title, description, stats = [], actions = null }) {
  return (
    <section className="overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/60 shadow-[0_30px_100px_rgba(2,6,23,0.42)] backdrop-blur-xl">
      <div className="bg-[linear-gradient(135deg,rgba(15,23,42,0.9),rgba(8,47,73,0.68)_48%,rgba(30,41,59,0.82))]">
        <div className="relative flex flex-col gap-3 border-b border-white/10 px-4 py-4 md:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">{eyebrow}</div>
            <div className="mt-1 text-lg font-semibold text-white md:text-[1.65rem] md:leading-9">{title}</div>
            {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{description}</p> : null}
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between lg:justify-end">
            {stats.length ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                {stats.map((stat) => (
                  <span key={stat.label} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                    {stat.value} {stat.label}
                  </span>
                ))}
              </div>
            ) : null}
            {actions}
          </div>
        </div>
      </div>
    </section>
  );
}
