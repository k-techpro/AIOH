import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { getApp, getApps } from "@react-native-firebase/app";
import { getDownloadURL, getStorage, putFile, ref } from "@react-native-firebase/storage";
import type { Invoice } from "../store/mock-data";

const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
const money = (value: number) => "₹" + Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const invoiceHtml = (invoice: Invoice) => "<!doctype html><html><head><meta charset=\"utf-8\"/><style>body{font-family:Arial;color:#172033;padding:28px}h1{margin:0;color:#2563eb}.muted{color:#64748b}table{width:100%;border-collapse:collapse;margin:24px 0}th,td{padding:10px;border-bottom:1px solid #e2e8f0;text-align:left}th:last-child,td:last-child{text-align:right}.total{font-size:20px;font-weight:bold}</style></head><body><h1>RetailPrime</h1><p class=\"muted\">" + escape(invoice.shop_name) + " · Invoice " + escape(invoice.invoice_number) + "</p><p><b>Customer:</b> " + escape(invoice.customer_name) + "<br/><span class=\"muted\">" + escape(invoice.customer_phone || "Walk-in customer") + "</span></p><table><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>" + invoice.items.map(item => "<tr><td>" + escape(item.name) + "</td><td>" + Number(item.quantity) + "</td><td>" + money(item.price) + "</td><td>" + money(item.subtotal) + "</td></tr>").join("") + "</tbody></table><table><tbody><tr><td>Subtotal</td><td>" + money(invoice.subtotal) + "</td></tr><tr><td>Discount</td><td>" + money(-invoice.discount) + "</td></tr><tr><td>Tax</td><td>" + money(invoice.gst) + "</td></tr><tr class=\"total\"><td>Total</td><td>" + money(invoice.total) + "</td></tr><tr><td>Paid (" + escape(invoice.payment_method).toUpperCase() + ")</td><td>" + money(invoice.amount_paid) + "</td></tr><tr><td>Balance due</td><td>" + money(invoice.balance_due) + "</td></tr></tbody></table><p class=\"muted\">Generated " + escape(new Date(invoice.created_at).toLocaleString()) + "</p></body></html>";

// Retained for consumers that imported the original template before the
// complete production template below was introduced.
void invoiceHtml;

/** The durable PDF mirrors the current invoice detail, including compatibility fields. */
const completeInvoiceHtml = (invoice: Invoice) => {
  const value = invoice as any;
  const branch = value.branch_name || value.branchName || invoice.shop_name || "Branch not recorded";
  const customerEmail = value.customer_email || value.customerEmail;
  const customerAddress = value.customer_address || value.customerAddress;
  const customerGSTIN = value.customer_gstin || value.customerGstin;
  const sellerGSTIN = value.seller_gstin || value.sellerGSTIN;
  const payments = (value.paymentBreakdown || value.payment_breakdown || []).filter((entry: any) => Number(entry?.amount) > 0);
  const paymentLines = payments.length ? payments.map((entry: any) => `${escape(entry.method || "Payment")} &#8377;${Number(entry.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`).join("<br/>") : `${escape(invoice.payment_method || "Payment")} &#8377;${Number(invoice.amount_paid || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  const lineItems = (invoice.items || []).map((item: any) => {
    const quantity = Number(item.quantity ?? item.qty ?? 0), rate = Number(item.price ?? item.rate ?? 0), discount = Number(item.discount ?? 0), tax = Number(item.gst ?? item.tax ?? 0), line = Number(item.subtotal ?? item.total ?? (rate * quantity));
    return `<tr><td><b>${escape(item.name || item.product_name || "Item")}</b>${item.sku ? `<br/><small>SKU: ${escape(item.sku)}</small>` : ""}${item.hsn ? `<br/><small>HSN: ${escape(item.hsn)}</small>` : ""}</td><td>${quantity}</td><td>&#8377;${rate.toFixed(2)}</td><td>&#8377;${discount.toFixed(2)}</td><td>${tax}%</td><td>&#8377;${line.toFixed(2)}</td></tr>`;
  }).join("");
  const currency = (amount: any) => `&#8377;${Number(amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `<!doctype html><html><head><meta charset="utf-8"/><style>body{font-family:Arial,sans-serif;color:#172033;padding:24px;font-size:12px}h1{color:#4f46e5;margin:0;font-size:25px}.header{display:flex;justify-content:space-between;border-bottom:2px solid #4f46e5;padding-bottom:16px}.right{text-align:right}.muted,small{color:#64748b}table{width:100%;border-collapse:collapse;margin:18px 0}th,td{padding:8px;border:1px solid #e2e8f0;text-align:left;vertical-align:top}th{background:#eef2ff}th:not(:first-child),td:not(:first-child){text-align:right}.total{font-weight:bold;font-size:15px;background:#f8fafc}.status{color:#4338ca;font-weight:bold;text-transform:uppercase}</style></head><body><div class="header"><div><h1>ALL IN ONE HUB</h1><p class="muted">${escape(branch)}${value.branch_address || value.branchAddress ? `<br/>${escape(value.branch_address || value.branchAddress)}` : ""}${sellerGSTIN ? `<br/>GSTIN: ${escape(sellerGSTIN)}` : ""}</p></div><div class="right"><b>INVOICE ${escape(invoice.invoice_number)}</b><br/><span class="muted">${escape(new Date(invoice.created_at).toLocaleString())}</span></div></div><p><b>Bill to:</b> ${escape(invoice.customer_name || "Walk-in Customer")}<br/>${escape(invoice.customer_phone || "Walk-in customer")}${customerEmail ? `<br/>${escape(customerEmail)}` : ""}${customerAddress ? `<br/>${escape(customerAddress)}` : ""}${customerGSTIN ? `<br/>GSTIN: ${escape(customerGSTIN)}` : ""}</p><table><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Discount</th><th>GST</th><th>Line total</th></tr></thead><tbody>${lineItems}</tbody></table><table><tbody><tr><td>Subtotal</td><td>${currency(invoice.subtotal)}</td></tr><tr><td>Discount</td><td>${currency(-Number(invoice.discount || 0))}</td></tr><tr><td>GST / Tax</td><td>${currency(invoice.gst)}</td></tr><tr class="total"><td>Grand total</td><td>${currency(invoice.total)}</td></tr><tr><td>Payment breakup</td><td>${paymentLines}</td></tr><tr><td>Total paid</td><td>${currency(invoice.amount_paid)}</td></tr><tr><td>Pending</td><td>${currency(invoice.balance_due)}</td></tr><tr><td>Payment status</td><td class="status">${escape(value.paymentStatus || value.payment_status || invoice.status || "due")}</td></tr></tbody></table><p class="muted">Computer-generated invoice from ALL IN ONE HUB.</p></body></html>`;
};

export async function createAndUploadInvoicePdf(uid: string, invoice: Invoice) {
  const localUri = await createInvoicePdf(invoice);
  const upload = await uploadInvoicePdf(uid, invoice, localUri);
  return { ...upload, localUri };
}

/** Creates the durable device copy first. Cloud storage is deliberately optional. */
export async function createInvoicePdf(invoice: Invoice) {
  const { uri } = await Print.printToFileAsync({ html: completeInvoiceHtml(invoice), base64: false });
  const filename = invoice.invoice_number.replace(/[^a-zA-Z0-9_-]/g, "-") + ".pdf";
  const invoiceDirectory = FileSystem.documentDirectory + "invoices/";
  await FileSystem.makeDirectoryAsync(invoiceDirectory, { intermediates: true });
  const localUri = invoiceDirectory + filename;
  await FileSystem.copyAsync({ from: uri, to: localUri });
  await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
  return localUri;
}

/** Upload retries can call this later; a failure must never invalidate a completed sale. */
export async function uploadInvoicePdf(uid: string, invoice: Invoice, localUri: string) {
  if (!getApps().length) throw new Error("Firebase is not initialized. Install the native RetailPrime build.");
  const date = new Date(invoice.created_at);
  const filename = invoice.invoice_number.replace(/[^a-zA-Z0-9_-]/g, "-") + ".pdf";
  // Same object layout as the web app: users/{businessId}/invoices/{shop}/{year}/{customer}/{file}.pdf — the
  // business (owner) id is part of the path, which is what the Storage rules key on.
  const customer = String((invoice as any).customer_name || "walk-in").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "walk-in";
  const path = "users/" + uid + "/invoices/" + (invoice.shop_id || "unknown") + "/" + date.getFullYear() + "/" + customer + "/" + filename;
  const app = getApp();
  const storageRef = ref(getStorage(app), path);
  await putFile(storageRef, localUri, { contentType: "application/pdf" });
  const downloadUrl = await getDownloadURL(storageRef);
  return { path, downloadUrl };
}

export async function openInvoicePdf(invoice: Invoice) {
  if (invoice.local_file_uri) {
    const local = await FileSystem.getInfoAsync(invoice.local_file_uri);
    if (local.exists) return invoice.local_file_uri;
  }
  if (!invoice.storage_url) throw new Error("The invoice PDF is not available yet.");
  const target = FileSystem.cacheDirectory + invoice.invoice_number.replace(/[^a-zA-Z0-9_-]/g, "-") + ".pdf";
  return (await FileSystem.downloadAsync(invoice.storage_url, target)).uri;
}

export async function shareInvoicePdf(invoice: Invoice) {
  const uri = await openInvoicePdf(invoice);
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing is not available on this device.");
  await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Share " + invoice.invoice_number });
}
