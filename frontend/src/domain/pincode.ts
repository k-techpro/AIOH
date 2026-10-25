export interface PostOffice { area: string; city: string; district: string; state: string }
type PincodeFetcher = (input: string, init?: RequestInit) => Promise<{ ok: boolean; json: () => Promise<any> }>;
const cache = new Map<string, PostOffice[]>();

/** India Post lookup cached for this app session. */
export async function lookupIndianPincode(pin: string, fetcher: PincodeFetcher = fetch): Promise<PostOffice[]> {
  const code = String(pin || "").replace(/\D/g, "");
  if (!/^\d{6}$/.test(code)) throw new Error("Enter a valid 6-digit PIN code.");
  const cached = cache.get(code);
  if (cached) return cached;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetcher(`https://api.postalpincode.in/pincode/${code}`, { signal: controller.signal });
    if (!response.ok) throw new Error("PIN lookup unavailable.");
    const [result]: any[] = await response.json();
    if (result?.Status !== "Success" || !Array.isArray(result.PostOffice) || !result.PostOffice.length) throw new Error("PIN code not found.");
    const offices: PostOffice[] = result.PostOffice.map((office: any) => ({
      area: String(office.Name || "").trim(),
      city: String(office.Block || office.Region || "").trim(),
      district: String(office.District || "").trim(),
      state: String(office.State || "").trim(),
    })).filter((office: PostOffice) => office.area && office.state);
    if (!offices.length) throw new Error("PIN code did not return usable address details.");
    cache.set(code, offices);
    return offices;
  } finally { clearTimeout(timer); }
}

export function clearPincodeCache() { cache.clear(); }
