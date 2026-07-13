/**
 * Integration tests for decidePromotionRequest Cloud Function.
 *
 * Validates the full callable flow including:
 * - Authorization checks (unauthenticated, non-instructor, non-institutional email)
 * - Transaction read ordering (all reads before writes)
 * - Audit trail persistence via FieldValue.arrayUnion
 * - Progress document updates on approval
 * - Rejection without progress modification
 *
 * Adapted from wip/training-promotion-integration-tests for PR#5 architecture:
 * - Document path: dogs/{dogId}/training/{modality}
 * - CompletedModuleEntry: decided_by (not completed_by), no milestones
 * - Transaction reads: 3 (request, progress, modules) — no separate program doc
 * - Audit trail entry includes by_email field
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
  modules?: Array<{ id: string; order: number; title: string }>;
  userDocExists?: boolean;
} = {}) {
  const {
    promotionDoc = {},
    progressDoc = {},
    modules,
    userDocExists = true,
  } = overrides;

  mockGetUser.mockResolvedValue({
    uid: "uid-instructor-1",
    email: "12345@gcm.com.br",
    disabled: false,
    displayName: "Instrutor Silva",
  });

  const userDocSnap = makeUserDoc(userDocExists);
  const requestDocSnap = makePromotionRequestDoc(promotionDoc);
  const progressDocSnap = makeProgressDoc(progressDoc);
  const modulesSnap = makeModulesDocs(modules);

  mockDoc.mockImplementation((path: string) => ({ path }));

  mockCollection.mockImplementation((path: string) => {
    if (path === "users") {
      return { doc: () => ({ get: () => Promise.resolve(userDocSnap) }) };
    }
    if (path === "promotion_requests") {
      return { doc: () => ({ path: "promotion_requests/req-1" }) };
    }
    return { path };
  });

  mockTransaction.get.mockImplementation((ref: { path?: string; docs?: unknown[] } | unknown) => {
    const path = (ref as { path?: string }).path ?? "";
    if (path.startsWith("promotion_requests")) return Promise.resolve(requestDocSnap);
    if (path.includes("/training/")) return Promise.resolve(progressDocSnap);
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

  // ─── 1. Intermediate module approval ─────────────────────────────────

  describe("1. Intermediate module approval", () => {
    it("advances current_module to next and appends to completed_module_ids", async () => {
      setupMocksForApproval();

      const result = await callFunction({ requestId: "req-1", decision: "approved", note: "Ótimo desempenho" });

      expect(result).toEqual({ id: "req-1", status: "approved" });
      expect(mockTransaction.update).toHaveBeenCalledTimes(2);

      const progressUpdate = mockTransaction.update.mock.calls[1][1];
      expect(progressUpdate.current_module).toBe("mod-2");
      expect(progressUpdate.completed_module_ids).toEqual(["mod-1"]);
      expect(progressUpdate.completed_modules).toHaveLength(1);
      expect(progressUpdate.completed_modules[0].module_id).toBe("mod-1");
      expect(progressUpdate.completed_modules[0].module_name).toBe("Fundamentos");
      expect(progressUpdate.completed_modules[0].decided_by).toBe("12345");
      expect(progressUpdate.completed_modules[0].completed_at).toBeInstanceOf(Date);
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
      mockTransaction.get.mockImplementation((ref: { path?: string }) => {
        const path = (ref as { path?: string }).path ?? "";
        if (path.includes("/training/")) return Promise.resolve({ exists: false });
        if (path.startsWith("promotion_requests")) return Promise.resolve(makePromotionRequestDoc());
        return Promise.resolve(makeModulesDocs());
      });

      await expect(
        callFunction({ requestId: "req-1", decision: "approved" }),
      ).rejects.toMatchObject({ code: "failed-precondition", message: expect.stringContaining("Progresso") });
    });
  });

  // ─── 6. Module not in program ──────────────────────────────────────────

  describe("6. Module not in program", () => {
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

  // ─── 7. Version divergence ─────────────────────────────────────────────

  describe("7. Program version divergence", () => {
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

  // ─── 8. Current module divergence ──────────────────────────────────────

  describe("8. Current module divergence", () => {
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

  // ─── 9. Already decided request ───────────────────────────────────────

  describe("9. Already decided request", () => {
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

  // ─── 10. Concurrent decisions ──────────────────────────────────────────

  describe("10. Concurrent decisions", () => {
    it("second decision fails when first already changed status", async () => {
      setupMocksForApproval();
      await callFunction({ requestId: "req-1", decision: "approved" });

      setupMocksForApproval({ promotionDoc: { status: "approved" } });
      await expect(
        callFunction({ requestId: "req-1", decision: "approved" }),
      ).rejects.toMatchObject({ code: "failed-precondition" });
    });
  });

  // ─── 11. Rollback on failure ───────────────────────────────────────────

  describe("11. Rollback on validation failure", () => {
    it("no writes persist when validation fails mid-transaction", async () => {
      setupMocksForApproval({
        promotionDoc: { module_id: "mod-nonexistent" },
        progressDoc: { current_module: "mod-nonexistent" },
      });

      await expect(
        callFunction({ requestId: "req-1", decision: "approved" }),
      ).rejects.toMatchObject({ code: "failed-precondition" });
    });
  });

  // ─── 12. completed_module_ids without duplication ──────────────────────

  describe("12. completed_module_ids persisted without duplication", () => {
    it("does not duplicate if module already in list", async () => {
      setupMocksForApproval({
        progressDoc: { current_module: "mod-2", completed_module_ids: ["mod-1"], completed_modules: [{ module_id: "mod-1" }] },
        promotionDoc: { module_id: "mod-2", module_name: "Controle", module_order: 2 },
      });

      const result = await callFunction({ requestId: "req-1", decision: "approved" });
      expect(result).toEqual({ id: "req-1", status: "approved" });

      const progressUpdate = mockTransaction.update.mock.calls[1][1];
      expect(progressUpdate.completed_module_ids).toEqual(["mod-1", "mod-2"]);
      const counts = progressUpdate.completed_module_ids.reduce((acc: Record<string, number>, id: string) => {
        acc[id] = (acc[id] || 0) + 1;
        return acc;
      }, {});
      expect(Object.values(counts).every((c: number) => c === 1)).toBe(true);
    });
  });

  // ─── 13. completed_modules canonical format ────────────────────────────

  describe("13. completed_modules canonical format", () => {
    it("entry has all required fields with correct types", async () => {
      setupMocksForApproval();
      await callFunction({ requestId: "req-1", decision: "approved", note: "Bom" });

      const progressUpdate = mockTransaction.update.mock.calls[1][1];
      const entry = progressUpdate.completed_modules[0];
      expect(entry).toHaveProperty("module_id", "mod-1");
      expect(entry).toHaveProperty("module_name", "Fundamentos");
      expect(entry).toHaveProperty("module_order", 1);
      expect(entry).toHaveProperty("completed_at");
      expect(entry.completed_at).toBeInstanceOf(Date);
      expect(entry).toHaveProperty("decided_by", "12345");
    });
  });

  // ─── 14. operational_since on last module ──────────────────────────────

  describe("14. operational_since on last module", () => {
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

  // ─── 15. Audit trail persisted ─────────────────────────────────────────

  describe("15. Audit trail persisted correctly", () => {
    it("approval creates evolution_approved audit entry", async () => {
      setupMocksForApproval();
      await callFunction({ requestId: "req-1", decision: "approved", note: "Excelente" });

      const requestUpdate = mockTransaction.update.mock.calls[0][1];
      expect(requestUpdate.audit_trail).toBeDefined();
      const auditCall = mockArrayUnion.mock.calls[0][0];
      expect(auditCall.action).toBe("evolution_approved");
      expect(auditCall.by_ra).toBe("12345");
      expect(auditCall.by_uid).toBe("uid-instructor-1");
      expect(auditCall.by_email).toBe("12345@gcm.com.br");
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

  // ─── 16. Unauthorized user ─────────────────────────────────────────────

  describe("16. User without instructor permission", () => {
    it("throws permission-denied for non-instructor", async () => {
      setupMocksForApproval();

      await expect(
        callFunction({ requestId: "req-1", decision: "approved" }, NON_INSTRUCTOR_AUTH),
      ).rejects.toMatchObject({ code: "permission-denied", message: expect.stringContaining("instrutor") });
    });
  });

  // ─── 17. No authentication ─────────────────────────────────────────────

  describe("17. Callable without authentication", () => {
    it("throws unauthenticated", async () => {
      if (!handlers.decide) throw new Error("Handler not captured");

      await expect(
        handlers.decide({ data: { requestId: "req-1", decision: "approved" }, auth: null }),
      ).rejects.toMatchObject({ code: "unauthenticated" });
    });
  });

  // ─── 18. Non-institutional email ───────────────────────────────────────

  describe("18. Non-institutional email (no RA)", () => {
    it("throws permission-denied for gmail user", async () => {
      setupMocksForApproval();

      await expect(
        callFunction({ requestId: "req-1", decision: "approved" }, GMAIL_AUTH),
      ).rejects.toMatchObject({ code: "permission-denied", message: expect.stringContaining("RA") });
    });
  });

  // ─── 19. Transaction read order ────────────────────────────────────────

  describe("19. Transaction read order: all reads before writes", () => {
    it("reads request, progress, modules before any write", async () => {
      setupMocksForApproval();

      await callFunction({ requestId: "req-1", decision: "approved" });

      expect(mockTransaction.get).toHaveBeenCalledTimes(3);

      const getCallOrder = mockTransaction.get.mock.invocationCallOrder;
      const updateCallOrder = mockTransaction.update.mock.invocationCallOrder;

      const lastGet = Math.max(...getCallOrder);
      const firstUpdate = Math.min(...updateCallOrder);
      expect(lastGet).toBeLessThan(firstUpdate);
    });
  });

  // ─── 20. Request not found ─────────────────────────────────────────────

  describe("20. Request not found", () => {
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

  // ─── 21. Program with no modules ───────────────────────────────────────

  describe("21. Program with no modules", () => {
    it("throws failed-precondition", async () => {
      setupMocksForApproval({ modules: [] });

      await expect(
        callFunction({ requestId: "req-1", decision: "approved" }),
      ).rejects.toMatchObject({ code: "failed-precondition", message: expect.stringContaining("sem módulos") });
    });
  });
});
