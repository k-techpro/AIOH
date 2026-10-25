import React from "react";
import { ResourceScreen } from "../src/components/ResourceScreen";
import { formatINR, formatDate } from "../src/utils/format";

const day = (v: any) => formatDate(v);

// Payments — same collection (`payments`) as the web page; also lists the payments that checkout / Pay Later write.
export default function Payments() {
  return (
    <ResourceScreen
      config={{
        title: "Payments", subtitle: "Recorded payments across invoices and customers", collection: "payments", addLabel: "Record Payment",
        searchKeys: ["customerName", "customer_name", "invoiceNumber", "invoice_number", "method"],
        defaults: { amount: "", method: "Cash", status: "Paid" },
        fields: [
          { name: "customerName", label: "Customer Name", required: true },
          { name: "invoiceNumber", label: "Invoice Number" },
          { name: "amount", label: "Amount", type: "currency", required: true },
          { name: "method", label: "Method", type: "select", options: ["Cash", "UPI", "Card", "Bank Transfer", "Pay Later"] },
          { name: "status", label: "Status", type: "select", options: ["Paid", "Pending", "Partial"] },
          { name: "date", label: "Date", type: "date" },
          { name: "note", label: "Note", type: "textarea" },
        ],
        card: (r) => ({
          title: r.customerName || r.customer_name || "—",
          subtitle: `${r.invoiceNumber || r.invoice_number || "—"} · ${r.method || r.payment_method || ""}`,
          right: formatINR(Number(r.amount || 0)),
          badge: `${day(r.date ?? r.created_at)} · ${r.status || ""}`,
        }),
      }}
    />
  );
}
