const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

async function req<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export const api = {
  listShops: () => req<any[]>("/shops"),
  dashboard: (shopId: string) => req<any>(`/dashboard/${shopId}`),
  listProducts: (shopId: string, params: Record<string, any> = {}) => {
    const q = new URLSearchParams({ shop_id: shopId, ...params }).toString();
    return req<any[]>(`/products?${q}`);
  },
  getProduct: (id: string) => req<any>(`/products/${id}`),
  createProduct: (data: any) => req<any>("/products", { method: "POST", body: JSON.stringify(data) }),
  listCustomers: (shopId: string, search?: string) => {
    const q = new URLSearchParams({ shop_id: shopId, ...(search ? { search } : {}) }).toString();
    return req<any[]>(`/customers?${q}`);
  },
  getCustomer: (id: string) => req<any>(`/customers/${id}`),
  createCustomer: (data: any) => req<any>("/customers", { method: "POST", body: JSON.stringify(data) }),
  listInvoices: (shopId: string, params: Record<string, any> = {}) => {
    const q = new URLSearchParams({ shop_id: shopId, ...params }).toString();
    return req<any[]>(`/invoices?${q}`);
  },
  getInvoice: (id: string) => req<any>(`/invoices/${id}`),
  createInvoice: (data: any) => req<any>("/invoices", { method: "POST", body: JSON.stringify(data) }),
  listExpenses: (shopId: string) => req<any[]>(`/expenses?shop_id=${shopId}`),
  createExpense: (data: any) => req<any>("/expenses", { method: "POST", body: JSON.stringify(data) }),
  listTransfers: (shopId?: string) => req<any[]>(`/transfers${shopId ? `?shop_id=${shopId}` : ""}`),
  createTransfer: (data: any) => req<any>("/transfers", { method: "POST", body: JSON.stringify(data) }),
  gstReport: (shopId: string) => req<any>(`/reports/gst/${shopId}`),
  seed: () => req<any>("/seed", { method: "POST" }),
};
