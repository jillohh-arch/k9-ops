/**
 * K9 Ops Web — Health Web v1 HW-3A
 * Pure Freshness & Projection Version Policy Helpers
 *
 * Implements pure evaluation logic according to:
 * - HW-3A §8 (Freshness Policy), §9 (Projection Version)
 * - HEALTH_WEB_READINESS_POLICY.md §39, §44
 */

import {
  CURRENT_PROJECTION_VERSION,
  DEFAULT_MAX_FRESHNESS_AGE_MS,
  SUPPORTED_PROJECTION_VERSIONS,
  type FreshnessEvaluationResult,
  type VersionEvaluationResult,
} from "./readiness-types";

/**
 * Safely parses various timestamp representations (Date, ISO string, number, Firestore Timestamp) into a JavaScript Date object.
 * Returns null if the timestamp is missing, null, undefined, or invalid.
 */
export function parseTimestamp(
  raw: unknown
): Date | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (raw instanceof Date) {
    return isNaN(raw.getTime()) ? null : raw;
  }
  if (typeof raw === "number") {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof raw === "string") {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.toMillis === "function") {
      try {
        const millis = (obj.toMillis as () => number)();
        const d = new Date(millis);
        return isNaN(d.getTime()) ? null : d;
      } catch {
        return null;
      }
    }
    if (typeof obj.seconds === "number") {
      const d = new Date(obj.seconds * 1000);
      return isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}

export interface FreshnessOptions {
  maxAgeMs?: number;
  now?: Date;
  futureToleranceMs?: number;
}

/**
 * Evaluates the freshness of a projection timestamp.
 *
 * PURE HELPER: Classifies projection freshness without computing clinical readiness.
 */
export function evaluateFreshness(
  rawTimestamp: unknown,
  options: FreshnessOptions = {}
): FreshnessEvaluationResult {
  const now = options.now ?? new Date();
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_FRESHNESS_AGE_MS;
  const futureToleranceMs = options.futureToleranceMs ?? 60 * 1000; // 1 minute clock skew tolerance

  const computedAt = parseTimestamp(rawTimestamp);

  if (!computedAt) {
    return {
      evaluatedAt: now,
      computedAt: null,
      ageMs: null,
      maxAgeMs,
      isStale: true,
      isFutureAnomaly: false,
      hasValidTimestamp: false,
      status: "missing_timestamp",
    };
  }

  const ageMs = now.getTime() - computedAt.getTime();

  // Check for future timestamp anomaly (beyond clock skew tolerance)
  if (ageMs < -futureToleranceMs) {
    return {
      evaluatedAt: now,
      computedAt,
      ageMs,
      maxAgeMs,
      isStale: true,
      isFutureAnomaly: true,
      hasValidTimestamp: true,
      status: "future_anomaly",
    };
  }

  const isStale = ageMs > maxAgeMs;

  return {
    evaluatedAt: now,
    computedAt,
    ageMs: Math.max(0, ageMs),
    maxAgeMs,
    isStale,
    isFutureAnomaly: false,
    hasValidTimestamp: true,
    status: isStale ? "stale" : "fresh",
  };
}

export interface VersionOptions {
  supportedVersions?: readonly (string | number)[];
  allowMissing?: boolean;
}

/**
 * Evaluates whether a projection schema version is supported by the Web application.
 *
 * PURE HELPER: Fails closed on unknown/incompatible versions.
 */
export function evaluateProjectionVersion(
  rawVersion: unknown,
  options: VersionOptions = {}
): VersionEvaluationResult {
  const supported = options.supportedVersions ?? SUPPORTED_PROJECTION_VERSIONS;
  const allowMissing = options.allowMissing ?? false;

  if (rawVersion === null || rawVersion === undefined || rawVersion === "") {
    if (allowMissing) {
      return {
        rawVersion: null,
        isSupported: true,
        isMissing: true,
        status: "missing",
        details: "Projection version is missing but allowed by policy",
      };
    }
    return {
      rawVersion: null,
      isSupported: false,
      isMissing: true,
      status: "missing",
      details: "Projection version is missing; fail-closed requirement",
    };
  }

  const normalized = typeof rawVersion === "string" ? rawVersion.trim() : rawVersion;
  const isSupported = supported.some(
    (v) => String(v).trim() === String(normalized).trim()
  );

  if (isSupported) {
    return {
      rawVersion: normalized as string | number,
      isSupported: true,
      isMissing: false,
      status: "valid",
      details: `Version ${normalized} is supported`,
    };
  }

  return {
    rawVersion: normalized as string | number,
    isSupported: false,
    isMissing: false,
    status: "incompatible",
    details: `Incompatible projection version '${normalized}'. Expected one of: ${supported.join(", ")} (Current expected: ${CURRENT_PROJECTION_VERSION})`,
  };
}
