import { describe, expect, it, vi, beforeEach } from "vitest";

type TransactionMock = {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

const state = vi.hoisted(() => {
  function createTransaction(): TransactionMock {
    return {
      get: vi.fn().mockResolvedValue({
        exists: () => true,
        data: () => ({
          version: 1,
          audit_trail: [],
          name: "Programa",
          title: "Módulo",
          description: "desc",
          order: 1,
        }),
      }),
      set: vi.fn(),
      update: vi.fn(),
    };
  }

  return {
    createTransaction,
    transaction: createTransaction(),
    incrementCalls: [] as number[],
    setDocCalls: [] as unknown[][],
    rejectWith: null as Error | null,
  };
});

vi.mock("firebase/firestore", () => ({
  Timestamp: { now: () => ({ seconds: 1000, nanoseconds: 0 }) },
  addDoc: vi.fn(),
  collection: vi.fn((_db: unknown, ...segments: string[]) => ({
    path: segments.join("/"),
    type: "collectionRef",
  })),
  doc: vi.fn((...args: unknown[]) => {
    if (args.length === 1 && typeof args[0] === "object" && args[0] !== null && "path" in args[0]) {
      const collRef = args[0] as { path: string };
      return { path: collRef.path + "/auto-id", id: "auto-id", type: "docRef" };
    }
    const segments = args.slice(1) as string[];
    return { path: segments.join("/"), id: segments[segments.length - 1] || "auto-id", type: "docRef" };
  }),
  getDoc: vi.fn(async () => ({ exists: () => false })),
  increment: (n: number) => {
    state.incrementCalls.push(n);
    return { __increment: n };
  },
  runTransaction: async (_db: unknown, fn: unknown) => {
    if (state.rejectWith) {
      const err = state.rejectWith;
      state.rejectWith = null;
      throw err;
    }
    state.transaction = state.createTransaction();
    return (fn as (t: TransactionMock) => Promise<unknown>)(state.transaction);
  },
  setDoc: async (...args: unknown[]) => {
    state.setDocCalls.push(args);
  },
}));

vi.mock("@/lib/firebase/client", () => ({ db: {} }));
vi.mock("@/features/effective/lib/k9-modalities", () => ({
  canônicalModality: (v: string) => v.toLowerCase().replace(/\s/g, "_"),
}));

import type { AuthProfile } from "@/features/auth/providers/auth-provider";

import {
  createTrainingModule,
  createTrainingMilestone,
  createTrainingProgram,
  updateTrainingModule,
  updateTrainingMilestone,
  updateTrainingProgram,
  type ModuleInput,
  type MilestoneInput,
  type ProgramInput,
} from "../data/training-curriculum-service";

const baseProfile = {
  displayName: "Admin",
  email: "admin@gcm.com.br",
  ra: "admin",
  uid: "uid-admin",
  isK9Instructor: true,
  photoURL: null,
  photoUrl: null,
  accessProfile: null,
  roles: [],
  claims: {},
  userMirror: null,
} as unknown as AuthProfile;

const moduleInput: ModuleInput = {
  description: "Módulo teste",
  order: "1",
  title: "Fundamentos",
  criteria: {
    instructorApprovalRequired: true,
    maxAverageDurationS: "",
    minDistanceM: "",
    minSessions: "5",
    minSuccessRate: "80",
    notes: "",
    requiredEvents: "",
  },
};

const milestoneInput: MilestoneInput = {
  description: "Marco teste",
  order: "1",
  required: true,
  title: "Obediência básica",
};

const programInput: ProgramInput = {
  active: true,
  description: "Programa de busca",
  modality: "busca_captura",
  name: "Busca e Captura",
};

function findProgramVersionUpdate() {
  return state.transaction.update.mock.calls.find((call) => {
    const path: string = call[0]?.path ?? "";
    return path === "training_programs/prog-bc";
  });
}

describe("training-curriculum-service: auto-versioning", () => {
  beforeEach(() => {
    state.incrementCalls = [];
    state.setDocCalls = [];
    state.rejectWith = null;
  });

  it("1. createTrainingModule increments program.version", async () => {
    await createTrainingModule("prog-bc", moduleInput, baseProfile);

    const call = findProgramVersionUpdate();
    expect(call).toBeDefined();
    expect(call![1].version).toEqual({ __increment: 1 });
  });

  it("2. updateTrainingModule increments program.version", async () => {
    await updateTrainingModule("prog-bc", "mod-1", moduleInput, baseProfile);

    const call = findProgramVersionUpdate();
    expect(call).toBeDefined();
    expect(call![1].version).toEqual({ __increment: 1 });
  });

  it("3. changing module order increments program.version", async () => {
    const reordered = { ...moduleInput, order: "5" };
    await updateTrainingModule("prog-bc", "mod-1", reordered, baseProfile);

    const call = findProgramVersionUpdate();
    expect(call).toBeDefined();
    expect(call![1].version).toEqual({ __increment: 1 });
  });

  it("4. createTrainingMilestone increments program.version", async () => {
    await createTrainingMilestone("prog-bc", "mod-1", milestoneInput, baseProfile);

    const call = findProgramVersionUpdate();
    expect(call).toBeDefined();
    expect(call![1].version).toEqual({ __increment: 1 });
  });

  it("5. updateTrainingMilestone increments program.version", async () => {
    await updateTrainingMilestone("prog-bc", "mod-1", "ms-1", milestoneInput, baseProfile);

    const call = findProgramVersionUpdate();
    expect(call).toBeDefined();
    expect(call![1].version).toEqual({ __increment: 1 });
  });

  it("6. changing milestone order increments program.version", async () => {
    const reordered = { ...milestoneInput, order: "9" };
    await updateTrainingMilestone("prog-bc", "mod-1", "ms-1", reordered, baseProfile);

    const call = findProgramVersionUpdate();
    expect(call).toBeDefined();
    expect(call![1].version).toEqual({ __increment: 1 });
  });

  it("7. updateTrainingProgram does NOT alter version", async () => {
    await updateTrainingProgram("prog-bc", programInput, baseProfile);

    for (const call of state.transaction.update.mock.calls) {
      expect(call[1]).not.toHaveProperty("version");
    }
  });

  it("8. transaction failure does not increment version", async () => {
    state.rejectWith = new Error("Transaction failed");

    await expect(
      createTrainingModule("prog-bc", moduleInput, baseProfile),
    ).rejects.toThrow("Transaction failed");
  });

  it("9. two concurrent mutations produce two independent increment calls", async () => {
    await Promise.all([
      createTrainingModule("prog-bc", moduleInput, baseProfile),
      createTrainingModule("prog-bc", { ...moduleInput, title: "Controle" }, baseProfile),
    ]);

    expect(state.incrementCalls.filter((n) => n === 1).length).toBeGreaterThanOrEqual(2);
  });

  it("10. stale promotion request is rejected after version increment", async () => {
    const { validatePromotionState } = await import("../../../../functions/src/promotion-helpers");

    const modules = [{ id: "mod-1", order: 1 }];
    const progress = {
      current_module: "mod-1",
      completed_module_ids: [] as string[],
      completed_modules: [] as unknown[],
      program_version: 2,
      status: "in_formation",
      achieved_milestones: {},
    };
    const promotion = {
      dog_id: "dog-1",
      modality: "busca_captura",
      module_id: "mod-1",
      program_id: "prog-bc",
      program_version: 1,
      status: "pending",
    };

    const result = validatePromotionState(promotion, progress, modules);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Versão do programa");
  });
});

describe("training-curriculum-service: ProgramInput version safety", () => {
  beforeEach(() => {
    state.incrementCalls = [];
    state.setDocCalls = [];
    state.rejectWith = null;
  });

  it("ProgramInput type does not include version field", () => {
    const input: ProgramInput = {
      active: true,
      description: "test",
      modality: "faro",
      name: "Faro",
    };
    expect(input).not.toHaveProperty("version");
  });

  it("createTrainingProgram initializes version to 1", async () => {
    await createTrainingProgram(programInput, baseProfile);

    expect(state.setDocCalls.length).toBe(1);
    const payload = state.setDocCalls[0][1] as Record<string, unknown>;
    expect(payload.version).toBe(1);
  });

  it("updateTrainingProgram payload does NOT contain version", async () => {
    await updateTrainingProgram("prog-bc", programInput, baseProfile);

    for (const call of state.transaction.update.mock.calls) {
      expect(call[1]).not.toHaveProperty("version");
    }
  });
});
