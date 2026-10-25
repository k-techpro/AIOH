export const demoShops = [
  { id: "shop-1", name: "RetailPrime Central", location: "MG Road, Bengaluru", gstin: "29ABCDE1234F1Z5", today_sales: 48650, today_invoices: 24, products: 186, low_stock: 4, trend: [18, 29, 23, 38, 34, 46, 49] },
  { id: "shop-2", name: "RetailPrime Indiranagar", location: "100 Ft Road, Bengaluru", gstin: "29ABCDE1234F2Z4", today_sales: 32780, today_invoices: 17, products: 142, low_stock: 2, trend: [15, 18, 30, 22, 35, 28, 33] },
];

export const demoProducts = [
  { id: "p1", shop_id: "shop-1", name: "iPhone 15 Tempered Glass", sku: "ACC-IPH-015", barcode: "8901234567001", category: "Accessories", selling_price: 599, price: 599, cost_price: 245, stock: 7, min_stock: 10, gst: 18, status: "low_stock" },
  { id: "p2", shop_id: "shop-1", name: "20W USB-C Fast Charger", sku: "ACC-CHR-020", barcode: "8901234567002", category: "Chargers", selling_price: 1499, price: 1499, cost_price: 850, stock: 32, min_stock: 8, gst: 18, status: "in_stock" },
  { id: "p3", shop_id: "shop-1", name: "AirPods Pro Case", sku: "ACC-APP-031", barcode: "8901234567003", category: "Accessories", selling_price: 899, price: 899, cost_price: 390, stock: 4, min_stock: 8, gst: 18, status: "low_stock" },
  { id: "p4", shop_id: "shop-1", name: "Samsung Galaxy A55", sku: "PH-SAM-055", barcode: "8901234567004", category: "Mobiles", selling_price: 39999, price: 39999, cost_price: 35800, stock: 12, min_stock: 3, gst: 18, status: "in_stock" },
  { id: "p5", shop_id: "shop-1", name: "Wireless Neckband", sku: "AUD-NKB-012", barcode: "8901234567005", category: "Audio", selling_price: 1799, price: 1799, cost_price: 920, stock: 0, min_stock: 5, gst: 18, status: "out_stock" },
];

export const demoCustomers = [
  { id: "c1", shop_id: "shop-1", name: "Ananya Sharma", phone: "98765 43210", email: "ananya@example.com", gstin: "29ANYPK4332R1Z8", total_purchases: 24390, total_paid: 23190, total_due: 1200, outstanding: 1200, invoices: [] as any[] },
  { id: "c2", shop_id: "shop-1", name: "Rahul Menon", phone: "98450 11223", email: "rahul@example.com", total_purchases: 18750, total_paid: 18750, total_due: 0, outstanding: 0, invoices: [] as any[] },
  { id: "c3", shop_id: "shop-1", name: "Priya Nair", phone: "99887 22110", email: "priya@example.com", total_purchases: 9450, total_paid: 9000, total_due: 450, outstanding: 450, invoices: [] as any[] },
];

export const demoInvoices = [
  { id: "inv1", shop_id: "shop-1", invoice_number: "RP-2026-1048", customer_name: "Ananya Sharma", total: 2248, subtotal: 1905, gst: 343, discount: 0, amount_paid: 2248, balance_due: 0, payment_method: "UPI", status: "paid", created_at: "Today, 11:42 AM", items: [{ product_id: "p2", name: "20W USB-C Fast Charger", quantity: 1, price: 1499, subtotal: 1499 }, { product_id: "p1", name: "iPhone 15 Tempered Glass", quantity: 1, price: 599, subtotal: 599 }] },
  { id: "inv2", shop_id: "shop-1", invoice_number: "RP-2026-1047", customer_name: "Rahul Menon", total: 39999, subtotal: 33897, gst: 6102, discount: 0, amount_paid: 30000, balance_due: 9999, payment_method: "Card", status: "partial", created_at: "Today, 10:18 AM", items: [{ product_id: "p4", name: "Samsung Galaxy A55", quantity: 1, price: 39999, subtotal: 39999 }] },
  { id: "inv3", shop_id: "shop-1", invoice_number: "RP-2026-1046", customer_name: "Walk-in Customer", total: 1799, subtotal: 1525, gst: 274, discount: 0, amount_paid: 0, balance_due: 1799, payment_method: "Cash", status: "due", created_at: "Yesterday, 6:04 PM", items: [{ product_id: "p3", name: "AirPods Pro Case", quantity: 2, price: 899, subtotal: 1798 }] },
];
demoCustomers[0].invoices = [demoInvoices[0]];
demoCustomers[1].invoices = [demoInvoices[1]];
demoCustomers[2].invoices = [demoInvoices[2]];

export const demoExpenses = [
  { id: "e1", shop_id: "shop-1", category: "Rent", description: "August showroom rent", amount: 32000, payment_method: "Bank transfer", created_at: "01 Aug 2026", date: "2026-08-01" },
  { id: "e2", shop_id: "shop-1", category: "Utilities", description: "Electricity and internet", amount: 4850, payment_method: "UPI", created_at: "10 Aug 2026", date: "2026-08-10" },
  { id: "e3", shop_id: "shop-1", category: "Marketing", description: "Local campaign", amount: 6500, payment_method: "Card", created_at: "18 Aug 2026", date: "2026-08-18" },
];

const trendValues = [22100, 28600, 25300, 31800, 29100, 36500, 34400, 39800, 37200, 41600, 38900, 44200, 47500, 43800, 49200, 45800, 51600, 48300, 53900, 50100, 56200, 52700, 58400, 54800, 61200, 57500, 63400, 60100, 65900, 48650];
export const demoDashboard = {
  kpis: { today_sales: 48650, today_sales_change: 12.4, today_profit: 12840, today_profit_change: 8.2, outstanding: 11649, due_customers: 3, monthly_revenue: 824300, today_orders: 24, low_stock: 2, out_stock: 1 },
  low_stock_items: demoProducts.filter(p => p.status !== "in_stock"),
  top_products: [{ id: "p4", name: "Samsung Galaxy A55", brand: "Samsung", units: 18, revenue: 719982, profit: 75582 }, { id: "p2", name: "20W USB-C Fast Charger", brand: "Voltix", units: 86, revenue: 128914, profit: 55714 }, { id: "p1", name: "iPhone 15 Tempered Glass", brand: "ClearGuard", units: 74, revenue: 44326, profit: 26176 }],
  recent_invoices: demoInvoices,
  trend_30: trendValues.map((revenue, index) => ({ date: `${index + 1} Aug`, revenue, profit: Math.round(revenue * 0.265) })),
  categories: [{ name: "Mobiles", value: 406000 }, { name: "Chargers", value: 128914 }, { name: "Accessories", value: 112286 }, { name: "Audio", value: 85600 }, { name: "Services", value: 91500 }],
};
export const demoGst = { period: "August 2026", taxable_sales: 698560, cgst: 62870, sgst: 62870, igst: 0, total_tax: 125740, total_gst: 125740, gst_invoices: 117, total_sales: 824300 };
export const demoTransfers = [{ id: "t1", transfer_number: "TRF-2026-018", from_shop_id: "shop-1", to_shop_id: "shop-2", from_shop_name: "RetailPrime Central", to_shop_name: "RetailPrime Indiranagar", product_name: "20W USB-C Fast Charger", quantity: 12, status: "in_transit", created_at: "Today, 9:30 AM" }, { id: "t2", transfer_number: "TRF-2026-017", from_shop_id: "shop-2", to_shop_id: "shop-1", from_shop_name: "RetailPrime Indiranagar", to_shop_name: "RetailPrime Central", product_name: "Samsung Galaxy A55", quantity: 3, status: "completed", created_at: "20 Aug 2026" }];
