/**
 * CSV Export Utility
 *
 * Provides robust CSV export functionality with proper escaping for special characters,
 * quotes, and commas. Handles array of objects and converts to downloadable CSV file.
 */

/**
 * Escapes a field value for CSV format.
 *
 * Wraps fields with quotes and escapes any internal quotes by doubling them.
 * Handles null/undefined values.
 *
 * @param field - The field value to escape
 * @returns The properly escaped CSV field
 */
function escapeCSVField(field: any): string {
  if (field === null || field === undefined) {
    return '""';
  }

  const stringValue = String(field);

  // If the field contains comma, newline, or double quote, wrap it and escape quotes
  if (stringValue.includes(",") || stringValue.includes("\n") || stringValue.includes('"')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  // Otherwise, just wrap it in quotes for consistency
  return `"${stringValue}"`;
}

/**
 * Exports data to CSV format and triggers a browser download.
 *
 * Takes an array of objects, extracts headers from the first object,
 * and generates a proper CSV file with escaped fields. Handles edge cases
 * like empty arrays, missing fields, and special characters.
 *
 * @param data - Array of objects to export
 * @param filename - Name of the file to download (should include .csv extension)
 *
 * @example
 * ```ts
 * const alerts = [
 *   { date: "2024-01-01", alertType: "DROWSY", plateNumber: "ABC-123" },
 *   { date: "2024-01-02", alertType: "HARSH_BRAKING", plateNumber: "XYZ-789" }
 * ];
 * exportToCSV(alerts, "alerts-report.csv");
 * ```
 */
export function exportToCSV(data: any[], filename: string): void {
  if (!data || data.length === 0) {
    console.warn("exportToCSV: No data provided");
    return;
  }

  // Extract headers from the first object
  const headers = Object.keys(data[0]);

  // Build CSV content
  const rows: string[] = [];

  // Add header row
  rows.push(headers.map(escapeCSVField).join(","));

  // Add data rows
  for (const item of data) {
    const row = headers.map((header) => {
      const value = item[header];
      return escapeCSVField(value);
    });
    rows.push(row.join(","));
  }

  const csvContent = rows.join("\n");

  // Create Blob and trigger download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the URL object
  URL.revokeObjectURL(url);
}
