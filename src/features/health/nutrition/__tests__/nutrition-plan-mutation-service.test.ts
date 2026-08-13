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
  // Uncertain-outcome predicate (WEB-01B.6R)
  isPotentiallyCommittedOutcome,
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
  CancelNutritionPlanCommand,
  CreateNutritionPlanCommand,
  HealthDocumentRef,
  ProfessionalIdentity,
  UpdateNutritionPlanCommand,
} from "../mutation-types";

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

  // The backend stores the ORIGINAL result in the receipt and returns it
  // verbatim on replay (engine 1157 / 1106), so a replayed UPDATE reports the
  // revision the first attempt wrote: expectedRevision + 1. A replay that
  // echoed expectedRevision unchanged would be uncorrelatable — it would
  // describe a write that never advanced the document.
  it("should handle replay response with wasNoOp true", async () => {
    const functions = createMockFunctions();
    const mockCallable = vi.fn().mockResolvedValue(
      mockCallableSuccess({
        success: true,
        planId: "plan-123",
        status: "active",
        revision: 4,
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

  // Same receipt-replay reasoning as UPDATE: the stored result carries the
  // revision the original CANCEL wrote (expectedRevision + 1), not the
  // pre-cancel revision.
  it("should handle replay response with wasNoOp true", async () => {
    const functions = createMockFunctions();
    const mockCallable = vi.fn().mockResolvedValue(
      mockCallableSuccess({
        success: true,
        planId: "plan-123",
        status: "cancelled",
        revision: 6,
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

  it("should normalize the Firebase SDK functions/unavailable code as retryable", () => {
    const error = mockCallableError("functions/unavailable", "Service down");

    const normalized = normalizeNutritionMutationError(error);

    expect(normalized.firebaseCode).toBe("unavailable");
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

  // Adapted in WEB-01B.3: the source version used "plan-not-found" as the
  // example of an UNRECOGNIZED code. WEB-01B.0R1 deliberately added
  // plan-not-found to the supported domain codes, so it is now mapped. The
  // behaviour under test (unrecognized code kept in details, domainCode left
  // undefined) is preserved using a code the contract genuinely does not know.
  it("should preserve unknown domain codes in details", () => {
    const error = mockCallableError(
      "failed-precondition",
      "Error",
      { code: "some-code-the-contract-does-not-know", message: "Unmapped" }
    );

    const normalized = normalizeNutritionMutationError(error);

    expect(normalized.firebaseCode).toBe("failed-precondition");
    expect(normalized.domainCode).toBeUndefined(); // Unknown code preserved in details
    expect(normalized.details?.code).toBe("some-code-the-contract-does-not-know");
  });

  // Guards the R1 addition itself: plan-not-found must be RECOGNIZED, so a
  // future regression that drops it from mapDomainCode fails here.
  it("should map plan-not-found as a recognized domain code (WEB-01B.0R1)", () => {
    const error = mockCallableError(
      "failed-precondition",
      "Error",
      { code: "plan-not-found", message: "Plan not found" }
    );

    const normalized = normalizeNutritionMutationError(error);

    expect(normalized.domainCode).toBe("plan-not-found");
    expect(normalized.retryable).toBe(false);
  });

  it("should normalize backend revision-conflict to revision-conflict", () => {
    // Backend emits "revision-conflict"
    const error = mockCallableError(
      "failed-precondition",
      "Revision mismatch",
      { code: "revision-conflict", message: "Stale revision" }
    );

    const normalized = normalizeNutritionMutationError(error);

    expect(normalized.firebaseCode).toBe("failed-precondition");
    expect(normalized.domainCode).toBe("revision-conflict");
    expect(normalized.details?.code).toBe("revision-conflict");
    expect(normalized.retryable).toBe(false);
  });

  it("should normalize backend integrity-conflict to integrity-conflict", () => {
    // Backend emits "integrity-conflict"
    const error = mockCallableError(
      "failed-precondition",
      "Concurrent modification",
      { code: "integrity-conflict", message: "Multiple active plans" }
    );

    const normalized = normalizeNutritionMutationError(error);

    expect(normalized.firebaseCode).toBe("failed-precondition");
    expect(normalized.domainCode).toBe("integrity-conflict");
    expect(normalized.details?.code).toBe("integrity-conflict");
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
    expect(normalized.domainCode).toBe("idempotency-conflict");
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
// TESTS: STRUCTURALLY INVALID SUCCESS PAYLOADS (WEB-01B.3 review hardening)
// =============================================================================

/**
 * `success: true` alone must not be accepted. planId and revision are identity
 * fields the caller acts on: revision becomes the expectedRevision of the next
 * UPDATE/CANCEL, so a fabricated default would either cause a spurious
 * revision-conflict or target the wrong revision.
 */
describe("Invalid success payloads fail closed", () => {
  const createCommand: CreateNutritionPlanCommand = {
    dogId: "dog-1",
    planData: {
      foodType: "Ração",
      amountGramsPerDay: 500,
      mealsPerDay: 3,
      timezone: "UTC",
      validFrom: "2026-08-12T00:00:00.000Z",
      mealSchedule: [],
    },
  };

  const updateCommand: UpdateNutritionPlanCommand = {
    dogId: "dog-1",
    planId: "plan-1",
    expectedRevision: 2,
    changes: { specialInstructions: "x" },
  };

  const cancelCommand: CancelNutritionPlanCommand = {
    dogId: "dog-1",
    planId: "plan-1",
    expectedRevision: 2,
    reason: "motivo",
  };

  const invalidPayloads: Array<[string, Record<string, unknown>]> = [
    ["bare success with no domain fields", { success: true }],
    ["missing planId", { success: true, status: "active", revision: 1 }],
    ["empty planId", { success: true, planId: "   ", status: "active", revision: 1 }],
    ["missing revision", { success: true, planId: "plan-1", status: "active" }],
    [
      "non-numeric revision",
      { success: true, planId: "plan-1", status: "active", revision: "2" },
    ],
    [
      "non-integer revision",
      { success: true, planId: "plan-1", status: "active", revision: 1.5 },
    ],
    ["missing status", { success: true, planId: "plan-1", revision: 1 }],
  ];

  for (const [label, data] of invalidPayloads) {
    it(`CREATE rejects ${label}`, async () => {
      mockHttpsCallable.mockReturnValue(vi.fn().mockResolvedValue({ data }));
      const request = buildCreateNutritionPlanRequest(createCommand, "op-invalid");

      await expect(
        executeCreateNutritionPlan(createMockFunctions(), request)
      ).rejects.toMatchObject({
        firebaseCode: "internal",
        retryable: false,
        details: { code: "invalid-mutation-response" },
      });
    });
  }

  it("UPDATE rejects a bare success payload", async () => {
    mockHttpsCallable.mockReturnValue(
      vi.fn().mockResolvedValue({ data: { success: true } })
    );
    const request = buildUpdateNutritionPlanRequest(updateCommand, "op-invalid-u");

    await expect(
      executeUpdateNutritionPlan(createMockFunctions(), request)
    ).rejects.toMatchObject({ details: { code: "invalid-mutation-response" } });
  });

  it("CANCEL rejects a bare success payload", async () => {
    mockHttpsCallable.mockReturnValue(
      vi.fn().mockResolvedValue({ data: { success: true } })
    );
    const request = buildCancelNutritionPlanRequest(cancelCommand, "op-invalid-c");

    await expect(
      executeCancelNutritionPlan(createMockFunctions(), request)
    ).rejects.toMatchObject({ details: { code: "invalid-mutation-response" } });
  });

  it("never fabricates a revision the backend did not send", async () => {
    mockHttpsCallable.mockReturnValue(
      vi.fn().mockResolvedValue({ data: { success: true, planId: "plan-1", status: "active" } })
    );
    const request = buildCreateNutritionPlanRequest(createCommand, "op-no-rev");

    // Before the hardening this resolved with revision: 1 (fabricated).
    await expect(
      executeCreateNutritionPlan(createMockFunctions(), request)
    ).rejects.toMatchObject({ details: { code: "invalid-mutation-response" } });
  });

  /**
   * WEB-01B.6R replaces the former "accepts revision 0 as a legitimate value".
   *
   * The generic shape gate still treats 0 as a well-typed integer — that part is
   * unchanged. What changed is that CREATE now also has to correlate: a plan is
   * BORN at revision 1 (engine 1654) and `planRevision` rejects anything below 1
   * (engine 1515), so revision 0 cannot describe a plan the backend just created.
   * The old test asserted the absence of a check rather than a contract, so it is
   * inverted here instead of loosening the service to keep it green.
   */
  it("CREATE rejects revision 0 — a new plan is born at revision 1", async () => {
    mockHttpsCallable.mockReturnValue(
      vi.fn().mockResolvedValue({
        data: { success: true, planId: "plan-1", status: "active", revision: 0, wasNoOp: false },
      })
    );
    const request = buildCreateNutritionPlanRequest(createCommand, "op-rev-zero");

    await expect(
      executeCreateNutritionPlan(createMockFunctions(), request)
    ).rejects.toMatchObject({
      firebaseCode: "internal",
      retryable: false,
      details: { code: "invalid-mutation-response" },
    });
  });

  it("still accepts a valid payload that omits only wasNoOp/supersededPlanId", async () => {
    mockHttpsCallable.mockReturnValue(
      vi.fn().mockResolvedValue({
        // revision 1: the only revision a freshly created plan can carry.
        data: { success: true, planId: "plan-1", status: "active", revision: 1 },
      })
    );
    const request = buildCreateNutritionPlanRequest(createCommand, "op-optional");

    const result = await executeCreateNutritionPlan(createMockFunctions(), request);
    expect(result.planId).toBe("plan-1");
    expect(result.revision).toBe(1);
    expect(result.wasNoOp).toBe(false);
    expect(result.supersededPlanId).toBeNull();
  });

  it("preserves a precise domain error instead of flattening it to unknown", async () => {
    const conflict = new Error("Stale revision") as Error & {
      code: string;
      details?: Record<string, unknown>;
    };
    conflict.code = "failed-precondition";
    conflict.details = { code: "revision-conflict" };
    mockHttpsCallable.mockReturnValue(vi.fn().mockRejectedValue(conflict));

    const request = buildUpdateNutritionPlanRequest(updateCommand, "op-conflict");

    await expect(
      executeUpdateNutritionPlan(createMockFunctions(), request)
    ).rejects.toMatchObject({
      firebaseCode: "failed-precondition",
      domainCode: "revision-conflict",
    });
  });
});

// =============================================================================
// TESTS: RESPONSE CORRELATION (WEB-01B.6R)
// =============================================================================

/**
 * Shape validity is not correlation. Every payload below is well-typed and
 * carries `success: true` — what separates the accepted cases from the rejected
 * ones is whether the response describes the operation this request asked for.
 *
 * Backend contract audited at canil-gcm @ feature/health-v1-foundation:
 * - CREATE/REPLACE write status "active" and revision 1 (engine 1654/1661/1662)
 * - REPLACE reports the plan it superseded, which the transaction already forced
 *   to equal expectedActivePlanId (engine 1612, 1641/1664)
 * - UPDATE/CANCEL write exactly currentRevision + 1, and current is forced to
 *   equal expectedRevision (engine 1533, 1722, 1758-1760)
 * - CANCEL writes the terminal status "cancelled" (engine 1760)
 *
 * A `wasNoOp: true` receipt replay is held to the SAME checks on purpose: the
 * receipt stores the original result verbatim (engine 1157) and replay only
 * returns it after re-asserting intent + expectation pair (engine 1096-1102), so
 * a legitimate replay is indistinguishable from the first success here.
 */
describe("Response correlation (WEB-01B.6R)", () => {
  const correlationCreateCommand: CreateNutritionPlanCommand = {
    dogId: "dog-100",
    planData: {
      foodType: "Ração Natural",
      amountGramsPerDay: 400,
      mealsPerDay: 2,
      timezone: "America/Sao_Paulo",
      validFrom: "2026-08-01T00:00:00.000Z",
      mealSchedule: [],
    },
  };

  const correlationReplaceCommand: CreateNutritionPlanCommand = {
    ...correlationCreateCommand,
    expectedActivePlanId: "plan-old",
    expectedActiveRevision: 3,
  };

  const correlationUpdateCommand: UpdateNutritionPlanCommand = {
    dogId: "dog-100",
    planId: "plan-active",
    expectedRevision: 5,
    changes: { specialInstructions: "Servir morno" },
  };

  const correlationCancelCommand: CancelNutritionPlanCommand = {
    dogId: "dog-100",
    planId: "plan-active",
    expectedRevision: 5,
    reason: "Dieta substituída por prescrição veterinária",
  };

  function respondWith(data: Record<string, unknown>) {
    mockHttpsCallable.mockReturnValue(vi.fn().mockResolvedValue(mockCallableSuccess(data)));
  }

  const INVALID_RESPONSE = {
    firebaseCode: "internal",
    retryable: false,
    details: { code: "invalid-mutation-response" },
  };

  describe("CREATE", () => {
    it("accepts the only response a CREATE can legitimately produce", async () => {
      respondWith({
        success: true,
        planId: "plan-new",
        status: "active",
        revision: 1,
        supersededPlanId: null,
        wasNoOp: false,
      });

      const request = buildCreateNutritionPlanRequest(correlationCreateCommand, "op-corr-c-ok");
      const result = await executeCreateNutritionPlan(createMockFunctions(), request);

      expect(result).toEqual({
        success: true,
        planId: "plan-new",
        status: "active",
        revision: 1,
        supersededPlanId: null,
        wasNoOp: false,
      });
    });

    it("accepts a legitimate wasNoOp receipt replay", async () => {
      respondWith({
        success: true,
        planId: "plan-new",
        status: "active",
        revision: 1,
        supersededPlanId: null,
        wasNoOp: true,
      });

      const request = buildCreateNutritionPlanRequest(correlationCreateCommand, "op-corr-c-replay");
      const result = await executeCreateNutritionPlan(createMockFunctions(), request);

      expect(result.wasNoOp).toBe(true);
      expect(result.planId).toBe("plan-new");
      expect(result.revision).toBe(1);
    });

    it("rejects a status other than active", async () => {
      respondWith({ success: true, planId: "plan-new", status: "cancelled", revision: 1 });

      const request = buildCreateNutritionPlanRequest(correlationCreateCommand, "op-corr-c-status");

      await expect(
        executeCreateNutritionPlan(createMockFunctions(), request)
      ).rejects.toMatchObject(INVALID_RESPONSE);
    });

    it("rejects a revision other than 1", async () => {
      respondWith({ success: true, planId: "plan-new", status: "active", revision: 2 });

      const request = buildCreateNutritionPlanRequest(correlationCreateCommand, "op-corr-c-rev");

      await expect(
        executeCreateNutritionPlan(createMockFunctions(), request)
      ).rejects.toMatchObject(INVALID_RESPONSE);
    });

    it("rejects a non-null supersededPlanId — a plain CREATE supersedes nothing", async () => {
      respondWith({
        success: true,
        planId: "plan-new",
        status: "active",
        revision: 1,
        supersededPlanId: "plan-nobody-asked-about",
      });

      const request = buildCreateNutritionPlanRequest(
        correlationCreateCommand,
        "op-corr-c-superseded"
      );

      await expect(
        executeCreateNutritionPlan(createMockFunctions(), request)
      ).rejects.toMatchObject(INVALID_RESPONSE);
    });
  });

  describe("REPLACE", () => {
    it("accepts a response that supersedes exactly the named plan", async () => {
      respondWith({
        success: true,
        planId: "plan-new",
        status: "active",
        revision: 1,
        supersededPlanId: "plan-old",
        wasNoOp: false,
      });

      const request = buildCreateNutritionPlanRequest(correlationReplaceCommand, "op-corr-r-ok");
      const result = await executeCreateNutritionPlan(createMockFunctions(), request);

      expect(result).toEqual({
        success: true,
        planId: "plan-new",
        status: "active",
        revision: 1,
        supersededPlanId: "plan-old",
        wasNoOp: false,
      });
    });

    it("accepts a legitimate wasNoOp receipt replay", async () => {
      respondWith({
        success: true,
        planId: "plan-new",
        status: "active",
        revision: 1,
        supersededPlanId: "plan-old",
        wasNoOp: true,
      });

      const request = buildCreateNutritionPlanRequest(correlationReplaceCommand, "op-corr-r-replay");
      const result = await executeCreateNutritionPlan(createMockFunctions(), request);

      expect(result.wasNoOp).toBe(true);
      expect(result.supersededPlanId).toBe("plan-old");
    });

    it("rejects a missing supersededPlanId", async () => {
      respondWith({ success: true, planId: "plan-new", status: "active", revision: 1 });

      const request = buildCreateNutritionPlanRequest(
        correlationReplaceCommand,
        "op-corr-r-missing"
      );

      await expect(
        executeCreateNutritionPlan(createMockFunctions(), request)
      ).rejects.toMatchObject(INVALID_RESPONSE);
    });

    it("rejects a null supersededPlanId", async () => {
      respondWith({
        success: true,
        planId: "plan-new",
        status: "active",
        revision: 1,
        supersededPlanId: null,
      });

      const request = buildCreateNutritionPlanRequest(correlationReplaceCommand, "op-corr-r-null");

      await expect(
        executeCreateNutritionPlan(createMockFunctions(), request)
      ).rejects.toMatchObject(INVALID_RESPONSE);
    });

    it("rejects a supersededPlanId that is not the plan the client named", async () => {
      respondWith({
        success: true,
        planId: "plan-new",
        status: "active",
        revision: 1,
        supersededPlanId: "plan-someone-else",
      });

      const request = buildCreateNutritionPlanRequest(
        correlationReplaceCommand,
        "op-corr-r-mismatch"
      );

      await expect(
        executeCreateNutritionPlan(createMockFunctions(), request)
      ).rejects.toMatchObject(INVALID_RESPONSE);
    });

    it("rejects the superseded id being returned as the new planId", async () => {
      // REPLACE mints a NEW document; the new plan can never be the old one.
      respondWith({
        success: true,
        planId: "plan-old",
        status: "active",
        revision: 1,
        supersededPlanId: "plan-old",
      });

      const request = buildCreateNutritionPlanRequest(correlationReplaceCommand, "op-corr-r-same");

      await expect(
        executeCreateNutritionPlan(createMockFunctions(), request)
      ).rejects.toMatchObject(INVALID_RESPONSE);
    });

    it("rejects a revision other than 1 — the new plan is still newborn", async () => {
      // The motivating case: shape-valid, but semantically impossible.
      respondWith({
        success: true,
        planId: "plan-new",
        status: "active",
        revision: 27,
        supersededPlanId: "plan-old",
      });

      const request = buildCreateNutritionPlanRequest(correlationReplaceCommand, "op-corr-r-rev");

      await expect(
        executeCreateNutritionPlan(createMockFunctions(), request)
      ).rejects.toMatchObject(INVALID_RESPONSE);
    });
  });

  describe("UPDATE", () => {
    it("accepts a response landing exactly one revision ahead", async () => {
      respondWith({
        success: true,
        planId: "plan-active",
        status: "active",
        revision: 6,
        wasNoOp: false,
      });

      const request = buildUpdateNutritionPlanRequest(correlationUpdateCommand, "op-corr-u-ok");
      const result = await executeUpdateNutritionPlan(createMockFunctions(), request);

      expect(result).toEqual({
        success: true,
        planId: "plan-active",
        status: "active",
        revision: 6,
        wasNoOp: false,
      });
    });

    it("accepts a legitimate wasNoOp receipt replay", async () => {
      respondWith({
        success: true,
        planId: "plan-active",
        status: "active",
        revision: 6,
        wasNoOp: true,
      });

      const request = buildUpdateNutritionPlanRequest(correlationUpdateCommand, "op-corr-u-replay");
      const result = await executeUpdateNutritionPlan(createMockFunctions(), request);

      expect(result.wasNoOp).toBe(true);
      expect(result.revision).toBe(6);
    });

    it("rejects a planId other than the one requested", async () => {
      respondWith({ success: true, planId: "plan-other", status: "active", revision: 6 });

      const request = buildUpdateNutritionPlanRequest(correlationUpdateCommand, "op-corr-u-planid");

      await expect(
        executeUpdateNutritionPlan(createMockFunctions(), request)
      ).rejects.toMatchObject(INVALID_RESPONSE);
    });

    it("rejects a status other than active — UPDATE does not end a plan", async () => {
      respondWith({ success: true, planId: "plan-active", status: "cancelled", revision: 6 });

      const request = buildUpdateNutritionPlanRequest(correlationUpdateCommand, "op-corr-u-status");

      await expect(
        executeUpdateNutritionPlan(createMockFunctions(), request)
      ).rejects.toMatchObject(INVALID_RESPONSE);
    });

    it("rejects a revision that did not advance", async () => {
      respondWith({ success: true, planId: "plan-active", status: "active", revision: 5 });

      const request = buildUpdateNutritionPlanRequest(correlationUpdateCommand, "op-corr-u-stale");

      await expect(
        executeUpdateNutritionPlan(createMockFunctions(), request)
      ).rejects.toMatchObject(INVALID_RESPONSE);
    });

    it("rejects a revision that advanced by more than one", async () => {
      // Monotonic is not enough: the backend writes expectedRevision + 1 exactly,
      // so a jump means the response describes some other write.
      respondWith({ success: true, planId: "plan-active", status: "active", revision: 9 });

      const request = buildUpdateNutritionPlanRequest(correlationUpdateCommand, "op-corr-u-jump");

      await expect(
        executeUpdateNutritionPlan(createMockFunctions(), request)
      ).rejects.toMatchObject(INVALID_RESPONSE);
    });
  });

  describe("CANCEL", () => {
    it("accepts a terminal response landing exactly one revision ahead", async () => {
      respondWith({
        success: true,
        planId: "plan-active",
        status: "cancelled",
        revision: 6,
        wasNoOp: false,
      });

      const request = buildCancelNutritionPlanRequest(correlationCancelCommand, "op-corr-x-ok");
      const result = await executeCancelNutritionPlan(createMockFunctions(), request);

      expect(result).toEqual({
        success: true,
        planId: "plan-active",
        status: "cancelled",
        revision: 6,
        wasNoOp: false,
      });
    });

    it("accepts a legitimate wasNoOp receipt replay", async () => {
      respondWith({
        success: true,
        planId: "plan-active",
        status: "cancelled",
        revision: 6,
        wasNoOp: true,
      });

      const request = buildCancelNutritionPlanRequest(correlationCancelCommand, "op-corr-x-replay");
      const result = await executeCancelNutritionPlan(createMockFunctions(), request);

      expect(result.wasNoOp).toBe(true);
      expect(result.status).toBe("cancelled");
    });

    it("rejects a planId other than the one requested", async () => {
      respondWith({ success: true, planId: "plan-other", status: "cancelled", revision: 6 });

      const request = buildCancelNutritionPlanRequest(correlationCancelCommand, "op-corr-x-planid");

      await expect(
        executeCancelNutritionPlan(createMockFunctions(), request)
      ).rejects.toMatchObject(INVALID_RESPONSE);
    });

    it("rejects a still-active status — a cancellation that did not happen", async () => {
      respondWith({ success: true, planId: "plan-active", status: "active", revision: 6 });

      const request = buildCancelNutritionPlanRequest(correlationCancelCommand, "op-corr-x-status");

      await expect(
        executeCancelNutritionPlan(createMockFunctions(), request)
      ).rejects.toMatchObject(INVALID_RESPONSE);
    });

    it("rejects a revision that did not advance", async () => {
      respondWith({ success: true, planId: "plan-active", status: "cancelled", revision: 5 });

      const request = buildCancelNutritionPlanRequest(correlationCancelCommand, "op-corr-x-stale");

      await expect(
        executeCancelNutritionPlan(createMockFunctions(), request)
      ).rejects.toMatchObject(INVALID_RESPONSE);
    });

    it("rejects a revision that advanced by more than one", async () => {
      respondWith({ success: true, planId: "plan-active", status: "cancelled", revision: 9 });

      const request = buildCancelNutritionPlanRequest(correlationCancelCommand, "op-corr-x-jump");

      await expect(
        executeCancelNutritionPlan(createMockFunctions(), request)
      ).rejects.toMatchObject(INVALID_RESPONSE);
    });
  });

  describe("error surface", () => {
    it("never leaks the raw response into the operator-facing message", async () => {
      respondWith({
        success: true,
        planId: "plan-secret-id",
        status: "active",
        revision: 27,
        supersededPlanId: "plan-old",
      });

      const request = buildCreateNutritionPlanRequest(correlationReplaceCommand, "op-corr-leak");

      await expect(
        executeCreateNutritionPlan(createMockFunctions(), request)
      ).rejects.toMatchObject({
        message: "Falha ao criar plano nutricional",
        retryable: false,
      });
    });

    it("is not retryable — the mutation may already be persisted", async () => {
      respondWith({ success: true, planId: "plan-active", status: "active", revision: 99 });

      const request = buildUpdateNutritionPlanRequest(correlationUpdateCommand, "op-corr-noretry");

      await expect(
        executeUpdateNutritionPlan(createMockFunctions(), request)
      ).rejects.toMatchObject({ retryable: false });
    });
  });

  /**
   * `planResponse` transmits `supersededPlanId` on EVERY plan callable, filling it
   * with `?? null` (callables 281). On the UPDATE and CANCEL paths the engine
   * result carries no such field at all (engine 1732, 1768), so the value is
   * contractually null.
   *
   * A non-null value there is not a harmless extra: it claims the operation ended
   * some other plan's life. Ignoring a semantically impossible field is how a
   * backend regression reaches the operator as a normal success.
   */
  describe("UPDATE/CANCEL reject a non-null supersededPlanId", () => {
    it("accepts UPDATE with supersededPlanId explicitly null", async () => {
      respondWith({
        success: true,
        planId: "plan-active",
        status: "active",
        revision: 6,
        supersededPlanId: null,
      });

      const request = buildUpdateNutritionPlanRequest(correlationUpdateCommand, "op-sup-u-ok");
      const result = await executeUpdateNutritionPlan(createMockFunctions(), request);

      expect(result.revision).toBe(6);
      expect(result.planId).toBe("plan-active");
    });

    it("rejects UPDATE reporting a superseded plan", async () => {
      respondWith({
        success: true,
        planId: "plan-active",
        status: "active",
        revision: 6,
        supersededPlanId: "plan-somebody-else",
      });

      const request = buildUpdateNutritionPlanRequest(correlationUpdateCommand, "op-sup-u-bad");

      await expect(
        executeUpdateNutritionPlan(createMockFunctions(), request)
      ).rejects.toMatchObject(INVALID_RESPONSE);
    });

    it("accepts CANCEL with supersededPlanId explicitly null", async () => {
      respondWith({
        success: true,
        planId: "plan-active",
        status: "cancelled",
        revision: 6,
        supersededPlanId: null,
      });

      const request = buildCancelNutritionPlanRequest(correlationCancelCommand, "op-sup-x-ok");
      const result = await executeCancelNutritionPlan(createMockFunctions(), request);

      expect(result.status).toBe("cancelled");
      expect(result.revision).toBe(6);
    });

    it("rejects CANCEL reporting a superseded plan", async () => {
      respondWith({
        success: true,
        planId: "plan-active",
        status: "cancelled",
        revision: 6,
        supersededPlanId: "plan-somebody-else",
      });

      const request = buildCancelNutritionPlanRequest(correlationCancelCommand, "op-sup-x-bad");

      await expect(
        executeCancelNutritionPlan(createMockFunctions(), request)
      ).rejects.toMatchObject(INVALID_RESPONSE);
    });
  });

  /**
   * `wasNoOp` and `supersededPlanId` stay optional — the backend omits them where
   * they do not apply. Optional is not untyped, though: a truthy string `wasNoOp`
   * would read as a replay, and a non-string `supersededPlanId` would slip past
   * the REPLACE comparison. Neither is coerced.
   */
  describe("optional field shape", () => {
    it("rejects a non-boolean wasNoOp", async () => {
      respondWith({
        success: true,
        planId: "plan-new",
        status: "active",
        revision: 1,
        supersededPlanId: null,
        wasNoOp: "true",
      });

      const request = buildCreateNutritionPlanRequest(correlationCreateCommand, "op-shape-noop");

      await expect(
        executeCreateNutritionPlan(createMockFunctions(), request)
      ).rejects.toMatchObject(INVALID_RESPONSE);
    });

    it("rejects an empty-string supersededPlanId", async () => {
      respondWith({
        success: true,
        planId: "plan-new",
        status: "active",
        revision: 1,
        supersededPlanId: "   ",
      });

      const request = buildCreateNutritionPlanRequest(correlationReplaceCommand, "op-shape-blank");

      await expect(
        executeCreateNutritionPlan(createMockFunctions(), request)
      ).rejects.toMatchObject(INVALID_RESPONSE);
    });

    it("rejects a non-string supersededPlanId instead of coercing it", async () => {
      respondWith({
        success: true,
        planId: "plan-new",
        status: "active",
        revision: 1,
        supersededPlanId: 42,
      });

      const request = buildCreateNutritionPlanRequest(correlationReplaceCommand, "op-shape-number");

      await expect(
        executeCreateNutritionPlan(createMockFunctions(), request)
      ).rejects.toMatchObject(INVALID_RESPONSE);
    });
  });

  /**
   * The predicate the presentation layer keys its reconciliation latches on.
   *
   * Its whole value is being NARROW: `invalid-mutation-response` is the only
   * failure raised past the `success: true` gate, so it is the only one where
   * "failed" does not imply "did not happen". Widening it to `internal` or
   * `internal-integrity-error` would freeze the UI after operations the backend
   * demonstrably refused.
   */
  describe("isPotentiallyCommittedOutcome", () => {
    it("recognizes a correlation failure raised after success:true", async () => {
      respondWith({ success: true, planId: "plan-active", status: "active", revision: 42 });

      const request = buildUpdateNutritionPlanRequest(correlationUpdateCommand, "op-pred-corr");

      const error = await executeUpdateNutritionPlan(createMockFunctions(), request).catch(
        (err: unknown) => err
      );

      expect(isPotentiallyCommittedOutcome(error)).toBe(true);
    });

    it("recognizes a shape failure raised after success:true", async () => {
      // The backend already committed to success; we just cannot read the result.
      respondWith({ success: true, planId: "plan-active", status: "active" });

      const request = buildUpdateNutritionPlanRequest(correlationUpdateCommand, "op-pred-shape");

      const error = await executeUpdateNutritionPlan(createMockFunctions(), request).catch(
        (err: unknown) => err
      );

      expect(isPotentiallyCommittedOutcome(error)).toBe(true);
    });

    it("does not recognize a backend rejection — the mutation never landed", async () => {
      mockHttpsCallable.mockReturnValue(
        vi
          .fn()
          .mockRejectedValue(
            mockCallableError("failed-precondition", "Revision desatualizada.", {
              code: "revision-conflict",
            })
          )
      );

      const request = buildUpdateNutritionPlanRequest(correlationUpdateCommand, "op-pred-conflict");

      const error = await executeUpdateNutritionPlan(createMockFunctions(), request).catch(
        (err: unknown) => err
      );

      expect(isPotentiallyCommittedOutcome(error)).toBe(false);
    });

    it("does not recognize permission-denied", async () => {
      mockHttpsCallable.mockReturnValue(
        vi.fn().mockRejectedValue(mockCallableError("permission-denied", "Sem permissão."))
      );

      const request = buildUpdateNutritionPlanRequest(correlationUpdateCommand, "op-pred-perm");

      const error = await executeUpdateNutritionPlan(createMockFunctions(), request).catch(
        (err: unknown) => err
      );

      expect(isPotentiallyCommittedOutcome(error)).toBe(false);
    });

    it("does not recognize a bare internal error with no details", async () => {
      mockHttpsCallable.mockReturnValue(
        vi.fn().mockRejectedValue(mockCallableError("internal", "Erro interno."))
      );

      const request = buildUpdateNutritionPlanRequest(correlationUpdateCommand, "op-pred-internal");

      const error = await executeUpdateNutritionPlan(createMockFunctions(), request).catch(
        (err: unknown) => err
      );

      expect(isPotentiallyCommittedOutcome(error)).toBe(false);
    });

    it("does not recognize non-error values", () => {
      expect(isPotentiallyCommittedOutcome(null)).toBe(false);
      expect(isPotentiallyCommittedOutcome(undefined)).toBe(false);
      expect(isPotentiallyCommittedOutcome("invalid-mutation-response")).toBe(false);
      expect(isPotentiallyCommittedOutcome({ details: null })).toBe(false);
      expect(isPotentiallyCommittedOutcome({ details: {} })).toBe(false);
    });
  });
});
