import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Functions } from "firebase/functions";
import {
  // Operation ID
  generateNutritionPlanOperationId,
  // Builders
  buildCreateNutritionPlanRequest,
  buildUpdateNutritionPlanRequest,
  buildCancelNutritionPlanRequest,
  // Executors
  executeCreateNutritionPlan,
  executeUpdateNutritionPlan,
  executeCancelNutritionPlan,
  // Convenience
  createNutritionPlan,
  updateNutritionPlan,
  cancelNutritionPlan,
  // Normalize only (error classifiers are in the errors barrel)
  normalizeNutritionMutationError,
} from "../data/nutrition-plan-mutation-service";
import {
  isNutritionPlanConflictError,
  isPermissionError,
  isValidationError,
  isTransportError,
} from "../errors/nutrition-mutation-errors";
import type {
  CreateNutritionPlanCommand,
  UpdateNutritionPlanCommand,
  CancelNutritionPlanCommand,
  ProfessionalIdentity,
  HealthDocumentRef,
} from "../types";

// =============================================================================
// MOCK SETUP
// =============================================================================

// Mock the Firebase functions module
vi.mock("firebase/functions", () => ({
  httpsCallable: vi.fn(),
}));

import { httpsCallable } from "firebase/functions";

const mockHttpsCallable = httpsCallable as unknown as ReturnType<typeof vi.fn>;

function createMockFunctions(): Functions {
  return {} as Functions;
}

function mockCallableSuccess<T>(data: T) {
  return { data };
}

function mockCallableError(code: string, message: string, details?: Record<string, unknown>) {
  const error = new Error(message) as Error & {
    code: string;
    details?: Record<string, unknown>;
  };
  error.code = code;
  error.details = details;
  return error;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// =============================================================================
// TESTS: OPERATION ID GENERATION
// =============================================================================

describe("Operation ID Generation", () => {
  it("should generate a valid UUID", () => {
    const id = generateNutritionPlanOperationId();
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(id).toMatch(uuidRegex);
  });

  it("should generate unique IDs for each call", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateNutritionPlanOperationId());
    }
    // All 100 should be unique
    expect(ids.size).toBe(100);
  });

  it("should preserve operationId across requests when using the same ID", () => {
    const operationId = generateNutritionPlanOperationId();

    const command: CreateNutritionPlanCommand = {
      dogId: "dog-1",
      planData: {
        foodType: "Ração Premium",
        amountGramsPerDay: 500,
        mealsPerDay: 3,
        timezone: "America/Sao_Paulo",
        validFrom: "2026-07-19T10:00:00.000Z",
        mealSchedule: [],
      },
    };

    const request1 = buildCreateNutritionPlanRequest(command, operationId);
    const request2 = buildCreateNutritionPlanRequest(command, operationId);

    expect(request1.operationId).toBe(operationId);
    expect(request2.operationId).toBe(operationId);
    expect(request1.operationId).toBe(request2.operationId);
  });

  it("should generate new operationId for new intent", () => {
    const intent1Id = generateNutritionPlanOperationId();
    const intent2Id = generateNutritionPlanOperationId();

    expect(intent1Id).not.toBe(intent2Id);
  });
});

// =============================================================================
// TESTS: CREATE MAPPING
// =============================================================================

describe("Create Request Builder", () => {
  const validCommand: CreateNutritionPlanCommand = {
    dogId: "dog-xyz",
    planData: {
      foodType: "Ração Super Premium",
      amountGramsPerDay: 600,
      mealsPerDay: 3,
      timezone: "America/Sao_Paulo",
      validFrom: "2026-07-19T10:00:00.000Z",
      validUntil: "2026-12-31T23:59:59.000Z",
      mealSchedule: [
        { id: "slot-1", period: "morning", scheduledTime: "08:00", targetGrams: 200 },
        { id: "slot-2", period: "afternoon", scheduledTime: "14:00", targetGrams: 200 },
        { id: "slot-3", period: "evening", scheduledTime: "19:00", targetGrams: 200 },
      ],
      supplements: [
        {
          id: "supp-1",
          name: "Omega 3",
          dose: 1,
          unit: "tablet",
          frequency: "QD",
          instructions: "Junto com almoço",
        },
      ],
      hydrationMl: 1500,
      specialInstructions: "Servir em temperatura ambiente",
      professional: {
        name: "Dra. Ana Silva",
        registration_type: "CRMV",
        registration_number: "SP-12345",
        clinic: "Clínica Veterinária Central",
        specialty: "Nutrição Animal",
      },
      sourceDocument: {
        health_document_id: "doc-abc-123",
        description: "Avaliação nutricional completa",
      },
      attachmentRefs: ["doc-ref-1", "doc-ref-2"],
    },
  };

  it("should map camelCase command to snake_case wire request", () => {
    const operationId = "op-123-abc";
    const request = buildCreateNutritionPlanRequest(validCommand, operationId);

    expect(request.dogId).toBe("dog-xyz");
    expect(request.operationId).toBe(operationId);
    expect(request.planData.food_type).toBe("Ração Super Premium");
    expect(request.planData.amount_grams_per_day).toBe(600);
    expect(request.planData.meals_per_day).toBe(3);
    expect(request.planData.timezone).toBe("America/Sao_Paulo");
    expect(request.planData.valid_from).toBe("2026-07-19T10:00:00.000Z");
    expect(request.planData.valid_until).toBe("2026-12-31T23:59:59.000Z");
  });

  it("should preserve ISO instant timestamps", () => {
    const request = buildCreateNutritionPlanRequest(validCommand, "op-1");
    expect(request.planData.valid_from).toBe("2026-07-19T10:00:00.000Z");
    expect(request.planData.valid_until).toBe("2026-12-31T23:59:59.000Z");
  });

  it("should map meal schedule to snake_case", () => {
    const request = buildCreateNutritionPlanRequest(validCommand, "op-1");

    expect(request.planData.meal_schedule).toHaveLength(3);
    expect(request.planData.meal_schedule[0]).toEqual({
      id: "slot-1",
      period: "morning",
      scheduled_time: "08:00",
      target_grams: 200,
    });
  });

  it("should map professional to canonical shape", () => {
    const request = buildCreateNutritionPlanRequest(validCommand, "op-1");

    expect(request.planData.professional).toEqual({
      name: "Dra. Ana Silva",
      registration_type: "CRMV",
      registration_number: "SP-12345",
      clinic: "Clínica Veterinária Central",
      specialty: "Nutrição Animal",
    });
    // Should NOT have register_number or register_state
    expect(request.planData.professional).not.toHaveProperty("register_number");
    expect(request.planData.professional).not.toHaveProperty("register_state");
  });

  it("should map sourceDocument to canonical shape with health_document_id", () => {
    const request = buildCreateNutritionPlanRequest(validCommand, "op-1");

    expect(request.planData.source_document).toEqual({
      health_document_id: "doc-abc-123",
      description: "Avaliação nutricional completa",
    });
    // Should NOT have id, type, issued_by, issued_at, url
    expect(request.planData.source_document).not.toHaveProperty("id");
    expect(request.planData.source_document).not.toHaveProperty("type");
    expect(request.planData.source_document).not.toHaveProperty("issued_by");
    expect(request.planData.source_document).not.toHaveProperty("issued_at");
    expect(request.planData.source_document).not.toHaveProperty("url");
  });

  it("should map attachment_refs as string array", () => {
    const request = buildCreateNutritionPlanRequest(validCommand, "op-1");
    expect(request.planData.attachment_refs).toEqual(["doc-ref-1", "doc-ref-2"]);
  });

  it("should send null when optional fields are omitted", () => {
    const minimalCommand: CreateNutritionPlanCommand = {
      dogId: "dog-1",
      planData: {
        foodType: "Ração",
        amountGramsPerDay: 400,
        mealsPerDay: 2,
        timezone: "UTC",
        validFrom: "2026-07-19T00:00:00.000Z",
        mealSchedule: [],
      },
    };

    const request = buildCreateNutritionPlanRequest(minimalCommand, "op-1");

    expect(request.planData.valid_until).toBeNull();
    expect(request.planData.supplements).toBeUndefined();
    expect(request.planData.hydration_ml).toBeNull();
    expect(request.planData.special_instructions).toBeNull();
    expect(request.planData.professional).toBeNull();
    expect(request.planData.source_document).toBeNull();
    expect(request.planData.attachment_refs).toBeNull();
  });

  it("should send null when optional fields are explicitly null", () => {
    const commandWithNulls: CreateNutritionPlanCommand = {
      dogId: "dog-1",
      planData: {
        foodType: "Ração",
        amountGramsPerDay: 400,
        mealsPerDay: 2,
        timezone: "UTC",
        validFrom: "2026-07-19T00:00:00.000Z",
        mealSchedule: [],
        validUntil: null,
        hydrationMl: null,
        specialInstructions: null,
        professional: null,
        sourceDocument: null,
        attachmentRefs: null,
      },
    };

    const request = buildCreateNutritionPlanRequest(commandWithNulls, "op-1");

    expect(request.planData.valid_until).toBeNull();
    expect(request.planData.hydration_ml).toBeNull();
    expect(request.planData.special_instructions).toBeNull();
    expect(request.planData.professional).toBeNull();
    expect(request.planData.source_document).toBeNull();
    expect(request.planData.attachment_refs).toBeNull();
  });

  it("should NOT include server-authoritative fields", () => {
    const request = buildCreateNutritionPlanRequest(validCommand, "op-1");

    expect(request.planData).not.toHaveProperty("status");
    expect(request.planData).not.toHaveProperty("revision");
    expect(request.planData).not.toHaveProperty("schema_version");
    expect(request.planData).not.toHaveProperty("recorded_by");
    expect(request.planData).not.toHaveProperty("created_at");
    expect(request.planData).not.toHaveProperty("updated_at");
  });
});

// =============================================================================
// TESTS: UPDATE MAPPING
// =============================================================================

describe("Update Request Builder", () => {
  it("should reject empty changes", () => {
    const command: UpdateNutritionPlanCommand = {
      dogId: "dog-1",
      planId: "plan-1",
      expectedRevision: 1,
      changes: {},
    };

    expect(() => buildUpdateNutritionPlanRequest(command, "op-1")).toThrow(
      "Update command must include at least one change field"
    );
  });

  it("should map all four allowed patch fields", () => {
    const professional: ProfessionalIdentity = {
      name: "Dr. Carlos",
      registration_type: "CRMV",
      registration_number: "RJ-54321",
    };
    const sourceDoc: HealthDocumentRef = {
      health_document_id: "doc-new",
      description: "Nova receita",
    };

    const command: UpdateNutritionPlanCommand = {
      dogId: "dog-1",
      planId: "plan-1",
      expectedRevision: 3,
      changes: {
        specialInstructions: "Novas instruções",
        professional,
        sourceDocument: sourceDoc,
        attachmentRefs: ["ref-1", "ref-2"],
      },
    };

    const request = buildUpdateNutritionPlanRequest(command, "op-abc");

    expect(request.dogId).toBe("dog-1");
    expect(request.planId).toBe("plan-1");
    expect(request.operationId).toBe("op-abc");
    expect(request.expectedRevision).toBe(3);
    expect(request.planData.special_instructions).toBe("Novas instruções");
    expect(request.planData.professional).toEqual(professional);
    expect(request.planData.source_document).toEqual(sourceDoc);
    expect(request.planData.attachment_refs).toEqual(["ref-1", "ref-2"]);
  });

  it("should include only provided fields (absent = preserve)", () => {
    const command: UpdateNutritionPlanCommand = {
      dogId: "dog-1",
      planId: "plan-1",
      expectedRevision: 1,
      changes: {
        specialInstructions: "Only this",
      },
    };

    const request = buildUpdateNutritionPlanRequest(command, "op-1");

    expect(request.planData).toHaveProperty("special_instructions");
    expect(request.planData).not.toHaveProperty("professional");
    expect(request.planData).not.toHaveProperty("source_document");
    expect(request.planData).not.toHaveProperty("attachment_refs");
  });

  it("should send null to explicitly clear a field", () => {
    const command: UpdateNutritionPlanCommand = {
      dogId: "dog-1",
      planId: "plan-1",
      expectedRevision: 1,
      changes: {
        specialInstructions: null,
        attachmentRefs: null,
      },
    };

    const request = buildUpdateNutritionPlanRequest(command, "op-1");

    expect(request.planData.special_instructions).toBeNull();
    expect(request.planData.attachment_refs).toBeNull();
  });

  it("should allow empty array for attachmentRefs (replace with empty)", () => {
    const command: UpdateNutritionPlanCommand = {
      dogId: "dog-1",
      planId: "plan-1",
      expectedRevision: 1,
      changes: {
        attachmentRefs: [],
      },
    };

    const request = buildUpdateNutritionPlanRequest(command, "op-1");

    expect(request.planData.attachment_refs).toEqual([]);
  });

  it("should not allow structural fields in changes", () => {
    // This is enforced by TypeScript - we're testing runtime behavior
    const command: UpdateNutritionPlanCommand = {
      dogId: "dog-1",
      planId: "plan-1",
      expectedRevision: 1,
      changes: {
        specialInstructions: "Test",
      },
    };

    const request = buildUpdateNutritionPlanRequest(command, "op-1");

    // Structural fields should not exist
    expect(request.planData).not.toHaveProperty("food_type");
    expect(request.planData).not.toHaveProperty("amount_grams_per_day");
    expect(request.planData).not.toHaveProperty("valid_from");
    expect(request.planData).not.toHaveProperty("status");
    expect(request.planData).not.toHaveProperty("revision");
  });

  it("should send planData (not changes) per backend contract", () => {
    const command: UpdateNutritionPlanCommand = {
      dogId: "dog-1",
      planId: "plan-1",
      expectedRevision: 1,
      changes: {
        specialInstructions: "Test instructions",
      },
    };

    const request = buildUpdateNutritionPlanRequest(command, "op-1");

    // planData must exist and contain the field
    expect(request.planData).toBeDefined();
    expect(request.planData.special_instructions).toBe("Test instructions");

    // changes must NOT exist (backend expects planData)
    expect(request).not.toHaveProperty("changes");
  });
});

// =============================================================================
// TESTS: CANCEL MAPPING
// =============================================================================

describe("Cancel Request Builder", () => {
  it("should build cancel request with all required fields", () => {
    const command: CancelNutritionPlanCommand = {
      dogId: "dog-1",
      planId: "plan-abc",
      expectedRevision: 5,
      reason: "Cão faleceu",
    };

    const request = buildCancelNutritionPlanRequest(command, "op-cancel-1");

    expect(request.dogId).toBe("dog-1");
    expect(request.planId).toBe("plan-abc");
    expect(request.operationId).toBe("op-cancel-1");
    expect(request.expectedRevision).toBe(5);
    expect(request.reason).toBe("Cão faleceu");
  });

  it("should trim and reject empty reason", () => {
    const command: CancelNutritionPlanCommand = {
      dogId: "dog-1",
      planId: "plan-1",
      expectedRevision: 1,
      reason: "   ",
    };

    expect(() => buildCancelNutritionPlanRequest(command, "op-1")).toThrow(
      "Cancel reason cannot be empty"
    );
  });

  it("should accept reason with whitespace and trim it", () => {
    const command: CancelNutritionPlanCommand = {
      dogId: "dog-1",
      planId: "plan-1",
      expectedRevision: 1,
      reason: "  Motivo válido  ",
    };

    const request = buildCancelNutritionPlanRequest(command, "op-1");
    expect(request.reason).toBe("Motivo válido");
  });
});

// =============================================================================
// TESTS: EXECUTE CREATE
// =============================================================================

describe("Execute Create", () => {
  it("should call healthNutritionCreateAndActivatePlan callable", async () => {
    const functions = createMockFunctions();
    const mockCallable = vi.fn().mockResolvedValue(
      mockCallableSuccess({
        success: true,
        planId: "new-plan-123",
        status: "active",
        revision: 1,
        supersededPlanId: null,
        wasNoOp: false,
      })
    );
    mockHttpsCallable.mockReturnValue(mockCallable);

    const command: CreateNutritionPlanCommand = {
      dogId: "dog-1",
      planData: {
        foodType: "Ração",
        amountGramsPerDay: 500,
        mealsPerDay: 3,
        timezone: "America/Sao_Paulo",
        validFrom: "2026-07-19T00:00:00.000Z",
        mealSchedule: [],
      },
    };
    const request = buildCreateNutritionPlanRequest(command, "op-1");

    const result = await executeCreateNutritionPlan(functions, request);

    expect(mockHttpsCallable).toHaveBeenCalledWith(
      functions,
      "healthNutritionCreateAndActivatePlan"
    );
    expect(result.success).toBe(true);
    expect(result.planId).toBe("new-plan-123");
    expect(result.status).toBe("active");
    expect(result.revision).toBe(1);
    expect(result.wasNoOp).toBe(false);
  });

  it("should handle success with wasNoOp true (replay response)", async () => {
    const functions = createMockFunctions();
    const mockCallable = vi.fn().mockResolvedValue(
      mockCallableSuccess({
        success: true,
        planId: "existing-plan",
        status: "active",
        revision: 1,
        supersededPlanId: null,
        wasNoOp: true,
      })
    );
    mockHttpsCallable.mockReturnValue(mockCallable);

    const command: CreateNutritionPlanCommand = {
      dogId: "dog-1",
      planData: {
        foodType: "Ração",
        amountGramsPerDay: 500,
        mealsPerDay: 3,
        timezone: "UTC",
        validFrom: "2026-07-19T00:00:00.000Z",
        mealSchedule: [],
      },
    };

    const result = await executeCreateNutritionPlan(
      functions,
      buildCreateNutritionPlanRequest(command, "op-replay")
    );

    expect(result.wasNoOp).toBe(true);
    expect(result.planId).toBe("existing-plan");
  });

  it("should normalize validation error", async () => {
    const functions = createMockFunctions();
    mockHttpsCallable.mockReturnValue(
      vi.fn().mockRejectedValue(
        mockCallableError(
          "invalid-argument",
          "Invalid request",
          { code: "validation", message: "food_type é obrigatório" }
        )
      )
    );

    const command: CreateNutritionPlanCommand = {
      dogId: "dog-1",
      planData: {
        foodType: "",
        amountGramsPerDay: 500,
        mealsPerDay: 3,
        timezone: "UTC",
        validFrom: "2026-07-19T00:00:00.000Z",
        mealSchedule: [],
      },
    };

    await expect(
      executeCreateNutritionPlan(
        functions,
        buildCreateNutritionPlanRequest(command, "op-1")
      )
    ).rejects.toMatchObject({
      firebaseCode: "invalid-argument",
      domainCode: "validation",
      retryable: false,
    });
  });

  it("should normalize permission-denied error", async () => {
    const functions = createMockFunctions();
    mockHttpsCallable.mockReturnValue(
      vi.fn().mockRejectedValue(
        mockCallableError(
          "permission-denied",
          "Permission denied",
          { code: "permission-denied" }
        )
      )
    );

    const command: CreateNutritionPlanCommand = {
      dogId: "dog-1",
      planData: {
        foodType: "Ração",
        amountGramsPerDay: 500,
        mealsPerDay: 3,
        timezone: "UTC",
        validFrom: "2026-07-19T00:00:00.000Z",
        mealSchedule: [],
      },
    };

    await expect(
      executeCreateNutritionPlan(
        functions,
        buildCreateNutritionPlanRequest(command, "op-1")
      )
    ).rejects.toMatchObject({
      firebaseCode: "permission-denied",
      domainCode: "permission-denied",
      retryable: false,
    });
  });

  it("should normalize nutrition_plan_conflict error", async () => {
    const functions = createMockFunctions();
    mockHttpsCallable.mockReturnValue(
      vi.fn().mockRejectedValue(
        mockCallableError(
          "failed-precondition",
          "Plan conflict",
          { code: "nutrition_plan_conflict", message: "Já existe plano ativo" }
        )
      )
    );

    const command: CreateNutritionPlanCommand = {
      dogId: "dog-1",
      planData: {
        foodType: "Ração",
        amountGramsPerDay: 500,
        mealsPerDay: 3,
        timezone: "UTC",
        validFrom: "2026-07-19T00:00:00.000Z",
        mealSchedule: [],
      },
    };

    await expect(
      executeCreateNutritionPlan(
        functions,
        buildCreateNutritionPlanRequest(command, "op-1")
      )
    ).rejects.toMatchObject({
      firebaseCode: "failed-precondition",
      domainCode: "nutrition_plan_conflict",
      retryable: false,
    });
  });

  it("should normalize transport error (unavailable) preserving original code", async () => {
    const functions = createMockFunctions();
    mockHttpsCallable.mockReturnValue(
      vi.fn().mockRejectedValue(
        mockCallableError("unavailable", "Service temporarily unavailable")
      )
    );

    const command: CreateNutritionPlanCommand = {
      dogId: "dog-1",
      planData: {
        foodType: "Ração",
        amountGramsPerDay: 500,
        mealsPerDay: 3,
        timezone: "UTC",
        validFrom: "2026-07-19T00:00:00.000Z",
        mealSchedule: [],
      },
    };

    await expect(
      executeCreateNutritionPlan(
        functions,
        buildCreateNutritionPlanRequest(command, "op-1")
      )
    ).rejects.toMatchObject({
      firebaseCode: "unavailable",
      domainCode: undefined,
      retryable: true,
    });
  });
});

// =============================================================================
// TESTS: EXECUTE UPDATE
// =============================================================================

describe("Execute Update", () => {
  it("should call healthNutritionUpdateActivePlan callable", async () => {
    const functions = createMockFunctions();
    const mockCallable = vi.fn().mockResolvedValue(
      mockCallableSuccess({
        success: true,
        planId: "plan-123",
        status: "active",
        revision: 4,
        wasNoOp: false,
      })
    );
    mockHttpsCallable.mockReturnValue(mockCallable);

    const command: UpdateNutritionPlanCommand = {
      dogId: "dog-1",
      planId: "plan-123",
      expectedRevision: 3,
      changes: { specialInstructions: "Updated instructions" },
    };

    const result = await executeUpdateNutritionPlan(
      functions,
      buildUpdateNutritionPlanRequest(command, "op-update-1")
    );

    expect(mockHttpsCallable).toHaveBeenCalledWith(
      functions,
      "healthNutritionUpdateActivePlan"
    );
    expect(result.success).toBe(true);
    expect(result.revision).toBe(4);
    expect(result.wasNoOp).toBe(false);
  });

  it("should handle replay response with wasNoOp true", async () => {
    const functions = createMockFunctions();
    const mockCallable = vi.fn().mockResolvedValue(
      mockCallableSuccess({
        success: true,
        planId: "plan-123",
        status: "active",
        revision: 3,
        wasNoOp: true,
      })
    );
    mockHttpsCallable.mockReturnValue(mockCallable);

    const command: UpdateNutritionPlanCommand = {
      dogId: "dog-1",
      planId: "plan-123",
      expectedRevision: 3,
      changes: { specialInstructions: "Same value" },
    };

    const result = await executeUpdateNutritionPlan(
      functions,
      buildUpdateNutritionPlanRequest(command, "op-replay-update")
    );

    expect(result.wasNoOp).toBe(true);
  });

  it("should normalize stale revision error", async () => {
    const functions = createMockFunctions();
    mockHttpsCallable.mockReturnValue(
      vi.fn().mockRejectedValue(
        mockCallableError(
          "failed-precondition",
          "Revision mismatch",
          { code: "nutrition_plan_conflict", message: "expectedRevision does not match current" }
        )
      )
    );

    const command: UpdateNutritionPlanCommand = {
      dogId: "dog-1",
      planId: "plan-123",
      expectedRevision: 2,
      changes: { specialInstructions: "New" },
    };

    await expect(
      executeUpdateNutritionPlan(
        functions,
        buildUpdateNutritionPlanRequest(command, "op-1")
      )
    ).rejects.toMatchObject({
      firebaseCode: "failed-precondition",
      domainCode: "nutrition_plan_conflict",
      retryable: false,
    });
  });

  it("should normalize permission-denied error", async () => {
    const functions = createMockFunctions();
    mockHttpsCallable.mockReturnValue(
      vi.fn().mockRejectedValue(
        mockCallableError(
          "permission-denied",
          "Cannot update",
          { code: "permission-denied" }
        )
      )
    );

    const command: UpdateNutritionPlanCommand = {
      dogId: "dog-other",
      planId: "plan-123",
      expectedRevision: 3,
      changes: { specialInstructions: "Test" },
    };

    await expect(
      executeUpdateNutritionPlan(
        functions,
        buildUpdateNutritionPlanRequest(command, "op-1")
      )
    ).rejects.toMatchObject({
      firebaseCode: "permission-denied",
      domainCode: "permission-denied",
      retryable: false,
    });
  });
});

// =============================================================================
// TESTS: EXECUTE CANCEL
// =============================================================================

describe("Execute Cancel", () => {
  it("should call healthNutritionCancelPlan callable", async () => {
    const functions = createMockFunctions();
    const mockCallable = vi.fn().mockResolvedValue(
      mockCallableSuccess({
        success: true,
        planId: "plan-123",
        status: "cancelled",
        revision: 6,
        wasNoOp: false,
      })
    );
    mockHttpsCallable.mockReturnValue(mockCallable);

    const command: CancelNutritionPlanCommand = {
      dogId: "dog-1",
      planId: "plan-123",
      expectedRevision: 5,
      reason: "Cão faleceu",
    };

    const result = await executeCancelNutritionPlan(
      functions,
      buildCancelNutritionPlanRequest(command, "op-cancel-1")
    );

    expect(mockHttpsCallable).toHaveBeenCalledWith(
      functions,
      "healthNutritionCancelPlan"
    );
    expect(result.success).toBe(true);
    expect(result.status).toBe("cancelled");
    expect(result.revision).toBe(6);
    expect(result.wasNoOp).toBe(false);
  });

  it("should preserve operationId in cancel request", async () => {
    const functions = createMockFunctions();
    const operationId = "op-cancel-unique-123";

    const mockCallable = vi.fn().mockResolvedValue(
      mockCallableSuccess({
        success: true,
        planId: "plan-123",
        status: "cancelled",
        revision: 6,
        wasNoOp: false,
      })
    );
    mockHttpsCallable.mockReturnValue(mockCallable);

    const command: CancelNutritionPlanCommand = {
      dogId: "dog-1",
      planId: "plan-123",
      expectedRevision: 5,
      reason: "Motivo válido",
    };

    const request = buildCancelNutritionPlanRequest(command, operationId);
    await executeCancelNutritionPlan(functions, request);

    // Verify the callable received the correct operationId
    expect(mockCallable).toHaveBeenCalledWith(
      expect.objectContaining({ operationId })
    );
  });

  it("should handle replay response with wasNoOp true", async () => {
    const functions = createMockFunctions();
    const mockCallable = vi.fn().mockResolvedValue(
      mockCallableSuccess({
        success: true,
        planId: "plan-123",
        status: "cancelled",
        revision: 5,
        wasNoOp: true,
      })
    );
    mockHttpsCallable.mockReturnValue(mockCallable);

    const command: CancelNutritionPlanCommand = {
      dogId: "dog-1",
      planId: "plan-123",
      expectedRevision: 5,
      reason: "Already cancelled",
    };

    const result = await executeCancelNutritionPlan(
      functions,
      buildCancelNutritionPlanRequest(command, "op-replay-cancel")
    );

    expect(result.wasNoOp).toBe(true);
  });

  it("should normalize nutrition_plan_conflict error", async () => {
    const functions = createMockFunctions();
    mockHttpsCallable.mockReturnValue(
      vi.fn().mockRejectedValue(
        mockCallableError(
          "failed-precondition",
          "Conflict",
          { code: "integrity", message: "Concurrent modification detected" }
        )
      )
    );

    const command: CancelNutritionPlanCommand = {
      dogId: "dog-1",
      planId: "plan-123",
      expectedRevision: 4,
      reason: "Trying to cancel",
    };

    await expect(
      executeCancelNutritionPlan(
        functions,
        buildCancelNutritionPlanRequest(command, "op-1")
      )
    ).rejects.toMatchObject({
      firebaseCode: "failed-precondition",
      domainCode: "integrity",
      retryable: false,
    });
  });

  it("should normalize permission-denied error (without domain code)", async () => {
    const functions = createMockFunctions();
    mockHttpsCallable.mockReturnValue(
      vi.fn().mockRejectedValue(
        mockCallableError("permission-denied", "Not allowed")
      )
    );

    const command: CancelNutritionPlanCommand = {
      dogId: "dog-other",
      planId: "plan-123",
      expectedRevision: 5,
      reason: "Unauthorized cancel",
    };

    await expect(
      executeCancelNutritionPlan(
        functions,
        buildCancelNutritionPlanRequest(command, "op-1")
      )
    ).rejects.toMatchObject({
      firebaseCode: "permission-denied",
      domainCode: undefined,
      retryable: false,
    });
  });
});

// =============================================================================
// TESTS: ERROR NORMALIZATION
// =============================================================================

describe("Error Normalization", () => {
  it("should extract and preserve both firebaseCode and domainCode", () => {
    const error = mockCallableError(
      "invalid-argument",
      "Bad input",
      { code: "validation", message: "Invalid timezone" }
    );

    const normalized = normalizeNutritionMutationError(error);

    expect(normalized.firebaseCode).toBe("invalid-argument");
    expect(normalized.domainCode).toBe("validation");
    expect(normalized.message).toBe("Invalid timezone");
    expect(normalized.retryable).toBe(false);
  });

  it("should preserve unavailable transport code when domain code is absent", () => {
    const error = mockCallableError("unavailable", "Service down");

    const normalized = normalizeNutritionMutationError(error);

    expect(normalized.firebaseCode).toBe("unavailable");
    expect(normalized.domainCode).toBeUndefined();
    expect(normalized.message).toBe("Service down");
    expect(normalized.retryable).toBe(true);
  });

  it("should preserve deadline-exceeded transport code", () => {
    const error = mockCallableError("deadline-exceeded", "Request timed out");

    const normalized = normalizeNutritionMutationError(error);

    expect(normalized.firebaseCode).toBe("deadline-exceeded");
    expect(normalized.domainCode).toBeUndefined();
    expect(normalized.retryable).toBe(true);
  });

  it("should handle null/undefined error gracefully", () => {
    expect(normalizeNutritionMutationError(null)).toMatchObject({
      firebaseCode: "unknown",
      retryable: false,
    });
    expect(normalizeNutritionMutationError(undefined)).toMatchObject({
      firebaseCode: "unknown",
      retryable: false,
    });
  });

  it("should preserve details in normalized error", () => {
    const error = mockCallableError(
      "invalid-argument",
      "Error",
      { code: "validation", field: "food_type", extra: "data" }
    );

    const normalized = normalizeNutritionMutationError(error);

    expect(normalized.details).toMatchObject({
      code: "validation",
      field: "food_type",
    });
    expect(normalized.details?.extra).toBe("data");
  });

  it("should use default message when error has no message", () => {
    const error = new Error();
    const normalized = normalizeNutritionMutationError(
      error,
      "Mensagem padrão"
    );

    expect(normalized.message).toBe("Mensagem padrão");
  });

  it("should preserve unknown domain codes in details", () => {
    const error = mockCallableError(
      "failed-precondition",
      "Error",
      { code: "plan-not-found", message: "Plan not found" }
    );

    const normalized = normalizeNutritionMutationError(error);

    expect(normalized.firebaseCode).toBe("failed-precondition");
    expect(normalized.domainCode).toBeUndefined(); // Unknown code preserved in details
    expect(normalized.details?.code).toBe("plan-not-found");
  });

  it("should normalize backend revision-conflict to nutrition_plan_conflict", () => {
    // Backend emits "revision-conflict", Web expects "nutrition_plan_conflict"
    const error = mockCallableError(
      "failed-precondition",
      "Revision mismatch",
      { code: "revision-conflict", message: "Document has been modified" }
    );

    const normalized = normalizeNutritionMutationError(error);

    expect(normalized.firebaseCode).toBe("failed-precondition");
    expect(normalized.domainCode).toBe("nutrition_plan_conflict"); // Normalized
    expect(normalized.details?.code).toBe("revision-conflict"); // Original preserved
    expect(normalized.retryable).toBe(false);
  });

  it("should normalize backend integrity-conflict to integrity", () => {
    // Backend emits "integrity-conflict", Web expects "integrity"
    const error = mockCallableError(
      "failed-precondition",
      "Concurrent modification",
      { code: "integrity-conflict", message: "Multiple active plans" }
    );

    const normalized = normalizeNutritionMutationError(error);

    expect(normalized.firebaseCode).toBe("failed-precondition");
    expect(normalized.domainCode).toBe("integrity"); // Normalized
    expect(normalized.details?.code).toBe("integrity-conflict"); // Original preserved
    expect(normalized.retryable).toBe(false);
  });

  it("should normalize backend idempotency-conflict", () => {
    // Backend emits "idempotency-conflict"
    const error = mockCallableError(
      "already-exists",
      "Operation already processed",
      { code: "idempotency-conflict", message: "OperationId reuse with different payload" }
    );

    const normalized = normalizeNutritionMutationError(error);

    expect(normalized.firebaseCode).toBe("already-exists");
    expect(normalized.domainCode).toBe("idempotency_conflict");
    expect(normalized.details?.code).toBe("idempotency-conflict");
    expect(normalized.retryable).toBe(false);
  });

  it("should correctly identify conflict errors", () => {
    expect(
      isNutritionPlanConflictError({
        firebaseCode: "failed-precondition",
        domainCode: "nutrition_plan_conflict",
        message: "",
        retryable: false,
      })
    ).toBe(true);

    expect(
      isNutritionPlanConflictError({
        firebaseCode: "failed-precondition",
        domainCode: "integrity",
        message: "",
        retryable: false,
      })
    ).toBe(true);

    expect(
      isNutritionPlanConflictError({
        firebaseCode: "invalid-argument",
        domainCode: "validation",
        message: "",
        retryable: false,
      })
    ).toBe(false);
  });

  it("should correctly identify permission errors", () => {
    expect(
      isPermissionError({
        firebaseCode: "permission-denied",
        domainCode: "permission-denied",
        message: "",
        retryable: false,
      })
    ).toBe(true);

    expect(
      isPermissionError({
        firebaseCode: "unauthenticated",
        domainCode: "unauthenticated",
        message: "",
        retryable: false,
      })
    ).toBe(true);

    expect(
      isPermissionError({
        firebaseCode: "not-found",
        domainCode: "not-found",
        message: "",
        retryable: false,
      })
    ).toBe(false);
  });

  it("should correctly identify validation errors", () => {
    expect(
      isValidationError({
        firebaseCode: "invalid-argument",
        domainCode: "validation",
        message: "",
        retryable: false,
      })
    ).toBe(true);

    expect(
      isValidationError({
        firebaseCode: "invalid-argument",
        domainCode: "invalid_timezone",
        message: "",
        retryable: false,
      })
    ).toBe(true);

    expect(
      isValidationError({
        firebaseCode: "permission-denied",
        domainCode: "permission-denied",
        message: "",
        retryable: false,
      })
    ).toBe(false);
  });

  it("should correctly identify transport errors", () => {
    expect(
      isTransportError({
        firebaseCode: "unavailable",
        domainCode: undefined,
        message: "",
        retryable: true,
      })
    ).toBe(true);

    expect(
      isTransportError({
        firebaseCode: "deadline-exceeded",
        domainCode: undefined,
        message: "",
        retryable: true,
      })
    ).toBe(true);

    expect(
      isTransportError({
        firebaseCode: "invalid-argument",
        domainCode: "validation",
        message: "",
        retryable: false,
      })
    ).toBe(false);
  });
});

// =============================================================================
// TESTS: CONVENIENCE FUNCTIONS
// =============================================================================

describe("Convenience Functions", () => {
  it("createNutritionPlan should generate new operationId per call", async () => {
    const functions = createMockFunctions();
    const mockCallable = vi.fn().mockResolvedValue(
      mockCallableSuccess({
        success: true,
        planId: "plan-new",
        status: "active",
        revision: 1,
        wasNoOp: false,
      })
    );
    mockHttpsCallable.mockReturnValue(mockCallable);

    const command: CreateNutritionPlanCommand = {
      dogId: "dog-1",
      planData: {
        foodType: "Ração",
        amountGramsPerDay: 500,
        mealsPerDay: 3,
        timezone: "UTC",
        validFrom: "2026-07-19T00:00:00.000Z",
        mealSchedule: [],
      },
    };

    await createNutritionPlan(functions, command);
    await createNutritionPlan(functions, command);

    // Each call should have generated a unique operationId
    expect(mockCallable).toHaveBeenCalledTimes(2);
    const calls = mockCallable.mock.calls;
    const opId1 = calls[0][0].operationId;
    const opId2 = calls[1][0].operationId;
    expect(opId1).not.toBe(opId2);
  });

  it("updateNutritionPlan should generate new operationId per call", async () => {
    const functions = createMockFunctions();
    const mockCallable = vi.fn().mockResolvedValue(
      mockCallableSuccess({
        success: true,
        planId: "plan-1",
        status: "active",
        revision: 2,
        wasNoOp: false,
      })
    );
    mockHttpsCallable.mockReturnValue(mockCallable);

    const command: UpdateNutritionPlanCommand = {
      dogId: "dog-1",
      planId: "plan-1",
      expectedRevision: 1,
      changes: { specialInstructions: "Updated" },
    };

    await updateNutritionPlan(functions, command);
    await updateNutritionPlan(functions, command);

    expect(mockCallable).toHaveBeenCalledTimes(2);
    const calls = mockCallable.mock.calls;
    expect(calls[0][0].operationId).not.toBe(calls[1][0].operationId);
  });

  it("cancelNutritionPlan should generate new operationId per call", async () => {
    const functions = createMockFunctions();
    const mockCallable = vi.fn().mockResolvedValue(
      mockCallableSuccess({
        success: true,
        planId: "plan-1",
        status: "cancelled",
        revision: 3,
        wasNoOp: false,
      })
    );
    mockHttpsCallable.mockReturnValue(mockCallable);

    const command: CancelNutritionPlanCommand = {
      dogId: "dog-1",
      planId: "plan-1",
      expectedRevision: 2,
      reason: "Reason",
    };

    await cancelNutritionPlan(functions, command);
    await cancelNutritionPlan(functions, command);

    expect(mockCallable).toHaveBeenCalledTimes(2);
    const calls = mockCallable.mock.calls;
    expect(calls[0][0].operationId).not.toBe(calls[1][0].operationId);
  });
});
