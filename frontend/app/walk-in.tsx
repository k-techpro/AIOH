import React from "react";
import { ResourceScreen } from "../src/components/ResourceScreen";
import { formatDate } from "../src/utils/format";

const day = (v: any) => formatDate(v);

// Walk-in List — same collection (`walkins`) and fields as the web page.
export default function WalkIn() {
  return (
    <ResourceScreen
      config={{
        title: "Walk-in List", subtitle: "Walk-in customers and quick visitors", collection: "walkins", addLabel: "Add Walk-in",
        searchKeys: ["name", "phone", "purpose"],
        fields: [
          { name: "name", label: "Name", required: true },
          { name: "phone", label: "Phone", type: "tel" },
          { name: "purpose", label: "Purpose", type: "select", options: ["Enquiry", "Purchase", "Service", "Return", "Other"] },
          { name: "date", label: "Date", type: "date" },
          { name: "note", label: "Note", type: "textarea" },
        ],
        card: (r) => ({ title: r.name || "—", subtitle: [r.phone, r.purpose].filter(Boolean).join(" · "), right: day(r.date), badge: r.note ? "Note" : undefined }),
      }}
    />
  );
}
