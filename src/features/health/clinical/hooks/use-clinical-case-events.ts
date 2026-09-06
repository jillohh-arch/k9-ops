"use client";

/**
 * K9 Ops Web — Health Web v1 HW-6B
 * Clinical Case Events Hook — Authority-gated, race-safe, lazy-amendment capable.
 *
 * Responsibilities:
 * - Coordinates strict authority boundary (`profile.permissions.health.read === true`) before querying events.
 * - Guarantees NO Firestore read starts if authority is loading or forbidden.
 * - Handles switching selected case cleanly without leaking previous state.
 * - Provides on-demand lazy amendment loading per event without N+1 fanout on open.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccessControl } from "@/features/access/providers/access-control-provider";
import type { ReadState } from "../../domain/read-states";
import {
  CLINICAL_READ_CAPABILITY,
  readClinicalEventsForCase,
  readClinicalAmendmentsForEvent,
} from "../data/clinical-events-reader";
import type {
  ClinicalEventReadModel,
  ClinicalAmendmentReadModel,
} from "../types";

export type ClinicalReadAuthorityStatus = "loading" | "allowed" | "forbidden";

export interface UseClinicalCaseEventsResult {
  state: ReadState<ClinicalEventReadModel[]>;
  authorityStatus: ClinicalReadAuthorityStatus;
  refresh: () => void;
  loadAmendmentsForEvent: (eventId: string) => Promise<void>;
  amendmentsState: Record<string, ReadState<ClinicalAmendmentReadModel[]> | undefined>;
}

const FORBIDDEN_STATE: ReadState<ClinicalEventReadModel[]> = {
  status: "forbidden",
  requiredCapability: CLINICAL_READ_CAPABILITY,
  message: "Leitura de eventos clínicos não autorizada para o perfil de acesso atual.",
};

const LOADING_STATE: ReadState<ClinicalEventReadModel[]> = { status: "loading" };
const IDLE_STATE: ReadState<ClinicalEventReadModel[]> = { status: "idle" };

export function useClinicalCaseEvents(
  dogId: string | null | undefined,
  caseId: string | null | undefined
): UseClinicalCaseEventsResult {
  const { profile, status: accessStatus } = useAccessControl();

  const authorityStatus: ClinicalReadAuthorityStatus =
    accessStatus === "loading"
      ? "loading"
      : (profile?.permissions as Record<string, unknown> | undefined)?.health &&
        typeof (profile?.permissions as Record<string, unknown>).health === "object" &&
        ((profile?.permissions as Record<string, unknown>).health as Record<string, unknown>).read === true
      ? "allowed"
      : "forbidden";

  const [nonce, setNonce] = useState(0);

  const [publishedState, setPublishedState] = useState<ReadState<ClinicalEventReadModel[]>>(
    () => (dogId && caseId ? LOADING_STATE : IDLE_STATE)
  );

  const [amendmentsState, setAmendmentsState] = useState<
    Record<string, ReadState<ClinicalAmendmentReadModel[]> | undefined>
  >({});

  // Cycle tracking to reject stale async resolutions
  const cycleRef = useRef<string>("");
  const currentCycleKey = `${authorityStatus}#${dogId ?? ""}#${caseId ?? ""}#${nonce}`;
  cycleRef.current = currentCycleKey;

  const refresh = useCallback(() => {
    if (authorityStatus === "allowed") {
      setNonce((n) => n + 1);
    }
  }, [authorityStatus]);

  // Clean reset when dogId or caseId changes
  useEffect(() => {
    setAmendmentsState({});
  }, [dogId, caseId]);

  useEffect(() => {
    if (!dogId || !caseId) {
      setPublishedState(IDLE_STATE);
      return;
    }

    if (authorityStatus === "loading") {
      setPublishedState(LOADING_STATE);
      return;
    }

    if (authorityStatus === "forbidden") {
      setPublishedState(FORBIDDEN_STATE);
      return;
    }

    let isMounted = true;
    const requestCycle = currentCycleKey;

    setPublishedState(LOADING_STATE);

    readClinicalEventsForCase(dogId, caseId).then((res) => {
      if (!isMounted) return;
      if (cycleRef.current !== requestCycle) return;
      setPublishedState(res);
    });

    return () => {
      isMounted = false;
    };
  }, [dogId, caseId, authorityStatus, nonce, currentCycleKey]);

  const loadAmendmentsForEvent = useCallback(
    async (eventId: string) => {
      if (!dogId || !caseId || !eventId) return;
      if (authorityStatus !== "allowed") return;

      // Mark event amendment as loading
      setAmendmentsState((prev) => ({
        ...prev,
        [eventId]: { status: "loading" },
      }));

      const res = await readClinicalAmendmentsForEvent(dogId, caseId, eventId);

      setAmendmentsState((prev) => ({
        ...prev,
        [eventId]: res,
      }));
    },
    [dogId, caseId, authorityStatus]
  );

  // Derive final technical state
  let effectiveState: ReadState<ClinicalEventReadModel[]> = publishedState;
  if (!dogId || !caseId) {
    effectiveState = IDLE_STATE;
  } else if (authorityStatus === "loading") {
    effectiveState = LOADING_STATE;
  } else if (authorityStatus === "forbidden") {
    effectiveState = FORBIDDEN_STATE;
  }

  return {
    state: effectiveState,
    authorityStatus,
    refresh,
    loadAmendmentsForEvent,
    amendmentsState,
  };
}
