/**
 * Firestore Collections Audit Script
 * Validates schema consistency and checks for undefined values across all collections
 * Run this after enabling Firestore emulator or connecting to production
 */

import { getApp, getApps, initializeApp } from "@react-native-firebase/app";
import { getFirestore, collection, getDocs } from "@react-native-firebase/firestore";

interface AuditResult {
  collection: string;
  totalDocs: number;
  errors: {
    docId: string;
    field: string;
    value: any;
    issue: string;
  }[];
  warnings: {
    docId: string;
    field: string;
    value: any;
    warning: string;
  }[];
  schemaFields: Set<string>;
}

const FIRESTORE_COLLECTIONS = [
  "customers",
  "products",
  "invoices",
  "payments",
  "sales",
  "inventory-movements",
  "coupons",
  "services",
  "staff",
  "attendance",
  "returns",
  "expenses",
];

const REQUIRED_FIELDS: Record<string, string[]> = {
  customers: ["id", "shop_id", "name", "phone"],
  products: ["id", "shop_id", "name", "selling_price", "cost_price", "stock"],
  invoices: ["id", "invoice_number", "shop_id", "customer_name", "items", "total", "created_at"],
  payments: ["id", "invoice_id", "amount", "method", "created_at"],
  sales: ["id", "invoice_id", "total", "created_at"],
  "inventory-movements": ["id", "productId", "type", "quantityDelta", "createdAt"],
  coupons: ["id", "code", "discount", "discountType"],
  services: ["id", "shop_id", "customerName", "serviceName", "price", "expectedDelivery"],
  staff: ["id", "name", "phone", "status"],
  attendance: ["id", "staffId", "date", "status"],
  returns: ["id", "invoice_id", "refund_amount", "created_at"],
  expenses: ["id", "shop_id", "amount", "created_at"],
};

async function auditCollection(collectionName: string): Promise<AuditResult> {
  const result: AuditResult = {
    collection: collectionName,
    totalDocs: 0,
    errors: [],
    warnings: [],
    schemaFields: new Set(),
  };

  try {
    const db = getFirestore(getApp());
    const collRef = collection(db, "users", "audit-user", "businessData", collectionName, "records");
    const snapshot = await getDocs(collRef);

    result.totalDocs = snapshot.size;

    snapshot.forEach((doc) => {
      const data = doc.data();
      const docId = doc.id;

      // Check for undefined values
      Object.entries(data).forEach(([field, value]) => {
        result.schemaFields.add(field);

        if (value === undefined) {
          result.errors.push({
            docId,
            field,
            value,
            issue: "Field is undefined (should be null or omitted)",
          });
        } else if (typeof value === "number" && !Number.isFinite(value)) {
          result.errors.push({
            docId,
            field,
            value,
            issue: `Invalid number: ${value}`,
          });
        } else if (value instanceof Date) {
          result.errors.push({
            docId,
            field,
            value: value.toString(),
            issue: "Date object found (should be ISO string)",
          });
        } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
          // Check nested object for undefined
          Object.entries(value).forEach(([nestedField, nestedValue]) => {
            if (nestedValue === undefined) {
              result.errors.push({
                docId,
                field: `${field}.${nestedField}`,
                value: nestedValue,
                issue: "Nested field is undefined",
              });
            }
          });
        } else if (Array.isArray(value)) {
          value.forEach((item, idx) => {
            if (typeof item === "object" && item !== null) {
              Object.entries(item).forEach(([itemField, itemValue]) => {
                if (itemValue === undefined) {
                  result.errors.push({
                    docId,
                    field: `${field}[${idx}].${itemField}`,
                    value: itemValue,
                    issue: "Array item field is undefined",
                  });
                }
              });
            }
          });
        }
      });

      // Check for missing required fields
      const required = REQUIRED_FIELDS[collectionName] || [];
      required.forEach((field) => {
        if (!(field in data)) {
          result.warnings.push({
            docId,
            field,
            value: undefined,
            warning: `Required field missing: ${field}`,
          });
        } else if (data[field] === null || data[field] === "") {
          result.warnings.push({
            docId,
            field,
            value: data[field],
            warning: `Required field is null or empty: ${field}`,
          });
        }
      });
    });
  } catch (error: any) {
    console.error(`Error auditing ${collectionName}:`, error.message);
  }

  return result;
}

export async function runFullAudit(): Promise<void> {
  console.log("=== FIRESTORE COLLECTIONS AUDIT ===\n");

  const results: AuditResult[] = [];
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const collectionName of FIRESTORE_COLLECTIONS) {
    console.log(`Auditing ${collectionName}...`);
    const result = await auditCollection(collectionName);
    results.push(result);

    totalErrors += result.errors.length;
    totalWarnings += result.warnings.length;

    console.log(`  ✓ ${result.totalDocs} documents`);
    if (result.errors.length > 0) {
      console.log(`  ✗ ${result.errors.length} errors`);
    }
    if (result.warnings.length > 0) {
      console.log(`  ⚠ ${result.warnings.length} warnings`);
    }
  }

  console.log(`\n=== AUDIT SUMMARY ===`);
  console.log(`Total Documents Scanned: ${results.reduce((sum, r) => sum + r.totalDocs, 0)}`);
  console.log(`Total Errors: ${totalErrors}`);
  console.log(`Total Warnings: ${totalWarnings}`);

  if (totalErrors > 0) {
    console.log(`\n=== ERRORS ===`);
    results.forEach((result) => {
      if (result.errors.length > 0) {
        console.log(`\n${result.collection}:`);
        result.errors.forEach((error) => {
          console.log(
            `  [${error.docId}] ${error.field}: ${error.issue}`
          );
        });
      }
    });
  }

  if (totalWarnings > 0) {
    console.log(`\n=== WARNINGS ===`);
    results.forEach((result) => {
      if (result.warnings.length > 0) {
        console.log(`\n${result.collection}:`);
        result.warnings.forEach((warning) => {
          console.log(
            `  [${warning.docId}] ${warning.field}: ${warning.warning}`
          );
        });
      }
    });
  }

  console.log(`\n=== SCHEMA OVERVIEW ===`);
  results.forEach((result) => {
    if (result.schemaFields.size > 0) {
      console.log(`\n${result.collection}:`);
      console.log(`  Fields: ${Array.from(result.schemaFields).sort().join(", ")}`);
    }
  });

  if (totalErrors === 0 && totalWarnings === 0) {
    console.log("\n✅ All collections passed audit!");
  } else {
    console.log(
      `\n⚠️  Review the errors and warnings above before proceeding to production.`
    );
  }
}

// Export for use in other scripts
export { AuditResult, auditCollection };
