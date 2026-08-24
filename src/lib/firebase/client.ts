import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";
import { connectToEmulators, validateEmulatorEnvironment } from "./emulator";

import { resolveFirebaseClientConfig } from "@/lib/firebase/config";

// Each `process.env.NEXT_PUBLIC_*` is read as a LITERAL member expression on
// purpose: Next.js inlines public env vars by textual substitution at build
// time, so `process.env` cannot be forwarded as an object to the resolver —
// in the browser bundle it would arrive empty. Keep these reads explicit.
const firebaseClientEnv = {
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID:
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Fail-closed target guard: validates required fields, requires an explicit
// NEXT_PUBLIC_APP_ENV selector (no production default), and asserts the
// resolved projectId matches the selector's target BEFORE initializeApp().
const firebaseConfig = resolveFirebaseClientConfig(firebaseClientEnv);

export const firebaseApp =
  getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
export const functions = getFunctions(
  firebaseApp,
  process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION ?? "southamerica-east1",
);

let analyticsPromise: Promise<Analytics | null> | null = null;

export function getFirebaseAnalytics() {
  if (typeof window === "undefined") {
    return Promise.resolve(null);
  }

  analyticsPromise ??= isSupported()
    .then((supported) => (supported ? getAnalytics(firebaseApp) : null))
    .catch(() => null);

  return analyticsPromise;
}

// Connect to emulators after initialization (client-side only, requires valid config)
if (typeof window !== "undefined" && firebaseConfig.apiKey && firebaseConfig.projectId) {
  const validation = validateEmulatorEnvironment();
  if (validation.enabled) {
    connectToEmulators(auth, db);
  }
}
