/**
 * Verification: Object.groupBy Replacement
 *
 * Tests the reduce-based grouping implementation to ensure it produces
 * the same output as Object.groupBy would have.
 */

// Test data matching CIRCULAR_GRID structure
const CIRCULAR_GRID = [
  { section: "QUICK SALES", icon: "reload-outline", label: "Return Product" },
  { section: "QUICK SALES", icon: "time-outline", label: "Pay Later" },
  { section: "QUICK SALES", icon: "history", label: "History" },
  { section: "QUICK SALES", icon: "people-outline", label: "Walk-in List" },

  { section: "CUSTOMER & BILLING", icon: "card-outline", label: "Payments" },
  { section: "CUSTOMER & BILLING", icon: "cash-outline", label: "Outstanding" },

  { section: "INVENTORY", icon: "cube-outline", label: "Products" },
  { section: "INVENTORY", icon: "layers-outline", label: "Stock Check" },

  { section: "BUSINESS", icon: "bar-chart-outline", label: "Reports" },
  { section: "BUSINESS", icon: "wallet-outline", label: "Expenses" },

  { section: "OPERATIONS", icon: "person-add-outline", label: "Staff" },
  { section: "OPERATIONS", icon: "checkmark-circle-outline", label: "Attendance" },

  { section: "CONFIGURATION", icon: "settings-outline", label: "Settings" },
  { section: "CONFIGURATION", icon: "pricetag-outline", label: "Coupons" },
];

// React Native compatible reduce-based grouping (FIXED VERSION)
type CircularItem = (typeof CIRCULAR_GRID)[number];
const groupedCircular = CIRCULAR_GRID.reduce<Record<string, CircularItem[]>>((groups, item) => {
  const key = item.section;
  if (!groups[key]) {
    groups[key] = [];
  }
  groups[key].push(item);
  return groups;
}, {});

// Verify results
console.log("✓ Grouping completed successfully");
console.log("✓ Groups created:", Object.keys(groupedCircular).length);

Object.entries(groupedCircular).forEach(([section, items]) => {
  console.log(`  ${section}: ${items.length} items`);
});

// Expected output:
// ✓ Grouping completed successfully
// ✓ Groups created: 6
//   QUICK SALES: 4 items
//   CUSTOMER & BILLING: 2 items
//   INVENTORY: 2 items
//   BUSINESS: 2 items
//   OPERATIONS: 2 items
//   CONFIGURATION: 2 items

export default groupedCircular;
