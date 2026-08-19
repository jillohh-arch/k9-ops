/**
 * K9 Ops Web — Health Web v1 HW-3A
 * Pure Freshness & Projection Version Policy Helpers
 *
 * Implements pure evaluation logic according to:
 * - HW-3A Corrective Review §2 (Timestamps), §3 (Schema Version)
 * - HEALTH_V1_READINESS_POLICY.md
 */

import {
  CURRENT_CANONICAL_SCHEMA_VERSION,
  DEFAULT_MAX_FRESHNESS_AGE_MS,
  SUPPORTED_CANONICAL_SCHEMA_VERSIONS,
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

export interface ProjectionTimestamps {
  readinessUpdatedAt?: unknown;
  lastEvaluatedAt?: unknown;
  updatedAt?: unknown;
}

/**
 * Evaluates the freshness of a readiness projection.
 *
 * CRITICAL RULE:
 * `readiness_updated_at` is the ONLY authoritative timestamp for readiness freshness!
 * `last_evaluated_at` is Function evaluation execution context.
 * `updated_at` is summary document overall update context.
 * NO fallback collapsing between timestamps!
 */
export function evaluateFreshness(
  timestamps: ProjectionTimestamps | unknown,
  options: FreshnessOptions = {}
): FreshnessEvaluationResult {
  const now = options.now ?? new Date();
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_FRESHNESS_AGE_MS;
  const futureToleranceMs = options.futureToleranceMs ?? 60 * 1000; // 1 minute clock skew tolerance

  let rawReadinessUpdatedAt: unknown = null;
  let rawLastEvaluatedAt: unknown = null;
  let rawUpdatedAt: unknown = null;

  if (typeof timestamps === "object" && timestamps !== null) {
    const obj = timestamps as Record<string, unknown>;
    if ("readinessUpdatedAt" in obj || "lastEvaluatedAt" in obj || "updatedAt" in obj) {
      rawReadinessUpdatedAt = obj.readinessUpdatedAt;
      rawLastEvaluatedAt = obj.lastEvaluatedAt;
      rawUpdatedAt = obj.updatedAt;
    } else {
      rawReadinessUpdatedAt = timestamps;
    }
  } else {
    rawReadinessUpdatedAt = timestamps;
  }

  const readinessUpdatedAt = parseTimestamp(rawReadinessUpdatedAt);
  const lastEvaluatedAt = parseTimestamp(rawLastEvaluatedAt);
  const updatedAt = parseTimestamp(rawUpdatedAt);

  if (!readinessUpdatedAt) {
    return {
      evaluatedAt: now,
      readinessUpdatedAt: null,
      lastEvaluatedAt,
      updatedAt,
      ageMs: null,
      maxAgeMs,
      isStale: true,
      isFutureAnomaly: false,
      hasValidTimestamp: false,
      status: "missing_timestamp",
    };
  }

  const ageMs = now.getTime() - readinessUpdatedAt.getTime();

  // Check for future timestamp anomaly (beyond clock skew tolerance)
  if (ageMs < -futureToleranceMs) {
    return {
      evaluatedAt: now,
      readinessUpdatedAt,
      lastEvaluatedAt,
      updatedAt,
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
    readinessUpdatedAt,
    lastEvaluatedAt,
    updatedAt,
    ageMs: Math.max(0, ageMs),
    maxAgeMs,
    isStale,
    isFutureAnomaly: false,
    hasValidTimestamp: true,
    status: isStale ? "stale" : "fresh",
  };
}

export interface VersionOptions {
  supportedVersions?: readonly number[];
  allowMissing?: boolean;
}

/**
 * Evaluates whether a projection schema version is supported by the Web application.
 *
 * CRITICAL RULE:
 * Canonical schema_version MUST be a numeric value matching supported version number (e.g. 1).
 * Strings (like "1", "1.0") or unsupported numbers are fail-closed rejected.
 */
export function evaluateProjectionVersion(
  rawVersion: unknown,
  options: VersionOptions = {}
): VersionEvaluationResult {
  const supported = options.supportedVersions ?? SUPPORTED_CANONICAL_SCHEMA_VERSIONS;
  const allowMissing = options.allowMissing ?? false;

  if (rawVersion === null || rawVersion === undefined || rawVersion === "") {
    if (allowMissing) {
      return {
        rawVersion: null,
        parsedVersion: null,
        isSupported: true,
        isMissing: true,
        status: "missing",
        details: "Projection schema_version is missing but allowed by policy",
      };
    }
    return {
      rawVersion: null,
      parsedVersion: null,
      isSupported: false,
      isMissing: true,
      status: "missing",
      details: "Projection schema_version is missing; fail-closed requirement",
    };
  }

  // Schema version MUST be strict numeric type
  if (typeof rawVersion !== "number" || isNaN(rawVersion)) {
    return {
      rawVersion,
      parsedVersion: null,
      isSupported: false,
      isMissing: false,
      status: "incompatible",
      details: `Incompatible schema_version format '${String(rawVersion)}'. Must be numeric (expected ${CURRENT_CANONICAL_SCHEMA_VERSION})`,
    };
  }

  const isSupported = supported.includes(rawVersion);

  if (isSupported) {
    return {
      rawVersion,
      parsedVersion: rawVersion,
      isSupported: true,
      isMissing: false,
      status: "valid",
      details: `Numeric schema_version ${rawVersion} is supported`,
    };
  }

  return {
    rawVersion,
    parsedVersion: rawVersion,
    isSupported: false,
    isMissing: false,
    status: "incompatible",
    details: `Incompatible numeric schema_version ${rawVersion}. Supported: ${supported.join(", ")}`,
  };
}
