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

// Improved line chart with full x-axis label support (rotated if dense)
export function LineChartX({ points = [], height = 200, color = '#2563eb', area = true, showValues = false }) {
  const max = Math.max(0, ...points.map(p => p.value || 0));
  const n = points.length;
  const topPad = 8; // svg units
  const bottomPad = 30; // space for labels
  const leftPad = 4;
  const rightPad = 2;
  const innerWidth = 100 - leftPad - rightPad;
  const innerHeight = 100 - topPad - bottomPad;
  const xAt = (i) => n <= 1 ? leftPad + innerWidth/2 : leftPad + (i/(n-1))*innerWidth;
  const yAt = (v) => max > 0 ? topPad + (1 - (v/max)) * innerHeight : topPad + innerHeight;
  // Build path
  const path = points.reduce((acc,p,i)=>{
    const x = xAt(i), y = yAt(p.value || 0);
    if (i===0) return `M${x},${y}`;
    return acc + ` L${x},${y}`;
  }, '');
  const areaPath = area && path ? path + ` L${xAt(n-1)},${topPad+innerHeight} L${xAt(0)},${topPad+innerHeight} Z` : '';
  // Decide which labels to show to avoid overlap
  let labelIdxs = [];
  if (n <= 12) {
    labelIdxs = points.map((_p,i)=>i);
  } else {
    const target = 12;
    const step = (n-1)/(target-1);
    for (let i=0;i<target;i++) labelIdxs.push(Math.round(i*step));
    const set = new Set(labelIdxs);
    // ensure first/last
    set.add(0); set.add(n-1);
    labelIdxs = Array.from(set).sort((a,b)=>a-b);
  }
  return (
    <div className="w-full" style={{height}}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
        <defs>
          <linearGradient id="lcxFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {[0,0.25,0.5,0.75,1].map(g => (
          <line key={g} x1={leftPad} x2={100-rightPad} y1={topPad + g*innerHeight} y2={topPad + g*innerHeight} stroke="#f1f5f9" strokeWidth="0.5" />
        ))}
        {/* Axis */}
        <line x1={leftPad} x2={100-rightPad} y1={topPad+innerHeight} y2={topPad+innerHeight} stroke="#cbd5e1" strokeWidth="0.6" />
        {areaPath && <path d={areaPath} fill="url(#lcxFill)" stroke="none" />}
        {path && <path d={path} fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" />}
        {points.map((p,i)=>(
          <g key={i}>
            <circle cx={xAt(i)} cy={yAt(p.value || 0)} r={1.3} fill={color} />
            <title>{p.label}: {formatNum(p.value)}</title>
            {showValues && <text x={xAt(i)} y={yAt(p.value || 0)-2} fontSize={3} textAnchor="middle" fill="#334155">{formatNum(p.value)}</text>}
          </g>
        ))}
        {labelIdxs.map(i => (
          <g key={'lbl'+i} transform={`translate(${xAt(i)}, ${topPad+innerHeight+2})`}>
            <text fontSize={3.2} textAnchor="end" transform="rotate(-45)" fill="#475569">{points[i].label}</text>
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
