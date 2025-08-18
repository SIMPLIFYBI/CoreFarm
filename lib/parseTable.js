// Parses CSV or TSV pasted from Excel/Sheets into an array of objects.
// - First row must contain headers
// - Delimiter auto-detected (comma or tab)
// - Trims whitespace from headers and values
export function parseTable(text) {
  if (!text) return [];
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const headers = lines[0].split(delimiter).map((h) => h.trim().toLowerCase());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map((c) => c.trim());
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = cols[idx] ?? "";
    });
    rows.push(obj);
  }
  return rows;
}
