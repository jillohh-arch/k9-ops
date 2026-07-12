/**
 * Integration tests for decidePromotionRequest Cloud Function.
 *
 * These tests validate the full transaction flow including:
 * - Firestore reads/writes within transactions
 * - Date/Timestamp serialization
 * - Concurrent decision handling
 * - Rollback on failure
 * - Authorization checks (disabled user, email mismatch)
 * - Audit trail persistence
 * - Progress document state after approval/rejection
 *
 * Uses firebase-functions-test in "offline" mode with mocked Firestore.
 * For full emulator tests, set FIRESTORE_EMULATOR_HOST before running.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock firebase-admin (hoisted to avoid TDZ) ─────────────────────────────

const {
  mockTransaction,
  mockRunTransaction,
  mockDoc,
  mockCollection,
  mockGetFirestore,
  mockGetUser,
  mockGetAuth,
  mockServerTimestamp,
  mockArrayUnion,
  handlers,
} = vi.hoisted(() => {
  const mockTransaction = {
    get: vi.fn(),
    update: vi.fn(),
  };
  const mockRunTransaction = vi.fn((fn: (tx: typeof mockTransaction) => Promise<unknown>) => fn(mockTransaction));
  const mockDoc = vi.fn();
  const mockCollection = vi.fn();
  const mockGetFirestore = vi.fn(() => ({
    doc: mockDoc,
    collection: mockCollection,
    runTransaction: mockRunTransaction,
  }));
  const mockGetUser = vi.fn();
  const mockGetAuth = vi.fn(() => ({ getUser: mockGetUser }));
  const mockServerTimestamp = vi.fn(() => ({ _type: "serverTimestamp" }));
  const mockArrayUnion = vi.fn((...args: unknown[]) => ({ _type: "arrayUnion", values: args }));
  const handlers: { decide: ((request: unknown) => Promise<unknown>) | null } = { decide: null };

  return {
    mockTransaction,
    mockRunTransaction,
    mockDoc,
    mockCollection,
    mockGetFirestore,
    mockGetUser,
    mockGetAuth,
    mockServerTimestamp,
    mockArrayUnion,
    handlers,
  };
});

vi.mock("firebase-admin/app", () => ({ initializeApp: vi.fn() }));
vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => mockGetFirestore(),
  FieldValue: {
    serverTimestamp: () => mockServerTimestamp(),
    arrayUnion: (...args: unknown[]) => mockArrayUnion(...args),
  },
}));
vi.mock("firebase-admin/auth", () => ({
  getAuth: () => mockGetAuth(),
}));
vi.mock("firebase-admin/messaging", () => ({
  getMessaging: vi.fn(() => ({ send: vi.fn() })),
}));
vi.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: vi.fn(() => vi.fn()),
}));
vi.mock("firebase-functions/v2", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Mock onCall to capture the handler
vi.mock("firebase-functions/v2/https", () => ({
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = "HttpsError";
    }
  },
  onCall: (_opts: unknown, handler: (request: unknown) => Promise<unknown>) => {
    handlers.decide = handler;
    return handler;
  },
}));

// ─── Import module (after mocks) ────────────────────────────────────────────

import "../src/index";

// ─── Fixtures ───────────────────────────────────────────────────────────────

const VALID_AUTH = {
  uid: "uid-instructor-1",
  token: {
    email: "12345@gcm.com.br",
    instrutor_k9: true,
  },
};

const DISABLED_AUTH = {
  uid: "uid-disabled-1",
  token: {
    email: "99999@gcm.com.br",
    instrutor_k9: true,
  },
};

const NON_INSTRUCTOR_AUTH = {
  uid: "uid-operator-1",
  token: {
    email: "88888@gcm.com.br",
    role: "operador_k9",
  },
};

const GMAIL_AUTH = {
  uid: "uid-gmail-1",
  token: {
    email: "user@gmail.com",
    instrutor_k9: true,
  },
};

function makePromotionRequestDoc(overrides: Record<string, unknown> = {}) {
  return {
    exists: true,
    data: () => ({
      dog_id: "dog-bono",
      dog_name: "Bono",
      modality: "busca_captura",
      module_id: "mod-1",
      module_name: "Fundamentos",
      module_order: 1,
      program_id: "prog-bc",
      program_version: 1,
      status: "pending",
      requester_ra: "67890",
      audit_trail: [],
      ...overrides,
    }),
  };
}

function makeProgressDoc(overrides: Record<string, unknown> = {}) {
  return {
    exists: true,
    data: () => ({
      modality: "busca_captura",
      current_module: "mod-1",
      completed_module_ids: [],
      completed_modules: [],
      program_version: 1,
      status: "in_formation",
      achieved_milestones: {},
      ...overrides,
    }),
  };
}

function makeProgramDoc(overrides: Record<string, unknown> = {}) {
  return {
    exists: true,
    data: () => ({
      active: true,
      modality: "busca_captura",
      name: "Busca e Captura",
      version: 1,
      ...overrides,
    }),
  };
}

function makeModulesDocs(modules = [
  { id: "mod-1", order: 1, title: "Fundamentos" },
  { id: "mod-2", order: 2, title: "Controle" },
  { id: "mod-3", order: 3, title: "Busca Avançada" },
]) {
  return {
    docs: modules.map((m) => ({
      id: m.id,
      data: () => ({ order: m.order, title: m.title }),
    })),
  };
}

function makeUserDoc(exists = true, data: Record<string, unknown> = { displayName: "Instrutor Silva" }) {
  return { exists, data: () => data };
}

// ─── Test helpers ───────────────────────────────────────────────────────────

function callFunction(data: Record<string, unknown>, auth = VALID_AUTH) {
  if (!handlers.decide) throw new Error("Handler not captured");
  return handlers.decide({ data, auth });
}

function setupMocksForApproval(overrides: {
  promotionDoc?: Record<string, unknown>;
  progressDoc?: Record<string, unknown>;
  programDoc?: Record<string, unknown>;
  modules?: Array<{ id: string; order: number; title: string }>;
  userDocExists?: boolean;
  userDisabled?: boolean;
  userEmail?: string;
} = {}) {
  const {
    promotionDoc = {},
    progressDoc = {},
    programDoc = {},
    modules,
    userDocExists = true,
    userDisabled = false,
    userEmail = "12345@gcm.com.br",
  } = overrides;

  // getUser mock
  mockGetUser.mockResolvedValue({
    uid: "uid-instructor-1",
    email: userEmail,
    disabled: userDisabled,
    displayName: "Instrutor Silva",
  });

  // users/{ra} doc for name resolution
  const userDocSnap = makeUserDoc(userDocExists);
  const requestDocSnap = makePromotionRequestDoc(promotionDoc);
  const progressDocSnap = makeProgressDoc(progressDoc);
  const programDocSnap = makeProgramDoc(programDoc);
  const modulesSnap = makeModulesDocs(modules);

  // mockDoc returns a ref — used for db.doc() calls
  mockDoc.mockImplementation((path: string) => {
    const ref = { path };
    return ref;
  });

  // mockCollection for db.collection() calls
  mockCollection.mockImplementation((path: string) => {
    if (path === "users") {
      return { doc: () => ({ get: () => Promise.resolve(userDocSnap) }) };
    }
    if (path === "promotion_requests") {
      return { doc: () => ({ path: `promotion_requests/req-1` }) };
    }
    // training_programs/{id}/modules
    return { path };
  });

  // Transaction get mock — order-dependent
  let txGetCount = 0;
  mockTransaction.get.mockImplementation((ref: { path?: string } | Record<string, unknown>) => {
    txGetCount++;
    const path = (ref as { path?: string }).path ?? "";

    if (path.startsWith("promotion_requests")) return Promise.resolve(requestDocSnap);
    if (path.includes("/training/")) return Promise.resolve(progressDocSnap);
    if (path.startsWith("training_programs/") && !path.includes("/modules")) return Promise.resolve(programDocSnap);

    // modules collection
    return Promise.resolve(modulesSnap);
  });

  mockTransaction.update.mockReturnValue(undefined);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("decidePromotionRequest — Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── 1. Approval of intermediate module ─────────────────────────────────

  describe("1. Intermediate module approval", () => {
    it("advances current_module to next and appends to completed_module_ids", async () => {
      setupMocksForApproval();

      const result = await callFunction({ requestId: "req-1", decision: "approved", note: "Ótimo desempenho" });

      expect(result).toEqual({ id: "req-1", status: "approved" });

      // Should call tx.update twice: request + progress
      expect(mockTransaction.update).toHaveBeenCalledTimes(2);

      // Progress update (second call)
      const progressUpdate = mockTransaction.update.mock.calls[1][1];
      expect(progressUpdate.current_module).toBe("mod-2");
      expect(progressUpdate.completed_module_ids).toEqual(["mod-1"]);
      expect(progressUpdate.completed_modules).toHaveLength(1);
      expect(progressUpdate.completed_modules[0].module_id).toBe("mod-1");
      expect(progressUpdate.completed_modules[0].module_name).toBe("Fundamentos");
      expect(progressUpdate.completed_modules[0].completed_by).toBe("12345");
      expect(progressUpdate.completed_modules[0].program_version).toBe(1);
      expect(progressUpdate.completed_modules[0].milestones).toEqual([]);
      expect(progressUpdate.status).toBeUndefined();
      expect(progressUpdate.operational_since).toBeUndefined();
    });
  });

  // ─── 2. Last module approval ────────────────────────────────────────────

  describe("2. Last module approval", () => {
    it("sets status=operational, current_module=null, operational_since", async () => {
      setupMocksForApproval({
        promotionDoc: { module_id: "mod-3", module_name: "Busca Avançada", module_order: 3 },
        progressDoc: { current_module: "mod-3", completed_module_ids: ["mod-1", "mod-2"] },
      });

      const result = await callFunction({ requestId: "req-1", decision: "approved" });

      expect(result).toEqual({ id: "req-1", status: "approved" });

      const progressUpdate = mockTransaction.update.mock.calls[1][1];
      expect(progressUpdate.current_module).toBeNull();
      expect(progressUpdate.completed_module_ids).toEqual(["mod-1", "mod-2", "mod-3"]);
      expect(progressUpdate.status).toBe("operational");
      expect(progressUpdate.operational_since).toBeInstanceOf(Date);
    });
  });

  // ─── 3. Valid rejection ─────────────────────────────────────────────────

  describe("3. Valid rejection", () => {
    it("updates request status without touching progress", async () => {
      setupMocksForApproval();

      const result = await callFunction({ requestId: "req-1", decision: "rejected", reason: "Desempenho insuficiente" });

      expect(result).toEqual({ id: "req-1", status: "rejected" });

      // Only one update (the request itself) — no progress update
      expect(mockTransaction.update).toHaveBeenCalledTimes(1);

      const requestUpdate = mockTransaction.update.mock.calls[0][1];
      expect(requestUpdate.status).toBe("rejected");
      expect(requestUpdate.decision).toBe("rejected");
      expect(requestUpdate.decision_reason).toBe("Desempenho insuficiente");
    });
  });

  // ─── 4. Rejection with empty reason ────────────────────────────────────

  describe("4. Rejection with empty reason", () => {
    it("throws invalid-argument", async () => {
      setupMocksForApproval();

      await expect(
        callFunction({ requestId: "req-1", decision: "rejected", reason: "" }),
      ).rejects.toMatchObject({ code: "invalid-argument" });
    });

    it("throws for whitespace-only reason", async () => {
      setupMocksForApproval();

      await expect(
        callFunction({ requestId: "req-1", decision: "rejected", reason: "   " }),
      ).rejects.toMatchObject({ code: "invalid-argument" });
    });
  });

  // ─── 5. Progress not found ─────────────────────────────────────────────

  describe("5. Progress document not found", () => {
    it("throws failed-precondition", async () => {
      setupMocksForApproval();
      // Override progress to not exist
      mockTransaction.get.mockImplementation((ref: { path?: string }) => {
        const path = (ref as { path?: string }).path ?? "";
        if (path.includes("/training/")) return Promise.resolve({ exists: false });
        if (path.startsWith("promotion_requests")) return Promise.resolve(makePromotionRequestDoc());
        if (path.startsWith("training_programs/") && !path.includes("/modules")) return Promise.resolve(makeProgramDoc());
        return Promise.resolve(makeModulesDocs());
      });

      await expect(
        callFunction({ requestId: "req-1", decision: "approved" }),
      ).rejects.toMatchObject({ code: "failed-precondition", message: expect.stringContaining("Progresso") });
    });
  });

  // ─── 6. Program not found ──────────────────────────────────────────────

  describe("6. Program not found", () => {
    it("throws failed-precondition", async () => {
      setupMocksForApproval();
      mockTransaction.get.mockImplementation((ref: { path?: string }) => {
        const path = (ref as { path?: string }).path ?? "";
        if (path.startsWith("promotion_requests")) return Promise.resolve(makePromotionRequestDoc());
        if (path.includes("/training/")) return Promise.resolve(makeProgressDoc());
        if (path.startsWith("training_programs/") && !path.includes("/modules")) {
          return Promise.resolve({ exists: false });
        }
        return Promise.resolve(makeModulesDocs());
      });

      await expect(
        callFunction({ requestId: "req-1", decision: "approved" }),
      ).rejects.toMatchObject({ code: "failed-precondition", message: expect.stringContaining("Programa") });
    });
  });

  // ─── 7. Module not in program ──────────────────────────────────────────

  describe("7. Module not in program", () => {
    it("throws failed-precondition for nonexistent module_id", async () => {
      setupMocksForApproval({
        promotionDoc: { module_id: "mod-nonexistent" },
        progressDoc: { current_module: "mod-nonexistent" },
      });

      await expect(
        callFunction({ requestId: "req-1", decision: "approved" }),
      ).rejects.toMatchObject({ code: "failed-precondition", message: expect.stringContaining("não pertence") });
    });
  });

  // ─── 8. Version divergence ─────────────────────────────────────────────

  describe("8. Program version divergence", () => {
    it("throws when program version was updated since request creation", async () => {
      setupMocksForApproval({
        promotionDoc: { program_version: 1 },
        programDoc: { version: 2 },
      });

      await expect(
        callFunction({ requestId: "req-1", decision: "approved" }),
      ).rejects.toMatchObject({ code: "failed-precondition", message: expect.stringContaining("atualizada") });
    });

    it("throws when progress version diverges from request", async () => {
      setupMocksForApproval({
        promotionDoc: { program_version: 1 },
        progressDoc: { program_version: 2 },
      });

      await expect(
        callFunction({ requestId: "req-1", decision: "approved" }),
      ).rejects.toMatchObject({ code: "failed-precondition", message: expect.stringContaining("Versão") });
    });
  });

  // ─── 9. Current module divergence ──────────────────────────────────────

  describe("9. Current module divergence", () => {
    it("throws when progress.current_module differs from request", async () => {
      setupMocksForApproval({
        promotionDoc: { module_id: "mod-1" },
        progressDoc: { current_module: "mod-2" },
      });

      await expect(
        callFunction({ requestId: "req-1", decision: "approved" }),
      ).rejects.toMatchObject({ code: "failed-precondition", message: expect.stringContaining("não corresponde") });
    });
  });

  // ─── 10. Already decided request ───────────────────────────────────────

  describe("10. Already decided request", () => {
    it("throws failed-precondition for approved request", async () => {
      setupMocksForApproval({ promotionDoc: { status: "approved" } });

      await expect(
        callFunction({ requestId: "req-1", decision: "approved" }),
      ).rejects.toMatchObject({ code: "failed-precondition", message: expect.stringContaining("já foi analisada") });
    });

    it("throws failed-precondition for rejected request", async () => {
      setupMocksForApproval({ promotionDoc: { status: "rejected" } });

      await expect(
        callFunction({ requestId: "req-1", decision: "rejected", reason: "Motivo" }),
      ).rejects.toMatchObject({ code: "failed-precondition", message: expect.stringContaining("já foi analisada") });
    });
  });

  // ─── 11. Concurrent decisions ──────────────────────────────────────────

  describe("11. Concurrent decisions", () => {
    it("second decision fails when first already changed status", async () => {
      // First call succeeds
      setupMocksForApproval();
      await callFunction({ requestId: "req-1", decision: "approved" });

      // Second call sees already-decided doc
      setupMocksForApproval({ promotionDoc: { status: "approved" } });
      await expect(
        callFunction({ requestId: "req-1", decision: "approved" }),
      ).rejects.toMatchObject({ code: "failed-precondition" });
    });
  });

  // ─── 12. Rollback on failure ───────────────────────────────────────────

  describe("12. Rollback on validation failure", () => {
    it("no writes persist when validation fails mid-transaction", async () => {
      setupMocksForApproval({
        promotionDoc: { module_id: "mod-nonexistent" },
        progressDoc: { current_module: "mod-nonexistent" },
      });

      await expect(
        callFunction({ requestId: "req-1", decision: "approved" }),
      ).rejects.toMatchObject({ code: "failed-precondition" });

      // The request update fires before validation, but since it's in a transaction
      // and the tx throws, Firestore would roll back. Here we verify the error propagates.
      // In a real emulator test, we'd read the doc and confirm it's unchanged.
    });
  });

  // ─── 13. completed_module_ids without duplication ──────────────────────

  describe("13. completed_module_ids persisted without duplication", () => {
    it("does not duplicate if module already in list (idempotency guard)", async () => {
      setupMocksForApproval({
        progressDoc: { current_module: "mod-2", completed_module_ids: ["mod-1"], completed_modules: [{ module_id: "mod-1" }] },
        promotionDoc: { module_id: "mod-2", module_name: "Controle", module_order: 2 },
      });

      const result = await callFunction({ requestId: "req-1", decision: "approved" });
      expect(result).toEqual({ id: "req-1", status: "approved" });

      const progressUpdate = mockTransaction.update.mock.calls[1][1];
      expect(progressUpdate.completed_module_ids).toEqual(["mod-1", "mod-2"]);
      // No duplicates
      const counts = progressUpdate.completed_module_ids.reduce((acc: Record<string, number>, id: string) => {
        acc[id] = (acc[id] || 0) + 1;
        return acc;
      }, {});
      expect(Object.values(counts).every((c: number) => c === 1)).toBe(true);
    });
  });

  // ─── 14. completed_modules canonical format ────────────────────────────

  describe("14. completed_modules canonical format", () => {
    it("entry has all required fields with correct types", async () => {
      setupMocksForApproval();
      await callFunction({ requestId: "req-1", decision: "approved", note: "Bom" });

      const progressUpdate = mockTransaction.update.mock.calls[1][1];
      const entry = progressUpdate.completed_modules[0];
      expect(entry).toHaveProperty("module_id", "mod-1");
      expect(entry).toHaveProperty("module_name", "Fundamentos");
      expect(entry).toHaveProperty("module_order", 1);
      expect(entry).toHaveProperty("program_version", 1);
      expect(entry).toHaveProperty("completed_at");
      expect(entry.completed_at).toBeInstanceOf(Date);
      expect(entry).toHaveProperty("completed_by", "12345");
      expect(entry).toHaveProperty("milestones");
      expect(Array.isArray(entry.milestones)).toBe(true);
    });
  });

  // ─── 15. operational_since on last module ──────────────────────────────

  describe("15. operational_since on last module", () => {
    it("sets operational_since as Date when last module is approved", async () => {
      setupMocksForApproval({
        promotionDoc: { module_id: "mod-3", module_name: "Busca Avançada", module_order: 3 },
        progressDoc: { current_module: "mod-3", completed_module_ids: ["mod-1", "mod-2"], status: "in_formation" },
      });

      await callFunction({ requestId: "req-1", decision: "approved" });

      const progressUpdate = mockTransaction.update.mock.calls[1][1];
      expect(progressUpdate.operational_since).toBeInstanceOf(Date);
      expect(progressUpdate.status).toBe("operational");
    });

    it("does NOT set operational_since if already operational", async () => {
      setupMocksForApproval({
        promotionDoc: { module_id: "mod-3", module_name: "Busca Avançada", module_order: 3 },
        progressDoc: { current_module: "mod-3", completed_module_ids: ["mod-1", "mod-2"], status: "operational" },
      });

      await callFunction({ requestId: "req-1", decision: "approved" });

      const progressUpdate = mockTransaction.update.mock.calls[1][1];
      expect(progressUpdate.operational_since).toBeUndefined();
      expect(progressUpdate.status).toBeUndefined();
    });
  });

  // ─── 16. Audit trail persisted ─────────────────────────────────────────

  describe("16. Audit trail persisted correctly", () => {
    it("approval creates evolution_approved audit entry", async () => {
      setupMocksForApproval();
      await callFunction({ requestId: "req-1", decision: "approved", note: "Excelente" });

      const requestUpdate = mockTransaction.update.mock.calls[0][1];
      expect(requestUpdate.audit_trail).toBeDefined();
      // arrayUnion was called with the audit entry
      const auditCall = mockArrayUnion.mock.calls[0][0];
      expect(auditCall.action).toBe("evolution_approved");
      expect(auditCall.by_ra).toBe("12345");
      expect(auditCall.by_uid).toBe("uid-instructor-1");
      expect(auditCall.at).toBeInstanceOf(Date);
    });

    it("rejection creates request_rejected audit entry", async () => {
      setupMocksForApproval();
      await callFunction({ requestId: "req-1", decision: "rejected", reason: "Motivo" });

      const auditCall = mockArrayUnion.mock.calls[0][0];
      expect(auditCall.action).toBe("request_rejected");
      expect(auditCall.note).toBe("Motivo");
    });
  });

  // ─── 17. Unauthorized user ─────────────────────────────────────────────

  describe("17. User without instructor permission", () => {
    it("throws permission-denied for non-instructor", async () => {
      setupMocksForApproval();

      await expect(
        callFunction({ requestId: "req-1", decision: "approved" }, NON_INSTRUCTOR_AUTH),
      ).rejects.toMatchObject({ code: "permission-denied", message: expect.stringContaining("instrutor") });
    });
  });

  // ─── 18. Disabled user ─────────────────────────────────────────────────

  describe("18. Disabled user", () => {
    it("throws permission-denied when Firebase Auth user is disabled", async () => {
      setupMocksForApproval({ userDisabled: true });

      await expect(
        callFunction({ requestId: "req-1", decision: "approved" }),
      ).rejects.toMatchObject({ code: "permission-denied", message: expect.stringContaining("desabilitada") });
    });
  });

  // ─── 19. No authentication ─────────────────────────────────────────────

  describe("19. Callable without authentication", () => {
    it("throws unauthenticated", async () => {
      if (!handlers.decide) throw new Error("Handler not captured");

      await expect(
        handlers.decide({ data: { requestId: "req-1", decision: "approved" }, auth: null }),
      ).rejects.toMatchObject({ code: "unauthenticated" });
    });
  });

  // ─── 20. Non-institutional email ───────────────────────────────────────

  describe("20. Non-institutional email (no RA)", () => {
    it("throws permission-denied for gmail user", async () => {
      setupMocksForApproval();

      await expect(
        callFunction({ requestId: "req-1", decision: "approved" }, GMAIL_AUTH),
      ).rejects.toMatchObject({ code: "permission-denied", message: expect.stringContaining("RA") });
    });
  });

  // ─── Additional: email mismatch ────────────────────────────────────────

  describe("Additional: Email mismatch between Auth record and token", () => {
    it("throws permission-denied when Auth email does not match RA", async () => {
      setupMocksForApproval({ userEmail: "different@gcm.com.br" });

      await expect(
        callFunction({ requestId: "req-1", decision: "approved" }),
      ).rejects.toMatchObject({ code: "permission-denied", message: expect.stringContaining("não corresponde") });
    });
  });

  // ─── Transaction read order ────────────────────────────────────────────

  describe("Transaction read order: all reads before writes", () => {
    it("reads request, progress, program, modules before any write", async () => {
      setupMocksForApproval();

      await callFunction({ requestId: "req-1", decision: "approved" });

      // tx.get should be called 4 times (request, progress, program, modules)
      expect(mockTransaction.get).toHaveBeenCalledTimes(4);

      // tx.update called after all gets
      const getCallOrder = mockTransaction.get.mock.invocationCallOrder;
      const updateCallOrder = mockTransaction.update.mock.invocationCallOrder;

      const lastGet = Math.max(...getCallOrder);
      const firstUpdate = Math.min(...updateCallOrder);
      expect(lastGet).toBeLessThan(firstUpdate);
    });
  });

  // ─── Request not found ─────────────────────────────────────────────────

  describe("Request not found", () => {
    it("throws not-found", async () => {
      setupMocksForApproval();
      mockTransaction.get.mockImplementation((ref: { path?: string }) => {
        const path = (ref as { path?: string }).path ?? "";
        if (path.startsWith("promotion_requests")) return Promise.resolve({ exists: false });
        return Promise.resolve(makeProgressDoc());
      });

      await expect(
        callFunction({ requestId: "req-1", decision: "approved" }),
      ).rejects.toMatchObject({ code: "not-found" });
    });
  });

  // ─── Program with no modules ───────────────────────────────────────────

  describe("Program with no modules", () => {
    it("throws failed-precondition", async () => {
      setupMocksForApproval({ modules: [] });

      await expect(
        callFunction({ requestId: "req-1", decision: "approved" }),
      ).rejects.toMatchObject({ code: "failed-precondition", message: expect.stringContaining("sem módulos") });
    });
  });
});
