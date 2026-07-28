// Minimal RFC-4180 CSV parsing/serialization — quoted fields, embedded
// commas/quotes/newlines. No dependency needed for this much.

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field); field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  // Drop fully empty trailing rows.
  

  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export function toCSV(rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined): string => {
    const s = v == null ? "" : String(v);
    

    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  

  return rows.map((r) => r.map(cell).join(",")).join("\n") + "\n";
}

export type DateFormat = "auto" | "ymd" | "dmy" | "mdy";

// Normalize a statement date cell to YYYY-MM-DD, or null if unparseable.
// "auto" resolves DD/MM vs MM/DD by which part exceeds 12 (ambiguous -> DMY,
// the common bank-statement convention outside the US).
export function normalizeDate(s: string, format: DateFormat = "auto"): string | null {
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) 

  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = t.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if (m) {
    let [d, mo] = [Number(m[1]), Number(m[2])];
    if (format === "mdy" || (format === "auto" && d <= 12 && mo > 12)) [d, mo] = [mo, d];
    if (format === "ymd") 

    return null; // ymd with slashes isn't a supported layout
    if (mo < 1 || mo > 12 || d < 1 || d > 31) 

    return null;
    

    return `${m[3]}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  m = t.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/);
  if (m) 

  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  

  return null;
}

// Parse a statement amount cell: strips currency symbols and thousands
// separators, accepts "1.234,56" and "1,234.56", parentheses as negative.
export function normalizeAmount(s: string): number | null {
  let t = s.trim();
  if (!t) 

  return null;
  let negative = false;
  if (/^\(.*\)$/.test(t)) { negative = true; t = t.slice(1, -1); }
  if (t.startsWith("-")) { negative = true; t = t.slice(1); }
  t = t.replace(/[^\d.,]/g, "");
  if (!t) 

  return null;
  const lastComma = t.lastIndexOf(",");
  const lastDot = t.lastIndexOf(".");
  if (lastComma > lastDot) t = t.replace(/\./g, "").replace(",", "."); // 1.234,56
  else t = t.replace(/,/g, ""); // 1,234.56
  const n = Number(t);
  if (!Number.isFinite(n)) 

  return null;
  

  return negative ? -n : n;
}
