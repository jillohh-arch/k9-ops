"use client";

import { useEffect, useMemo, useState } from "react";

import {
  subscribeAccessProfiles,
} from "@/features/access/data/access-profile-service";
import type { AccessProfile } from "@/lib/permissions/access-control";

type AccessProfilesState = {
  error: string | null;
  loading: boolean;
  profiles: AccessProfile[];
};

export function useAccessProfiles() {
  const [state, setState] = useState<AccessProfilesState>({
    error: null,
    loading: true,
    profiles: [],
  });

  useEffect(
    () =>
      subscribeAccessProfiles(
        (profiles) =>
          setState({
            error: null,
            loading: false,
            profiles,
          }),
        (error) =>
          setState((current) => ({
            ...current,
            error: error.message,
            loading: false,
          })),
      ),
    [],
  );

  return useMemo(() => state, [state]);
}
