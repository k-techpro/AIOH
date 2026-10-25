// Phone-first customer capture with safe AUTOMATIC save — the mobile twin of the web
// CustomerPhoneLookup `autoSave` mode. No "Create & Select" button anywhere.
//
// Rules (same as web):
//  * Name is required; a typed GSTIN must be valid; phone must normalise to 10 digits.
//  * Saves go through ONE serialised queue. The first save creates (idempotent — the
//    create dependency returns the existing customer for a known normalised phone);
//    every later save only UPDATES that same customer. Typing "A","Ar","Aru","Arun"
//    therefore can never create four records.
//  * `flush()` (called right before the user advances) finishes any pending save first.
import { normalizePhone, validPhone } from "./phone.ts";
import { validateGSTIN } from "./gst.ts";

export interface CustomerFields { name: string; address: string; email: string; gstin: string; type: string }
export const EMPTY_CUSTOMER_FIELDS: CustomerFields = { name: "", address: "", email: "", gstin: "", type: "Retail" };
export type Customer = Record<string, any> & { id: string };

export interface AutosaveDeps {
  create(input: Record<string, any>): Promise<Customer>;
  update(id: string, fields: Record<string, any>): Promise<void>;
}
export interface FlushResult { customer?: Customer; error?: string; changed?: boolean }

const clean = (f: CustomerFields) => ({
  name: f.name.trim(),
  gstin: f.gstin.trim().toUpperCase() || null,
  address: f.address.trim() || null,
  email: f.email.trim() || null,
  type: f.type,
  customer_type: f.type,
});

export class CustomerAutosave {
  phone = "";
  fields: CustomerFields = { ...EMPTY_CUSTOMER_FIELDS };
  saved: Customer | null = null;
  private lastSnapshot = "";
  private chain: Promise<unknown> = Promise.resolve();
  createCalls = 0;
  private deps: AutosaveDeps;
  private onSaved: (c: Customer) => void;
  constructor(deps: AutosaveDeps, onSaved: (c: Customer) => void = () => {}) {
    this.deps = deps;
    this.onSaved = onSaved;
  }

  /** A different phone is a different identity: forget what was saved for the old one. */
  setPhone(phone: string) {
    if (normalizePhone(phone) !== normalizePhone(this.phone)) { this.saved = null; this.lastSnapshot = ""; this.fields = { ...EMPTY_CUSTOMER_FIELDS }; }
    this.phone = phone;
  }
  edit(patch: Partial<CustomerFields>) { this.fields = { ...this.fields, ...patch }; }

  /** null when savable, otherwise the human reason it is not yet. */
  blocker(): string | null {
    if (!validPhone(this.phone)) return "Enter a valid 10-digit phone number.";
    if (!this.fields.name.trim()) return "Enter the customer's name to continue.";
    if (this.fields.gstin.trim() && !validateGSTIN(this.fields.gstin).valid) return "Enter a valid GSTIN.";
    return null;
  }

  /** Serialised create-or-update. Reads the LATEST fields when it runs; no-op if nothing changed. */
  save(): Promise<Customer> {
    const run = async (): Promise<Customer> => {
      const reason = this.blocker();
      if (reason) throw new Error(reason);
      const fields = clean(this.fields);
      const snapshot = JSON.stringify([normalizePhone(this.phone), fields]);
      if (this.saved && snapshot === this.lastSnapshot) return this.saved;
      let c = this.saved;
      if (!c) {
        this.createCalls += 1;
        c = await this.deps.create({ ...fields, phone: this.phone });
      } else {
        await this.deps.update(c.id, fields);
        c = { ...c, ...fields };
      }
      this.saved = c;
      this.lastSnapshot = snapshot;
      this.onSaved(c);
      return c;
    };
    const result = this.chain.then(run);
    this.chain = result.catch(() => {});
    return result;
  }

  /** Finish any pending save before the user advances. `changed` = selection differs from `current`. */
  async flush(current: Customer | null = null): Promise<FlushResult> {
    const reason = this.blocker();
    if (reason) return { error: reason };
    try {
      const customer = await this.save();
      return { customer, changed: !current || current.id !== customer.id || current.name !== customer.name };
    } catch (e: any) {
      return { error: e?.message || "Could not save the customer." };
    }
  }
}
