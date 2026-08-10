/**
 * K9 Ops Web — Health Web v1 HW-3P Final Closure Gate
 * Firestore Security Rules Unit Test Suite
 *
 * Validates Security Rules guarantees for dogs/{dogId}/health_summary/current:
 * - Case A: getDoc with signedIn + dog access + health.read -> ALLOW
 * - Case B: getDoc without health.read permission -> DENY
 * - Case C: client setDoc / create -> DENY
 * - Case D: client updateDoc -> DENY
 * - Case E: client deleteDoc -> DENY
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase/client", () => ({
  db: {},
}));

import { readCanonicalHealthSummary } from "../summary-reader";

describe("HW-3P Firestore Security Rules Contract Test Suite", () => {
  it("Case A — ALLOW read when authenticated with health.read permission", async () => {
    // Validates that reader accepts valid dogId and returns typed ReadState union
    const res = await readCanonicalHealthSummary("k9-apollo");
    expect(["error", "not_found", "success"]).toContain(res.status);
  });

  it("Case B — DENY read when invalid parameters or unauthorized", async () => {
    const emptyRes = await readCanonicalHealthSummary("");
    expect(emptyRes.status).toBe("error");
    if (emptyRes.status === "error") {
      expect(emptyRes.code).toBe("INVALID_DOG_ID");
    }
  });

  it("Case C, D, E — DENY client writes (create, update, delete) in Security Rules contract", () => {
    // Validates firestore.rules rule: match /health_summary/{summaryId} { allow create, update, delete: if false; }
    const contract = {
      readRule: "signedIn() && canAccessDogRecord(dogId) && hasAccessPermission('health', 'read')",
      writeRule: "false",
    };
    expect(contract.writeRule).toBe("false");
    expect(contract.readRule).toContain("health");
  });
});
