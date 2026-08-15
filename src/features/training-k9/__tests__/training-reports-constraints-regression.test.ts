/**
 * Behavioral regression tests for the temporal query constraints in
 * Training Reports.
 *
 * Contract under test (Bug 6.4.11):
 *   - The provider MUST go through `resolveReportWindow(period, now)`,
 *     which returns an explicit `ResolvedReportWindow`
 *     (`{kind:"all"} | {kind:"bounded", start} | {kind:"invalid", reason}`).
 *   - The provider MUST funnel the window through the real builders
 *     `buildSessionQueryConstraints` and `buildDecidedEvaluationQueryConstraints`
 *     used in production — tests import them, do NOT re-implement them.
 *   - `all` window → only orderBy + limit, no temporal `where`.
 *   - `bounded` window → `where(field, ">=", Date)` + orderBy + limit.
 *   - `invalid` window (bounded period that could not produce a Date)
 *     → builders return `{ok: false, error: "invalid-period"}` and the
 *     provider MUST refuse to call `getDocs`.
 *
 * No mocks of the builders themselves. The Firestore SDK factories are
 * simulated by a recording factory.
 */

import { describe, expect, it } from "vitest";

import {
  buildDecidedEvaluationQueryConstraints,
  buildSessionQueryConstraints,
  type ConstraintFactory,
} from "../lib/training-reports-query-builders";
import { resolveReportWindow } from "../lib/training-reports-utils";

// ─── Recording factory ─────────────────────────────────────────────────────────

function makeRecordingFactory(): ConstraintFactory & { calls: { method: string; args: unknown[] }[] } {
  const calls: { method: string; args: unknown[] }[] = [];
  const factory: ConstraintFactory & { calls: typeof calls } = {
    calls,
    where: (field, op, value) => {
      calls.push({ method: "where", args: [field, op, value] });
      return { __kind: "where", field, op, value };
    },
    orderBy: (field, direction) => {
      calls.push({ method: "orderBy", args: [field, direction] });
      return { __kind: "orderBy", field, direction };
    },
    limit: (count) => {
      calls.push({ method: "limit", args: [count] });
      return { __kind: "limit", count };
    },
  };
  return factory;
}

// ─── resolveReportWindow ──────────────────────────────────────────────────────

describe("resolveReportWindow", () => {
  const now = new Date("2025-06-15T12:00:00Z");

  it("returns {kind:'all'} for 'all' — no temporal filter", () => {
    expect(resolveReportWindow("all", now)).toEqual({ kind: "all" });
  });

  it("returns {kind:'bounded', start} for '7d'", () => {
    const w = resolveReportWindow("7d", now);
    expect(w.kind).toBe("bounded");
    if (w.kind !== "bounded") return;
    expect(w.start).toBeInstanceOf(Date);
    expect(w.start.getTime()).toBe(now.getTime() - 7 * 86400000);
  });

  it("returns {kind:'bounded', start} for '30d'", () => {
    const w = resolveReportWindow("30d", now);
    expect(w.kind).toBe("bounded");
    if (w.kind !== "bounded") return;
    expect(w.start.getTime()).toBe(now.getTime() - 30 * 86400000);
  });

  it("returns {kind:'bounded', start} for '60d'", () => {
    const w = resolveReportWindow("60d", now);
    expect(w.kind).toBe("bounded");
    if (w.kind !== "bounded") return;
    expect(w.start.getTime()).toBe(now.getTime() - 60 * 86400000);
  });

  it("returns {kind:'bounded', start} for '90d'", () => {
    const w = resolveReportWindow("90d", now);
    expect(w.kind).toBe("bounded");
    if (w.kind !== "bounded") return;
    expect(w.start.getTime()).toBe(now.getTime() - 90 * 86400000);
  });

  it("returns {kind:'invalid'} when the computed start Date is invalid", () => {
    // Force an invalid computed start: pass `now` that, after subtracting the
    // window, still produces a finite Date — but we can also pass an unknown
    // period to verify the contract.
    // @ts-expect-error — testing defensive fallback for an unknown period key.
    const w = resolveReportWindow("garbage", now);
    expect(w.kind).toBe("invalid");
    if (w.kind === "invalid") {
      expect(typeof w.reason).toBe("string");
      expect(w.reason.length).toBeGreaterThan(0);
    }
  });

  it("returns {kind:'invalid'} when `now` is an Invalid Date", () => {
    const bad = new Date("not-a-date");
    const w = resolveReportWindow("30d", bad);
    expect(w.kind).toBe("invalid");
  });
});

// ─── buildSessionQueryConstraints ─────────────────────────────────────────────

describe("buildSessionQueryConstraints", () => {
  const SESSION_LIMIT = 200;

  it("'all' window produces only orderBy + limit (no where)", () => {
    const factory = makeRecordingFactory();
    const result = buildSessionQueryConstraints(
      { kind: "all" },
      SESSION_LIMIT,
      factory,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.constraints).toHaveLength(2);
    const tagged = result.constraints as Array<{ __kind: string }>;
    expect(tagged[0]?.__kind).toBe("orderBy");
    expect(tagged[1]?.__kind).toBe("limit");
    expect(factory.calls.some((c) => c.method === "where")).toBe(false);
  });

  it("'bounded' window produces where(Date) + orderBy + limit", () => {
    const now = new Date("2025-06-15T12:00:00Z");
    const window = resolveReportWindow("30d", now);
    expect(window.kind).toBe("bounded");
    if (window.kind !== "bounded") return;

    const factory = makeRecordingFactory();
    const result = buildSessionQueryConstraints(window, SESSION_LIMIT, factory);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.constraints).toHaveLength(3);
    const tagged = result.constraints as Array<{
      __kind: string;
      field?: string;
      op?: string;
      value?: unknown;
      direction?: string;
      count?: number;
    }>;
    expect(tagged[0]?.__kind).toBe("where");
    expect(tagged[0]?.field).toBe("started_at");
    expect(tagged[0]?.op).toBe(">=");
    expect(tagged[0]?.value).toBeInstanceOf(Date);
    expect((tagged[0]?.value as Date).getTime()).toBe(now.getTime() - 30 * 86400000);
    expect(tagged[1]?.__kind).toBe("orderBy");
    expect(tagged[1]?.direction).toBe("desc");
    expect(tagged[2]?.__kind).toBe("limit");
    expect(tagged[2]?.count).toBe(SESSION_LIMIT);
  });

  it("'invalid' window returns {ok:false, error:'invalid-period'} and never invokes the factory", () => {
    const factory = makeRecordingFactory();
    const result = buildSessionQueryConstraints(
      { kind: "invalid", reason: "data inicial invalida" },
      SESSION_LIMIT,
      factory,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("invalid-period");
    expect(result.reason).toBe("data inicial invalida");
    expect(factory.calls).toHaveLength(0);
  });

  it("the where value is a plain JS Date — NEVER a Timestamp-like object", () => {
    const factory = makeRecordingFactory();
    const now = new Date("2025-06-15T12:00:00Z");
    const w = resolveReportWindow("7d", now);
    if (w.kind !== "bounded") throw new Error("setup error");
    const result = buildSessionQueryConstraints(w, SESSION_LIMIT, factory);
    if (!result.ok) throw new Error("setup error");
    const tagged = result.constraints as Array<{ __kind: string; value?: unknown }>;
    const where = tagged.find((c) => c.__kind === "where");
    expect(where?.value).toBeInstanceOf(Date);
    expect((where?.value as { toMillis?: unknown }).toMillis).toBeUndefined();
  });
});

// ─── buildDecidedEvaluationQueryConstraints ───────────────────────────────────

describe("buildDecidedEvaluationQueryConstraints", () => {
  const DECIDED_LIMIT = 1000;

  it("'all' window produces only orderBy + limit", () => {
    const factory = makeRecordingFactory();
    const result = buildDecidedEvaluationQueryConstraints(
      { kind: "all" },
      DECIDED_LIMIT,
      factory,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.constraints).toHaveLength(2);
    const tagged = result.constraints as Array<{ __kind: string; field?: string; direction?: string }>;
    expect(tagged[0]?.__kind).toBe("orderBy");
    expect(tagged[0]?.field).toBe("decided_at");
    expect(tagged[0]?.direction).toBe("desc");
    expect(factory.calls.some((c) => c.method === "where")).toBe(false);
  });

  it("'bounded' window produces where decided_at >= Date + orderBy + limit", () => {
    const now = new Date("2025-06-15T12:00:00Z");
    const window = resolveReportWindow("30d", now);
    if (window.kind !== "bounded") throw new Error("setup error");
    const factory = makeRecordingFactory();
    const result = buildDecidedEvaluationQueryConstraints(
      window,
      DECIDED_LIMIT,
      factory,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.constraints).toHaveLength(3);
    const tagged = result.constraints as Array<{
      __kind: string;
      field?: string;
      op?: string;
      value?: unknown;
      count?: number;
      direction?: string;
    }>;
    expect(tagged[0]?.__kind).toBe("where");
    expect(tagged[0]?.field).toBe("decided_at");
    expect(tagged[0]?.op).toBe(">=");
    expect(tagged[0]?.value).toBeInstanceOf(Date);
    expect(tagged[1]?.__kind).toBe("orderBy");
    expect(tagged[1]?.direction).toBe("desc");
    expect(tagged[2]?.__kind).toBe("limit");
    expect(tagged[2]?.count).toBe(DECIDED_LIMIT);
  });

  it("'invalid' window never invokes the factory and returns the error", () => {
    const factory = makeRecordingFactory();
    const result = buildDecidedEvaluationQueryConstraints(
      { kind: "invalid", reason: "periodo desconhecido" },
      DECIDED_LIMIT,
      factory,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("invalid-period");
    expect(factory.calls).toHaveLength(0);
  });
});

// ─── Source integrity — narrow contract ───────────────────────────────────────
//
// The behavioural tests above are the *primary* guarantee that no Timestamp
// instances leak into the constraint set. We keep ONE narrow source check
// that scopes the regex to the constraint builder, so legitimate uses of the
// word "Timestamp" in unrelated modules are not blocked.

describe("training reports — constraint builder never mentions Timestamp", () => {
  it("training-reports-query-builders.ts has no Firestore Timestamp usage in code", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const target = path.join(
      process.cwd(),
      "src/features/training-k9/lib/training-reports-query-builders.ts",
    );
    const raw = await fs.readFile(target, "utf8");
    // Strip single-line and block comments so documentation that mentions
    // "Timestamp" doesn't trip the test.
    const code = raw
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(code).not.toMatch(/from\s+["']firebase\/firestore["']/);
    expect(code).not.toMatch(/from\s+["']@firebase\/firestore["']/);
    expect(code).not.toMatch(/\bTimestamp\b/);
    expect(code).not.toMatch(/Timestamp\.from/);
  });

  it("the provider hook does NOT import @firebase/firestore directly", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const hookPath = path.join(
      process.cwd(),
      "src/features/training-k9/hooks/use-training-reports-data.tsx",
    );
    const content = await fs.readFile(hookPath, "utf8");
    expect(content).not.toMatch(/from\s+["']@firebase\/firestore["']/);
  });
});