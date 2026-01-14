"use client";

function hexToRgb(hex) {
  if (!hex) return null;
  const h = String(hex).trim().replace("#", "");
  if (![3, 6].includes(h.length)) return null;
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (!Number.isFinite(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function normalizeType(resolved) {
  if (!resolved) return { name: "", color: "" };
  if (typeof resolved === "string") return { name: resolved, color: "" };
  return { name: resolved.name || "", color: resolved.color || "" };
}

function addSectionTitle(pdf, text, y, marginMm) {
  pdf.setFontSize(11);
  pdf.setTextColor(15, 23, 42);
  pdf.text(text, marginMm, y);
  pdf.setDrawColor(226, 232, 240);
  pdf.line(marginMm, y + 2, pdf.internal.pageSize.getWidth() - marginMm, y + 2);
  return y + 6;
}

// NOTE: buildLegendItems removed (no longer needed)

export async function exportSchematicPdf({
  element,
  filename = "schematic.pdf",
  hole,
  geologyIntervals = [],
  annulusIntervals = [],
  constructionIntervals = [],
  resolveGeologyType = (row) => ({ name: row?.typeName || "", color: row?.color || "" }),
  resolveAnnulusType = (row) => ({ name: row?.typeName || "", color: row?.color || "" }),
  resolveConstructionType = (row) => ({ name: row?.typeName || "", color: row?.color || "" }),
  backgroundColor = "#0b1220",
  pixelRatio = 3,
  marginMm = 10,
} = {}) {
  if (!element) throw new Error("exportSchematicPdf: element is required");

  const [{ toPng }, { jsPDF }, autoTableMod] = await Promise.all([
    import("html-to-image"),
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const autoTable = autoTableMod.default;

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const contentW = pageW - marginMm * 2;

  // ---- Header (modern top bar) ----
  pdf.setFillColor(15, 23, 42); // slate-900
  pdf.roundedRect(marginMm, marginMm, contentW, 18, 3, 3, "F");
  pdf.setTextColor(248, 250, 252); // slate-50
  pdf.setFontSize(13);
  pdf.text("Borehole Schematic", marginMm + 6, marginMm + 11);

  pdf.setFontSize(9);
  pdf.setTextColor(226, 232, 240); // slate-200
  const holeId = hole?.hole_id || "—";
  pdf.text(`Hole: ${holeId}`, marginMm + 6, marginMm + 16);
  pdf.text(`Generated: ${new Date().toLocaleString()}`, pageW - marginMm - 6, marginMm + 16, { align: "right" });

  let y = marginMm + 26;

  // ---- Hole attributes panel ----
  y = addSectionTitle(pdf, "Hole attributes", y, marginMm);

  const attrs = [
    ["Project", hole?.projects?.name ?? hole?.project_id ?? "—"],
    ["Actual depth (m)", hole?.depth ?? "—"],
    ["Planned depth (m)", hole?.planned_depth ?? "—"],
    ["Water level (m)", hole?.water_level_m ?? "—"],
  ];

  autoTable(pdf, {
    startY: y,
    head: [["Field", "Value"]],
    body: attrs,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2.2, lineColor: [226, 232, 240], lineWidth: 0.2 },
    headStyles: { fillColor: [30, 41, 59], textColor: [248, 250, 252] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: marginMm, right: marginMm },
    tableWidth: contentW,
    columnStyles: { 0: { cellWidth: 48 }, 1: { cellWidth: contentW - 48 } },
  });

  y = (pdf.lastAutoTable?.finalY ?? y) + 8;

  // ---- Helper: intervals table ----
  const addIntervalsTable = (title, rows, resolveType) => {
    y = addSectionTitle(pdf, title, y, marginMm);

    const body = (rows || []).map((r) => {
      const t = normalizeType(resolveType(r));
      const from = r.from_m ?? "";
      const to = r.to_m ?? "";
      return [from, to, t.name || "—", t.color || "", r.notes || ""];
    });

    autoTable(pdf, {
      startY: y,
      head: [["From (m)", "To (m)", "Type", "Colour", "Notes"]],
      body: body.length ? body : [["—", "—", "No intervals", "", ""]],
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2, lineColor: [226, 232, 240], lineWidth: 0.2, textColor: [15, 23, 42] },
      headStyles: { fillColor: [30, 41, 59], textColor: [248, 250, 252] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: marginMm, right: marginMm },
      tableWidth: contentW,
      columnStyles: {
        0: { cellWidth: 18, halign: "right" },
        1: { cellWidth: 18, halign: "right" },
        2: { cellWidth: 52 },
        3: { cellWidth: 16 }, // narrower (swatch only)
        4: { cellWidth: contentW - (18 + 18 + 52 + 16) },
      },
      didDrawCell: (data) => {
        // swatch in the "Colour" column (index 3)
        if (data.section !== "body") return;
        if (data.column.index !== 3) return;

        const hex = String(data.cell.raw || "").trim();
        const rgb = hexToRgb(hex);
        if (!rgb) return;

        const sw = 7;
        const x = data.cell.x + (data.cell.width - sw) / 2;
        const y0 = data.cell.y + (data.cell.height - sw) / 2;

        // clear any text in the colour cell by painting over it (then draw swatch)
        pdf.setFillColor(255, 255, 255);
        pdf.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, "F");

        pdf.setFillColor(rgb.r, rgb.g, rgb.b);
        pdf.roundedRect(x, y0, sw, sw, 1, 1, "F");
        pdf.setDrawColor(203, 213, 225);
        pdf.roundedRect(x, y0, sw, sw, 1, 1, "S");
      },
    });

    y = (pdf.lastAutoTable?.finalY ?? y) + 8;
  };

  // ---- Three separate tables ----
  addIntervalsTable("Geology intervals", geologyIntervals, resolveGeologyType);
  addIntervalsTable("Annulus intervals", annulusIntervals, resolveAnnulusType);
  addIntervalsTable("Construction intervals", constructionIntervals, resolveConstructionType);

  // ---- Schematic image: page 1 if fits, else page 2 ----
  await new Promise((r) => setTimeout(r, 50));

  const dataUrl = await toPng(element, {
    cacheBust: true,
    pixelRatio,
    backgroundColor,
  });

  const imgProps = pdf.getImageProperties(dataUrl);
  const imgW = contentW;
  const imgH = (imgProps.height * imgW) / imgProps.width;

  const availableH = pageH - marginMm - (y + 2);
  if (imgH > availableH) {
    pdf.addPage();
    y = marginMm;
  }

  y = addSectionTitle(pdf, "Schematic", y, marginMm);
  pdf.addImage(dataUrl, "PNG", marginMm, y, imgW, imgH, undefined, "FAST");

  pdf.save(filename);
}