"use client";

// Simple, zero-dependency charts for quick insights

export function BarChart({ data = [], valueSuffix = " m" }) {
  const max = Math.max(0, ...data.map((d) => d.value || 0));
  // Abbreviation mapping
  const abbr = {
    "Orientation": "Ori",
    "Whole core sampling": "WC SMPL",
    "Magnetic susceptibility": "Mag",
    "Cutting": "Cut",
  };
  return (
    <div className="w-full">
      <div className="grid grid-cols-6 md:grid-cols-12 gap-3 items-end min-h-[10rem] p-2">
        {data.map((d) => {
          const shortLabel = abbr[d.label] || d.label;
          return (
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
                {shortLabel}
              </div>
              <div className="text-[11px] text-gray-900 font-medium">
                {formatNum(d.value)}
                {valueSuffix}
              </div>
            </div>
          );
        })}
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

export function TrendChart({ points = [], height = 180, color = "#4f46e5" }) {
  // Layout: reserve bottom band for x-axis labels so they don't overlap chart area
  const chartTop = 4;          // top padding
  const chartBottom = 82;      // baseline (leave ~18 units for labels)
  const chartHeightUnits = chartBottom - chartTop; // usable vertical span
  const max = Math.max(0, ...points.map((p) => p.value || 0));
  const n = points.length;
  const px = (i) => (n <= 1 ? 0 : (i / (n - 1)) * 100);
  const py = (v) => (max > 0 ? chartBottom - (v / max) * (chartHeightUnits - 2) : chartBottom - 1);

  // Smooth path via simple Catmull-Rom to Bezier conversion
  function buildSmoothPath(pts) {
    if (pts.length < 2) return "";
    const coords = pts.map((p, i) => [px(i), py(p.value)]);
    if (coords.length === 2) {
      return `M${coords[0][0]},${coords[0][1]} L${coords[1][0]},${coords[1][1]}`;
    }
    const path = [`M${coords[0][0]},${coords[0][1]}`];
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i - 1] || coords[i];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = coords[i + 2] || p2;
      // Catmull-Rom to cubic Bezier
      const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
      const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
      const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
      const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
      path.push(`C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`);
    }
    return path.join(" ");
  }

  const linePath = buildSmoothPath(points);
  const areaPath = linePath ? `${linePath} L100,${chartBottom} L0,${chartBottom} Z` : "";

  // Month labels (use first day of each month present)
  const monthLabels = [];
  const seen = new Set();
  points.forEach((p, i) => {
    if (!p.label) return;
    const date = new Date(p.label);
    if (isNaN(date)) return;
    const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
    if (!seen.has(key)) {
      seen.add(key);
      monthLabels.push({ x: px(i), text: date.toLocaleString(undefined, { month: 'short' }) });
    }
  });

  return (
    <div className="w-full relative" style={{ height }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
        <defs>
          <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Transparent background (no rect) */}
        {/* Horizontal grid / baseline */}
        <line x1="0" x2="100" y1={chartBottom} y2={chartBottom} stroke="#e5e7eb" strokeWidth="0.5" />
        {areaPath && <path d={areaPath} fill="url(#trendFill)" stroke="none" />}
        {linePath && <path d={linePath} stroke={color} strokeWidth={1.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />}
        {/* X-axis month labels */}
        {monthLabels.map((m) => (
          <text key={m.x} x={m.x} y={chartBottom + 10} fontSize={4} textAnchor="middle" fill="#6b7280">{m.text}</text>
        ))}
      </svg>
    </div>
  );
}

// Fresh, simplified responsive line chart to avoid layout skew/stretch issues
// Features: auto-thinning of x labels, aspect-preserving scaling, optional area fill.
export function LineChart({ points = [], height = '100%', color = '#2563eb', area = true, fullBleed = false }) {
  const clean = (points || []).filter(p => p && typeof p.value === 'number');
  const n = clean.length;
  const max = Math.max(0, ...clean.map(p => p.value));
  const min = Math.min(0, ...clean.map(p => p.value));
  const range = max - min || 1;
  // Reduced padding since no x labels now
  const pad = { top: 6, right: 4, bottom: 6, left: 6 };
  const iw = 100 - pad.left - pad.right;
  const ih = 100 - pad.top - pad.bottom;
  const xAt = i => pad.left + (n <= 1 ? iw/2 : (i/(n-1))*iw);
  const yAt = v => pad.top + (1 - ((v - min)/range)) * ih;
  let path = '';
  clean.forEach((p,i) => { path += (i? ' L':'M') + xAt(i) + ',' + yAt(p.value); });
  const areaPath = area && path ? `${path} L${xAt(n-1)},${pad.top+ih} L${xAt(0)},${pad.top+ih} Z` : '';
  const grids = [0,0.25,0.5,0.75,1];
  return (
    <div className={`w-full h-full ${fullBleed ? 'ml-[-1rem] mr-[-1rem] md:ml-[-1.25rem] md:mr-[-1.25rem]' : ''}`} style={{height}}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" className="w-full h-full block">
        <defs>
          <linearGradient id="lcFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {grids.map(g => (
          <line key={g} x1={pad.left} x2={100-pad.right} y1={pad.top + g*ih} y2={pad.top + g*ih} stroke="#e5e7eb" strokeWidth={0.4} />
        ))}
        <line x1={pad.left} x2={pad.left} y1={pad.top} y2={pad.top+ih} stroke="#cbd5e1" strokeWidth={0.5} />
        <line x1={pad.left} x2={100-pad.right} y1={pad.top+ih} y2={pad.top+ih} stroke="#cbd5e1" strokeWidth={0.5} />
        {areaPath && <path d={areaPath} fill="url(#lcFill)" stroke="none" />}
        {path && <path d={path} fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" />}
        {clean.map((p,i)=>(
          <g key={i}>
            <circle cx={xAt(i)} cy={yAt(p.value)} r={1.2} fill={color} />
            <title>{p.label}: {formatNum(p.value)}</title>
          </g>
        ))}
      </svg>
    </div>
  );
}

function formatNum(n) {
  if (!n && n !== 0) return "0";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(n);
}
