"use client";

import {
  onIdTokenChanged,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { auth, db } from "@/lib/firebase/client";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type UserMirror = {
  auth_uid?: string;
  accessLevel?: string;
  callSign?: string;
  callsign?: string;
  email?: string;
  image_url?: string;
  nome?: string;
  name?: string;
  photoUrl?: string;
  role?: string;
  roles?: string[];
  training_role?: string;
  is_k9_instructor?: boolean;
};

export type AuthProfile = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoUrl: string | null;
  ra: string | null;
  roles: string[];
  isK9Instructor: boolean;
  claims: Record<string, unknown>;
  userMirror: UserMirror | null;
};

type AuthContextValue = {
  user: User | null;
  profile: AuthProfile | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  refreshClaims: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function getRaFromUser(user: User, claims: Record<string, unknown>) {
  const claimRa = claims.ra;
  if (typeof claimRa === "string" && claimRa.trim().length > 0) {
    return claimRa.trim();
  }

  const emailPrefix = user.email?.split("@")[0];
  return emailPrefix && /^\d+$/.test(emailPrefix) ? emailPrefix : null;
}

function uniqueRoles(values: unknown[]) {
  return Array.from(
    new Set(
      values
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function firstStringValue(...values: unknown[]) {
  return (
    values.find(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    )?.trim() ?? null
  );
}

async function loadAuthProfile(user: User): Promise<AuthProfile> {
  const token = await user.getIdTokenResult();
  const claims = token.claims as Record<string, unknown>;
  const ra = getRaFromUser(user, claims);

  let userMirror: UserMirror | null = null;

  if (ra) {
    try {
      const snapshot = await getDoc(doc(db, "users", ra));
      userMirror = snapshot.exists() ? (snapshot.data() as UserMirror) : null;
    } catch {
      userMirror = null;
    }
  }

  const roles = uniqueRoles([
    claims.role,
    claims.roles,
    claims.training_role,
    userMirror?.role,
    userMirror?.roles,
    userMirror?.training_role,
  ]);

  const isK9Instructor =
    claims.instrutor_k9 === true ||
    claims.training_instructor === true ||
    claims.role === "instrutor_k9" ||
    claims.training_role === "instrutor_k9" ||
    userMirror?.is_k9_instructor === true ||
    userMirror?.training_role === "instrutor_k9";

  return {
    uid: user.uid,
    email: user.email,
    displayName: firstStringValue(
      userMirror?.callsign,
      userMirror?.callSign,
      userMirror?.nome,
      userMirror?.name,
      user.displayName,
    ),
    photoUrl: firstStringValue(
      userMirror?.photoUrl,
      userMirror?.image_url,
      user.photoURL,
    ),
    ra,
    roles,
    isK9Instructor,
    claims,
    userMirror,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const hydrateProfile = useCallback(async (nextUser: User | null) => {
    setUser(nextUser);

    if (!nextUser) {
      setProfile(null);
      setStatus("unauthenticated");
      return;
    }

    setStatus("loading");
    const nextProfile = await loadAuthProfile(nextUser);
    setProfile(nextProfile);
    setStatus("authenticated");
  }, []);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, (nextUser) => {
      void hydrateProfile(nextUser);
    });

    return unsubscribe;
  }, [hydrateProfile]);

  const refreshClaims = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return;
    }

    await currentUser.getIdToken(true);
    await hydrateProfile(currentUser);
  }, [hydrateProfile]);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      status,
      isAuthenticated: status === "authenticated",
      refreshClaims,
      signOut,
    }),
    [profile, refreshClaims, signOut, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  }

  return context;
}
