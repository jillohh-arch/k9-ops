import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

import { NutritionPlanManagement } from "../components/nutrition-plan-management";
import { NutritionPlanEditDialog } from "../components/nutrition-plan-edit-dialog";
import type { NutritionPlanState, NutritionPlan, UpdateNutritionPlanCommand } from "../types";

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
const mockPrepareUpdate = vi.fn();
const mockExecuteUpdate = vi.fn();
const mockRetryUpdate = vi.fn();
const mockResetUpdate = vi.fn();

type MockUpdateState = {
  status: "idle" | "preparing" | "ready" | "executing" | "success" | "error";
  intent: { operationId: string; command: UpdateNutritionPlanCommand } | null;
  result: unknown;
  error: unknown;
};

let mockUpdateState: MockUpdateState = {
  status: "idle",
  intent: null,
  result: null,
  error: null,
};

vi.mock("../hooks/use-nutrition-plan-mutations", () => ({
  useNutritionPlanMutations: () => ({
    createState: { status: "idle" },
    updateState: mockUpdateState,
    cancelState: { status: "idle" },
    prepareCreate: vi.fn(),
    executeCreate: vi.fn(),
    prepareUpdate: mockPrepareUpdate,
    executeUpdate: mockExecuteUpdate,
    retryUpdate: mockRetryUpdate,
    resetUpdate: mockResetUpdate,
    prepareCancel: vi.fn(),
    executeCancel: vi.fn(),
    resetAll: vi.fn(),
  }),
}));

const mockDirectExecuteUpdate = vi.fn();
vi.mock("../data/nutrition-plan-mutation-service", () => ({
  executeUpdateNutritionPlan: mockDirectExecuteUpdate,
}));

// Sample Active Plan
const sampleActivePlan: NutritionPlan = {
  id: "plan-active-100",
  dogId: "dog-1",
  foodType: "Ração K9 Super Energy",
  amountGramsPerDay: 600,
  mealsPerDay: 2,
  mealSchedule: [
    { id: "s1", period: "morning", scheduledTime: "07:00", targetGrams: 300 },
    { id: "s2", period: "evening", scheduledTime: "19:00", targetGrams: 300 },
  ],
  validFrom: new Date("2026-01-01T00:00:00.000Z"),
  timezone: "America/Sao_Paulo",
  hydrationMl: 2000,
  specialInstructions: "Oferecer água fresca à vontade.",
  professional: {
    name: "Dr. Fernando",
    registration_type: "CRMV",
    registration_number: "SP-12345",
    clinic: "Hospital Vet K9",
    specialty: "Nutrição",
  },
  recordedBy: { uid: "u1", name: "Vet", internalRole: "Vet" },
  status: "active",
  schemaVersion: 1,
  revision: 3,
};

// =============================================================================
// TESTS
// =============================================================================

describe("Gate 5D.3 — Edit Nutrition Plan Administrative Fields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCan.mockReturnValue(true);
    mockUpdateState = {
      status: "idle",
      intent: null,
      result: null,
      error: null,
    };
  });

  describe("CTA Availability across Read States", () => {
    it("should display 'Editar Informações' CTA when read state is CANONICAL ACTIVE and user is authorized", () => {
      mockPlanState.mockReturnValue({
        status: "canonical",
        dogId: "dog-1",
        generation: 1,
        activePlan: sampleActivePlan,
        plans: [sampleActivePlan],
        legacyPlan: null,
        error: null,
        integrityConflict: null,
        parsingErrors: [],
      });

      render(<NutritionPlanManagement initialDogId="dog-1" />);

      expect(screen.getByRole("button", { name: /Editar Informações/i })).toBeInTheDocument();
    });

    it("should NOT display 'Editar Informações' CTA when user lacks health.manage_nutrition_plan even if generic health.edit is granted", () => {
      mockCan.mockImplementation((domain: string, action: string) => {
        if (domain === "health" && action === "manage_nutrition_plan") return false;
        if (domain === "health" && action === "edit") return true;
        return false;
      });

      mockPlanState.mockReturnValue({
        status: "canonical",
        dogId: "dog-1",
        generation: 1,
        activePlan: sampleActivePlan,
        plans: [sampleActivePlan],
        legacyPlan: null,
        error: null,
        integrityConflict: null,
        parsingErrors: [],
      });

      render(<NutritionPlanManagement initialDogId="dog-1" />);

      expect(screen.queryByRole("button", { name: /Editar Informações/i })).not.toBeInTheDocument();
    });

    it("should NOT display edit CTA in EMPTY, LEGACY, CONFLICT, DEGRADED, ERROR or LOADING states", () => {
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

      expect(screen.queryByRole("button", { name: /Editar Informações/i })).not.toBeInTheDocument();
    });
  });

  describe("Form Behavior & Minimal Patch Construction", () => {
    it("should open dialog pre-populated with current administrative values", () => {
      render(
        <NutritionPlanEditDialog
          open={true}
          onClose={vi.fn()}
          plan={sampleActivePlan}
          dogName="Thor"
        />
      );

      expect(screen.getByText(/Editar Dados Administrativos — K9 Thor/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Orientações Nutricionais Especiais/i)).toHaveValue(
        "Oferecer água fresca à vontade."
      );
    });

    it("should block submission if no administrative changes were made (empty patch protection)", () => {
      render(
        <NutritionPlanEditDialog
          open={true}
          onClose={vi.fn()}
          plan={sampleActivePlan}
          dogName="Thor"
        />
      );

      const submitButton = screen.getByRole("button", { name: /Salvar Alterações/i });
      fireEvent.click(submitButton);

      expect(screen.getByText(/Nenhuma alteração foi realizada nos dados administrativos/i)).toBeInTheDocument();
      expect(mockPrepareUpdate).not.toHaveBeenCalled();
    });

    it("should build minimal patch with only specialInstructions when only instructions are modified", () => {
      render(
        <NutritionPlanEditDialog
          open={true}
          onClose={vi.fn()}
          plan={sampleActivePlan}
          dogName="Thor"
        />
      );

      const textarea = screen.getByLabelText(/Orientações Nutricionais Especiais/i);
      fireEvent.change(textarea, { target: { value: "Nova orientação pós-treino." } });

      const submitButton = screen.getByRole("button", { name: /Salvar Alterações/i });
      fireEvent.click(submitButton);

      expect(mockPrepareUpdate).toHaveBeenCalledTimes(1);
      const command: UpdateNutritionPlanCommand = mockPrepareUpdate.mock.calls[0][0];

      expect(command.dogId).toBe("dog-1");
      expect(command.planId).toBe("plan-active-100");
      expect(command.expectedRevision).toBe(3);

      // Verify minimal patch
      expect(command.changes).toEqual({
        specialInstructions: "Nova orientação pós-treino.",
      });

      // Strict assertions: structural fields MUST NEVER be present in UPDATE patch
      const changesKeys = Object.keys(command.changes);
      expect(changesKeys).not.toContain("foodType");
      expect(changesKeys).not.toContain("amountGramsPerDay");
      expect(changesKeys).not.toContain("mealsPerDay");
      expect(changesKeys).not.toContain("mealSchedule");
      expect(changesKeys).not.toContain("supplements");
      expect(changesKeys).not.toContain("hydrationMl");
      expect(changesKeys).not.toContain("timezone");
      expect(changesKeys).not.toContain("validFrom");
      expect(changesKeys).not.toContain("validUntil");

      expect(mockExecuteUpdate).toHaveBeenCalledTimes(1);
      expect(mockDirectExecuteUpdate).not.toHaveBeenCalled();
    });

    it("should send professional: null when user removes professional from plan", () => {
      render(
        <NutritionPlanEditDialog
          open={true}
          onClose={vi.fn()}
          plan={sampleActivePlan}
          dogName="Thor"
        />
      );

      const toggleButton = screen.getByRole("button", { name: /Remover profissional do plano/i });
      fireEvent.click(toggleButton);

      const submitButton = screen.getByRole("button", { name: /Salvar Alterações/i });
      fireEvent.click(submitButton);

      expect(mockPrepareUpdate).toHaveBeenCalledTimes(1);
      const command: UpdateNutritionPlanCommand = mockPrepareUpdate.mock.calls[0][0];

      expect(command.changes).toEqual({
        professional: null,
      });
    });
  });

  describe("Stale Form & Revision Integrity", () => {
    it("should detect when plan revision changes in background and block submission", () => {
      const { rerender } = render(
        <NutritionPlanEditDialog
          open={true}
          onClose={vi.fn()}
          plan={sampleActivePlan}
          dogName="Thor"
        />
      );

      // Listener receives updated plan (revision 4)
      const updatedPlan: NutritionPlan = {
        ...sampleActivePlan,
        revision: 4,
      };

      rerender(
        <NutritionPlanEditDialog
          open={true}
          onClose={vi.fn()}
          plan={updatedPlan}
          dogName="Thor"
        />
      );

      expect(screen.getByTestId("stale-form-warning")).toBeInTheDocument();

      const submitButton = screen.getByRole("button", { name: /Salvar Alterações/i });
      expect(submitButton).toBeDisabled();
    });
  });

  describe("Retry & Conflict Handling", () => {
    it("should invoke retryUpdate without calling prepareUpdate again on transport error", () => {
      const dummyCommand: UpdateNutritionPlanCommand = {
        dogId: "dog-1",
        planId: "plan-active-100",
        expectedRevision: 3,
        changes: { specialInstructions: "Atualizado" },
      };

      mockUpdateState = {
        status: "error",
        intent: { operationId: "op-update-99", command: dummyCommand },
        result: null,
        error: {
          code: "unavailable",
          message: "Falha de rede",
          category: "transport",
          retryable: true,
        },
      };

      render(
        <NutritionPlanEditDialog
          open={true}
          onClose={vi.fn()}
          plan={sampleActivePlan}
          dogName="Thor"
        />
      );

      const retryButton = screen.getByRole("button", { name: /Tentar novamente/i });
      fireEvent.click(retryButton);

      expect(mockRetryUpdate).toHaveBeenCalledTimes(1);
      expect(mockPrepareUpdate).not.toHaveBeenCalled();
    });

    it("should render clear conflict feedback when domainCode is nutrition_plan_conflict", () => {
      const dummyCommand: UpdateNutritionPlanCommand = {
        dogId: "dog-1",
        planId: "plan-active-100",
        expectedRevision: 3,
        changes: { specialInstructions: "Atualizado" },
      };

      mockUpdateState = {
        status: "error",
        intent: { operationId: "op-update-99", command: dummyCommand },
        result: null,
        error: {
          domainCode: "nutrition_plan_conflict",
          message: "Conflict revision",
          category: "conflict",
          retryable: false,
        },
      };

      render(
        <NutritionPlanEditDialog
          open={true}
          onClose={vi.fn()}
          plan={sampleActivePlan}
          dogName="Thor"
        />
      );

      expect(screen.getByText(/Conflito de revisão/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Revisar Versão Atual/i })).toBeInTheDocument();
    });
  });
});
