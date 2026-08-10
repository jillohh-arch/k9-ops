"use client";

/**
 * K9 Ops Web — Health Web v1 HW-3D
 * Cockpit state hook for /health/readiness/[dogId] (SCR-03).
 *
 * CRITICAL MANDATES:
 * - Never computes readiness. Composition only, over server-owned projections.
 * - `not_found` is a distinct state, never an error and never an empty cockpit.
 * - `partial` preserves every successfully read block; it does not blank the page.
 * - Reuses the single canonical composition path (loadReadinessCockpit).
 */

import { useCallback, useEffect, useState } from "react";
import { loadReadinessCockpit } from "./load-readiness-cockpit";
import type { ReadinessCockpit } from "../../domain/readiness-types";

export interface ReadinessCockpitState {
  /**
   * `not_found` — dog absent from the authorized scope (never disambiguated
   * from "exists but forbidden", so scope membership is not leaked).
   * `partial`   — cockpit rendered, but at least one composed source degraded.
   * `error`     — the institutional dog document itself could not be read.
   */
  status: "loading" | "success" | "partial" | "not_found" | "error";
  cockpit: ReadinessCockpit | null;
  /** False when the restrictions read failed: absence must not be affirmed. */
  restrictionsCoverageComplete: boolean;
  errorMessage: string | null;
  refetch: () => void;
}

export function useReadinessCockpit(dogId: string): ReadinessCockpitState {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<boolean>(false);
  const [cockpit, setCockpit] = useState<ReadinessCockpit | null>(null);
  const [isPartial, setIsPartial] = useState<boolean>(false);
  const [coverageComplete, setCoverageComplete] = useState<boolean>(true);
  const [reloadTrigger, setReloadTrigger] = useState<number>(0);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    setReloadTrigger((n) => n + 1);
  }, []);

  useEffect(() => {
    let isSubscribed = true;

    async function load() {
      try {
        const result = await loadReadinessCockpit(dogId);

        if (!isSubscribed) return;

        if (result.status === "not_found") {
          setNotFound(true);
          setCockpit(null);
          setLoading(false);
          return;
        }

        setCockpit(result.cockpit);
        setIsPartial(result.isPartial);
        setCoverageComplete(result.restrictionsCoverageComplete);
        setLoading(false);
      } catch (err: unknown) {
        if (!isSubscribed) return;
        // Institutional dog document unavailable -> controlled global error.
        const msg =
          err instanceof Error
            ? err.message
            : "Erro desconhecido ao carregar a prontidão do K9";
        setError(msg);
        setLoading(false);
      }
    }

    void load();

    return () => {
      isSubscribed = false;
    };
  }, [dogId, reloadTrigger]);

  let status: ReadinessCockpitState["status"] = "success";
  if (loading) {
    status = "loading";
  } else if (error) {
    status = "error";
  } else if (notFound) {
    status = "not_found";
  } else if (isPartial) {
    status = "partial";
  }

  return {
    status,
    cockpit,
    restrictionsCoverageComplete: coverageComplete,
    errorMessage: error,
    refetch,
  };
}
