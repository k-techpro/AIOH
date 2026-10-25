/**
 * RetailPrime mobile — Printer Service interface (stub).
 *
 * This mirrors the web app's abstraction 1:1
 * (frontend/src/lib/printerService.js in the "Aioh WebApp" project) so
 * billing/label screens here can eventually call the same shape of API
 * regardless of platform:
 *   RetailPrime → PrinterService → platform adapter → printer
 *
 * IMPORTANT — this file is NOT a working native integration. It exists so
 * the call sites and types are ready; the actual Bluetooth transport is
 * deliberately left unimplemented because:
 *   - No official DeTong Android/iOS Bluetooth SDK (.aar / CocoaPods/SPM
 *     package) was supplied to this project — only two Windows installer
 *     .exe files were provided, which this project never executes, bundles
 *     or reverse-engineers (see the web app's print-bridge/README.md for the
 *     same constraint applied there).
 *   - A working native module requires compiling against that SDK and
 *     testing against a physical DP27 over Bluetooth, neither of which is
 *     possible in this environment.
 *
 * To finish this for real:
 *   1. Get the official "Android Bluetooth SDK" .aar from DeTong (the
 *      vendor's own PC SDK download page lists it alongside the PC/iOS/Linux
 *      SDKs — see en.detonger.com).
 *   2. Wrap it in a small Expo config plugin / native module exposing
 *      connect(macAddress), printRaster(bytes), disconnect() — the DP27
 *      speaks a proprietary binary protocol, not ESC/POS or TSPL (confirmed
 *      via github.com/sb-child/dz-print, a third-party reverse-engineered
 *      driver for the same Detonger vendor id), so do not assume ESC/POS
 *      compatibility here either.
 *   3. Implement the methods below using that native module instead of
 *      throwing NOT_IMPLEMENTED.
 *   4. iOS follows the same shape using DeTong's iOS Bluetooth SDK.
 */

export type PrinterRole = "invoicePrinter" | "labelPrinter";

export type PrinterErrorCode =
  | "offline"
  | "not_installed"
  | "driver_missing"
  | "disconnected"
  | "paper_unavailable"
  | "job_failed"
  | "vendor_unavailable"
  | "not_implemented";

export class PrinterServiceError extends Error {
  code: PrinterErrorCode;
  constructor(code: PrinterErrorCode, message: string) {
    super(message);
    this.name = "PrinterServiceError";
    this.code = code;
  }
}

export interface DetectedPrinter {
  id: string;
  name: string;
}

export interface PrinterStatus {
  connected: boolean;
  ready: boolean;
  name: string | null;
}

// Same shape as the web app's PrinterService (req. "MOBILE SUPPORT" —
// structure this so Android Bluetooth printing through DeTong's official SDK
// can be added or supported).
export interface PrinterService {
  detectPrinters(role: PrinterRole): Promise<DetectedPrinter[]>;
  getPrinterStatus(role: PrinterRole): Promise<PrinterStatus>;
  connect(role: PrinterRole): Promise<{ ok: true }>;
  disconnect(role: PrinterRole): Promise<{ ok: true }>;
  printReceipt(invoice: unknown, ctx?: Record<string, unknown>): Promise<{ ok: boolean; error?: string }>;
  printLabel(kind: string, items: unknown[], ctx?: Record<string, unknown>): Promise<{ ok: boolean; error?: string }>;
  testPrint(role: PrinterRole): Promise<{ ok: boolean; error?: string }>;
  calibrate(): Promise<{ ok: boolean; error?: string }>;
}

const notImplemented = (fn: string) => {
  throw new PrinterServiceError("not_implemented", `${fn} requires the official DeTong Android Bluetooth SDK, which is not wired in yet — see the TODO at the top of printerService.ts.`);
};

export const printerService: PrinterService = {
  async detectPrinters() { return []; },
  async getPrinterStatus() { return { connected: false, ready: false, name: null }; },
  async connect() { return notImplemented("connect") as never; },
  async disconnect() { return { ok: true }; },
  async printReceipt() { return notImplemented("printReceipt") as never; },
  async printLabel() { return notImplemented("printLabel") as never; },
  async testPrint() { return notImplemented("testPrint") as never; },
  async calibrate() { return notImplemented("calibrate") as never; },
};
