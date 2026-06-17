"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { doc, onSnapshot } from "firebase/firestore";

import { useAuth, type AuthProfile } from "@/features/auth/providers/auth-provider";
import { db } from "@/lib/firebase/client";
import {
  defaultAccessProfiles,
  getDefaultAccessProfile,
  getProfileIdFromLegacyValue,
  hasAccessPermission,
  type AccessAction,
  type AccessModuleId,
  type AccessProfile,
} from "@/lib/permissions/access-control";
import { normalizeAccessProfile } from "@/features/access/data/access-profile-service";

type AccessStatus = "fallback" | "loading" | "ready";

type AccessControlContextValue = {
  can: (moduleId: AccessModuleId, action?: AccessAction) => boolean;
  error: string | null;
  profile: AccessProfile;
  profileId: string;
  status: AccessStatus;
};

const fallbackProfile =
  getDefaultAccessProfile("operador_k9") ?? defaultAccessProfiles[0];

const AccessControlContext = createContext<AccessControlContextValue | null>(
  null,
);

function getUserMirrorValue(
  profile: AuthProfile | null,
  key: string,
): string | null {
  const mirror = profile?.userMirror as Record<string, unknown> | null;
  const value = mirror?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function resolveProfileId(profile: AuthProfile | null) {
  if (!profile) return fallbackProfile.id;

  const explicitProfileId =
    getUserMirrorValue(profile, "access_profile_id") ??
    getUserMirrorValue(profile, "accessProfileId") ??
    getUserMirrorValue(profile, "accessProfile") ??
    getUserMirrorValue(profile, "access_profile") ??
    getUserMirrorValue(profile, "accessLevel");

  const explicit = getProfileIdFromLegacyValue(explicitProfileId);
  if (explicit) return explicit;

  for (const role of profile.roles) {
    const roleProfile = getProfileIdFromLegacyValue(role);
    if (roleProfile) return roleProfile;
  }

  if (profile.isK9Instructor) {
    return "instrutor_k9";
  }

  return "operador_k9";
}

function applyK9InstructorCapability(
  profile: AccessProfile,
  authProfile: AuthProfile | null,
): AccessProfile {
  if (!authProfile?.isK9Instructor || profile.id === "instrutor_k9") {
    return profile;
  }

  return {
    ...profile,
    permissions: {
      ...profile.permissions,
      training: {
        ...(profile.permissions.training ?? {}),
        approve: true,
        view: true,
      },
      training_matrix: {
        ...(profile.permissions.training_matrix ?? {}),
        approve: true,
        view: true,
      },
    },
    role_keys: Array.from(new Set([...profile.role_keys, "instrutor_k9"])),
  };
}

export function AccessControlProvider({ children }: { children: ReactNode }) {
  const { profile: authProfile, status: authStatus } = useAuth();
  const [remoteProfile, setRemoteProfile] = useState<AccessProfile | null>(null);
  const [status, setStatus] = useState<AccessStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const profileId = resolveProfileId(authProfile);
  const localProfile = getDefaultAccessProfile(profileId) ?? fallbackProfile;

  useEffect(() => {
    if (authStatus !== "authenticated") {
      return;
    }

    return onSnapshot(
      doc(db, "access_profiles", profileId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setRemoteProfile(null);
          setStatus("fallback");
          return;
        }

        setRemoteProfile(normalizeAccessProfile(snapshot.id, snapshot.data()));
        setStatus("ready");
      },
      (nextError) => {
        setRemoteProfile(null);
        setError(nextError.message);
        setStatus("fallback");
      },
    );
  }, [authStatus, profileId]);

  const activeProfile = applyK9InstructorCapability(
    remoteProfile ?? localProfile,
    authProfile,
  );

  const value = useMemo<AccessControlContextValue>(
    () => ({
      can: (moduleId, action = "view") =>
        hasAccessPermission(activeProfile, moduleId, action),
      error,
      profile: activeProfile,
      profileId,
      status,
    }),
    [activeProfile, error, profileId, status],
  );

  return (
    <AccessControlContext.Provider value={value}>
      {children}
    </AccessControlContext.Provider>
  );
}

export function useAccessControl() {
  const context = useContext(AccessControlContext);

  if (!context) {
    throw new Error(
      "useAccessControl deve ser usado dentro de AccessControlProvider.",
    );
  }

  return context;
}
