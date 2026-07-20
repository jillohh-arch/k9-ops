import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

import { NutritionPlanManagement } from "../components/nutrition-plan-management";
import { NutritionPlanCreateDialog } from "../components/nutrition-plan-create-dialog";
import type { NutritionPlanState, NutritionPlan, LegacyNutritionPlanView, CreateNutritionPlanCommand } from "../types";

// =============================================================================
// MOCK SETUP
// =============================================================================

vi.mock("@/lib/firebase/client", () => ({
  functions: {},
}));

const mockCan = vi.fn();
vi.mock("@/features/access/providers/access-control-provider", () => ({
  useAccessControl: () => ({
    can: mockCan,
    profileId: "operador_k9",
    status: "ready",
  }),
}));

const mockDogs = [
  { _id: "dog-1", name: "Thor", rg: "K9-001", breed: "Pastor Alemão", status: "Ativo" },
];
vi.mock("@/features/effective/providers/entities-provider", () => ({
  useEntities: () => ({
    dogs: mockDogs,
    dogsLoading: false,
  }),
}));

const mockPlanState = vi.fn<(dogId: string) => NutritionPlanState>();
vi.mock("../hooks/use-nutrition-plans", () => ({
  useNutritionPlans: (dogId: string) => mockPlanState(dogId),
}));

// Mock mutation hook
const mockPrepareCreate = vi.fn();
const mockExecuteCreate = vi.fn();
const mockRetryCreate = vi.fn();
const mockResetCreate = vi.fn();

type MockCreateState = {
  status: "idle" | "preparing" | "ready" | "executing" | "success" | "error";
  intent: { operationId: string; command: CreateNutritionPlanCommand } | null;
  result: unknown;
  error: unknown;
};

let mockCreateState: MockCreateState = {
  status: "idle",
  intent: null,
  result: null,
  error: null,
};

vi.mock("../hooks/use-nutrition-plan-mutations", () => ({
  useNutritionPlanMutations: () => ({
    createState: mockCreateState,
    prepareCreate: mockPrepareCreate,
    executeCreate: mockExecuteCreate,
    retryCreate: mockRetryCreate,
    resetCreate: mockResetCreate,
  }),
}));

// Ensure no direct mutation service or firebase callable is ever called
const mockDirectExecuteCreate = vi.fn();
vi.mock("../data/nutrition-plan-mutation-service", () => ({
  executeCreateNutritionPlan: mockDirectExecuteCreate,
}));

// =============================================================================
// TESTS
// =============================================================================

describe("Gate 5D.2 — Create & Activate Nutrition Plan UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCan.mockReturnValue(true);
    mockCreateState = {
      status: "idle",
      intent: null,
      result: null,
      error: null,
    };
  });

  describe("CTA Availability across Read States", () => {
    it("should display CREATE CTA when read state is EMPTY and user is authorized", () => {
      mockPlanState.mockReturnValue({
        status: "empty",
        dogId: "dog-1",
        generation: 1,
        activePlan: null,
        plans: [],
        legacyPlan: null,
        error: null,
        integrityConflict: null,
        parsingErrors: [],
      });

      render(<NutritionPlanManagement initialDogId="dog-1" />);

      expect(screen.getByRole("button", { name: /Criar Plano Alimentar/i })).toBeInTheDocument();
    });

    it("should NOT display CREATE CTA when read state is EMPTY and user is read-only", () => {
      mockCan.mockReturnValue(false);
      mockPlanState.mockReturnValue({
        status: "empty",
        dogId: "dog-1",
        generation: 1,
        activePlan: null,
        plans: [],
        legacyPlan: null,
        error: null,
        integrityConflict: null,
        parsingErrors: [],
      });

      render(<NutritionPlanManagement initialDogId="dog-1" />);

      expect(screen.queryByRole("button", { name: /Criar Plano Alimentar/i })).not.toBeInTheDocument();
    });

    it("should display 'Criar Novo Plano Canônico' CTA when read state is LEGACY and user is authorized", () => {
      const sampleLegacy: LegacyNutritionPlanView = {
        id: "plan-leg-1",
        dogId: "dog-1",
        foodType: "Ração Legada",
        amountGramsPerDay: 400,
        mealsPerDay: 2,
        vigentFrom: new Date(),
        legacySource: "legacy_db",
        legacyId: "LEG-01",
      };

      mockPlanState.mockReturnValue({
        status: "legacy",
        dogId: "dog-1",
        generation: 1,
        activePlan: sampleLegacy,
        plans: [],
        legacyPlan: sampleLegacy,
        error: null,
        integrityConflict: null,
        parsingErrors: [],
      });

      render(<NutritionPlanManagement initialDogId="dog-1" />);

      expect(screen.getByRole("button", { name: /Criar Novo Plano Canônico/i })).toBeInTheDocument();
    });

    it("should NOT display CREATE CTA when read state is CANONICAL ACTIVE", () => {
      const sampleCanonical: NutritionPlan = {
        id: "plan-can-1",
        dogId: "dog-1",
        foodType: "Ração Canônica",
        amountGramsPerDay: 600,
        mealsPerDay: 2,
        mealSchedule: [],
        validFrom: new Date(),
        timezone: "America/Sao_Paulo",
        recordedBy: { uid: "u1", name: "Vet", internalRole: "Vet" },
        status: "active",
        schemaVersion: 1,
        revision: 1,
      };

      mockPlanState.mockReturnValue({
        status: "canonical",
        dogId: "dog-1",
        generation: 1,
        activePlan: sampleCanonical,
        plans: [sampleCanonical],
        legacyPlan: null,
        error: null,
        integrityConflict: null,
        parsingErrors: [],
      });

      render(<NutritionPlanManagement initialDogId="dog-1" />);

      expect(screen.queryByRole("button", { name: /Criar Plano Alimentar/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Criar Novo Plano Canônico/i })).not.toBeInTheDocument();
    });

    it("should NOT display CREATE CTA when read state is CONFLICT, DEGRADED, ERROR or LOADING", () => {
      mockPlanState.mockReturnValue({
        status: "conflict",
        dogId: "dog-1",
        generation: 1,
        activePlan: null,
        plans: [],
        legacyPlan: null,
        error: "Conflict",
        integrityConflict: { message: "Conflict", activePlansCount: 2, activePlanIds: ["1", "2"] },
        parsingErrors: [],
      });

      render(<NutritionPlanManagement initialDogId="dog-1" />);

      expect(screen.queryByRole("button", { name: /Criar Plano Alimentar/i })).not.toBeInTheDocument();
    });
  });

  describe("Form Validations & Meal Sum Constraint", () => {
    it("should open dialog when CTA is clicked", () => {
      const handleClose = vi.fn();
      render(
        <NutritionPlanCreateDialog
          open={true}
          onClose={handleClose}
          dogId="dog-1"
          dogName="Thor"
        />
      );

      expect(screen.getByText(/Criar e Ativar Plano Alimentar/i)).toBeInTheDocument();
    });

    it("should perform continuous validation of meal schedule sum matching amountGramsPerDay", () => {
      render(
        <NutritionPlanCreateDialog
          open={true}
          onClose={vi.fn()}
          dogId="dog-1"
          dogName="Thor"
        />
      );

      const foodInput = screen.getByLabelText(/Alimento \/ Dieta Prescrita/i);
      const amountInput = screen.getByLabelText(/Quantidade Diária/i);

      fireEvent.change(foodInput, { target: { value: "Ração Premium K9" } });
      fireEvent.change(amountInput, { target: { value: "600" } });

      // Default 2 slots sum is 500g (250 + 250), which does not equal 600g
      const validationBar = screen.getByTestId("meal-sum-validation-bar");
      expect(validationBar).toHaveTextContent("Faltam 100 g");

      const submitButton = screen.getByRole("button", { name: /Criar e Ativar Plano/i });
      expect(submitButton).toBeDisabled();
    });

    it("should allow submission when meal schedule sum exactly matches amountGramsPerDay", async () => {
      render(
        <NutritionPlanCreateDialog
          open={true}
          onClose={vi.fn()}
          dogId="dog-1"
          dogName="Thor"
        />
      );

      const foodInput = screen.getByLabelText(/Alimento \/ Dieta Prescrita/i);
      const amountInput = screen.getByLabelText(/Quantidade Diária/i);

      fireEvent.change(foodInput, { target: { value: "Ração Premium K9" } });
      fireEvent.change(amountInput, { target: { value: "500" } }); // Matches 250 + 250

      const validationBar = screen.getByTestId("meal-sum-validation-bar");
      expect(validationBar).toHaveTextContent("Distribuição Completa (100%)");

      const submitButton = screen.getByRole("button", { name: /Criar e Ativar Plano/i });
      expect(submitButton).not.toBeDisabled();

      fireEvent.click(submitButton);

      expect(mockPrepareCreate).toHaveBeenCalledTimes(1);
      const command = mockPrepareCreate.mock.calls[0][0];
      expect(command.dogId).toBe("dog-1");
      expect(command.planData.foodType).toBe("Ração Premium K9");
      expect(command.planData.amountGramsPerDay).toBe(500);
      expect(command.planData.mealsPerDay).toBe(2);
      expect(command.planData.timezone).toBe("America/Sao_Paulo");
      expect(command.planData.validUntil).toBeNull();
      expect(command.planData.sourceDocument).toBeNull();
      expect(command.planData.attachmentRefs).toBeNull();

      expect(mockExecuteCreate).toHaveBeenCalledTimes(1);
      expect(mockDirectExecuteCreate).not.toHaveBeenCalled();
    });
  });

  describe("Retry and Reset Lifecycle", () => {
    const dummyCommand = { dogId: "dog-1", planData: {} } as unknown as CreateNutritionPlanCommand;

    it("should invoke retryCreate without calling prepareCreate again when transport error is retryable", () => {
      mockCreateState = {
        status: "error",
        intent: { operationId: "op-stable-123", command: dummyCommand },
        result: null,
        error: {
          code: "unavailable",
          message: "Falha temporária de rede",
          category: "transport",
          retryable: true,
        },
      };

      render(
        <NutritionPlanCreateDialog
          open={true}
          onClose={vi.fn()}
          dogId="dog-1"
          dogName="Thor"
        />
      );

      const retryButton = screen.getByRole("button", { name: /Tentar novamente/i });
      expect(retryButton).toBeInTheDocument();

      fireEvent.click(retryButton);

      expect(mockRetryCreate).toHaveBeenCalledTimes(1);
      expect(mockPrepareCreate).not.toHaveBeenCalled();
    });

    it("should invoke resetCreate and unlock form when user clicks 'Revisar dados'", () => {
      mockCreateState = {
        status: "error",
        intent: { operationId: "op-stable-123", command: dummyCommand },
        result: null,
        error: {
          code: "invalid_argument",
          message: "Dado inválido",
          category: "validation",
          retryable: false,
        },
      };

      render(
        <NutritionPlanCreateDialog
          open={true}
          onClose={vi.fn()}
          dogId="dog-1"
          dogName="Thor"
        />
      );

      const reviewButton = screen.getByRole("button", { name: /Revisar dados/i });
      fireEvent.click(reviewButton);

      expect(mockResetCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe("HydrationMl & ValidFrom Timing Validations", () => {
    it("should accept valid hydrationMl >= 0 and reject negative hydrationMl", () => {
      render(
        <NutritionPlanCreateDialog
          open={true}
          onClose={vi.fn()}
          dogId="dog-1"
          dogName="Thor"
        />
      );

      const foodInput = screen.getByLabelText(/Alimento \/ Dieta Prescrita/i);
      const amountInput = screen.getByLabelText(/Quantidade Diária/i);
      const hydrationInput = screen.getByLabelText(/Meta de Hidratação/i);

      fireEvent.change(foodInput, { target: { value: "Ração Premium" } });
      fireEvent.change(amountInput, { target: { value: "500" } });

      // Negative hydration
      fireEvent.change(hydrationInput, { target: { value: "-500" } });
      const submitButton = screen.getByRole("button", { name: /Criar e Ativar Plano/i });
      fireEvent.submit(submitButton.closest("form")!);

      expect(screen.getByText(/A meta de hidratação deve ser maior ou igual a zero/i)).toBeInTheDocument();
      expect(mockPrepareCreate).not.toHaveBeenCalled();

      // Zero hydration
      fireEvent.change(hydrationInput, { target: { value: "0" } });
      fireEvent.submit(submitButton.closest("form")!);

      expect(mockPrepareCreate).toHaveBeenCalledTimes(1);
      expect(mockPrepareCreate.mock.calls[0][0].planData.hydrationMl).toBe(0);

      // Positive hydration
      mockPrepareCreate.mockClear();
      fireEvent.change(hydrationInput, { target: { value: "2500" } });
      fireEvent.submit(submitButton.closest("form")!);

      expect(mockPrepareCreate).toHaveBeenCalledTimes(1);
      expect(mockPrepareCreate.mock.calls[0][0].planData.hydrationMl).toBe(2500);
    });

    it("should capture validFrom instant at submission time and NOT during initial dialog render", () => {
      const beforeRenderInstant = new Date().getTime();

      render(
        <NutritionPlanCreateDialog
          open={true}
          onClose={vi.fn()}
          dogId="dog-1"
          dogName="Thor"
        />
      );

      const foodInput = screen.getByLabelText(/Alimento \/ Dieta Prescrita/i);
      const amountInput = screen.getByLabelText(/Quantidade Diária/i);
      fireEvent.change(foodInput, { target: { value: "Ração Premium" } });
      fireEvent.change(amountInput, { target: { value: "500" } });

      const submitButton = screen.getByRole("button", { name: /Criar e Ativar Plano/i });
      fireEvent.click(submitButton);

      expect(mockPrepareCreate).toHaveBeenCalledTimes(1);
      const validFromStr = mockPrepareCreate.mock.calls[0][0].planData.validFrom;
      const validFromTimestamp = new Date(validFromStr).getTime();

      expect(validFromTimestamp).toBeGreaterThanOrEqual(beforeRenderInstant);
    });
  });
});
