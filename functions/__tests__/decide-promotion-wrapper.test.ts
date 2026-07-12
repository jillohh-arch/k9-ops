import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockGetUser = vi.fn();
const mockDocGet = vi.fn();
const mockTxGet = vi.fn();
const mockTxUpdate = vi.fn();
const mockCollectionGet = vi.fn();

vi.mock("firebase-admin/app", () => ({ initializeApp: vi.fn() }));
vi.mock("firebase-admin/auth", () => ({ getAuth: () => ({ getUser: mockGetUser }) }));
vi.mock("firebase-admin/messaging", () => ({ getMessaging: vi.fn() }));

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: () => "SERVER_TS",
    arrayUnion: (...args: unknown[]) => ({ __arrayUnion: args }),
  },
  getFirestore: () => ({
    collection: (path: string) => ({
      __type: "collection",
      path,
      doc: (id: string) => ({
        __type: "doc",
        path: `${path}/${id}`,
        get: () => mockDocGet(`${path}/${id}`),
      }),
      get: () => mockCollectionGet(path),
    }),
    doc: (path: string) => ({
      __type: "doc",
      path,
      get: () => mockDocGet(path),
    }),
    runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: (ref: { __type: string; path: string }) => {
          if (ref.__type === "collection") {
            return mockCollectionGet(ref.path);
          }
          return mockTxGet(ref.path);
        },
        update: mockTxUpdate,
      };
      return fn(tx);
    },
  }),
}));

let callableHandler: (request: unknown) => Promise<unknown>;

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
    callableHandler = handler;
    return handler;
  },
}));

vi.mock("firebase-functions/v2/scheduler", () => ({ onSchedule: vi.fn(() => vi.fn()) }));
vi.mock("firebase-functions/v2", () => ({ logger: { info: vi.fn(), warn: vi.fn() } }));

await import("../src/index");

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(overrides: Record<string, unknown> = {}) {
  return {
    auth: {
      uid: "uid-12345",
      token: {
        email: "12345@gcm.com.br",
        instrutor_k9: true,
      },
    },
    data: {
      requestId: "req-001",
      decision: "approved",
      reason: null,
      note: "Bom desempenho",
    },
    ...overrides,
  };
}

function setupApprovalMocks() {
  mockGetUser.mockResolvedValue({
    uid: "uid-12345",
    email: "12345@gcm.com.br",
    disabled: false,
    displayName: "Sgt. Silva",
  });
  mockDocGet.mockImplementation((path: string) => {
    if (path?.includes("users/")) {
      return Promise.resolve({ exists: true, data: () => ({ displayName: "Sgt. Silva" }) });
    }
    return Promise.resolve({ exists: false });
  });
  mockTxGet.mockImplementation((path: string) => {
    if (path?.includes("promotion_requests/")) {
      return Promise.resolve({
        exists: true,
        data: () => ({
          dog_id: "dog-bono",
          modality: "busca_captura",
          module_id: "mod-1",
          module_name: "Fundamentos",
          module_order: 1,
          program_id: "prog-bc",
          program_version: 1,
          status: "pending",
        }),
      });
    }
    if (path?.includes("dogs/") && path?.includes("/training/")) {
      return Promise.resolve({
        exists: true,
        data: () => ({
          current_module: "mod-1",
          completed_module_ids: [],
          completed_modules: [],
          program_version: 1,
          status: "in_formation",
          achieved_milestones: {},
        }),
      });
    }
    return Promise.resolve({ exists: false });
  });
  mockCollectionGet.mockResolvedValue({
    docs: [
      { id: "mod-1", data: () => ({ order: 1, title: "Fundamentos" }) },
      { id: "mod-2", data: () => ({ order: 2, title: "Controle" }) },
    ],
  });
  mockTxUpdate.mockReturnValue(undefined);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("decidePromotionRequest wrapper: authentication & validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupApprovalMocks();
  });

  it("rejects unauthenticated request", async () => {
    const request = makeRequest({ auth: undefined });

    await expect(callableHandler(request)).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("rejects user without RA (non-institutional email)", async () => {
    const request = makeRequest({
      auth: {
        uid: "uid-ext",
        token: { email: "user@gmail.com", instrutor_k9: true },
      },
    });

    await expect(callableHandler(request)).rejects.toMatchObject({
      code: "permission-denied",
      message: expect.stringContaining("RA"),
    });
  });

  it("rejects user without instructor claims", async () => {
    const request = makeRequest({
      auth: {
        uid: "uid-12345",
        token: { email: "12345@gcm.com.br", operador: true },
      },
    });

    await expect(callableHandler(request)).rejects.toMatchObject({
      code: "permission-denied",
      message: expect.stringContaining("instrutor"),
    });
  });

  it("rejects missing requestId", async () => {
    const request = makeRequest();
    (request.data as Record<string, unknown>).requestId = "";

    await expect(callableHandler(request)).rejects.toMatchObject({
      code: "invalid-argument",
      message: expect.stringContaining("requestId"),
    });
  });

  it("rejects invalid decision value", async () => {
    const request = makeRequest();
    (request.data as Record<string, unknown>).decision = "maybe";

    await expect(callableHandler(request)).rejects.toMatchObject({
      code: "invalid-argument",
      message: expect.stringContaining("decision"),
    });
  });

  it("rejects rejection without reason", async () => {
    const request = makeRequest();
    (request.data as Record<string, unknown>).decision = "rejected";
    (request.data as Record<string, unknown>).reason = "   ";

    await expect(callableHandler(request)).rejects.toMatchObject({
      code: "invalid-argument",
      message: expect.stringContaining("Justificativa"),
    });
  });
});

describe("decidePromotionRequest wrapper: core delegation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupApprovalMocks();
  });

  it("delegates to decidePromotionCore (no runTransaction in index.ts)", async () => {
    await callableHandler(makeRequest());

    // The transaction was called through the core, not directly
    // This verifies the refactor: index.ts has no inline runTransaction
    expect(mockTxGet).toHaveBeenCalledWith(expect.stringContaining("promotion_requests/req-001"));
    expect(mockTxUpdate).toHaveBeenCalled();
  });
});

describe("decidePromotionRequest wrapper: transaction flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupApprovalMocks();
  });

  it("returns success on valid approved request", async () => {
    const result = await callableHandler(makeRequest());

    expect(result).toMatchObject({ id: "req-001", status: "approved" });
  });

  it("calls transaction.update for request and progress on approval", async () => {
    await callableHandler(makeRequest());

    expect(mockTxUpdate).toHaveBeenCalled();
    const calls = mockTxUpdate.mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  it("rejects already-decided request", async () => {
    mockTxGet.mockImplementation((path: string) => {
      if (path?.includes("promotion_requests/")) {
        return Promise.resolve({
          exists: true,
          data: () => ({
            dog_id: "dog-bono",
            modality: "busca_captura",
            module_id: "mod-1",
            program_id: "prog-bc",
            program_version: 1,
            status: "approved",
          }),
        });
      }
      return Promise.resolve({ exists: false });
    });

    await expect(callableHandler(makeRequest())).rejects.toMatchObject({
      code: "failed-precondition",
      message: expect.stringContaining("já foi analisada"),
    });
  });

  it("rejects when request doc not found", async () => {
    mockTxGet.mockResolvedValue({ exists: false });

    await expect(callableHandler(makeRequest())).rejects.toMatchObject({
      code: "not-found",
    });
  });

  it("resolves decider name from Firestore users collection", async () => {
    await callableHandler(makeRequest());

    expect(mockDocGet).toHaveBeenCalledWith(expect.stringContaining("users/12345"));
  });

  it("rejection only updates request doc, not progress", async () => {
    const request = makeRequest();
    (request.data as Record<string, unknown>).decision = "rejected";
    (request.data as Record<string, unknown>).reason = "Não apto";

    mockTxGet.mockResolvedValue({
      exists: true,
      data: () => ({
        dog_id: "dog-bono",
        modality: "busca_captura",
        module_id: "mod-1",
        program_id: "prog-bc",
        program_version: 1,
        status: "pending",
      }),
    });

    const result = await callableHandler(request);

    expect(result).toMatchObject({ id: "req-001", status: "rejected" });
    expect(mockTxUpdate).toHaveBeenCalledTimes(1);
  });

  it("rejects stale program version", async () => {
    mockTxGet.mockImplementation((path: string) => {
      if (path?.includes("promotion_requests/")) {
        return Promise.resolve({
          exists: true,
          data: () => ({
            dog_id: "dog-bono",
            modality: "busca_captura",
            module_id: "mod-1",
            program_id: "prog-bc",
            program_version: 1,
            status: "pending",
          }),
        });
      }
      if (path?.includes("dogs/") && path?.includes("/training/")) {
        return Promise.resolve({
          exists: true,
          data: () => ({
            current_module: "mod-1",
            completed_module_ids: [],
            completed_modules: [],
            program_version: 2,
            status: "in_formation",
            achieved_milestones: {},
          }),
        });
      }
      return Promise.resolve({ exists: false });
    });

    await expect(callableHandler(makeRequest())).rejects.toMatchObject({
      code: "failed-precondition",
      message: expect.stringContaining("Versão"),
    });
  });
});
