"use client";

import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";

import { db } from "@/lib/firebase/client";
import {
  parseOperationalRestriction,
  type OperationalRestriction,
} from "@/features/health/data/health-restriction-service";

export type UseK9RestrictionsResult = {
  activeRestrictions: OperationalRestriction[];
  error: string | null;
  historyRestrictions: OperationalRestriction[];
  loading: boolean;
  restrictions: OperationalRestriction[];
};

type State = {
  dogId: string | null | undefined;
  items: OperationalRestriction[];
  loading: boolean;
  error: string | null;
};

export function useK9Restrictions(
  dogId: string | null | undefined,
): UseK9RestrictionsResult {
  const [state, setState] = useState<State>({
    dogId: null,
    items: [],
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!dogId) return;

    const colRef = collection(db, "dogs", dogId, "operational_restrictions");

    return onSnapshot(
      colRef,
      (snapshot) => {
        const items = snapshot.docs.map((docSnap) =>
          parseOperationalRestriction(docSnap.id, dogId, docSnap.data()),
        );
        items.sort((a, b) => b.issued_at.getTime() - a.issued_at.getTime());
        setState({
          dogId,
          items,
          loading: false,
          error: null,
        });
      },
      (err) => {
        setState({
          dogId,
          items: [],
          loading: false,
          error: err.message,
        });
      },
    );
  }, [dogId]);

  const isCurrent = state.dogId === dogId;
  const restrictions = useMemo(
    () => (!dogId ? [] : isCurrent ? state.items : []),
    [dogId, isCurrent, state.items],
  );
  const loading = !dogId ? false : isCurrent ? state.loading : true;
  const error = !dogId ? null : isCurrent ? state.error : null;

  const activeRestrictions = useMemo(
    () => restrictions.filter((r) => r.status === "active"),
    [restrictions],
  );

  const historyRestrictions = useMemo(
    () =>
      restrictions.filter(
        (r) => r.status === "ended" || r.status === "cancelled",
      ),
    [restrictions],
  );

  return {
    activeRestrictions,
    error,
    historyRestrictions,
    loading,
    restrictions,
  };
}
