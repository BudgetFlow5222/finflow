/**
 * CSV / file export utilities for FinFlow.
 *
 * All functions are client-side only — they touch `document`, `Blob`, and
 * `URL.createObjectURL`. Do not call them from server components / API routes.
 */

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/**
 * Convert an array of objects to a CSV string.
 *
 * - The first row is the header (column labels).
 * - Values containing commas, double quotes, or newlines are wrapped in
 *   double quotes; internal double quotes are escaped by doubling them.
 * - If a column provides a `format` function, it is applied to the raw cell
 *   value *before* escaping — useful for dates and currency.
 */
export function toCSV<T extends object>(
  rows: T[],
  columns: { key: keyof T; label: string; format?: (value: T[keyof T]) => string }[],
): string {
  if (columns.length === 0) return "";

  const escapeCell = (value: unknown): string => {
    let str: string;
    if (value === null || value === undefined) {
      str = "";
    } else if (typeof value === "string") {
      str = value;
    } else if (typeof value === "number" || typeof value === "boolean") {
      str = String(value);
    } else if (value instanceof Date) {
      str = value.toISOString();
    } else {
      // Objects / arrays — best-effort JSON serialisation.
      try {
        str = JSON.stringify(value);
      } catch {
        str = String(value);
      }
    }
    // Wrap in double quotes if the value contains a comma, double quote,
    // newline, or carriage return. Escape any internal double quotes by
    // doubling them (RFC 4180).
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = columns.map((c) => escapeCell(c.label)).join(",");
  const dataLines = rows.map((row) =>
    columns
      .map((c) => {
        const raw = row[c.key];
        const value = c.format ? c.format(raw as T[keyof T]) : raw;
        return escapeCell(value);
      })
      .join(","),
  );

  return [header, ...dataLines].join("\r\n");
}

/**
 * Trigger a browser download of a text file.
 *
 * For `text/csv` (the default), a UTF-8 BOM (`\uFEFF`) is prepended so that
 * Microsoft Excel correctly interprets the file as UTF-8 (otherwise accented
 * characters and ₹ symbols can get mangled).
 */
export function downloadFile(
  filename: string,
  content: string,
  mimeType: string = "text/csv",
): void {
  const bom = mimeType === "text/csv" ? "\uFEFF" : "";
  const blob = new Blob([bom + content], {
    type: `${mimeType};charset=utf-8`,
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Give the browser a tick to start the download before revoking the URL.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Convenience: build a CSV from the given rows/columns and trigger a download.
 */
export function exportToCSV<T extends object>(
  filename: string,
  rows: T[],
  columns: { key: keyof T; label: string; format?: (value: T[keyof T]) => string }[],
): void {
  const csv = toCSV(rows, columns);
  downloadFile(filename, csv, "text/csv");
}
