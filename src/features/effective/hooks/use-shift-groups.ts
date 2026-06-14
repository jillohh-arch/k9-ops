"use client";

import { useEffect, useState } from "react";

import {
  getAllShiftGroups,
  getMembersCountByShiftGroup,
  subscribeShiftGroups,
  type ShiftGroup,
} from "@/features/effective/data/shift-group-service";

export type ShiftGroupWithCount = ShiftGroup & { memberCount: number };

export function useShiftGroups() {
  const [groups, setGroups] = useState<ShiftGroup[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initial load
    getAllShiftGroups()
      .then(setGroups)
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar"))
      .finally(() => setLoading(false));

    getMembersCountByShiftGroup()
      .then(setMemberCounts)
      .catch(() => { /* ignore */ });

    // Subscribe to real-time updates
    const unsubscribe = subscribeShiftGroups((newGroups) => {
      setGroups(newGroups);
    });

    return unsubscribe;
  }, []);

  const groupsWithCount: ShiftGroupWithCount[] = groups.map((g) => ({
    ...g,
    memberCount: memberCounts[g.id] ?? 0,
  }));

  return {
    groups: groupsWithCount,
    loading,
    error,
    refetchCounts: async () => {
      const counts = await getMembersCountByShiftGroup();
      setMemberCounts(counts);
    },
  };
}
