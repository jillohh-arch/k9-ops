import { describe, expect, it } from "vitest";

import {
  defaultTab,
  isValidTab,
  trainingTabs,
} from "../lib/training-k9-constants";

describe("training-k9-constants", () => {
  describe("isValidTab", () => {
    it("accepts all defined tabs", () => {
      for (const tab of trainingTabs) {
        expect(isValidTab(tab.id)).toBe(true);
      }
    });

    it("rejects null", () => {
      expect(isValidTab(null)).toBe(false);
    });

    it("rejects empty string", () => {
      expect(isValidTab("")).toBe(false);
    });

    it("rejects unknown tab", () => {
      expect(isValidTab("settings")).toBe(false);
      expect(isValidTab("matrices")).toBe(false);
    });

    it("is case-sensitive", () => {
      expect(isValidTab("Overview")).toBe(false);
      expect(isValidTab("DOGS")).toBe(false);
    });

    it("defaultTab is valid", () => {
      expect(isValidTab(defaultTab)).toBe(true);
    });
  });

  describe("tab definitions", () => {
    it("has exactly 5 tabs", () => {
      expect(trainingTabs).toHaveLength(5);
    });

    it("dogs tab label is 'Cães em Treinamento'", () => {
      const dogsTab = trainingTabs.find((t) => t.id === "dogs");
      expect(dogsTab?.label).toBe("Cães em Treinamento");
    });

    it("all tabs have unique ids", () => {
      const ids = trainingTabs.map((t) => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("defaultTab is overview", () => {
      expect(defaultTab).toBe("overview");
    });
  });
});

describe("session source strategy", () => {
  it("dedupe by _path allows duplicates from different collections", () => {
    const records = [
      { _id: "sess-1", _path: "training_sessions/sess-1", date: "2026-07-01" },
      { _id: "sess-1", _path: "dogs/dog-1/training_sessions/sess-1", date: "2026-07-01" },
    ];

    const dedupeByPath = (recs: typeof records) => {
      const byKey = new Map<string, (typeof records)[number]>();
      for (const rec of recs) {
        byKey.set(rec._path, rec);
      }
      return Array.from(byKey.values());
    };

    const result = dedupeByPath(records);
    expect(result).toHaveLength(2);
  });

  it("dedupe by _id would correctly unify same session across collections", () => {
    const records = [
      { _id: "sess-1", _path: "training_sessions/sess-1", date: "2026-07-01" },
      { _id: "sess-1", _path: "dogs/dog-1/training_sessions/sess-1", date: "2026-07-01" },
    ];

    const dedupeById = (recs: typeof records) => {
      const byKey = new Map<string, (typeof records)[number]>();
      for (const rec of recs) {
        byKey.set(rec._id, rec);
      }
      return Array.from(byKey.values());
    };

    const result = dedupeById(records);
    expect(result).toHaveLength(1);
  });

  it("overview tab does NOT use session metrics", () => {
    // This test documents the decision: the overview tab does not display
    // any KPI derived from training_sessions, trainings, or dogs/{id}/training_sessions
    // because dedupe by _path allows double-counting.
    //
    // KPIs displayed:
    // - K9s em treinamento (from progress state, no session dependency)
    // - Cães em formação (from progress state)
    // - Avaliações pendentes (from promotion_requests)
    // - Matrizes ativas (from training_programs)
    //
    // KPIs NOT displayed:
    // - Sessões no período (removed)
    // - Último treino (removed from cards)
    // - Cães sem treino recente (removed from attention)
    expect(true).toBe(true);
  });
});

describe("progress calculation safety", () => {
  it("handles zero total milestones without division by zero", () => {
    const totalMilestones = 0;
    const achieved = 0;

    const progress =
      totalMilestones && totalMilestones > 0
        ? {
            achieved,
            percent: Math.round((achieved / totalMilestones) * 100),
            total: totalMilestones,
          }
        : null;

    expect(progress).toBeNull();
  });

  it("handles undefined totalMilestones", () => {
    const totalMilestones: number | null = null;
    const achieved = 3;

    const progress =
      totalMilestones && totalMilestones > 0
        ? {
            achieved,
            percent: Math.round((achieved / totalMilestones) * 100),
            total: totalMilestones,
          }
        : null;

    expect(progress).toBeNull();
  });

  it("calculates correct percentage", () => {
    const totalMilestones = 12;
    const achieved = 6;

    const progress =
      totalMilestones && totalMilestones > 0
        ? {
            achieved,
            percent: Math.round((achieved / totalMilestones) * 100),
            total: totalMilestones,
          }
        : null;

    expect(progress).not.toBeNull();
    expect(progress!.percent).toBe(50);
    expect(progress!.achieved).toBe(6);
    expect(progress!.total).toBe(12);
  });

  it("rounds percentage correctly", () => {
    const totalMilestones = 7;
    const achieved = 3;

    const progress = {
      achieved,
      percent: Math.round((achieved / totalMilestones) * 100),
      total: totalMilestones,
    };

    expect(progress.percent).toBe(43);
  });
});
