// CSV rather than PDF — this is "give me the raw data to work with in
// Excel/Sheets," not a formatted document to print, and a CSV export
// works identically for every table in the app with zero per-table
// template work (a PDF table would need its own @react-pdf/renderer
// layout built per page, the way invoices/payslips/reports already do
// for the documents that actually need to look like a document).
export function downloadCSV(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const escape = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // Leading "#" row-number column, added here rather than by every call
  // site — matches the same leading "#" column now on every on-screen
  // .dt-table, so a row's position lines up between what's on screen
  // and what's in the exported file.
  const numberedHeaders = ["#", ...headers];
  const numberedRows = rows.map((r, i) => [i + 1, ...r]);
  const lines = [numberedHeaders.map(escape).join(","), ...numberedRows.map((r) => r.map(escape).join(","))];
  // Leading UTF-8 BOM — without it, Excel (not Sheets, not a text
  // editor) mis-renders non-ASCII characters like ₹ in an otherwise
  // valid UTF-8 CSV.
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
