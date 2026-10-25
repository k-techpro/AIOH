// Business context + secure-access gate for mobile — the same model the web app uses.
//
//  * Production ERP data lives under users/{business_owner_uid}/businessData/{collection}/records.
//    That owner uid comes from authorizedUsers/{uid}.business_owner_uid (NOT the signed-in
//    user's own uid), so every staff login sees the shared business data.
//  * Firestore rules require a server-issued accessSessions/{uid}. It is created by the Supabase
//    Edge Function `verify-aioh-access` (verifies the Firebase ID token server-side). The web
//    currently runs in Google-only mode (token only); if the server asks for the access password
//    we show the password screen. Mobile never decides access on its own.
import { create } from "zustand";
import { getApp, getApps } from "@react-native-firebase/app";
import { getAuth } from "@react-native-firebase/auth";
import {neonRepository} from "./neonRepository";
import {newOperationId} from "./neon/client";

export const OWNER_UID = "53RkfgSSN3USUvtceny57iiZiqj2";
const PROJECT_REF = "lnsvgzgjpmxcotafekrw";
const ENDPOINT = `https://${PROJECT_REF}.supabase.co/functions/v1/verify-aioh-access`;
export const RETIRED_BRANCHES = new Set(["testbench", "shop-test"]);

export type GateStatus = "idle" | "checking" | "needs_password" | "ready" | "deactivated" | "error";
export interface Access {
  uid: string; role: string; active: boolean; full_access: boolean;
  business_owner_uid: string; allowed_shop_ids?: string[]; allowed_branches?: string[]; default_branch?: string;
}
interface BusinessState {
  status: GateStatus;
  error: string | null;
  businessId: string | null;
  actorUid: string | null;
  access: Access | null;
  profile: Record<string, any> | null;
  saveProfile: (patch: Record<string, any>) => Promise<void>;
  bootstrap: () => Promise<void>;
  submitPassword: (password: string) => Promise<void>;
  reset: () => void;
}


const MESSAGES: Record<string, string> = {
  bad_request: "Enter the access password to continue.",
  unauthenticated: "Your session expired. Sign in again.",
  forbidden: "Incorrect access password. Please try again.",
  rate_limited: "Too many attempts. Access is locked for 15 minutes.",
  server_not_configured: "Secure access is temporarily unavailable. Try again shortly.",
  server_error: "Could not verify access right now. Please try again.",
  network: "Could not reach the secure access service. Check your connection.",
};
class AccessError extends Error { code: string; constructor(code: string, message: string) { super(message); this.code = code; } }

async function verifyFreshSession(user: any) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const firebaseIdToken = await user.getIdToken(true);
    try { return await postVerify({ firebaseIdToken }); }
    catch (error: any) {
      if (["bad_request", "forbidden", "server_not_configured"].includes(error?.code) || attempt === 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

function friendlyAccessError(error: any) {
  const code = String(error?.code || "");
  console.warn("[RetailPrime access] bootstrap failed", code || "unknown");
  if (code.includes("resource-exhausted") || /quota limit exceeded/i.test(String(error?.message || ""))) return "Database usage limit reached temporarily. Please try again later or contact administrator.";
  if (["permission-denied", "unavailable", "deadline-exceeded", "network-request-failed"].includes(code)) return "Service is temporarily unavailable. Please retry.";
  return error?.message || "Could not verify your access. Please retry.";
}

async function postVerify(body: Record<string, unknown>) {
  let res: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    res = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: controller.signal });
  } catch {
    clearTimeout(timeout);
    throw new AccessError("network", MESSAGES.network);
  }
  clearTimeout(timeout);
  let data: any = {};
  try { data = await res.json(); } catch { /* non-JSON error body */ }
  if (res.ok && data.ok) { if(data.backend!=="neon")throw new AccessError("server_error","The access service is not configured for Neon.");return data; }
  const code = data.error || (res.status === 429 ? "rate_limited" : "server_error");
  throw new AccessError(code, MESSAGES[code] || MESSAGES.server_error);
}

async function hasValidSession(uid:string){try{const context=await neonRepository.session();return context.profile.uid===uid;}catch{return false;}}
async function loadAccess(uid:string):Promise<{access:Access|null;deactivated:boolean}>{const context=await neonRepository.session();if(context.profile.uid!==uid)throw new Error('Session identity mismatch.');return {access:context.profile as Access,deactivated:context.profile.active===false};}

export const useBusiness = create<BusinessState>((set, get) => {
  // Shared tail of both paths: session is valid -> resolve profile -> start data listeners.
  const finish = async (uid: string) => {
    const { access, deactivated } = await loadAccess(uid);
    if (deactivated || !access) { set({ status: "deactivated", error: "This account has been deactivated." }); return; }
    let profile: Record<string, any> | null = null;
    try {
      profile = await neonRepository.getRecord({businessId:access.business_owner_uid,shopId:null},"settings","business-profile");
    } catch { /* profile is optional */ }
    set({ status: "ready", error: null, access, businessId: access.business_owner_uid, actorUid: uid, profile });
    const { useMockStore } = await import("../store/mock-data");
    useMockStore.getState().connect(access.business_owner_uid, uid);
  };
  return {
    status: "idle", error: null, businessId: null, actorUid: null, access: null, profile: null,
    reset: () => set({ status: "idle", error: null, businessId: null, actorUid: null, access: null, profile: null }),
    // Business profile (web: settings/business-profile, merged).
    saveProfile: async (patch) => {
      const { businessId } = get();
      if (!businessId) throw new Error("Secure access is not established yet.");
      const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
      await neonRepository.mutateRecord({businessId,shopId:null},"settings","business-profile","update",clean,newOperationId());
      set({ profile: { ...(get().profile || {}), ...clean } });
    },
    bootstrap: async () => {
      if (!getApps().length) return;
      const user = getAuth(getApp()).currentUser;
      if (!user) return;
      set({ status: "checking", error: null });
      try {
        if (!(await hasValidSession(user.uid))) {
          try {
            await verifyFreshSession(user); // Endpoint validates Google auth and issues the session.
          } catch (e: any) {
            if (e?.code === "bad_request" || e?.code === "forbidden") { set({ status: "needs_password", error: null }); return; }
            throw e;
          }
        }
        await finish(user.uid);
      } catch (e: any) {
        set({ status: "error", error: friendlyAccessError(e) });
      }
    },
    submitPassword: async (password) => {
      const user = getAuth(getApp()).currentUser;
      if (!user) { set({ status: "error", error: MESSAGES.unauthenticated }); return; }
      set({ status: "checking", error: null });
      try {
        await postVerify({ firebaseIdToken: await user.getIdToken(true), accessPassword: password });
        await finish(user.uid);
      } catch (e: any) {
        set({ status: e?.code === "forbidden" || e?.code === "bad_request" ? "needs_password" : "error", error: friendlyAccessError(e) });
      }
    },
  };
});
