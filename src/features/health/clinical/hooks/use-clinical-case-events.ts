"use client";

/**
 * K9 Ops Web — Health Web v1 HW-6B
 * Clinical Case Events Hook — Authority-gated, race-safe, lazy-amendment capable.
 *
 * Responsibilities:
 * - Coordinates canonical authority boundary (`useClinicalReadAuthority`: active profile + `health.read === true`) before querying events.
 * - Guarantees NO Firestore read starts if authority is loading or forbidden.
 * - Handles switching selected case cleanly without leaking previous state.
 * - Provides on-demand lazy amendment loading per event without N+1 fanout on open.
 */

import { useCallback, useEffect, useState } from "react";
import type { ReadState } from "../../domain/read-states";
import {
  CLINICAL_READ_CAPABILITY,
  readClinicalEventsForCase,
  readClinicalAmendmentsForEvent,
} from "../data/clinical-events-reader";
import {
  useClinicalReadAuthority,
  type ClinicalReadAuthorityStatus,
} from "./use-clinical-read-authority";
import type {
  ClinicalEventReadModel,
  ClinicalAmendmentReadModel,
} from "../types";

export type { ClinicalReadAuthorityStatus };

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

interface EventCycleResult {
  cycleKey: string;
  state: ReadState<ClinicalEventReadModel[]>;
}

export function useClinicalCaseEvents(
  dogId: string | null | undefined,
  caseId: string | null | undefined
): UseClinicalCaseEventsResult {
  const { status: authorityStatus, canRead } = useClinicalReadAuthority();

  const [nonce, setNonce] = useState(0);
  const [cycleResult, setCycleResult] = useState<EventCycleResult | null>(null);

  const [amendmentsState, setAmendmentsState] = useState<{
    targetKey: string;
    map: Record<string, ReadState<ClinicalAmendmentReadModel[]> | undefined>;
  }>({ targetKey: "", map: {} });

  const currentTargetKey = dogId && caseId ? `${dogId}#${caseId}` : "";
  const cycleKey = `${authorityStatus}#${currentTargetKey}#${nonce}`;

  const refresh = useCallback(() => {
    if (authorityStatus === "allowed") {
      setNonce((n) => n + 1);
    }
  }, [authorityStatus]);

  useEffect(() => {
    if (!dogId || !caseId || !canRead) {
      return;
    }

    let isCurrent = true;

    readClinicalEventsForCase(dogId, caseId).then((res) => {
      if (!isCurrent) return;
      setCycleResult({ cycleKey, state: res });
    });

    return () => {
      isCurrent = false;
    };
  }, [dogId, caseId, canRead, cycleKey]);

  const loadAmendmentsForEvent = useCallback(
    async (eventId: string) => {
      if (!dogId || !caseId || !eventId) return;
      if (authorityStatus !== "allowed") return;

      const target = `${dogId}#${caseId}`;

      setAmendmentsState((prev) => ({
        targetKey: target,
        map: {
          ...(prev.targetKey === target ? prev.map : {}),
          [eventId]: { status: "loading" },
        },
      }));

      const res = await readClinicalAmendmentsForEvent(dogId, caseId, eventId);

      setAmendmentsState((prev) => ({
        targetKey: target,
        map: {
          ...(prev.targetKey === target ? prev.map : {}),
          [eventId]: res,
        },
      }));
    },
    [dogId, caseId, authorityStatus]
  );

  // Derive final technical state
  let effectiveState: ReadState<ClinicalEventReadModel[]>;
  if (!dogId || !caseId) {
    effectiveState = IDLE_STATE;
  } else if (authorityStatus === "loading") {
    effectiveState = LOADING_STATE;
  } else if (!canRead) {
    effectiveState = FORBIDDEN_STATE;
  } else if (cycleResult && cycleResult.cycleKey === cycleKey) {
    effectiveState = cycleResult.state;
  } else {
    effectiveState = LOADING_STATE;
  }

  const effectiveAmendments =
    amendmentsState.targetKey === currentTargetKey ? amendmentsState.map : {};

  return {
    state: effectiveState,
    authorityStatus,
    refresh,
    loadAmendmentsForEvent,
    amendmentsState: effectiveAmendments,
  };
}
