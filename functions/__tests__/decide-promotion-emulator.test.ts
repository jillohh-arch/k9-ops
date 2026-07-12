/**
 * Real Firestore Emulator integration tests for decidePromotionRequest.
 *
 * These tests connect to a real Firestore Emulator, seed documents,
 * execute the core transaction, and verify persisted state.
 *
 * Run with: FIRESTORE_EMULATOR_HOST=localhost:8080 npx vitest run __tests__/decide-promotion-emulator.test.ts
 * Or via:   npx firebase emulators:exec --only firestore "cd functions && npx vitest run __tests__/decide-promotion-emulator.test.ts"
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { initializeApp, deleteApp, type App } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";
import { decidePromotionCore, type AuthContext, type DecidePayload } from "../src/decide-promotion-core";

// ─── Skip if emulator not running ───────────────────────────────────────────

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;
const describeEmulator = EMULATOR_HOST ? describe : describe.skip;

// ─── Setup ──────────────────────────────────────────────────────────────────

let app: App;
let db: Firestore;

const AUTH: AuthContext = {
  uid: "uid-instructor-1",
  ra: "12345",
  email: "12345@gcm.com.br",
  deciderName: "Instrutor Silva",
};

function makePayload(overrides: Partial<DecidePayload> = {}): DecidePayload {
  return {
    requestId: "req-1",
    decision: "approved",
    ...overrides,
  };
}

async function seedProgram(programId = "prog-bc", version = 1) {
  await db.doc(`training_programs/${programId}`).set({
    active: true,
    modality: "busca_captura",
    name: "Busca e Captura",
    version,
    created_at: Timestamp.now(),
    updated_at: Timestamp.now(),
  });
  const modules = [
    { id: "mod-1", order: 1, title: "Fundamentos" },
    { id: "mod-2", order: 2, title: "Controle" },
    { id: "mod-3", order: 3, title: "Busca Avançada" },
  ];
  for (const m of modules) {
    await db.doc(`training_programs/${programId}/modules/${m.id}`).set({
      order: m.order,
      title: m.title,
      active: true,
    });
  }
}

async function seedProgress(dogId = "dog-bono", modality = "busca_captura", overrides: Record<string, unknown> = {}) {
  await db.doc(`dogs/${dogId}/training/${modality}`).set({
    modality,
    current_module: "mod-1",
    completed_module_ids: [],
    completed_modules: [],
    program_version: 1,
    status: "in_formation",
    achieved_milestones: {},
    updated_at: Timestamp.now(),
    ...overrides,
  });
}

async function seedRequest(requestId = "req-1", overrides: Record<string, unknown> = {}) {
  await db.doc(`promotion_requests/${requestId}`).set({
    dog_id: "dog-bono",
    dog_name: "Bono",
    modality: "busca_captura",
    module_id: "mod-1",
    module_name: "Fundamentos",
    module_order: 1,
    program_id: "prog-bc",
    program_version: 1,
    status: "pending",
    direct_instructor: false,
    requester_ra: "67890",
    requester_name: "Operador Santos",
    requested_by_uid: "uid-operator-1",
    requested_by_email: "67890@gcm.com.br",
    requested_at: Timestamp.now(),
    created_at: Timestamp.now(),
    updated_at: Timestamp.now(),
    marks_snapshot: [
      { milestone_id: "ms-1", label: "Obediência", required: true, achieved: true },
    ],
    audit_trail: [],
    ...overrides,
  });
}

async function clearAll() {
  // Delete all docs in collections used by tests
  const collections = ["promotion_requests", "training_programs", "dogs"];
  for (const col of collections) {
    const snap = await db.collection(col).listDocuments();
    for (const docRef of snap) {
      await db.recursiveDelete(docRef);
    }
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describeEmulator("decidePromotionRequest — Emulator", () => {
  beforeAll(() => {
    app = initializeApp({ projectId: "k9-ops-test" }, "emulator-test");
    db = getFirestore(app);
  });

  afterAll(async () => {
    await deleteApp(app);
  });

  beforeEach(async () => {
    await clearAll();
    await seedProgram();
    await seedProgress();
    await seedRequest();
  });

  // ─── 1. Intermediate module approval ─────────────────────────────────

  it("1. approves intermediate module — advances current_module", async () => {
    const result = await decidePromotionCore(db, FieldValue, AUTH, makePayload());

    expect(result).toEqual({ id: "req-1", status: "approved" });

    const progress = (await db.doc("dogs/dog-bono/training/busca_captura").get()).data()!;
    expect(progress.current_module).toBe("mod-2");
    expect(progress.completed_module_ids).toEqual(["mod-1"]);
    expect(progress.status).toBe("in_formation");
    expect(progress.operational_since).toBeUndefined();
  });

  // ─── 2. Last module approval ────────────────────────────────────────

  it("2. approves last module — sets operational", async () => {
    await seedProgress("dog-bono", "busca_captura", {
      current_module: "mod-3",
      completed_module_ids: ["mod-1", "mod-2"],
    });
    await seedRequest("req-1", { module_id: "mod-3", module_name: "Busca Avançada", module_order: 3 });

    const result = await decidePromotionCore(db, FieldValue, AUTH, makePayload());

    expect(result).toEqual({ id: "req-1", status: "approved" });

    const progress = (await db.doc("dogs/dog-bono/training/busca_captura").get()).data()!;
    expect(progress.current_module).toBeNull();
    expect(progress.completed_module_ids).toEqual(["mod-1", "mod-2", "mod-3"]);
    expect(progress.status).toBe("operational");
    // Firestore converts Date to Timestamp on write; reads back as Timestamp
    expect(progress.operational_since).toBeDefined();
    expect(progress.operational_since.toDate()).toBeInstanceOf(Date);
  });

  // ─── 3. Rejection ───────────────────────────────────────────────────

  it("3. rejection — does not modify progress", async () => {
    const result = await decidePromotionCore(db, FieldValue, AUTH, makePayload({
      decision: "rejected",
      reason: "Desempenho insuficiente",
    }));

    expect(result).toEqual({ id: "req-1", status: "rejected" });

    // Progress unchanged
    const progress = (await db.doc("dogs/dog-bono/training/busca_captura").get()).data()!;
    expect(progress.current_module).toBe("mod-1");
    expect(progress.completed_module_ids).toEqual([]);

    // Request updated
    const request = (await db.doc("promotion_requests/req-1").get()).data()!;
    expect(request.status).toBe("rejected");
    expect(request.decision_reason).toBe("Desempenho insuficiente");
  });

  // ─── 4. Request not found ──────────────────────────────────────────

  it("4. request not found — throws", async () => {
    await expect(
      decidePromotionCore(db, FieldValue, AUTH, makePayload({ requestId: "nonexistent" })),
    ).rejects.toMatchObject({ code: "not-found" });
  });

  // ─── 5. Progress not found ─────────────────────────────────────────

  it("5. progress not found — throws", async () => {
    await db.doc("dogs/dog-bono/training/busca_captura").delete();

    await expect(
      decidePromotionCore(db, FieldValue, AUTH, makePayload()),
    ).rejects.toMatchObject({ code: "failed-precondition" });

    // Request should NOT be updated (transaction rolled back)
    const request = (await db.doc("promotion_requests/req-1").get()).data()!;
    expect(request.status).toBe("pending");
  });

  // ─── 6. Program not found ──────────────────────────────────────────

  it("6. program not found — throws", async () => {
    await db.recursiveDelete(db.doc("training_programs/prog-bc"));

    await expect(
      decidePromotionCore(db, FieldValue, AUTH, makePayload()),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  // ─── 7. Module not in program ──────────────────────────────────────

  it("7. module not in program — throws", async () => {
    await seedRequest("req-1", { module_id: "mod-nonexistent" });
    await seedProgress("dog-bono", "busca_captura", { current_module: "mod-nonexistent" });

    await expect(
      decidePromotionCore(db, FieldValue, AUTH, makePayload()),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  // ─── 8. Version divergence ─────────────────────────────────────────

  it("8. program version divergence — throws", async () => {
    // Update program version to 2 while request is version 1
    await db.doc("training_programs/prog-bc").update({ version: 2 });

    await expect(
      decidePromotionCore(db, FieldValue, AUTH, makePayload()),
    ).rejects.toMatchObject({ code: "failed-precondition" });

    // Request unchanged
    const request = (await db.doc("promotion_requests/req-1").get()).data()!;
    expect(request.status).toBe("pending");
  });

  // ─── 9. Current module divergence ──────────────────────────────────

  it("9. current_module divergence — throws", async () => {
    await seedProgress("dog-bono", "busca_captura", { current_module: "mod-2" });

    await expect(
      decidePromotionCore(db, FieldValue, AUTH, makePayload()),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  // ─── 10. Already decided ───────────────────────────────────────────

  it("10. already decided — throws", async () => {
    await seedRequest("req-1", { status: "approved" });

    await expect(
      decidePromotionCore(db, FieldValue, AUTH, makePayload()),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  // ─── 11. Concurrent decisions ──────────────────────────────────────

  it("11. two concurrent approvals — only one succeeds", async () => {
    const p1 = decidePromotionCore(db, FieldValue, AUTH, makePayload());
    const p2 = decidePromotionCore(db, FieldValue, { ...AUTH, ra: "99999", deciderName: "Outro" }, makePayload());

    const results = await Promise.allSettled([p1, p2]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // Exactly one succeeds, one fails
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    // 12. Only one decision persisted
    const request = (await db.doc("promotion_requests/req-1").get()).data()!;
    expect(["approved"]).toContain(request.status);
  });

  // ─── 13. Rollback — no partial update ──────────────────────────────

  it("13. validation failure — complete rollback, no partial state", async () => {
    // Request with module that does not match current_module
    await seedProgress("dog-bono", "busca_captura", { current_module: "mod-2" });
    // Request asks for mod-1 which differs from current

    await expect(
      decidePromotionCore(db, FieldValue, AUTH, makePayload()),
    ).rejects.toMatchObject({ code: "failed-precondition" });

    // Request must remain pending
    const request = (await db.doc("promotion_requests/req-1").get()).data()!;
    expect(request.status).toBe("pending");

    // Progress must remain unchanged
    const progress = (await db.doc("dogs/dog-bono/training/busca_captura").get()).data()!;
    expect(progress.current_module).toBe("mod-2");
    expect(progress.completed_module_ids).toEqual([]);
  });

  // ─── 14. completed_module_ids no duplication ───────────────────────

  it("14. completed_module_ids persisted without duplication", async () => {
    await decidePromotionCore(db, FieldValue, AUTH, makePayload());

    const progress = (await db.doc("dogs/dog-bono/training/busca_captura").get()).data()!;
    const counts = progress.completed_module_ids.reduce((acc: Record<string, number>, id: string) => {
      acc[id] = (acc[id] || 0) + 1;
      return acc;
    }, {});
    expect(Object.values(counts).every((c: number) => c === 1)).toBe(true);
  });

  // ─── 15. completed_modules canonical format ────────────────────────

  it("15. completed_modules in canonical format with milestones snapshot", async () => {
    await decidePromotionCore(db, FieldValue, AUTH, makePayload());

    const progress = (await db.doc("dogs/dog-bono/training/busca_captura").get()).data()!;
    const entry = progress.completed_modules[0];
    expect(entry.module_id).toBe("mod-1");
    expect(entry.module_name).toBe("Fundamentos");
    expect(entry.module_order).toBe(1);
    expect(entry.program_version).toBe(1);
    expect(entry.completed_by).toBe("12345");
    expect(entry.completed_at).toBeDefined();
    expect(entry.milestones).toHaveLength(1);
    expect(entry.milestones[0].milestone_id).toBe("ms-1");
  });

  // ─── 16. current_module intermediate ───────────────────────────────

  it("16. intermediate approval sets current_module to next", async () => {
    await decidePromotionCore(db, FieldValue, AUTH, makePayload());

    const progress = (await db.doc("dogs/dog-bono/training/busca_captura").get()).data()!;
    expect(progress.current_module).toBe("mod-2");
    expect(typeof progress.current_module).toBe("string");
  });

  // ─── 17. current_module null on last ───────────────────────────────

  it("17. last module sets current_module = null", async () => {
    await seedProgress("dog-bono", "busca_captura", {
      current_module: "mod-3",
      completed_module_ids: ["mod-1", "mod-2"],
    });
    await seedRequest("req-1", { module_id: "mod-3", module_name: "Busca Avançada", module_order: 3 });

    await decidePromotionCore(db, FieldValue, AUTH, makePayload());

    const progress = (await db.doc("dogs/dog-bono/training/busca_captura").get()).data()!;
    expect(progress.current_module).toBeNull();
  });

  // ─── 18. operational_since persisted as Timestamp ──────────────────

  it("18. operational_since persisted as Date (Firestore converts to Timestamp)", async () => {
    await seedProgress("dog-bono", "busca_captura", {
      current_module: "mod-3",
      completed_module_ids: ["mod-1", "mod-2"],
    });
    await seedRequest("req-1", { module_id: "mod-3", module_name: "Busca Avançada", module_order: 3 });

    await decidePromotionCore(db, FieldValue, AUTH, makePayload());

    const progress = (await db.doc("dogs/dog-bono/training/busca_captura").get()).data()!;
    // Firestore stores Dates as Timestamps; when read back they're Timestamps
    expect(progress.operational_since).toBeDefined();
    expect(progress.operational_since.toDate).toBeDefined(); // is a Timestamp
  });

  // ─── 19. Audit trail ───────────────────────────────────────────────

  it("19. audit trail persisted on request", async () => {
    await decidePromotionCore(db, FieldValue, AUTH, makePayload({ note: "Excelente" }));

    const request = (await db.doc("promotion_requests/req-1").get()).data()!;
    expect(request.audit_trail).toHaveLength(1);
    const entry = request.audit_trail[0];
    expect(entry.action).toBe("evolution_approved");
    expect(entry.by_ra).toBe("12345");
    expect(entry.by_uid).toBe("uid-instructor-1");
  });

  // ─── 20. Rejection does not alter progress ─────────────────────────

  it("20. rejection does not alter progress document", async () => {
    const before = (await db.doc("dogs/dog-bono/training/busca_captura").get()).data()!;

    await decidePromotionCore(db, FieldValue, AUTH, makePayload({
      decision: "rejected",
      reason: "Motivo válido",
    }));

    const after = (await db.doc("dogs/dog-bono/training/busca_captura").get()).data()!;
    expect(after.current_module).toBe(before.current_module);
    expect(after.completed_module_ids).toEqual(before.completed_module_ids);
    expect(after.status).toBe(before.status);
  });
});
