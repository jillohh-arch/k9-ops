"use client";

/**
 * K9 Ops Web — Health Web v1 F30 Reports
 * Canonical hook for Health Reports data composition & authority gating.
 *
 * HARD SECURITY & INTEGRITY INVARIANTS:
 * - Gated strictly on canonical Health read authority: health.view === true satisfies domain health.read (CT3.AUTH-HEALTH-01).
 * - While authority is not `allowed`, ZERO Firestore queries are made.
 * - Composes the 3 frozen institutional scope loaders in parallel:
 *   1. `loadReadinessScope`
 *   2. `loadClinicalScope`
 *   3. `loadScheduleScope`
 * - Evaluates export authorization fail-closed: requires `reports.export === true`.
 * - Race-safe: superseded cycles are discarded.
 * - Truthful ZERO vs UNKNOWN: preserved into `HealthReportsAggregate`.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccessControl } from "@/features/access/providers/access-control-provider";
import type { ReadState } from "../../domain/read-states";
import {
  loadReadinessScope,
  type ReadinessScope,
} from "../../presentation/hooks/load-readiness-scope";
import {
  loadClinicalScope,
  type ClinicalScopeResult,
} from "../../clinical/data/clinical-scope-loader";
import {
  loadScheduleScope,
  type ScheduleListEntry,
  type ScheduleScopeResult,
} from "../../schedule/data/schedule-scope-loader";
import {
  composeScheduleEntry,
  type ComposedScheduleEntry,
} from "../../schedule/composition/schedule-composition";
import { aggregateHealthReports } from "../domain/health-reports-aggregators";
import {
  HEALTH_REPORTS_EXPORT_POLICY_RATIFIED,
  type HealthReportsAggregate,
  type ReportExportAuthority,
  type ReportPeriod,
} from "../domain/health-reports-types";

export type HealthReportsAuthorityStatus = "loading" | "allowed" | "forbidden";

export interface UseHealthReportsDataResult {
  /** Canonical read state for the reports aggregate */
  state: ReadState<HealthReportsAggregate>;
  /** Authority status for health.read */
  authorityStatus: HealthReportsAuthorityStatus;
  /** Export capability status (fail-closed) */
  exportAuthority: ReportExportAuthority;
  /** Active period filter */
  period: ReportPeriod;
  /** Changes active period filter */
  setPeriod: (period: ReportPeriod) => void;
  /** Re-triggers loading cycle */
  refresh: () => void;
}

function rawHealthPermissions(
  permissions: unknown
): Record<string, unknown> | null {
  if (!permissions || typeof permissions !== "object") return null;
  const health = (permissions as Record<string, unknown>).health;
  if (!health || typeof health !== "object") return null;
  return health as Record<string, unknown>;
}

function rawReportsPermissions(
  permissions: unknown
): Record<string, unknown> | null {
  if (!permissions || typeof permissions !== "object") return null;
  const reports = (permissions as Record<string, unknown>).reports;
  if (!reports || typeof reports !== "object") return null;
  return reports as Record<string, unknown>;
}

interface LoadedCycleData {
  cycleKey: string;
  readinessScope: ReadinessScope;
  clinicalResult: ClinicalScopeResult;
  scheduleResult: ScheduleScopeResult;
  composedScheduleEntries: ComposedScheduleEntry[];
  loadedAt: Date;
}

export function useHealthReportsData(): UseHealthReportsDataResult {
  const { profile, status: accessStatus } = useAccessControl();
  const [period, setPeriod] = useState<ReportPeriod>("7d");
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [loadedData, setLoadedData] = useState<LoadedCycleData | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);

  const refresh = useCallback(() => {
    setReloadTrigger((prev) => prev + 1);
  }, []);

  // Strict authority derivation
  const { authorityStatus, exportAuthority } = useMemo<{
    authorityStatus: HealthReportsAuthorityStatus;
    exportAuthority: ReportExportAuthority;
  }>(() => {
    if (accessStatus === "loading") {
      return {
        authorityStatus: "loading",
        exportAuthority: {
          canExport: false,
          reason: "Verificando perfil de acesso...",
          hasCanonicalRead: false,
          hasExportCapability: false,
          isPolicyRatified: HEALTH_REPORTS_EXPORT_POLICY_RATIFIED,
        },
      };
    }

    const profileActive = profile?.status === "active";
    const health = rawHealthPermissions(profile?.permissions);
    const reports = rawReportsPermissions(profile?.permissions);

    // CANONICAL HEALTH REPORTS READ RULE:
    // CT3.AUTH-HEALTH-01: F10 persisted grant `health.view === true` satisfies
    // canonical domain read authority `health.read`.
    // `reports.view` belongs to the generic reports surface and is NOT
    // required or evaluated for reading canonical Health Reports.
    const hasCanonicalRead = health?.view === true;
    const hasExportCapability = reports?.export === true || health?.export === true;
    const isPolicyRatified = HEALTH_REPORTS_EXPORT_POLICY_RATIFIED;

    if (!profileActive || !hasCanonicalRead) {
      return {
        authorityStatus: "forbidden",
        exportAuthority: {
          canExport: false,
          reason: "Acesso de leitura a saúde (health.read) não autorizado.",
          hasCanonicalRead: false,
          hasExportCapability,
          isPolicyRatified,
        },
      };
    }

    // EXPORT POLICY GATE:
    // Requires health read authority && export capability (reports.export or health.export).
    const candidateEligible = hasCanonicalRead && hasExportCapability;
    const canExport = candidateEligible && isPolicyRatified;

    let exportReason: string | undefined;
    if (!hasExportCapability) {
      exportReason = "Permissão de exportação não atribuída ao perfil de acesso.";
    } else if (!isPolicyRatified) {
      exportReason = "Exportação desabilitada: aguardando ratificação de política institucional.";
    }

    return {
      authorityStatus: "allowed",
      exportAuthority: {
        canExport,
        reason: exportReason,
        hasCanonicalRead,
        hasExportCapability,
        isPolicyRatified,
      },
    };
  }, [accessStatus, profile]);

  const cycleKey = `${authorityStatus}#${reloadTrigger}`;

  useEffect(() => {
    if (authorityStatus !== "allowed") {
      return;
    }

    let active = true;

    const runCycle = async () => {
      try {
        const now = new Date();

        // Run all three canonical scope loaders in parallel
        const [readinessScope, clinicalResult, scheduleResult] =
          await Promise.all([
            loadReadinessScope(),
            loadClinicalScope(),
            loadScheduleScope(),
          ]);

        if (!active) return;

        // Compose schedule items with temporal status at now
        const scheduleRawEntries: ScheduleListEntry[] =
          scheduleResult.state.status === "success"
            ? scheduleResult.state.data
            : scheduleResult.state.status === "partial"
              ? scheduleResult.state.partialData
              : [];

        const composedScheduleEntries = scheduleRawEntries.map((entry: ScheduleListEntry) =>
          composeScheduleEntry(entry, now)
        );

        setLoadedData({
          cycleKey,
          readinessScope,
          clinicalResult,
          scheduleResult,
          composedScheduleEntries,
          loadedAt: now,
        });
        setLoadError(null);
      } catch (err) {
        if (!active) return;
        setLoadError(err instanceof Error ? err : new Error(String(err)));
      }
    };

    runCycle();

    return () => {
      active = false;
    };
  }, [authorityStatus, cycleKey]);

  // Compute read state
  const state = useMemo<ReadState<HealthReportsAggregate>>(() => {
    if (authorityStatus === "loading") {
      return { status: "loading" };
    }

    if (authorityStatus === "forbidden") {
      return {
        status: "forbidden",
        requiredCapability: "health.read",
        message: "Acesso ao módulo de relatórios de saúde não autorizado para este perfil.",
      };
    }

    if (loadError) {
      return {
        status: "error",
        code: "REPORTS_LOAD_FAILED",
        message: loadError.message || "Erro ao carregar dados dos relatórios de saúde.",
        technicalDetails: loadError.stack,
        retryable: true,
      };
    }

    if (!loadedData || loadedData.cycleKey !== cycleKey) {
      return { status: "loading" };
    }

    const now = loadedData.loadedAt;
    const aggregate = aggregateHealthReports(
      loadedData.readinessScope,
      loadedData.clinicalResult,
      loadedData.composedScheduleEntries,
      loadedData.scheduleResult.coverage,
      period,
      now
    );

    const dogsInScope = aggregate.coverageSummary.totalDogsInScope;

    if (dogsInScope === 0 && loadedData.readinessScope.scopeEmpty) {
      return {
        status: "empty",
        query: "health-reports",
      };
    }

    if (!aggregate.coverageSummary.isAllComplete) {
      const failedSources: string[] = [];
      const successfulSources: string[] = [];
      if (loadedData.readinessScope.isPartial) {
        failedSources.push("readiness");
      } else {
        successfulSources.push("readiness");
      }
      if (!loadedData.clinicalResult.coverage.complete) {
        failedSources.push("clinical");
      } else {
        successfulSources.push("clinical");
      }
      if (!loadedData.scheduleResult.coverage.complete) {
        failedSources.push("schedule");
      } else {
        successfulSources.push("schedule");
      }

      return {
        status: "partial",
        partialData: aggregate,
        failedSources,
        successfulSources,
      };
    }

    return {
      status: "success",
      data: aggregate,
      fetchedAt: now,
    };
  }, [authorityStatus, loadError, loadedData, cycleKey, period]);

  return {
    state,
    authorityStatus,
    exportAuthority,
    period,
    setPeriod,
    refresh,
  };
}
