"use client";

export async function exportMarkedupSchematicPdf({
  element,
  filename = "schematic-markup.pdf",
  title = "Schematic Markup",
  subtitle = "",
  backgroundColor = "#0b1220",
  pixelRatio = 2.5,
  marginMm = 10,
} = {}) {
  if (!element) throw new Error("exportMarkedupSchematicPdf: element is required");

  const [{ toPng }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);

  const dataUrl = await toPng(element, {
    cacheBust: true,
    pixelRatio,
    backgroundColor,
  });

  const probe = new Image();
  await new Promise((resolve, reject) => {
    probe.onload = resolve;
    probe.onerror = reject;
    probe.src = dataUrl;
  });

  const landscape = probe.width >= probe.height;
  const pdf = new jsPDF({
    orientation: landscape ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const contentW = pageW - marginMm * 2;
  const headerH = subtitle ? 18 : 14;

  pdf.setFillColor(15, 23, 42);
  pdf.roundedRect(marginMm, marginMm, contentW, headerH, 3, 3, "F");
  pdf.setTextColor(248, 250, 252);
  pdf.setFontSize(13);
  pdf.text(title, marginMm + 5, marginMm + 9);
  if (subtitle) {
    pdf.setFontSize(8.5);
    pdf.setTextColor(226, 232, 240);
    pdf.text(subtitle, marginMm + 5, marginMm + 14);
  }

  const imageTop = marginMm + headerH + 6;
  const maxImageW = contentW;
  const maxImageH = pageH - imageTop - marginMm;
  const imageRatio = probe.width / probe.height;

  let imageW = maxImageW;
  let imageH = imageW / imageRatio;
  if (imageH > maxImageH) {
    imageH = maxImageH;
    imageW = imageH * imageRatio;
  }

  const imageX = marginMm + (contentW - imageW) / 2;
  pdf.addImage(dataUrl, "PNG", imageX, imageTop, imageW, imageH, undefined, "FAST");
  pdf.save(filename);
}