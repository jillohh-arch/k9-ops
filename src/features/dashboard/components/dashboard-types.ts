import type { LucideIcon } from "lucide-react";

/* ─── Core collection types ─── */

export type DashboardCollectionKey =
  | "activeShifts"
  | "dogs"
  | "users"
  | "vehicleCrews"
  | "vehicles";

export type DashboardRecord = Record<string, unknown> & { _id: string };

export type DashboardCollectionState = {
  error: string | null;
  loading: boolean;
  records: DashboardRecord[];
};

export type DashboardCollections = Record<
  DashboardCollectionKey,
  DashboardCollectionState
>;

/* ─── Dog health ─── */

export type DogHealthStatus = {
  dogId: string;
  dogName: string;
  exam: "current" | "due" | "missing";
  issues: Array<{
    detail: string;
    label: string;
    severity: "critical" | "warning" | "missing";
  }>;
  ready: boolean;
  vaccine: "current" | "due_soon" | "overdue" | "missing";
  weight: "in_range" | "out_of_range" | "missing" | "missing_range";
};

/* ─── User profile ─── */

export type UserProfile = "operador" | "instrutor" | "gestor" | "admin";

/* ─── Drugs ─── */

export type DrugCategory =
  | "maconha"
  | "cocaina"
  | "crack"
  | "ecstasy"
  | "outros";

export type DrugStats = Record<DrugCategory, number>;

export interface DrugTile {
  label: string;
  category: DrugCategory;
  className: string;
  glyph: string;
}

/* ─── Summary cards ─── */

export interface SummaryCardMeta {
  collection: string;
  label: string;
  image: string;
  imageClassName: string;
  tone: string;
}

export interface SummaryCardData extends SummaryCardMeta {
  detail: string;
  value: string;
}

/* ─── Occurrence metrics ─── */

export interface OccurrenceMetrics {
  awaitingSignatures: number;
  finalized: number;
  natures: Array<{ label: string; value: number; percent: number }>;
  open: number;
  total: number;
}

/* ─── Pending metrics ─── */

export interface PendingMetrics {
  awaitingSignatureOccurrences: number;
  finalizedWithPending: number;
  finalizingOccurrences: number;
  pendingPromotions: number;
  personalActions: number;
}

/* ─── Health metrics ─── */

export interface HealthMetrics {
  attention: DogHealthStatus[];
  critical: number;
  incomplete: number;
  outOfRangeWeight: number;
  periodEvents: number;
  ready: number;
  total: number;
  vaccinesDueSoon: number;
  vaccinesOverdue: number;
}

/* ─── Integrity metrics ─── */

export interface IntegrityMetrics {
  awaitingSignatures: number;
  correctionsInProgress: number;
  coverage: number;
  finalized: number;
  sealed: number;
  versions: Array<{ version: number; count: number }>;
}

/* ─── Shift today ─── */

export interface ShiftTodayGroup {
  group: {
    id: string;
    name: string;
    color?: string;
    expectedStartHour?: string;
    expectedEndHour?: string;
  };
  members: string[];
  startHour?: string;
  endHour?: string;
}

/* ─── Metric item (used in health/occurrences) ─── */

export interface MetricItem {
  label: string;
  value: number;
  detail: string;
  icon: LucideIcon;
  tone: string;
}
