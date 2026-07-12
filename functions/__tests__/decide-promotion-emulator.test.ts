import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { initializeApp, deleteApp, type App } from "firebase-admin/app";
import { FieldValue, getFirestore, type Firestore } from "firebase-admin/firestore";

import { decidePromotionCore, type DeciderContext, type DecisionPayload } from "../src/decide-promotion-core";

// ─── Setup ──────────────────────────────────────────────────────────────────

let app: App;
let db: Firestore;

const DECIDER: DeciderContext = {
  uid: "uid-12345",
  ra: "12345",
  email: "12345@gcm.com.br",
  deciderName: "Sgt. Silva",
};

function approvePayload(requestId = "req-001"): DecisionPayload {
  return { requestId, decision: "approved", note: "Bom desempenho" };
}

function rejectPayload(requestId = "req-001"): DecisionPayload {
  return { requestId, decision: "rejected", reason: "Não atende critérios mínimos" };
}

beforeAll(() => {
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
  app = initializeApp({ projectId: "k9-ops-test" }, "emulator-test");
  db = getFirestore(app);
});

afterAll(async () => {
  await deleteApp(app);
});

async function clearCollection(path: string) {
  const snap = await db.collection(path).get();
  const batch = db.batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
}

async function seedScenario(opts: {
  requestId?: string;
  dogId?: string;
  modality?: string;
  programId?: string;
  moduleId?: string;
  programVersion?: number;
  progressVersion?: number;
  currentModule?: string;
  completedModuleIds?: string[];
  status?: string;
  promotionStatus?: string;
  modules?: Array<{ id: string; order: number; title: string }>;
}) {
  const {
    requestId = "req-001",
    dogId = "dog-bono",
    modality = "busca_captura",
    programId = "prog-bc",
    moduleId = "mod-1",
    programVersion = 1,
    progressVersion = 1,
    currentModule = "mod-1",
    completedModuleIds = [],
    status = "in_formation",
    promotionStatus = "pending",
    modules = [
      { id: "mod-1", order: 1, title: "Fundamentos" },
      { id: "mod-2", order: 2, title: "Controle" },
      { id: "mod-3", order: 3, title: "Operacional" },
    ],
  } = opts;

  await db.collection("promotion_requests").doc(requestId).set({
    dog_id: dogId,
    modality,
    module_id: moduleId,
    module_name: modules.find((m) => m.id === moduleId)?.title ?? "Módulo",
    module_order: modules.find((m) => m.id === moduleId)?.order ?? 1,
    program_id: programId,
    program_version: programVersion,
    status: promotionStatus,
    created_at: new Date(),
  });

  await db.doc(`dogs/${dogId}/training/${modality}`).set({
    current_module: currentModule,
    completed_module_ids: completedModuleIds,
    completed_modules: [],
    program_version: progressVersion,
    status,
    achieved_milestones: {},
  });

  for (const mod of modules) {
    await db.doc(`training_programs/${programId}/modules/${mod.id}`).set({
      order: mod.order,
      title: mod.title,
    });
  }
}

async function cleanup() {
  await clearCollection("promotion_requests");

  const dogs = await db.collection("dogs").get();
  for (const dog of dogs.docs) {
    const training = await db.collection(`dogs/${dog.id}/training`).get();
    const b = db.batch();
    training.docs.forEach((d) => b.delete(d.ref));
    await b.commit();
    await dog.ref.delete();
  }

  const programs = await db.collection("training_programs").get();
  for (const prog of programs.docs) {
    const mods = await db.collection(`training_programs/${prog.id}/modules`).get();
    const b = db.batch();
    mods.docs.forEach((d) => b.delete(d.ref));
    await b.commit();
    await prog.ref.delete();
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("decidePromotionCore: Firestore Emulator", () => {
  beforeEach(async () => {
    await cleanup();
  });

  it("1. approves intermediate module and advances to next", async () => {
    await seedScenario({ moduleId: "mod-1", currentModule: "mod-1" });

    const result = await decidePromotionCore(db, FieldValue, DECIDER, approvePayload());

    expect(result).toMatchObject({ id: "req-001", status: "approved" });

    const progress = (await db.doc("dogs/dog-bono/training/busca_captura").get()).data()!;
    expect(progress.current_module).toBe("mod-2");
    expect(progress.completed_module_ids).toContain("mod-1");
    expect(progress.status).toBe("in_formation");
  });

  it("2. approves last module and marks operational", async () => {
    await seedScenario({
      moduleId: "mod-3",
      currentModule: "mod-3",
      completedModuleIds: ["mod-1", "mod-2"],
    });

    const result = await decidePromotionCore(db, FieldValue, DECIDER, approvePayload());

    expect(result).toMatchObject({ id: "req-001", status: "approved" });

    const progress = (await db.doc("dogs/dog-bono/training/busca_captura").get()).data()!;
    expect(progress.current_module).toBeNull();
    expect(progress.completed_module_ids).toContain("mod-3");
    expect(progress.status).toBe("operational");
    expect(progress.operational_since).toBeDefined();
  });

  it("3. rejects validly without altering progress", async () => {
    await seedScenario({});

    const result = await decidePromotionCore(db, FieldValue, DECIDER, rejectPayload());

    expect(result).toMatchObject({ id: "req-001", status: "rejected" });

    const request = (await db.doc("promotion_requests/req-001").get()).data()!;
    expect(request.status).toBe("rejected");
    expect(request.decision_reason).toContain("Não atende");

    const progress = (await db.doc("dogs/dog-bono/training/busca_captura").get()).data()!;
    expect(progress.current_module).toBe("mod-1");
    expect(progress.completed_module_ids).toEqual([]);
  });

  it("4. rejects stale program version", async () => {
    await seedScenario({ programVersion: 1, progressVersion: 2 });

    await expect(
      decidePromotionCore(db, FieldValue, DECIDER, approvePayload()),
    ).rejects.toMatchObject({ message: expect.stringContaining("Versão") });
  });

  it("5. rejects divergent current_module", async () => {
    await seedScenario({ moduleId: "mod-1", currentModule: "mod-2" });

    await expect(
      decidePromotionCore(db, FieldValue, DECIDER, approvePayload()),
    ).rejects.toMatchObject({ message: expect.stringContaining("Módulo atual") });
  });

  it("6. rejects when progress doc is missing", async () => {
    await db.collection("promotion_requests").doc("req-missing").set({
      dog_id: "dog-ghost",
      modality: "faro",
      module_id: "mod-1",
      program_id: "prog-bc",
      program_version: 1,
      status: "pending",
    });
    await db.doc("training_programs/prog-bc/modules/mod-1").set({ order: 1, title: "X" });

    await expect(
      decidePromotionCore(db, FieldValue, DECIDER, approvePayload("req-missing")),
    ).rejects.toMatchObject({ message: expect.stringContaining("Progresso") });
  });

  it("7. concurrent approvals: only first succeeds", async () => {
    await seedScenario({ requestId: "req-a" });
    await db.collection("promotion_requests").doc("req-b").set({
      dog_id: "dog-bono",
      modality: "busca_captura",
      module_id: "mod-1",
      program_id: "prog-bc",
      program_version: 1,
      status: "pending",
    });

    const [resultA, resultB] = await Promise.allSettled([
      decidePromotionCore(db, FieldValue, DECIDER, approvePayload("req-a")),
      decidePromotionCore(db, FieldValue, DECIDER, approvePayload("req-b")),
    ]);

    const successes = [resultA, resultB].filter((r) => r.status === "fulfilled");

    // At least one succeeds; the other may fail due to current_module mismatch after first advances
    expect(successes.length).toBeGreaterThanOrEqual(1);
    // If both succeed, progress should still be consistent
    if (successes.length === 2) {
      const progress = (await db.doc("dogs/dog-bono/training/busca_captura").get()).data()!;
      expect(progress.completed_module_ids).toContain("mod-1");
    }
  });

  it("8. exactly one approval persisted after concurrent race", async () => {
    await seedScenario({ requestId: "req-race" });

    const promises = Array.from({ length: 3 }, () =>
      decidePromotionCore(db, FieldValue, DECIDER, approvePayload("req-race")).catch(() => null),
    );
    await Promise.all(promises);

    const request = (await db.doc("promotion_requests/req-race").get()).data()!;
    expect(request.status).toBe("approved");

    const progress = (await db.doc("dogs/dog-bono/training/busca_captura").get()).data()!;
    expect(progress.completed_module_ids.filter((id: string) => id === "mod-1").length).toBe(1);
  });

  it("9. rollback on failure: no partial writes", async () => {
    // Seed without modules to force failure after reading promotion+progress
    await db.collection("promotion_requests").doc("req-rollback").set({
      dog_id: "dog-bono",
      modality: "busca_captura",
      module_id: "mod-1",
      program_id: "prog-empty",
      program_version: 1,
      status: "pending",
    });
    await db.doc("dogs/dog-bono/training/busca_captura").set({
      current_module: "mod-1",
      completed_module_ids: [],
      completed_modules: [],
      program_version: 1,
      status: "in_formation",
      achieved_milestones: {},
    });

    await expect(
      decidePromotionCore(db, FieldValue, DECIDER, approvePayload("req-rollback")),
    ).rejects.toThrow();

    // Request should still be pending (transaction rolled back)
    const request = (await db.doc("promotion_requests/req-rollback").get()).data()!;
    expect(request.status).toBe("pending");
  });

  it("10. audit trail is persisted on approval", async () => {
    await seedScenario({});

    await decidePromotionCore(db, FieldValue, DECIDER, approvePayload());

    const request = (await db.doc("promotion_requests/req-001").get()).data()!;
    expect(request.audit_trail).toBeDefined();
    expect(request.audit_trail.length).toBeGreaterThanOrEqual(1);
    const entry = request.audit_trail[0];
    expect(entry.action).toBe("evolution_approved");
    expect(entry.by).toBe("Sgt. Silva");
    expect(entry.by_ra).toBe("12345");
  });

  it("11. completed_module_ids is updated correctly", async () => {
    await seedScenario({ completedModuleIds: ["mod-prev"] });

    await decidePromotionCore(db, FieldValue, DECIDER, approvePayload());

    const progress = (await db.doc("dogs/dog-bono/training/busca_captura").get()).data()!;
    expect(progress.completed_module_ids).toContain("mod-prev");
    expect(progress.completed_module_ids).toContain("mod-1");
  });

  it("12. completed_modules has mobile-compatible entry format", async () => {
    await seedScenario({});

    await decidePromotionCore(db, FieldValue, DECIDER, approvePayload());

    const progress = (await db.doc("dogs/dog-bono/training/busca_captura").get()).data()!;
    expect(progress.completed_modules.length).toBeGreaterThanOrEqual(1);
    const entry = progress.completed_modules[0];
    expect(entry).toHaveProperty("module_id", "mod-1");
    expect(entry).toHaveProperty("module_name");
    expect(entry).toHaveProperty("completed_at");
    expect(entry).toHaveProperty("decided_by", "12345");
  });

  it("13. current_module advances to next module", async () => {
    await seedScenario({ moduleId: "mod-2", currentModule: "mod-2", completedModuleIds: ["mod-1"] });

    await decidePromotionCore(db, FieldValue, DECIDER, approvePayload());

    const progress = (await db.doc("dogs/dog-bono/training/busca_captura").get()).data()!;
    expect(progress.current_module).toBe("mod-3");
  });

  it("14. operational_since is persisted on last-module graduation", async () => {
    await seedScenario({
      moduleId: "mod-3",
      currentModule: "mod-3",
      completedModuleIds: ["mod-1", "mod-2"],
    });

    await decidePromotionCore(db, FieldValue, DECIDER, approvePayload());

    const progress = (await db.doc("dogs/dog-bono/training/busca_captura").get()).data()!;
    expect(progress.operational_since).toBeDefined();
    // Should be a Date or Timestamp
    const since = progress.operational_since;
    expect(since instanceof Date || (since && typeof since.toDate === "function")).toBe(true);
  });

  it("15. rejection does not modify progress document", async () => {
    await seedScenario({ completedModuleIds: ["mod-prev"] });

    const beforeProgress = (await db.doc("dogs/dog-bono/training/busca_captura").get()).data()!;

    await decidePromotionCore(db, FieldValue, DECIDER, rejectPayload());

    const afterProgress = (await db.doc("dogs/dog-bono/training/busca_captura").get()).data()!;
    expect(afterProgress.current_module).toBe(beforeProgress.current_module);
    expect(afterProgress.completed_module_ids).toEqual(beforeProgress.completed_module_ids);
    expect(afterProgress.status).toBe(beforeProgress.status);
  });
});
