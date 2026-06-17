import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getFunctions, type Functions } from "firebase/functions";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

function getApp(): FirebaseApp {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp(firebaseConfig);
}

// Lazy singletons — only initialize when actually accessed (client-side).
// This prevents Firebase from throwing during SSR/prerender when env vars
// are not available.
let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _storage: FirebaseStorage | null = null;
let _functions: Functions | null = null;

export const firebaseApp: FirebaseApp = new Proxy({} as FirebaseApp, {
  get(_, prop) {
    _app ??= getApp();
    return Reflect.get(_app, prop);
  },
});

export const auth: Auth = new Proxy({} as Auth, {
  get(_, prop) {
    _app ??= getApp();
    _auth ??= getAuth(_app);
    return Reflect.get(_auth, prop);
  },
});

export const db: Firestore = new Proxy({} as Firestore, {
  get(_, prop) {
    _app ??= getApp();
    _db ??= getFirestore(_app);
    return Reflect.get(_db, prop);
  },
});

export const storage: FirebaseStorage = new Proxy({} as FirebaseStorage, {
  get(_, prop) {
    _app ??= getApp();
    _storage ??= getStorage(_app);
    return Reflect.get(_storage, prop);
  },
});

export const functions: Functions = new Proxy({} as Functions, {
  get(_, prop) {
    _app ??= getApp();
    _functions ??= getFunctions(
      _app,
      process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION ?? "southamerica-east1",
    );
    return Reflect.get(_functions, prop);
  },
});

let analyticsPromise: Promise<Analytics | null> | null = null;

export function getFirebaseAnalytics() {
  if (typeof window === "undefined") {
    return Promise.resolve(null);
  }

  analyticsPromise ??= isSupported()
    .then((supported) => (supported ? getAnalytics(getApp()) : null))
    .catch(() => null);

  return analyticsPromise;
}
