// Indian number formatting
export function formatINR(amount: number, compact = false): string {
  if (amount === null || amount === undefined || isNaN(amount)) return "₹0";
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (compact) {
    if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)}Cr`;
    if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)}L`;
    if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
  }
  // Indian grouping: 12,34,567
  const rounded = Math.round(abs).toString();
  const lastThree = rounded.substring(rounded.length - 3);
  const other = rounded.substring(0, rounded.length - 3);
  const formatted = other !== "" ? other.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree : lastThree;
  return `${sign}₹${formatted}`;
}

export function formatPercent(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export function formatDate(iso: any): string {
  try {
    const value = iso?.toDate ? iso.toDate() : iso;
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return "—";
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}

export function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return "—";
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export function formatDateTime(value: any): string {
  try {
    const raw = value?.toDate ? value.toDate() : value;
    const d = new Date(raw);
    if (!Number.isFinite(d.getTime())) return "—";
    return `${formatDate(d)} ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
  } catch {
    return "—";
  }
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
