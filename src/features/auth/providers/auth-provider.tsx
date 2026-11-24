"use client";

import {
  onIdTokenChanged,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { auth, db } from "@/lib/firebase/client";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export type UserMirror = {
  access_profile?: string;
  access_profile_id?: string;
  active?: boolean;
  adestrador?: boolean;
  archived_at?: unknown;
  auth_uid?: string;
  accessLevel?: string;
  accessProfile?: string;
  accessProfileId?: string;
  callSign?: string;
  callsign?: string;
  deleted_at?: unknown;
  email?: string;
  image_url?: string;
  instrutor?: boolean;
  instrutor_k9?: boolean;
  nome?: string;
  name?: string;
  photo_url?: string;
  photoUrl?: string;
  profile_image_url?: string;
  profileImageUrl?: string;
  permissions_version?: number;
  role?: string;
  roles?: string[];
  status?: string;
  training_instructor?: boolean;
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

async function findUserMirrorByField(field: string, value: string) {
  const snapshot = await getDocs(
    query(collection(db, "users"), where(field, "==", value), limit(1)),
  );
  const match = snapshot.docs[0];

  return match
    ? { ra: match.id, userMirror: match.data() as UserMirror }
    : null;
}

async function findUserMirrorByAuthIdentity(user: User) {
  for (const field of ["auth_uid", "authUid", "uid"]) {
    const resolved = await findUserMirrorByField(field, user.uid);
    if (resolved) return resolved;
  }

  if (user.email) {
    for (const field of ["email", "institutional_email", "institutionalEmail"]) {
      const resolved = await findUserMirrorByField(field, user.email);
      if (resolved) return resolved;
    }
  }

  return null;
}

const RATIFIED_LEGACY_INSTRUCTOR_ROLES = new Set([
  "instrutor",
  "adestrador",
  "instrutor_k9",
  "adestrador_k9",
  "k9_instructor",
]);

function normalizeRoleToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function isUserMirrorCurrentlyActive(
  userMirror: UserMirror | null | undefined,
): boolean {
  if (!userMirror) return false;
  if (userMirror.active === false) return false;
  if (userMirror.deleted_at != null) return false;
  if (userMirror.archived_at != null) return false;
  if (
    typeof userMirror.status === "string" &&
    ["inativo", "inactive"].includes(userMirror.status.trim().toLowerCase())
  ) {
    return false;
  }
  return true;
}

export function resolveIsK9Instructor(
  userMirror: UserMirror | null | undefined,
): boolean {
  if (!isUserMirrorCurrentlyActive(userMirror) || !userMirror) {
    return false;
  }

  // Precedence 1: Explicit canonical revocation overrides all legacy flags & claims.
  if (userMirror.is_k9_instructor === false) {
    return false;
  }

  // Precedence 2: Explicit canonical grant.
  if (userMirror.is_k9_instructor === true) {
    return true;
  }

  // Non-boolean non-nullish values (e.g. "true", 1, 0) fail closed.
  if (userMirror.is_k9_instructor != null) {
    return false;
  }

  // Precedence 3: Absent (undefined/null) -> ratified legacy compat ONLY on userMirror.
  if (
    userMirror.training_instructor === true ||
    userMirror.instrutor_k9 === true ||
    userMirror.instrutor === true ||
    userMirror.adestrador === true
  ) {
    return true;
  }

  const normalizedTrainingRole = normalizeRoleToken(userMirror.training_role);
  if (
    normalizedTrainingRole !== null &&
    RATIFIED_LEGACY_INSTRUCTOR_ROLES.has(normalizedTrainingRole)
  ) {
    return true;
  }

  if (Array.isArray(userMirror.roles)) {
    return userMirror.roles.some((entry) => {
      const token = normalizeRoleToken(entry);
      return token !== null && RATIFIED_LEGACY_INSTRUCTOR_ROLES.has(token);
    });
  }

  return false;
}

export function resolveAuthProfileRoles(
  userMirror: UserMirror | null | undefined,
  isK9Instructor: boolean,
): string[] {
  if (!isUserMirrorCurrentlyActive(userMirror) || !userMirror) {
    return [];
  }

  const candidates = uniqueRoles([
    userMirror.role,
    userMirror.roles,
    isK9Instructor ? userMirror.training_role : null,
  ]);

  if (isK9Instructor) {
    return candidates;
  }

  return candidates.filter((entry) => {
    const token = normalizeRoleToken(entry);
    return token === null || !RATIFIED_LEGACY_INSTRUCTOR_ROLES.has(token);
  });
}

async function loadAuthProfile(user: User): Promise<AuthProfile> {
  let claims: Record<string, unknown> = {};
  try {
    const token = await user.getIdTokenResult();
    claims = (token?.claims ?? {}) as Record<string, unknown>;
  } catch {
    return {
      uid: user.uid,
      email: user.email,
      displayName: firstStringValue(user.displayName),
      photoUrl: firstStringValue(user.photoURL),
      ra: getRaFromUser(user, {}),
      roles: [],
      isK9Instructor: false,
      claims: {},
      userMirror: null,
    };
  }

  let ra = getRaFromUser(user, claims);

  let userMirror: UserMirror | null = null;

  if (ra) {
    try {
      const snapshot = await getDoc(doc(db, "users", ra));
      userMirror = snapshot.exists() ? (snapshot.data() as UserMirror) : null;
    } catch {
      userMirror = null;
    }
  }

  if (!userMirror) {
    try {
      const resolved = await findUserMirrorByAuthIdentity(user);

      if (resolved) {
        ra = resolved.ra;
        userMirror = resolved.userMirror;
      }
    } catch {
      userMirror = null;
    }
  }

  // Web UI authority mirrors Firestore users/{ra}; server Rules/Functions remain authoritative.
  const isK9Instructor = resolveIsK9Instructor(userMirror);
  const roles = resolveAuthProfileRoles(userMirror, isK9Instructor);

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
      userMirror?.photo_url,
      userMirror?.image_url,
      userMirror?.profileImageUrl,
      userMirror?.profile_image_url,
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
  const hydrateRequestIdRef = useRef(0);

  const hydrateProfile = useCallback(async (nextUser: User | null) => {
    const requestId = ++hydrateRequestIdRef.current;
    setUser(nextUser);

    if (!nextUser) {
      setProfile(null);
      setStatus("unauthenticated");
      return;
    }

    setProfile(null);
    setStatus("loading");
    try {
      const nextProfile = await loadAuthProfile(nextUser);
      if (requestId !== hydrateRequestIdRef.current) {
        return;
      }
      setProfile(nextProfile);
      setStatus("authenticated");
    } catch {
      if (requestId !== hydrateRequestIdRef.current) {
        return;
      }
      setProfile({
        uid: nextUser.uid,
        email: nextUser.email,
        displayName: firstStringValue(nextUser.displayName),
        photoUrl: firstStringValue(nextUser.photoURL),
        ra: null,
        roles: [],
        isK9Instructor: false,
        claims: {},
        userMirror: null,
      });
      setStatus("authenticated");
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, (nextUser) => {
      void hydrateProfile(nextUser);
    });

    return () => {
      hydrateRequestIdRef.current += 1;
      unsubscribe();
    };
  }, [hydrateProfile]);

  const refreshClaims = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return;
    }

    setProfile(null);
    setStatus("loading");
    const refreshRequestId = ++hydrateRequestIdRef.current;
    try {
      await currentUser.getIdToken(true);
    } catch {
      // Fail closed via hydrateProfile even if forced token refresh rejects.
    }
    if (
      refreshRequestId !== hydrateRequestIdRef.current ||
      auth.currentUser !== currentUser
    ) {
      return;
    }
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
