const FALLBACK_ICON_KEY = "generic_marker";

export const COMPONENT_ICON_OPTIONS = [
  { value: "pressure_sensor", label: "Pressure Sensor", group: "Sensors" },
  { value: "water_level_sensor", label: "Water Level Sensor", group: "Sensors" },
  { value: "data_logger", label: "Data Logger", group: "Sensors" },
  { value: "telemetry_node", label: "Telemetry Node", group: "Sensors" },
  { value: "flow_meter", label: "Flow Meter", group: "Monitoring" },
  { value: "sampler", label: "Sampler", group: "Monitoring" },
  { value: "piezometer", label: "Piezometer", group: "Monitoring" },
  { value: "submersible_pump", label: "Submersible Pump", group: "Pumps" },
  { value: "dosing_pump", label: "Dosing Pump", group: "Pumps" },
  { value: "single_packer", label: "Single Packer", group: "Packers" },
  { value: "dual_packer", label: "Dual Packer", group: "Packers" },
  { value: "gate_valve", label: "Gate Valve", group: "Valves" },
  { value: "check_valve", label: "Check Valve", group: "Valves" },
  { value: "screen", label: "Screen", group: "Construction" },
  { value: "casing_shoe", label: "Casing Shoe", group: "Construction" },
  { value: "generic_marker", label: "Generic Marker", group: "General" },
];

const ICON_KEY_SET = new Set(COMPONENT_ICON_OPTIONS.map((option) => option.value));

export function resolveComponentIconKey(icon) {
  const value = String(icon || "").trim().toLowerCase();
  if (ICON_KEY_SET.has(value)) return value;

  if (value.includes("pressure")) return "pressure_sensor";
  if (value.includes("level") || value.includes("wave")) return "water_level_sensor";
  if (value.includes("logger")) return "data_logger";
  if (value.includes("telemetry")) return "telemetry_node";
  if (value.includes("flow")) return "flow_meter";
  if (value.includes("sample")) return "sampler";
  if (value.includes("piez")) return "piezometer";
  if (value.includes("submersible")) return "submersible_pump";
  if (value.includes("dosing")) return "dosing_pump";
  if (value.includes("pump")) return "submersible_pump";
  if (value.includes("dual") && value.includes("packer")) return "dual_packer";
  if (value.includes("seal") || value.includes("packer")) return "single_packer";
  if (value.includes("gate") && value.includes("valve")) return "gate_valve";
  if (value.includes("check") && value.includes("valve")) return "check_valve";
  if (value.includes("valve")) return "gate_valve";
  if (value.includes("screen")) return "screen";
  if (value.includes("shoe")) return "casing_shoe";
  if (value.includes("sensor") || value.includes("gauge")) return "pressure_sensor";
  if (value.includes("dot")) return FALLBACK_ICON_KEY;

  return FALLBACK_ICON_KEY;
}

export function getComponentIconOption(icon) {
  const key = resolveComponentIconKey(icon);
  return COMPONENT_ICON_OPTIONS.find((option) => option.value === key) || COMPONENT_ICON_OPTIONS[COMPONENT_ICON_OPTIONS.length - 1];
}

export function ComponentIconGlyph({ icon, cx = 10, cy = 10, selected = false, stroke = "rgba(255,255,255,0.96)", scale = 1 }) {
  const key = resolveComponentIconKey(icon);
  const lineProps = {
    stroke,
    strokeWidth: selected ? 1.9 : 1.6,
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  if (key === "pressure_sensor") {
    return (
      <g transform={scale !== 1 ? `translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})` : undefined}>
        <circle cx={cx} cy={cy} r={3.6} {...lineProps} />
        <line x1={cx} y1={cy} x2={cx + 2.3} y2={cy - 2.3} {...lineProps} />
      </g>
    );
  }

  if (key === "water_level_sensor") {
    return <path d={`M ${cx - 4.4} ${cy + 1.5} Q ${cx - 2.7} ${cy - 1.5} ${cx - 1} ${cy + 1.5} T ${cx + 2.4} ${cy + 1.5} T ${cx + 5.8} ${cy + 1.5}`} {...lineProps} transform={scale !== 1 ? `translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})` : undefined} />;
  }

  if (key === "data_logger") {
    return (
      <g transform={scale !== 1 ? `translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})` : undefined}>
        <rect x={cx - 3.7} y={cy - 4.3} width={7.4} height={8.6} rx={1.6} {...lineProps} />
        <line x1={cx - 1.8} y1={cy - 1.2} x2={cx + 1.8} y2={cy - 1.2} {...lineProps} />
        <line x1={cx - 1.8} y1={cy + 1.5} x2={cx + 1.8} y2={cy + 1.5} {...lineProps} />
      </g>
    );
  }

  if (key === "telemetry_node") {
    return (
      <g transform={scale !== 1 ? `translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})` : undefined}>
        <circle cx={cx} cy={cy} r={1.8} fill={stroke} opacity="0.95" />
        <path d={`M ${cx - 4.2} ${cy + 1.6} Q ${cx} ${cy - 2.4} ${cx + 4.2} ${cy + 1.6}`} {...lineProps} />
        <path d={`M ${cx - 3} ${cy + 3.4} Q ${cx} ${cy + 0.6} ${cx + 3} ${cy + 3.4}`} {...lineProps} />
      </g>
    );
  }

  if (key === "flow_meter") {
    return (
      <g transform={scale !== 1 ? `translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})` : undefined}>
        <circle cx={cx} cy={cy} r={3.2} {...lineProps} />
        <path d={`M ${cx - 1.2} ${cy + 1.3} C ${cx + 0.4} ${cy + 0.4} ${cx + 1.5} ${cy - 1.3} ${cx + 0.5} ${cy - 2.7}`} {...lineProps} />
      </g>
    );
  }

  if (key === "sampler") {
    return (
      <g transform={scale !== 1 ? `translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})` : undefined}>
        <path d={`M ${cx - 2.7} ${cy - 4} H ${cx + 2.7} L ${cx + 1.3} ${cy + 4} H ${cx - 1.3} Z`} {...lineProps} />
        <line x1={cx} y1={cy - 5.2} x2={cx} y2={cy - 3.7} {...lineProps} />
      </g>
    );
  }

  if (key === "piezometer") {
    return (
      <g transform={scale !== 1 ? `translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})` : undefined}>
        <line x1={cx} y1={cy - 5} x2={cx} y2={cy + 5} {...lineProps} />
        <circle cx={cx} cy={cy + 2.6} r={2.2} {...lineProps} />
      </g>
    );
  }

  if (key === "submersible_pump") {
    return (
      <g transform={scale !== 1 ? `translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})` : undefined}>
        <path d={`M ${cx - 3.5} ${cy + 3.5} L ${cx + 4.2} ${cy} L ${cx - 3.5} ${cy - 3.5} Z`} fill={stroke} opacity="0.95" />
        <line x1={cx - 5.5} y1={cy} x2={cx - 1.8} y2={cy} {...lineProps} />
      </g>
    );
  }

  if (key === "dosing_pump") {
    return (
      <g>
        <circle cx={cx - 1} cy={cy} r={3} {...lineProps} />
        <path d={`M ${cx + 1.6} ${cy - 3.1} L ${cx + 4.7} ${cy} L ${cx + 1.6} ${cy + 3.1}`} {...lineProps} />
      </g>
    );
  }

  if (key === "single_packer") {
    return <rect x={cx - 3.2} y={cy - 3.2} width={6.4} height={6.4} transform={`${scale !== 1 ? `translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy}) ` : ""}rotate(45 ${cx} ${cy})`} fill={stroke} opacity="0.95" />;
  }

  if (key === "dual_packer") {
    return (
      <g transform={scale !== 1 ? `translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})` : undefined}>
        <rect x={cx - 5.2} y={cy - 2.4} width={4.4} height={4.4} transform={`rotate(45 ${cx - 3} ${cy})`} fill={stroke} opacity="0.95" />
        <rect x={cx + 0.8} y={cy - 2.4} width={4.4} height={4.4} transform={`rotate(45 ${cx + 3} ${cy})`} fill={stroke} opacity="0.95" />
      </g>
    );
  }

  if (key === "gate_valve") {
    return (
      <g transform={scale !== 1 ? `translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})` : undefined}>
        <rect x={cx - 3.8} y={cy - 3.1} width={7.6} height={6.2} rx="1.5" fill={stroke} opacity="0.92" />
        <line x1={cx} y1={cy - 5.4} x2={cx} y2={cy + 5.4} stroke="rgba(15,23,42,0.9)" strokeWidth="1.2" />
      </g>
    );
  }

  if (key === "check_valve") {
    return (
      <g transform={scale !== 1 ? `translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})` : undefined}>
        <path d={`M ${cx - 4.8} ${cy} H ${cx + 3.2}`} {...lineProps} />
        <path d={`M ${cx + 0.6} ${cy - 2.6} L ${cx + 4.4} ${cy} L ${cx + 0.6} ${cy + 2.6} Z`} fill={stroke} opacity="0.95" />
      </g>
    );
  }

  if (key === "screen") {
    return (
      <g transform={scale !== 1 ? `translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})` : undefined}>
        <rect x={cx - 3.6} y={cy - 4.6} width={7.2} height={9.2} rx="1.6" {...lineProps} />
        <line x1={cx - 2.2} y1={cy - 2.3} x2={cx + 2.2} y2={cy - 2.3} {...lineProps} />
        <line x1={cx - 2.2} y1={cy} x2={cx + 2.2} y2={cy} {...lineProps} />
        <line x1={cx - 2.2} y1={cy + 2.3} x2={cx + 2.2} y2={cy + 2.3} {...lineProps} />
      </g>
    );
  }

  if (key === "casing_shoe") {
    return (
      <g>
        <path d={`M ${cx - 3.4} ${cy - 3.8} H ${cx + 3.4} V ${cy + 1.5} L ${cx} ${cy + 4.5} L ${cx - 3.4} ${cy + 1.5} Z`} {...lineProps} />
      </g>
    );
  }

  return <circle cx={cx} cy={cy} r={2.8} fill={stroke} opacity="0.95" transform={scale !== 1 ? `translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})` : undefined} />;
}

export function ComponentIconSvg({ icon, color = "#38bdf8", size = 20, selected = false, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" className={className} aria-hidden="true">
      <circle cx="10" cy="10" r="8.5" fill={color} opacity="0.22" />
      <ComponentIconGlyph icon={icon} cx={10} cy={10} selected={selected} />
    </svg>
  );
}