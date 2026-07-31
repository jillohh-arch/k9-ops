/**
 * Health Web v1 — Readers Foundation
 *
 * Read-only contracts for Health domain.
 * These are SEPARATE from technical read states.
 *
 * Based on:
 * - HEALTH_WEB_TARGET_ARCHITECTURE.md §25 (Technical States)
 * - HEALTH_WEB_INFORMATION_ARCHITECTURE.md §36 (Technical States Taxonomy)
 *
 * IMPORTANT: These are FOUNDATION contracts only.
 * HW-3+ will implement the actual projections.
 *
 * Each reader contract provides:
 * - typed result (T)
 * - aggregate source
 * - freshness metadata
 * - warnings array
 * - structured errors
 * - cancellation/cleanup hooks
 * - NO mutation (read-only)
 * - NO silent fallback
 */

import type { ReadState, ReadStateError } from "./read-states";

// ============================================================================
// Health Summary Reader
// ============================================================================

/**
 * Health Summary aggregate.
 * Represents the canonical health status for a dog.
 */
export interface HealthSummaryResult {
  dogId: string;
  readinessStatus: string;
  activeRestrictions: number;
  activeTreatments: number;
  pendingExams: number;
  lastUpdated: Date;
}

/**
 * Health Summary reader result type.
 * Uses discriminated union for strict state handling.
 */
export type HealthSummaryReadResult =
  | ReadState<HealthSummaryResult>
  | ReadStateError; // Explicit error typing

/**
 * Health Summary reader contract.
 * NO mutation, NO silent fallback.
 */
export interface HealthSummaryReader {
  /**
   * Read health summary for a dog.
   * Returns discriminated ReadState.
   */
  read(dogId: string): Promise<HealthSummaryReadResult>;

  /**
   * Cleanup function to cancel pending reads.
   */
  cancel(): void;
}

// ============================================================================
// Operational Restrictions Reader
// ============================================================================

/**
 * Operational restriction record.
 */
export interface OperationalRestriction {
  id: string;
  dogId: string;
  type: "absolute" | "partial" | "attention";
  reason: string;
  issuedAt: Date;
  expiresAt?: Date;
  issuedBy: string;
}

/**
 * Operational Restrictions reader result type.
 */
export type OperationalRestrictionsReadResult =
  | ReadState<OperationalRestriction[]>
  | ReadStateError;

/**
 * Operational Restrictions reader contract.
 */
export interface OperationalRestrictionsReader {
  /**
   * Read all active restrictions for a dog.
   */
  read(dogId: string): Promise<OperationalRestrictionsReadResult>;

  /**
   * Read restrictions by type.
   */
  readByType(dogId: string, type: OperationalRestriction["type"]): Promise<OperationalRestrictionsReadResult>;

  /**
   * Cleanup function.
   */
  cancel(): void;
}

// ============================================================================
// Health Schedule Reader
// ============================================================================

/**
 * Schedule item record.
 */
export interface ScheduleItem {
  id: string;
  dogId: string;
  type: "vaccination" | "medication" | "exam" | "checkup" | "other";
  title: string;
  scheduledAt: Date;
  status: "scheduled" | "pending" | "completed" | "cancelled" | "overdue";
  createdAt: Date;
  createdBy: string;
}

/**
 * Health Schedule reader result type.
 */
export type HealthScheduleReadResult =
  | ReadState<ScheduleItem[]>
  | ReadStateError;

/**
 * Health Schedule reader contract.
 */
export interface HealthScheduleReader {
  /**
   * Read all schedule items for a dog.
   */
  read(dogId: string): Promise<HealthScheduleReadResult>;

  /**
   * Read upcoming schedule items only.
   */
  readUpcoming(dogId: string, limit?: number): Promise<HealthScheduleReadResult>;

  /**
   * Read overdue items.
   */
  readOverdue(dogId: string): Promise<HealthScheduleReadResult>;

  /**
   * Cleanup function.
   */
  cancel(): void;
}

// ============================================================================
// Health Timeline Reader
// ============================================================================

/**
 * Timeline event record.
 */
export interface TimelineEvent {
  id: string;
  dogId: string;
  type: "routine" | "incident" | "treatment" | "exam" | "restriction" | "note";
  title: string;
  description?: string;
  occurredAt: Date;
  recordedAt: Date;
  recordedBy: string;
  source: "canonical" | "legacy";
}

/**
 * Health Timeline reader result type.
 */
export type HealthTimelineReadResult =
  | ReadState<TimelineEvent[]>
  | ReadStateError;

/**
 * Health Timeline reader contract.
 */
export interface HealthTimelineReader {
  /**
   * Read timeline events for a dog.
   */
  read(dogId: string): Promise<HealthTimelineReadResult>;

  /**
   * Read timeline with date range filter.
   */
  readRange(dogId: string, from: Date, to: Date): Promise<HealthTimelineReadResult>;

  /**
   * Read timeline by event type.
   */
  readByType(dogId: string, type: TimelineEvent["type"]): Promise<HealthTimelineReadResult>;

  /**
   * Cleanup function.
   */
  cancel(): void;
}

// ============================================================================
// Legacy Health Records Reader
// ============================================================================

/**
 * Legacy health record (pre-canonical).
 */
export interface LegacyHealthRecord {
  id: string;
  dogId: string;
  legacyId: string;
  source: string;
  data: unknown;
  recordedAt: Date;
  migratedAt?: Date;
  migrationStatus?: "pending" | "migrated" | "failed";
}

/**
 * Legacy Health Records reader result type.
 */
export type LegacyHealthRecordsReadResult =
  | ReadState<LegacyHealthRecord[]>
  | ReadStateError;

/**
 * Legacy Health Records reader contract.
 *
 * NOTE: This reader is for coexistence period only.
 * HW-3+ will handle migration.
 */
export interface LegacyHealthRecordsReader {
  /**
   * Read legacy records for a dog.
   * Returns ReadState with legacy metadata.
   */
  read(dogId: string): Promise<LegacyHealthRecordsReadResult>;

  /**
   * Read legacy records by source.
   */
  readBySource(dogId: string, source: string): Promise<LegacyHealthRecordsReadResult>;

  /**
   * Check if dog has any legacy records.
   */
  hasLegacyRecords(dogId: string): Promise<boolean>;

  /**
   * Cleanup function.
   */
  cancel(): void;
}

// ============================================================================
// Freshness Metadata
// ============================================================================

/**
 * Data freshness metadata.
 * Indicates staleness and source.
 */
export interface FreshnessMetadata {
  /** When the data was fetched */
  fetchedAt: Date;
  /** When the projection was computed (if applicable) */
  computedAt?: Date;
  /** Age in milliseconds */
  ageMs: number;
  /** Maximum acceptable age in milliseconds */
  maxAgeMs: number;
  /** Whether data is stale */
  isStale: boolean;
  /** Data source classification */
  sourceType: "canonical" | "legacy" | "unknown";
}

// ============================================================================
// Reader Warnings
// ============================================================================

/**
 * Warning types for reader results.
 */
export type ReaderWarning =
  | { type: "partial_data"; sources: string[] }
  | { type: "degraded_mode"; reason: string }
  | { type: "stale_data"; ageMs: number }
  | { type: "legacy_source"; source: string }
  | { type: "schema_mismatch"; details: string };

/**
 * Helper to create a reader warning.
 */
export function createReaderWarning(warning: ReaderWarning): ReaderWarning {
  return warning;
}
