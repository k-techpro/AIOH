// Real CODE128 barcodes + QR codes as SVG strings, shared by the on-screen preview (react-native-svg SvgXml) and the
// printable label HTML. Uses the same encoders as the web app (jsbarcode / qrcode), so a label printed from the phone
// scans exactly like one printed from the browser. Payload convention: QR = "AIOH:P:<product_code>".
import JsBarcode from "jsbarcode";
import QRCodeCore from "qrcode/lib/core/qrcode.js";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function code128Svg(value: string, opts: { height?: number; module?: number; margin?: number; text?: boolean } = {}): string {
  const text = String(value ?? "");
  if (!text) throw new Error("Nothing to encode");
  const target: { encodings?: { data: string }[] } = {};
  JsBarcode(target, text, { format: "CODE128", valid: () => undefined });
  const bits: string = target.encodings?.map((e) => e.data).join("") || "";
  if (!bits) throw new Error("Could not encode this value as CODE128");
  const m = opts.module ?? 2, h = opts.height ?? 70, quiet = opts.margin ?? 10 * m;
  const width = bits.length * m + quiet * 2;
  const labelH = opts.text === false ? 0 : 16;
  let rects = "", run = 0;
  for (let i = 0; i <= bits.length; i += 1) {
    if (bits[i] === "1") run += 1;
    else if (run) { rects += `<rect x="${(i - run) * m + quiet}" y="0" width="${run * m}" height="${h}"/>`; run = 0; }
  }
  const label = labelH ? `<text x="${width / 2}" y="${h + 13}" text-anchor="middle" font-family="monospace" font-size="12" fill="#000">${esc(text)}</text>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${h + labelH}" width="${width}" height="${h + labelH}"><rect width="100%" height="100%" fill="#fff"/><g fill="#000">${rects}</g>${label}</svg>`;
}

export function qrSvg(value: string, opts: { size?: number; margin?: number } = {}): string {
  const text = String(value ?? "");
  if (!text) throw new Error("Nothing to encode");
  const qr = QRCodeCore.create(text, { errorCorrectionLevel: "M" });
  const n: number = qr.modules.size, data: Uint8Array = qr.modules.data, q = opts.margin ?? 2;
  let path = "";
  for (let y = 0; y < n; y += 1) for (let x = 0; x < n; x += 1) if (data[y * n + x]) path += `M${x + q} ${y + q}h1v1h-1z`;
  const size = opts.size ?? 160;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + q * 2} ${n + q * 2}" width="${size}" height="${size}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}

export const productQrPayload = (code: string) => `AIOH:P:${code}`;
