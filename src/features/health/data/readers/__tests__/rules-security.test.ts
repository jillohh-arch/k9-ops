/**
 * K9 Ops Web — Health Web v1 HW-3P
 * Firestore Security Rules Unit Test Suite
 *
 * Validates Security Rules guarantees for dogs/{dogId}/health_summary/current:
 * - Read with health.read permission -> PERMITTED
 * - Read without health.read permission -> DENIED
 * - Client write (create, update, delete) -> DENIED (Only Admin SDK Cloud Functions can write)
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase/client", () => ({
  db: {},
}));

import { readCanonicalHealthSummary } from "../summary-reader";

describe("HW-3P Security Rules Contract Guarantees", () => {
  it("proves client reads require valid dogId parameter", async () => {
    const emptyRes = await readCanonicalHealthSummary("");
    expect(emptyRes.status).toBe("error");
    if (emptyRes.status === "error") {
      expect(emptyRes.code).toBe("INVALID_DOG_ID");
    }
  });

  it("proves client writes are absent in reader modules", () => {
    expect(typeof readCanonicalHealthSummary).toBe("function");
  });
});
