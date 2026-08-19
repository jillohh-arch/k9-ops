/**
 * Health Read States Tests
 *
 * Tests for the read state contracts defined in:
 * - HEALTH_WEB_TARGET_ARCHITECTURE.md §25 (Technical States)
 * - HEALTH_WEB_INFORMATION_ARCHITECTURE.md §36 (Technical States Taxonomy)
 */
import { describe, expect, it } from "vitest";
import {
  READINESS_STATUS_LABELS,
  READINESS_STATUS_PRIORITY,
  RESTRICTION_TYPE_LABELS,
  SCHEDULE_STATUS_LABELS,
  CLINICAL_CASE_STATUS_LABELS,
  NUTRITION_PLAN_STATUS_LABELS,
  isTerminalState,
  isLoadingState,
  isErrorState,
  isAuthErrorState,
  canRetry,
  type ReadState,
  type ReadinessStatus,
  type RestrictionType,
  type ScheduleStatus,
  type ClinicalCaseStatus,
  type NutritionPlanStatus,
} from "@/features/health/domain/read-states";

describe("Read States", () => {
  describe("isTerminalState", () => {
    it("returns true for terminal states", () => {
      const terminalStates: ReadState[] = [
        { status: "success", data: {}, fetchedAt: new Date() },
        { status: "empty", query: "test" },
        { status: "partial", partialData: {}, failedSources: [], successfulSources: [] },
        { status: "degraded", data: {}, reason: "test", reducedCapability: "test" },
        { status: "stale", data: {}, computedAt: new Date(), ageMs: 1000, maxAgeMs: 500 },
        { status: "legacy", data: {}, source: "test", explanation: "test" },
        { status: "conflict", data1: {}, data2: {}, conflictDescription: "test" },
        { status: "unauthorized", redirectToLogin: true },
        { status: "forbidden", requiredCapability: "test", message: "test" },
        { status: "not_found", entityType: "test", entityId: "test" },
        { status: "error", code: "test", message: "test", retryable: false },
      ];

      terminalStates.forEach((state) => {
        expect(isTerminalState(state)).toBe(true);
      });
    });

    it("returns false for loading states", () => {
      const loadingStates: ReadState[] = [
        { status: "idle" },
        { status: "loading" },
        { status: "refreshing", previousData: {} },
      ];

      loadingStates.forEach((state) => {
        expect(isTerminalState(state)).toBe(false);
      });
    });
  });

  describe("isLoadingState", () => {
    it("returns true for idle, loading, refreshing", () => {
      expect(isLoadingState({ status: "idle" })).toBe(true);
      expect(isLoadingState({ status: "loading" })).toBe(true);
      expect(isLoadingState({ status: "refreshing", previousData: {} })).toBe(true);
    });

    it("returns false for other states", () => {
      expect(isLoadingState({ status: "success", data: {}, fetchedAt: new Date() })).toBe(false);
      expect(isLoadingState({ status: "error", code: "test", message: "test", retryable: true })).toBe(false);
    });
  });

  describe("isErrorState", () => {
    it("returns true for error states", () => {
      expect(isErrorState({ status: "error", code: "test", message: "test", retryable: true })).toBe(true);
      expect(isErrorState({ status: "unauthorized", redirectToLogin: true })).toBe(true);
      expect(isErrorState({ status: "forbidden", requiredCapability: "test", message: "test" })).toBe(true);
      expect(isErrorState({ status: "not_found", entityType: "test", entityId: "test" })).toBe(true);
    });

    it("returns false for non-error states", () => {
      expect(isErrorState({ status: "success", data: {}, fetchedAt: new Date() })).toBe(false);
      expect(isErrorState({ status: "empty", query: "test" })).toBe(false);
    });
  });

  describe("isAuthErrorState", () => {
    it("returns true for auth error states", () => {
      expect(isAuthErrorState({ status: "unauthorized", redirectToLogin: true })).toBe(true);
      expect(isAuthErrorState({ status: "forbidden", requiredCapability: "test", message: "test" })).toBe(true);
    });

    it("returns false for other states", () => {
      expect(isAuthErrorState({ status: "error", code: "test", message: "test", retryable: true })).toBe(false);
      expect(isAuthErrorState({ status: "not_found", entityType: "test", entityId: "test" })).toBe(false);
    });
  });

  describe("canRetry", () => {
    it("returns true for error state with retryable=true", () => {
      expect(canRetry({ status: "error", code: "test", message: "test", retryable: true })).toBe(true);
    });

    it("returns false for error state with retryable=false", () => {
      expect(canRetry({ status: "error", code: "test", message: "test", retryable: false })).toBe(false);
    });

    it("returns true for loading state", () => {
      expect(canRetry({ status: "loading" })).toBe(true);
    });

    it("returns true for most other states", () => {
      expect(canRetry({ status: "success", data: {}, fetchedAt: new Date() })).toBe(true);
      expect(canRetry({ status: "empty", query: "test" })).toBe(true);
    });
  });
});

describe("Readiness Status Labels", () => {
  const validStatuses: ReadinessStatus[] = [
    "operational",
    "operational_attention",
    "fit_with_restrictions",
    "temporarily_unfit",
    "not_evaluated",
  ];

  it("has labels for all readiness statuses", () => {
    validStatuses.forEach((status) => {
      expect(READINESS_STATUS_LABELS[status]).toBeDefined();
      expect(typeof READINESS_STATUS_LABELS[status]).toBe("string");
      expect(READINESS_STATUS_LABELS[status].length).toBeGreaterThan(0);
    });
  });

  it("has priority ordering for all readiness statuses", () => {
    validStatuses.forEach((status) => {
      expect(READINESS_STATUS_PRIORITY[status]).toBeDefined();
      expect(typeof READINESS_STATUS_PRIORITY[status]).toBe("number");
    });
  });

  it("has correct priority ordering", () => {
    // temporarily_unfit (0) should have highest priority
    expect(READINESS_STATUS_PRIORITY.temporarily_unfit).toBe(0);
    // operational (4) should have lowest priority
    expect(READINESS_STATUS_PRIORITY.operational).toBe(4);
  });
});

describe("Restriction Type Labels", () => {
  const validTypes: RestrictionType[] = ["absolute", "partial", "attention"];

  it("has labels for all restriction types", () => {
    validTypes.forEach((type) => {
      expect(RESTRICTION_TYPE_LABELS[type]).toBeDefined();
      expect(typeof RESTRICTION_TYPE_LABELS[type]).toBe("string");
    });
  });
});

describe("Schedule Status Labels", () => {
  const validStatuses: ScheduleStatus[] = [
    "scheduled",
    "upcoming",
    "today",
    "pending",
    "overdue",
    "completed",
    "cancelled",
  ];

  it("has labels for all schedule statuses", () => {
    validStatuses.forEach((status) => {
      expect(SCHEDULE_STATUS_LABELS[status]).toBeDefined();
      expect(typeof SCHEDULE_STATUS_LABELS[status]).toBe("string");
    });
  });
});

describe("Clinical Case Status Labels", () => {
  const validStatuses: ClinicalCaseStatus[] = [
    "open",
    "under_investigation",
    "under_treatment",
    "monitoring",
    "discharged",
    "cancelled",
  ];

  it("has labels for all clinical case statuses", () => {
    validStatuses.forEach((status) => {
      expect(CLINICAL_CASE_STATUS_LABELS[status]).toBeDefined();
      expect(typeof CLINICAL_CASE_STATUS_LABELS[status]).toBe("string");
    });
  });
});

describe("Nutrition Plan Status Labels", () => {
  const validStatuses: NutritionPlanStatus[] = [
    "active",
    "superseded",
    "cancelled",
    "legacy",
    "conflict",
  ];

  it("has labels for all nutrition plan statuses", () => {
    validStatuses.forEach((status) => {
      expect(NUTRITION_PLAN_STATUS_LABELS[status]).toBeDefined();
      expect(typeof NUTRITION_PLAN_STATUS_LABELS[status]).toBe("string");
    });
  });
});
