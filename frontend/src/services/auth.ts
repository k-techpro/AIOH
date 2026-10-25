import {
  getAuth,
  onAuthStateChanged,
  signOut,
  type User,
} from "@react-native-firebase/auth";
import { getApp, getApps } from "@react-native-firebase/app";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { create } from "zustand";
import { useMockStore } from "../store/mock-data";
import { useBusiness } from "./business";

export const REQUIRED_FIREBASE_PROJECT_ID = "aioh-retailprime";

interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  phoneNumber: string | null;
  photoURL: string | null;
  providerId: string;
}

interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  initialized: boolean;
  error: string | null;
  setUser: (user: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  initialized: false,
  error: null,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  setInitialized: (initialized) => set({ initialized }),
  setError: (error) => set({ error }),
  logout: async () => {
    const firebaseAuth = getFirebaseAuth();
    if (!firebaseAuth) {
      set({ user: null, loading: false, initialized: true });
      return;
    }
    await signOut(firebaseAuth);
    try {
      await GoogleSignin.signOut();
    } catch (e) {
      // Ignore if not signed in with Google
    }
    set({ user: null, loading: false, initialized: true });
  },
}));

/**
 * Android creates the default Firebase app from app/google-services.json before
 * the JavaScript bundle runs. This intentionally does not initialize a web app.
 */
export const getFirebaseAuth = () => {
  if (getApps().length === 0) {
    return null;
  }
  const app = getApp();
  if (app.options.projectId !== REQUIRED_FIREBASE_PROJECT_ID) {
    throw new Error(`Wrong Firebase project: ${app.options.projectId || "unknown"}. Install a build generated with google-services.json for ${REQUIRED_FIREBASE_PROJECT_ID}.`);
  }
  return getAuth(app);
};

// Initialize Google Sign-In
GoogleSignin.configure({
  webClientId: "538061570203-itq2414p9d6uui6vcniibl3pufb5tb7n.apps.googleusercontent.com", // client_type: 3 from google-services.json
});

export const mapFirebaseUser = (user: User | null): UserProfile | null => {
  if (!user) return null;
  return {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    photoURL: user.photoURL,
    providerId: user.providerData[0]?.providerId || "firebase",
  };
};

export const subscribeToAuthChanges = () => {
  let firebaseAuth;
  try {
    firebaseAuth = getFirebaseAuth();
  } catch (error) {
    useAuthStore.getState().setError(error instanceof Error ? error.message : "Firebase project validation failed.");
    useAuthStore.getState().setLoading(false);
    useAuthStore.getState().setInitialized(true);
    return null;
  }
  if (!firebaseAuth) {
    return null;
  }

  return onAuthStateChanged(firebaseAuth, (user) => {
    useAuthStore.getState().setUser(mapFirebaseUser(user));
    useAuthStore.getState().setLoading(false);
    useAuthStore.getState().setInitialized(true);
    useAuthStore.getState().setError(null);
    if (user) {
      // Business data lives under the business owner uid and needs a server-issued access
      // session first — the gate resolves both, then starts the Firestore listeners.
      useBusiness.getState().bootstrap();
    } else {
      useBusiness.getState().reset();
      useMockStore.getState().disconnect();
    }
  }, (error) => {
    useAuthStore.getState().setError(error.message || "Firebase Authentication could not be initialized.");
    useAuthStore.getState().setLoading(false);
    useAuthStore.getState().setInitialized(true);
  });
};
