import {useBusiness}from '../services/business';
import {neonRepository}from '../services/neonRepository';
import {dataContext,createShopRecord,completeSale,transferStock}from '../services/repository.neon';
const rows=(name:string)=>neonRepository.listAll({businessId:useBusiness.getState().businessId!,shopId:null},name);
const save=async(name:string,data:any)=>{const id=await createShopRecord(name,data);return neonRepository.getRecord({...dataContext(),shopId:data.shop_id||dataContext().shopId},name,id);};
const scoped = (items: any[], shopId: string) => items.filter(item => shopId === "all" || !shopId || item.shop_id === shopId);

export const api = {
  listShops: async () => (await rows("shops")).filter((b) => b.status !== "deleted" && b.deleted !== true && b.status !== "archived" && b.active !== false && !["testbench", "shop-test"].includes(b.slug || b.id)),
  dashboard: async (shopId: string) => {
    const [invoices, products, customers] = await Promise.all([rows("invoices"), rows("products"), rows("customers")]);
    const sales = scoped(invoices, shopId), stock = scoped(products, shopId), customerRows = scoped(customers, shopId);
    const today = new Date().toISOString().slice(0, 10);
    const todayInvoices = sales.filter(item => String(item.created_at).slice(0, 10) === today);
    return { kpis: { today_sales: todayInvoices.reduce((n, item) => n + Number(item.total || 0), 0), outstanding: sales.reduce((n, item) => n + Number(item.balance_due || 0), 0), monthly_revenue: sales.reduce((n, item) => n + Number(item.total || 0), 0), today_orders: todayInvoices.length, low_stock: stock.filter(item => item.stock > 0 && item.stock <= item.min_stock).length, out_stock: stock.filter(item => item.stock === 0).length, due_customers: customerRows.filter(item => item.total_due > 0).length }, trend_30: [], recent_invoices: sales, low_stock_items: stock.filter(item => item.stock <= item.min_stock) };
  },
  listProducts: async (shopId: string, params: Record<string, any> = {}) => scoped(await rows("products"), shopId).filter(item => !params.search || JSON.stringify(item).toLowerCase().includes(String(params.search).toLowerCase())),
  getProduct: async (id: string) => (await rows("products")).find(item => item.id === id),
  createProduct: (data: any) => save("products", data),
  listCustomers: async (shopId: string, search?: string) => scoped(await rows("customers"), shopId).filter(item => !search || JSON.stringify(item).toLowerCase().includes(search.toLowerCase())),
  getCustomer: async (id: string) => (await rows("customers")).find(item => item.id === id),
  createCustomer: (data: any) => save("customers", data),
  listInvoices: async (shopId: string, params: Record<string, any> = {}) => scoped(await rows("invoices"), shopId).filter(item => !params.search || JSON.stringify(item).toLowerCase().includes(String(params.search).toLowerCase())),
  getInvoice: async (id: string) => (await rows("invoices")).find(item => item.id === id),
  createInvoice: (data: any) => completeSale(data,null),
  listExpenses: async (shopId: string) => scoped(await rows("expenses"), shopId),
  createExpense: (data: any) => save("expenses", data),
  listTransfers: async (shopId?: string) => scoped(await rows("transfers"), shopId || "all"),
  // Same document the web Transfers page reads: product / fromShop / toShop / quantity / status / date, scoped to
  // the source branch via shop_id (web lists transfers by shop_id).
  createTransfer: (data:any)=>transferStock(data),
  gstReport: async (shopId: string) => { const invoices = scoped(await rows("invoices"), shopId); const taxable_sales = invoices.reduce((n, item) => n + Number(item.taxable ?? item.subtotal ?? 0), 0), total_gst = invoices.reduce((n, item) => n + Number(item.gst ?? item.tax ?? 0), 0); return { taxable_sales, total_gst, total_tax: total_gst, cgst: total_gst / 2, sgst: total_gst / 2, igst: 0, gst_invoices: invoices.length, total_sales: invoices.reduce((n, item) => n + Number(item.total ?? item.grandTotal ?? 0), 0) }; },
  seed: async () => { throw new Error("Demo seeding is disabled. Create ERP data in Firebase."); },
};
