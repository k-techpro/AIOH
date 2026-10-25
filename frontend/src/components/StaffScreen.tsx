import React from "react";
import { ResourceScreen } from "./ResourceScreen";
import { formatINR } from "../utils/format";

// Staff — same `staff` collection and fields as the web page (name, phone, email, role, salary, active).
// Records created by the older mobile build carry `status` instead of `active`; both are understood.
export default function StaffScreen() {
  return (
    <ResourceScreen
      config={{
        title: "Staff", subtitle: "Team members and roles", collection: "staff", addLabel: "Add Staff",
        searchKeys: ["name", "role", "phone"],
        defaults: { role: "Cashier", salary: "", active: true },
        fields: [
          { name: "name", label: "Name", required: true },
          { name: "phone", label: "Phone", type: "tel" },
          { name: "email", label: "Email", type: "email" },
          { name: "role", label: "Role", type: "select", options: ["Manager", "Cashier", "Sales", "Inventory", "Accountant"] },
          { name: "salary", label: "Salary", type: "currency" },
          { name: "active", label: "Active", type: "switch" },
        ],
        card: (r) => {
          const active = r.active ?? r.status === "active";
          return { title: r.name || "—", subtitle: [r.role, r.phone].filter(Boolean).join(" · "), right: r.salary ? formatINR(Number(r.salary)) : undefined, badge: active ? "Active" : "Inactive" };
        },
      }}
    />
  );
}
