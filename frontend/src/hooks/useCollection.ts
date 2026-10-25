import { useEffect, useState } from "react";
import { useAppStore } from "../store/shop";
import { useMockStore } from "../store/mock-data";
import { useBusiness } from "../services/business";
import { listenCollection } from "../services/repository";

/** Live, branch-scoped collection (mobile twin of the web useCollection hook). */
export function useCollection(name: string) {
  const shopId = useAppStore((s) => s.shopId);
  const ready = useBusiness((b) => b.status === "ready");
  const shops = useMockStore((s) => s.shops);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!ready || !shopId) { setData([]); setLoading(false); return undefined; }
    setLoading(true);
    try {
      return listenCollection(name, (rows) => { setData(rows); setLoading(false); setError(null); }, (e) => { setError(e?.message || "Could not load data"); setLoading(false); }, shops);
    } catch (e: any) { setError(e?.message || "Could not load data"); setLoading(false); return undefined; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, shopId, ready]);
  return { data, loading, error };
}
