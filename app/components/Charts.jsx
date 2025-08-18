"use client";

// Simple, zero-dependency charts for quick insights

export function BarChart({ data = [], valueSuffix = " m" }) {
  const max = Math.max(0, ...data.map((d) => d.value || 0));
  return (
    <div className="w-full">
      <div className="grid grid-cols-6 md:grid-cols-12 gap-3 items-end min-h-[10rem] p-2">
        {data.map((d) => (
          <div key={d.label} className="flex flex-col items-center gap-1">
            <div
              className="w-full rounded-t-md"
              style={{
                background: d.color,
                height: max > 0 ? `${Math.max(4, (d.value / max) * 120)}px` : 4,
              }}
              title={`${d.label}: ${formatNum(d.value)}${valueSuffix}`}
            />
            <div className="text-[11px] text-gray-600 text-center truncate max-w-[5rem]" title={d.label}>
              {d.label}
            </div>
            <div className="text-[11px] text-gray-900 font-medium">
              {formatNum(d.value)}
              {valueSuffix}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DonutChart({ data = [], size = 160, valueSuffix = " m" }) {
  const total = data.reduce((a, b) => a + (b.value || 0), 0);
  // Build conic-gradient string
  let acc = 0;
  const segments = data.map((d) => {
    const pct = total > 0 ? (d.value / total) * 100 : 0;
    const seg = `${d.color} ${acc.toFixed(2)}% ${(acc + pct).toFixed(2)}%`;
    acc += pct;
    return seg;
  });
  const gradient = segments.length ? `conic-gradient(${segments.join(", ")})` : "#f3f4f6";

  return (
    <div className="flex items-center gap-6">
      <div
        className="relative"
        style={{ width: size, height: size, minWidth: size }}
        aria-label={`Total ${formatNum(total)}${valueSuffix}`}
        title={`Total ${formatNum(total)}${valueSuffix}`}
      >
        <div className="absolute inset-0 rounded-full" style={{ background: gradient }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-full bg-white" style={{ width: size * 0.6, height: size * 0.6 }} />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-xs text-gray-500">Total</div>
            <div className="text-lg font-semibold">{formatNum(total)}</div>
            <div className="text-xs text-gray-500">{valueSuffix.trim()}</div>
          </div>
        </div>
      </div>
      <ul className="space-y-1 text-sm">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded" style={{ background: d.color }} />
            <span className="text-gray-700">{d.label}</span>
            <span className="ml-auto tabular-nums text-gray-900">{formatNum(d.value)}</span>
            <span className="text-gray-500">{valueSuffix.trim()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TrendChart({ points = [], height = 120, color = "#4f46e5" }) {
  const max = Math.max(0, ...points.map((p) => p.value || 0));
  const n = points.length;
  const px = (i) => (n <= 1 ? 0 : (i / (n - 1)) * 100);
  const py = (v) => (max > 0 ? 100 - (v / max) * 90 - 5 : 95);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(2)},${py(p.value).toFixed(2)}`)
    .join(" ");
  const area = `${path} L100,100 L0,100 Z`;
  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full" style={{ height }}>
        <defs>
          <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="100" height="100" fill="#ffffff" />
        <path d={area} fill="url(#trendFill)" />
        <path d={path} stroke={color} strokeWidth="1.5" fill="none" />
      </svg>
    </div>
  );
}

function formatNum(n) {
  if (!n && n !== 0) return "0";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(n);
}
