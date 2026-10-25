import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useTheme } from "../theme/theme";
import { useMockStore } from "../store/mock-data";
import { normalizePhone, validPhone } from "../domain/phone.ts";
import { CustomerAutosave, EMPTY_CUSTOMER_FIELDS, type Customer, type CustomerFields, type FlushResult } from "../domain/customerAutosave.ts";
import { createPhoneCustomer, lookupCustomer, updateCustomerDetails } from "../services/repository";
import { formatINR } from "../utils/format";

const IDLE_MS = 1200;
const TYPES = ["Retail", "Other"];

type Props = {
  customer: Customer | null;
  onSelect: (c: Customer | null) => void;
  onPending?: (pending: boolean) => void;
  /** Parent calls flushRef.current() right before advancing: finishes any pending autosave first. */
  flushRef?: React.MutableRefObject<(() => Promise<FlushResult>) | null>;
  label?: string;
  testIDPrefix?: string;
};

/**
 * Phone-first customer capture (mobile twin of the web CustomerPhoneLookup, autosave mode).
 * ONE customer section: enter phone → existing customer auto-selected, or a "New Customer" panel
 * whose Name is the only name input. It saves + selects automatically — there is no
 * "Create & Select" button and no second Customer Name field.
 */
export default function CustomerPhoneLookup({ customer, onSelect, onPending, flushRef, label = "Customer Phone Number", testIDPrefix = "cpl" }: Props) {
  const { colors } = useTheme();
  const shops = useMockStore((s) => s.shops);
  const [phone, setPhone] = useState(customer?.phone || "");
  const [status, setStatus] = useState<"" | "searching" | "found" | "new" | "invalid" | "error">("");
  const [fields, setFields] = useState<CustomerFields>({ ...EMPTY_CUSTOMER_FIELDS });
  const [saveState, setSaveState] = useState<"" | "saving" | "saved">("");
  const [error, setError] = useState("");
  const cb = useRef({ onSelect, onPending, customer, shops });
  cb.current = { onSelect, onPending, customer, shops };
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedId = useRef<string | null>(null);

  const controller = useMemo(
    () => new CustomerAutosave({
      create: (input) => createPhoneCustomer(input, cb.current.shops),
      update: (id, f) => updateCustomerDetails(id, f, cb.current.shops),
    }, (c) => { savedId.current = c.id; }),
    [],
  );

  // Phone lookup (debounced). Selecting a customer writes their phone back — that must not re-query.
  useEffect(() => {
    let cancelled = false;
    setError("");
    if (!phone) { setStatus(""); cb.current.onPending?.(false); return undefined; }
    const current = cb.current.customer;
    if (current && normalizePhone(current.phone) === normalizePhone(phone)) { setStatus(savedId.current === current.id ? "new" : "found"); cb.current.onPending?.(false); return undefined; }
    cb.current.onPending?.(true);
    if (!validPhone(phone)) { setStatus("invalid"); return undefined; }
    setStatus("searching");
    const timer = setTimeout(async () => {
      try {
        const found = await lookupCustomer(phone, cb.current.shops);
        if (cancelled) return;
        if (found) { cb.current.onSelect(found); cb.current.onPending?.(false); setStatus("found"); }
        else { cb.current.onSelect(null); cb.current.onPending?.(true); setStatus("new"); }
      } catch (e: any) { if (!cancelled) { setError(e?.message || "Lookup failed"); setStatus("error"); } }
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  const persist = async () => {
    setError("");
    setSaveState("saving");
    try {
      const c = await controller.save();
      setSaveState("saved");
      cb.current.onSelect(c);
      cb.current.onPending?.(false);
      return c;
    } catch (e: any) { setSaveState(""); setError(e?.message || "Could not save the customer."); throw e; }
  };

  // Idle autosave: any edit in the New Customer panel re-arms the timer.
  useEffect(() => {
    if (idle.current) clearTimeout(idle.current);
    if (status !== "new") return undefined;
    controller.setPhone(phone);
    controller.fields = { ...fields };
    if (controller.blocker()) return undefined;
    idle.current = setTimeout(() => { persist().catch(() => {}); }, IDLE_MS);
    return () => { if (idle.current) clearTimeout(idle.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, phone, status]);

  useEffect(() => {
    if (!flushRef) return undefined;
    flushRef.current = async () => {
      if (idle.current) clearTimeout(idle.current);
      if (status !== "new") return { customer: cb.current.customer || undefined };
      controller.setPhone(phone);
      controller.fields = { ...fields };
      const r = await controller.flush(cb.current.customer);
      if (r.customer) { setSaveState("saved"); cb.current.onSelect(r.customer); cb.current.onPending?.(false); }
      else if (r.error) setError(r.error);
      return r;
    };
    return () => { flushRef.current = null; };
  }, [flushRef, status, phone, fields, controller]);

  const onPhone = (v: string) => {
    controller.setPhone(v);
    savedId.current = null;
    setSaveState("");
    setFields({ ...EMPTY_CUSTOMER_FIELDS });
    setPhone(v);
    cb.current.onSelect(null);
    cb.current.onPending?.(Boolean(v));
  };
  const blurSave = () => { if (status === "new") { controller.setPhone(phone); controller.fields = { ...fields }; if (!controller.blocker()) persist().catch(() => {}); } };

  const input = { backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 12, color: colors.onSurface, borderWidth: 1, borderColor: colors.border, fontSize: 15 } as const;
  const lbl = { color: colors.muted, fontSize: 12, fontWeight: "600" as const, marginBottom: 6, marginTop: 10 };
  const detail = (k: string, v?: string) => (v ? <Text key={k} style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{k}: {v}</Text> : null);
  const found = status === "found" && customer;

  return (
    <View testID={`${testIDPrefix}`}>
      <Text style={lbl}>{label}</Text>
      <TextInput testID={`${testIDPrefix}-phone`} value={phone} onChangeText={onPhone} keyboardType="phone-pad" placeholder="Phone number or +91" placeholderTextColor={colors.muted} style={input} />
      {status === "searching" && <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>Searching…</Text>}
      {status === "invalid" && <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>Enter a valid 10-digit phone number</Text>}
      {!!error && <Text testID={`${testIDPrefix}-error`} style={{ color: colors.error, fontSize: 12, marginTop: 6 }}>{error}</Text>}

      {found && (
        <View testID={`${testIDPrefix}-found`} style={{ marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.onSurface, fontWeight: "700" }}>{customer!.name} · {customer!.phone}</Text>
          {detail("Address", customer!.address)}
          {detail("Email", customer!.email)}
          {detail("GSTIN", customer!.gstin || customer!.gstIn)}
          {detail("Type", customer!.type || customer!.customer_type || "Unspecified")}
          <Text style={{ color: colors.warning, fontSize: 13, marginTop: 6 }}>Pay Later outstanding {formatINR(Number(customer!.outstanding ?? customer!.total_due ?? 0))}</Text>
        </View>
      )}

      {status === "new" && (
        <View testID={`${testIDPrefix}-new`} style={{ marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.onSurface, fontWeight: "700" }}>New Customer · {normalizePhone(phone)}</Text>
          <Text style={lbl}>Name *</Text>
          <TextInput testID={`${testIDPrefix}-new-name`} value={fields.name} onChangeText={(v) => setFields((f) => ({ ...f, name: v }))} onBlur={blurSave} placeholder="Customer name" placeholderTextColor={colors.muted} style={input} />
          <Text style={lbl}>Address (optional)</Text>
          <TextInput testID={`${testIDPrefix}-new-address`} value={fields.address} onChangeText={(v) => setFields((f) => ({ ...f, address: v }))} onBlur={blurSave} placeholderTextColor={colors.muted} style={input} />
          <Text style={lbl}>Email (optional)</Text>
          <TextInput testID={`${testIDPrefix}-new-email`} value={fields.email} onChangeText={(v) => setFields((f) => ({ ...f, email: v }))} onBlur={blurSave} keyboardType="email-address" autoCapitalize="none" placeholderTextColor={colors.muted} style={input} />
          <Text style={lbl}>GSTIN (optional)</Text>
          <TextInput testID={`${testIDPrefix}-new-gstin`} value={fields.gstin} onChangeText={(v) => setFields((f) => ({ ...f, gstin: v.toUpperCase() }))} onBlur={blurSave} autoCapitalize="characters" placeholderTextColor={colors.muted} style={input} />
          <Text style={lbl}>Customer Type</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {TYPES.map((t) => (
              <Pressable key={t} testID={`${testIDPrefix}-type-${t}`} onPress={() => setFields((f) => ({ ...f, type: t }))} style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: fields.type === t ? colors.brand : colors.border, backgroundColor: fields.type === t ? colors.brand : "transparent" }}>
                <Text style={{ color: fields.type === t ? colors.onBrandPrimary : colors.onSurface, fontWeight: "600" }}>{t}</Text>
              </Pressable>
            ))}
          </View>
          <Text testID={`${testIDPrefix}-save-state`} style={{ color: colors.muted, fontSize: 12, marginTop: 10 }}>
            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓ — customer selected automatically" : "Saves automatically once the name is filled in"}
          </Text>
        </View>
      )}
    </View>
  );
}
