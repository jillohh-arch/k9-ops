import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const firebaseApp =
  getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
export const functions = getFunctions(
  firebaseApp,
  process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION ?? "southamerica-east1",
);

declare global {
  var __k9OpsFirebaseEmulatorsConnected: boolean | undefined;
}

if (
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true" &&
  !globalThis.__k9OpsFirebaseEmulatorsConnected
) {
  const authEmulatorPort = Number(
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_PORT ?? "9099",
  );
  const firestoreEmulatorPort = Number(
    process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_PORT ?? "8080",
  );
  const functionsEmulatorPort = Number(
    process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_PORT ?? "5001",
  );

  connectAuthEmulator(auth, `http://127.0.0.1:${authEmulatorPort}`, {
    disableWarnings: true,
  });
  connectFirestoreEmulator(db, "127.0.0.1", firestoreEmulatorPort);
  connectFunctionsEmulator(functions, "127.0.0.1", functionsEmulatorPort);
  globalThis.__k9OpsFirebaseEmulatorsConnected = true;
}

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
