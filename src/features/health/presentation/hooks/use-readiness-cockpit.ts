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
 * - Gated by strict canonical read authority (useReadinessReadAuthority).
 */

import { useCallback, useEffect, useState } from "react";
import { loadReadinessCockpit } from "./load-readiness-cockpit";
import { useReadinessReadAuthority } from "./use-readiness-read-authority";
import type { ReadinessCockpit } from "../../domain/readiness-types";

export interface ReadinessCockpitState {
  /**
   * `not_found` — dog absent from the authorized scope (never disambiguated
   * from "exists but forbidden", so scope membership is not leaked).
   * `partial`   — cockpit rendered, but at least one composed source degraded.
   * `error`     — the institutional dog document itself could not be read.
   * `forbidden` — user access profile not authorized for health.read.
   */
  status: "loading" | "success" | "partial" | "not_found" | "error" | "forbidden";
  cockpit: ReadinessCockpit | null;
  /** False when the restrictions read failed: absence must not be affirmed. */
  restrictionsCoverageComplete: boolean;
  errorMessage: string | null;
  refetch: () => void;
}

interface CockpitLoadedResult {
  cycleKey: string;
  cockpit: ReadinessCockpit | null;
  isPartial: boolean;
  notFound: boolean;
  coverageComplete: boolean;
  error: string | null;
}

export function useReadinessCockpit(dogId: string): ReadinessCockpitState {
  const authority = useReadinessReadAuthority();
  const [dataResult, setDataResult] = useState<CockpitLoadedResult | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState<number>(0);

  const refetch = useCallback(() => {
    setReloadTrigger((n) => n + 1);
  }, []);

  const cycleKey = `${authority.status}#${dogId}#${reloadTrigger}`;

  useEffect(() => {
    // While authority is unresolved or denied, no read is even attempted.
    if (authority.status !== "allowed") {
      return;
    }

    let isSubscribed = true;

    async function load() {
      try {
        const result = await loadReadinessCockpit(dogId);

        if (!isSubscribed) return;

        if (result.status === "not_found") {
          setDataResult({
            cycleKey,
            cockpit: null,
            isPartial: false,
            notFound: true,
            coverageComplete: true,
            error: null,
          });
          return;
        }

        setDataResult({
          cycleKey,
          cockpit: result.cockpit,
          isPartial: result.isPartial,
          notFound: false,
          coverageComplete: result.restrictionsCoverageComplete,
          error: null,
        });
      } catch (err: unknown) {
        if (!isSubscribed) return;
        // Institutional dog document unavailable -> controlled global error.
        const msg =
          err instanceof Error
            ? err.message
            : "Erro desconhecido ao carregar a prontidão do K9";
        setDataResult({
          cycleKey,
          cockpit: null,
          isPartial: false,
          notFound: false,
          coverageComplete: true,
          error: msg,
        });
      }
    }

    void load();

    return () => {
      isSubscribed = false;
    };
  }, [authority.status, cycleKey, dogId]);

  // Derived, authority-first state:
  const hasValidData =
    authority.status === "allowed" && dataResult?.cycleKey === cycleKey;
  const cockpit = hasValidData ? dataResult.cockpit : null;
  const error = hasValidData ? dataResult.error : null;
  const notFound = hasValidData ? dataResult.notFound : false;
  const isPartial = hasValidData ? dataResult.isPartial : false;
  const coverageComplete = hasValidData ? dataResult.coverageComplete : true;

  let status: ReadinessCockpitState["status"] = "success";
  if (authority.status === "forbidden") {
    status = "forbidden";
  } else if (authority.status === "loading" || !hasValidData) {
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
