import { create } from "zustand";

type CartItem = {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  gst: number;
  cost_price: number;
};

type State = {
  shopId: string;
  shopName: string;
  setShop: (id: string, name: string) => void;
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  updateQty: (product_id: string, qty: number) => void;
  removeFromCart: (product_id: string) => void;
  clearCart: () => void;
  selectedCustomer: any | null;
  setCustomer: (c: any | null) => void;
};

export const useAppStore = create<State>((set, get) => ({
  shopId: "",
  shopName: "",
  setShop: (id, name) => set({ shopId: id, shopName: name }),
  cart: [],
  addToCart: (item) => {
    const existing = get().cart.find((c) => c.product_id === item.product_id);
    if (existing) {
      set({
        cart: get().cart.map((c) =>
          c.product_id === item.product_id ? { ...c, quantity: c.quantity + 1 } : c
        ),
      });
    } else {
      set({ cart: [...get().cart, { ...item, quantity: 1 }] });
    }
  },
  updateQty: (product_id, qty) => {
    if (qty <= 0) {
      set({ cart: get().cart.filter((c) => c.product_id !== product_id) });
    } else {
      set({ cart: get().cart.map((c) => (c.product_id === product_id ? { ...c, quantity: qty } : c)) });
    }
  },
  removeFromCart: (product_id) => set({ cart: get().cart.filter((c) => c.product_id !== product_id) }),
  clearCart: () => set({ cart: [], selectedCustomer: null }),
  selectedCustomer: null,
  setCustomer: (c) => set({ selectedCustomer: c }),
}));
