import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

const cell = (v: unknown) => {
  const t = String(v ?? "");
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
export const toCsv = (headers: string[], rows: (string | number | null | undefined)[][]) => [headers, ...rows].map((r) => r.map(cell).join(",")).join("\n");

/** Mobile equivalent of the web CSV/XLSX export: write the file and open the system share sheet. */
export async function shareCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const uri = (FileSystem.cacheDirectory || FileSystem.documentDirectory) + filename.replace(/[^a-zA-Z0-9_.-]/g, "-");
  await FileSystem.writeAsStringAsync(uri, "\uFEFF" + toCsv(headers, rows));
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing is not available on this device.");
  await Sharing.shareAsync(uri, { mimeType: "text/csv", dialogTitle: filename });
}
