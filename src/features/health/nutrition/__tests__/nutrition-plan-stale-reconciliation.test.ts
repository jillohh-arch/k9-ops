import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase/client", () => ({ functions: {} }));
vi.mock("../hooks/use-nutrition-plan-mutations", () => ({
  useNutritionPlanMutations: vi.fn(),
}));

import { shouldShowNutritionUpdateStale } from "../components/nutrition-plan-edit-dialog";
import { shouldShowNutritionReplaceStale } from "../components/nutrition-plan-replace-dialog";

const update = (mutationStatus: string, planRevision = 4) =>
  shouldShowNutritionUpdateStale({
    mutationStatus,
    planId: "plan-1",
    planRevision,
    initialPlanId: "plan-1",
    initialRevision: 3,
  });

const replace = (phase: "editing" | "reviewing" | "executing", mutationStatus: string) =>
  shouldShowNutritionReplaceStale({
    phase,
    mutationStatus,
    planId: "plan-1",
    planRevision: 4,
    planStatus: "active",
    snapshotPlanId: "plan-1",
    snapshotRevision: 3,
  });

describe("UPDATE and REPLACE stale reconciliation windows", () => {
  it("does not show false stale for an old-revision snapshot while UPDATE executes", () => {
    expect(update("executing")).toBe(false);
  });

  it("does not show false stale in the UPDATE success reconciliation window", () => {
    expect(update("success")).toBe(false);
  });

  it("still detects a real external UPDATE revision", () => {
    expect(update("idle")).toBe(true);
  });

  it("ends UPDATE protection after failure and reflects the real revision", () => {
    expect(update("error")).toBe(true);
  });

  it("does not show false stale for an old-revision snapshot while REPLACE executes", () => {
    expect(replace("executing", "executing")).toBe(false);
  });

  it("does not show false stale in the REPLACE success reconciliation window", () => {
    expect(replace("reviewing", "success")).toBe(false);
  });

  it("still detects a real external REPLACE revision", () => {
    expect(replace("reviewing", "idle")).toBe(true);
  });

  it("ends REPLACE protection after failure and reflects the real revision", () => {
    expect(replace("reviewing", "error")).toBe(true);
  });
});
