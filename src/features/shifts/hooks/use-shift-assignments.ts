"use client";

import { useEffect, useState } from "react";

import {
  subscribeShiftAssignments,
  type ShiftAssignment,
} from "@/features/effective/data/shift-group-service";

export function useShiftAssignments() {
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      subscribeShiftAssignments(
        (nextAssignments) => {
          setAssignments(nextAssignments);
          setError(null);
          setLoading(false);
        },
        (nextError) => {
          setError(nextError.message);
          setLoading(false);
        },
      ),
    [],
  );

  return { assignments, error, loading };
}
