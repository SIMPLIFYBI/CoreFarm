"use client";

// Simple, zero-dependency charts for quick insights
import { useState, useEffect, useRef, useId } from "react";

// Modern BarChart implementation
export function BarChart({ data = [], valueSuffix = " m", animate = true, duration = 600, height = 180 }) {
  const max = Math.max(0, ...data.map(d => d.value || 0));
  const [mounted, setMounted] = useState(false);
  useEffect(() => { if (animate) { const t=requestAnimationFrame(()=>setMounted(true)); return ()=>cancelAnimationFrame(t);} }, [animate]);
  const abbr = {
    "Orientation": "Ori",
    "Whole core sampling": "WC", // shorter for tight layouts
    "Magnetic susceptibility": "Mag",
    "Cutting": "Cut",
  };
  function shade(hex){
    if(!hex || typeof hex!=='string' || !hex.startsWith('#') || (hex.length!==7 && hex.length!==4)) return hex;
    let r,g,b; if(hex.length===7){ r=parseInt(hex.slice(1,3),16); g=parseInt(hex.slice(3,5),16); b=parseInt(hex.slice(5,7),16);} else { r=parseInt(hex[1]+hex[1],16); g=parseInt(hex[2]+hex[2],16); b=parseInt(hex[3]+hex[3],16);} r=Math.max(0,Math.min(255,Math.round(r*0.8))); g=Math.max(0,Math.min(255,Math.round(g*0.8))); b=Math.max(0,Math.min(255,Math.round(b*0.8))); return `rgb(${r} ${g} ${b})`; }
  return (
    <div className="w-full">
      <div className="flex items-end gap-3 px-2" style={{height}}>
        {data.map((d,i)=>{
          const shortLabel = abbr[d.label] || d.label;
          const pct = max>0 ? (d.value/max) : 0;
          const barHeightPct = mounted ? pct : 0;
          return (
            <div key={d.label} className="flex flex-col items-center flex-1 min-w-0 h-full group" title={`${d.label}: ${formatNum(d.value)}${valueSuffix}`}>
              <div className="relative w-full flex-1 flex items-end">
                <div
                  className="w-full rounded-md relative overflow-hidden transition-all duration-500 ease-out border border-black/5 shadow-sm"
                  style={{
                    height: `${Math.max(4, barHeightPct * 100)}%`,
                    background: `linear-gradient(180deg, ${d.color} 0%, ${shade(d.color)} 100%)`,
                    transitionDuration: duration + 'ms'
                  }}
                >
                  <span className="absolute top-1 left-1 right-1 text-[10px] leading-tight font-medium text-white/90 drop-shadow-sm text-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {formatNum(d.value)}{valueSuffix}
                  </span>
                </div>
              </div>
              <div className="mt-2 h-[28px] w-full text-center text-[11px] text-gray-700 truncate" title={d.label}>{shortLabel}</div>
              <div className="text-[10px] font-medium text-gray-900 tabular-nums md:hidden">{formatNum(d.value)}{valueSuffix}</div>
            </div>
          );
        })}
      </div>
      {/* Desktop value row (keeps bars aligned) */}
      <div className="hidden md:flex gap-3 px-2 mt-1">
        {data.map(d => (
          <div key={d.label} className="flex-1 min-w-0 text-center text-[11px] font-medium text-gray-900 tabular-nums">
            {formatNum(d.value)}{valueSuffix}
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
export function LineChart({ points = [], height = '100%', color = '#2563eb', area = true, fullBleed = false, animate = true, duration = 700, ease = 'ease-out' }) {
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
  const [mounted, setMounted] = useState(false);
  const pathRef = useRef(null);
  const unique = useId();
  useEffect(()=>{ if(animate){ const t=requestAnimationFrame(()=>setMounted(true)); return ()=>cancelAnimationFrame(t);} },[animate]);
  const strokeDashProps = {};
  if (animate) {
    const len = pathRef.current?.getTotalLength?.() || 0;
    strokeDashProps.strokeDasharray = len;
    strokeDashProps.strokeDashoffset = mounted ? 0 : len;
  }
  return (
    <div className={`w-full h-full ${fullBleed ? 'ml-[-1rem] mr-[-1rem] md:ml-[-1.25rem] md:mr-[-1.25rem]' : ''}`} style={{height}}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full block">
        <defs>
          <linearGradient id={`lcFill-${unique}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {grids.map(g => (
          <line key={g} x1={pad.left} x2={100-pad.right} y1={pad.top + g*ih} y2={pad.top + g*ih} stroke="#e5e7eb" strokeWidth={0.4} />
        ))}
        <line x1={pad.left} x2={pad.left} y1={pad.top} y2={pad.top+ih} stroke="#cbd5e1" strokeWidth={0.5} />
        <line x1={pad.left} x2={100-pad.right} y1={pad.top+ih} y2={pad.top+ih} stroke="#cbd5e1" strokeWidth={0.5} />
        {areaPath && <path d={areaPath} fill={`url(#lcFill-${unique})`} stroke="none" style={animate ? {opacity: mounted ? 1:0, transition:`opacity ${duration}ms ${ease}`} : undefined} />}
        {path && <path ref={pathRef} d={path} fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" style={animate ? { transition: `stroke-dashoffset ${duration}ms ${ease}` } : undefined} {...strokeDashProps} />}
        {clean.map((p,i)=>(
          <g key={i}>
            <circle cx={xAt(i)} cy={yAt(p.value)} r={1.2} fill={color} style={animate ? {opacity: mounted ? 1:0, transformOrigin:'center', transition:`opacity ${duration}ms ${ease} ${(i*50)}ms`} : undefined} />
            <title>{p.label}: {formatNum(p.value)}</title>
          </g>
        ))}
      </svg>
    </div>
  );
}

// 14-day stacked column chart: expects data=[{date:'YYYY-MM-DD', segments:[{key,label,color,value}], total}]
export function StackedColumnChart({ data = [], height = 160, fullBleed = false, animate = true, duration = 600 }) {
  const [mounted, setMounted] = useState(false);
  useEffect(()=>{ if(animate){ const t=requestAnimationFrame(()=>setMounted(true)); return ()=>cancelAnimationFrame(t);} },[animate]);
  const max = Math.max(0, ...data.map(d => d.total || 0));
  function shade(hex){
    if(!hex || typeof hex!=='string' || !hex.startsWith('#') || (hex.length!==7 && hex.length!==4)) return hex;
    let r,g,b; if(hex.length===7){ r=parseInt(hex.slice(1,3),16); g=parseInt(hex.slice(3,5),16); b=parseInt(hex.slice(5,7),16);} else { r=parseInt(hex[1]+hex[1],16); g=parseInt(hex[2]+hex[2],16); b=parseInt(hex[3]+hex[3],16);} r=Math.max(0,Math.min(255,Math.round(r*0.8))); g=Math.max(0,Math.min(255,Math.round(g*0.8))); b=Math.max(0,Math.min(255,Math.round(b*0.8))); return `rgb(${r} ${g} ${b})`; }
  return (
    <div className={`w-full ${fullBleed ? 'ml-[-1rem] mr-[-1rem] md:ml-[-1.25rem] md:mr-[-1.25rem]' : ''}`} style={{height}}>
      <div className="flex items-end h-full gap-2 px-2">
        {data.map((day,i)=>{
          const pct = max>0 ? (day.total/max) : 0;
            const barHeightPct = mounted ? pct : 0;
            const label = day.date.slice(5); // MM-DD
            return (
              <div key={day.date} className="flex flex-col items-center justify-end flex-1 min-w-0 h-full group" title={`${day.date}: ${formatNum(day.total)} m`}>
                <div className="relative w-full flex-1 flex items-end">
                  <div className="w-full relative rounded-md overflow-hidden border border-black/5 shadow-sm flex flex-col-reverse" style={{height: `${Math.max(4, barHeightPct*100)}%`, transition:`height ${duration}ms cubic-bezier(.4,.0,.2,1)`}}>
                    {day.segments.filter(s=>s.value>0).map(seg => {
                      const segPct = day.total>0 ? (seg.value/day.total)*100 : 0;
                      return (
                        <div key={seg.key} className="w-full" style={{height: segPct+'%', background:`linear-gradient(180deg, ${seg.color} 0%, ${shade(seg.color)} 100%)`}} title={`${seg.label}: ${formatNum(seg.value)} m`} />
                      );
                    })}
                    {day.total === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[9px] text-gray-400">0</span>
                      </div>
                    )}
                    <span className="absolute top-1 left-1 right-1 text-[10px] leading-tight font-medium text-white/90 drop-shadow-sm text-center opacity-0 group-hover:opacity-100 transition-opacity">
                      {formatNum(day.total)} m
                    </span>
                  </div>
                </div>
                <div className="mt-1 h-[18px] w-full text-center text-[10px] text-gray-600 truncate" title={day.date}>{label}</div>
              </div>
            );
        })}
      </div>
      {/* Legend (inline compact) */}
      {data.length>0 && data[0].segments && data[0].segments.length>0 && (
        <div className="flex flex-wrap gap-2 mt-2 px-2 justify-center">
          {(() => { // gather unique segments with color preserving order of first day
            const seen = new Map();
            data.forEach(d => d.segments.forEach(s => { if(!seen.has(s.key)) seen.set(s.key, s); }));
            return Array.from(seen.values()).map(s => (
              <div key={s.key} className="flex items-center gap-1 text-[10px] text-gray-600">
                <span className="h-2 w-2 rounded-sm" style={{background:s.color}} />
                <span>{s.label}</span>
              </div>
            ));
          })()}
        </div>
      )}
    </div>
  );
}

function formatNum(n) {
  if (!n && n !== 0) return "0";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(n);
}
