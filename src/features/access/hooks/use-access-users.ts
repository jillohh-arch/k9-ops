"use client";

import { useEffect, useMemo, useState } from "react";

import {
  subscribeAccessUsers,
  type AccessUser,
} from "@/features/access/data/access-profile-service";

type AccessUsersState = {
  error: string | null;
  loading: boolean;
  users: AccessUser[];
};

export function useAccessUsers() {
  const [state, setState] = useState<AccessUsersState>({
    error: null,
    loading: true,
    users: [],
  });

  useEffect(
    () =>
      subscribeAccessUsers(
        (users) =>
          setState({
            error: null,
            loading: false,
            users,
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
