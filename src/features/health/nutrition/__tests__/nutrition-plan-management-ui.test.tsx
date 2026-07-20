import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

import { NutritionPlanManagement } from "../components/nutrition-plan-management";
import type { NutritionPlanState, NutritionPlan, LegacyNutritionPlanView } from "../types";

// =============================================================================
// MOCK SETUP
// =============================================================================

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
  { _id: "dog-2", name: "Zeus", rg: "K9-002", breed: "Belga Malinois", status: "Ativo" },
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

// Mock mutation executors / services to ensure NO mutation executor is ever called
const mockExecuteCreate = vi.fn();
const mockExecuteUpdate = vi.fn();
const mockExecuteCancel = vi.fn();
vi.mock("../data/nutrition-plan-mutation-service", () => ({
  executeCreateNutritionPlan: mockExecuteCreate,
  executeUpdateNutritionPlan: mockExecuteUpdate,
  executeCancelNutritionPlan: mockExecuteCancel,
}));

// =============================================================================
// TEST DATA FACTORIES
// =============================================================================

const sampleCanonicalPlan: NutritionPlan = {
  id: "plan-canonical-100",
  dogId: "dog-1",
  foodType: "Ração Super Premium K9",
  amountGramsPerDay: 600,
  mealsPerDay: 2,
  mealSchedule: [
    { id: "slot-1", period: "morning", scheduledTime: "07:00", targetGrams: 300 },
    { id: "slot-2", period: "evening", scheduledTime: "19:00", targetGrams: 300 },
  ],
  validFrom: new Date("2026-01-01T00:00:00.000Z"),
  validUntil: undefined,
  timezone: "America/Sao_Paulo",
  recordedBy: { uid: "user-1", name: "Dr. Roberto Santos", internalRole: "Veterinário Chefe" },
  status: "active",
  schemaVersion: 1,
  revision: 2,
  hydrationMl: 1500,
  specialInstructions: "Oferecer água fresca à vontade após exercícios intensos.",
  professional: { name: "Dra. Ana Silva", crmv: "CRMV-SP 12345" },
  sourceDocument: { id: "doc-99", name: "Laudo Nutricional Anual" },
  attachmentRefs: ["att-1", "att-2"],
  supplements: [
    { id: "supp-1", name: "Ômega 3 K9", dose: "2", unit: "cápsulas", frequency: "1x ao dia", instructions: "Junto à refeição da manhã" },
  ],
};

const sampleLegacyPlan: LegacyNutritionPlanView = {
  id: "plan-legacy-200",
  dogId: "dog-1",
  foodType: "Ração Antiga Manutenção",
  amountGramsPerDay: 500,
  mealsPerDay: 2,
  vigentFrom: new Date("2025-06-01T00:00:00.000Z"),
  hydrationMl: 1000,
  notes: "Plano importado da planilha histórica do canil.",
  professionalName: "Dr. Carlos Vet",
  professionalCrmv: "CRMV-RJ 999",
  legacySource: "planilha_historica_2025",
  legacyId: "LEG-2025-01",
};

// =============================================================================
// TESTS
// =============================================================================

describe("NutritionPlanManagement UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCan.mockReturnValue(true);
  });

  describe("Permission UX", () => {
    it("should render MANAGEMENT MODE when user has health.manage_nutrition_plan capability", () => {
      mockCan.mockReturnValue(true);
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

      expect(screen.getByText("MODO GESTÃO ATIVO")).toBeInTheDocument();
      expect(screen.queryByText("MODO SOMENTE LEITURA")).not.toBeInTheDocument();
    });

    it("should render READ ONLY MODE when user lacks health.manage_nutrition_plan capability", () => {
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

      expect(screen.getByText("MODO SOMENTE LEITURA")).toBeInTheDocument();
      expect(screen.queryByText("MODO GESTÃO ATIVO")).not.toBeInTheDocument();
    });
  });

  describe("Visual States", () => {
    it("should render LOADING state skeleton when read state status is 'loading'", () => {
      mockPlanState.mockReturnValue({
        status: "loading",
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

      expect(screen.getByTestId("nutrition-plan-loading-skeleton")).toBeInTheDocument();
    });

    it("should render CANONICAL ACTIVE plan view with full details when status is 'canonical'", () => {
      mockPlanState.mockReturnValue({
        status: "canonical",
        dogId: "dog-1",
        generation: 1,
        activePlan: sampleCanonicalPlan,
        plans: [sampleCanonicalPlan],
        legacyPlan: null,
        error: null,
        integrityConflict: null,
        parsingErrors: [],
      });

      render(<NutritionPlanManagement initialDogId="dog-1" />);

      expect(screen.getByTestId("nutrition-plan-active-view")).toBeInTheDocument();
      expect(screen.getByText("Ração Super Premium K9 — Thor")).toBeInTheDocument();
      expect(screen.getByText("600 g/dia")).toBeInTheDocument();
      expect(screen.getByText("2x / dia")).toBeInTheDocument();
      expect(screen.getByText("1500 ml")).toBeInTheDocument();
      expect(screen.getByText("Ômega 3 K9")).toBeInTheDocument();
      expect(screen.getByText("Oferecer água fresca à vontade após exercícios intensos.")).toBeInTheDocument();
      expect(screen.getByText("Dra. Ana Silva")).toBeInTheDocument();
      expect(screen.getByText("Laudo Nutricional Anual")).toBeInTheDocument();
      expect(screen.getByText("Dr. Roberto Santos")).toBeInTheDocument();
    });

    it("should render LEGACY plan view with READ-ONLY notice when status is 'legacy'", () => {
      mockPlanState.mockReturnValue({
        status: "legacy",
        dogId: "dog-1",
        generation: 1,
        activePlan: sampleLegacyPlan,
        plans: [],
        legacyPlan: sampleLegacyPlan,
        error: null,
        integrityConflict: null,
        parsingErrors: [],
      });

      render(<NutritionPlanManagement initialDogId="dog-1" />);

      expect(screen.getByTestId("nutrition-plan-legacy-view")).toBeInTheDocument();
      expect(screen.getByText("Plano Alimentar Legado em Exibição — Thor")).toBeInTheDocument();
      expect(screen.getByText("Ração Antiga Manutenção")).toBeInTheDocument();
      expect(screen.getByText("500 g/dia")).toBeInTheDocument();
      expect(screen.getByText("Plano importado da planilha histórica do canil.")).toBeInTheDocument();
    });

    it("should render EMPTY state when status is 'empty'", () => {
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

      expect(screen.getByTestId("nutrition-plan-empty-state")).toBeInTheDocument();
      expect(screen.getByText("Nenhum Plano Alimentar Ativo")).toBeInTheDocument();
    });

    it("should render CONFLICT state when status is 'conflict' without picking an arbitrary plan", () => {
      const conflictData = {
        message: "Múltiplos planos ativos encontrados",
        activePlansCount: 2,
        activePlanIds: ["plan-a-100", "plan-b-200"],
      };

      mockPlanState.mockReturnValue({
        status: "conflict",
        dogId: "dog-1",
        generation: 1,
        activePlan: null,
        plans: [],
        legacyPlan: null,
        error: "Conflito de integridade",
        integrityConflict: conflictData,
        parsingErrors: [],
      });

      render(<NutritionPlanManagement initialDogId="dog-1" />);

      expect(screen.getByTestId("nutrition-plan-conflict-state")).toBeInTheDocument();
      expect(screen.getByText("Conflito de integridade")).toBeInTheDocument();
      expect(screen.getByText(/Foram identificados múltiplos planos alimentares ativos/i)).toBeInTheDocument();
      expect(screen.getByText("plan-a-100, plan-b-200")).toBeInTheDocument();
      expect(screen.queryByTestId("nutrition-plan-active-view")).not.toBeInTheDocument();
    });

    it("should render ERROR state when status is 'error'", () => {
      mockPlanState.mockReturnValue({
        status: "error",
        dogId: "dog-1",
        generation: 1,
        activePlan: null,
        plans: [],
        legacyPlan: null,
        error: "Falha na conexão Firestore",
        integrityConflict: null,
        parsingErrors: [],
      });

      render(<NutritionPlanManagement initialDogId="dog-1" />);

      expect(screen.getByTestId("nutrition-plan-error-state")).toBeInTheDocument();
      expect(screen.getByText("Falha ao Carregar Plano Alimentar")).toBeInTheDocument();
      expect(screen.getByText("Falha na conexão Firestore")).toBeInTheDocument();
    });

    it("should render DEGRADED state banner when status is 'degraded'", () => {
      mockPlanState.mockReturnValue({
        status: "degraded",
        dogId: "dog-1",
        generation: 1,
        activePlan: null,
        plans: [],
        legacyPlan: null,
        error: "Erros parciais em coleções legadas",
        integrityConflict: null,
        parsingErrors: [{ documentId: "doc-bad", error: "Bad schema", collection: "legacy" }],
      });

      render(<NutritionPlanManagement initialDogId="dog-1" />);

      expect(screen.getByTestId("nutrition-plan-degraded-state")).toBeInTheDocument();
      expect(screen.getByText("Modo de Leitura Parcial (Degradado)")).toBeInTheDocument();
    });
  });

  describe("Content & Safety Integrity", () => {
    it("should NOT call any mutation executor or Firestore write during rendering or interaction", () => {
      mockPlanState.mockReturnValue({
        status: "canonical",
        dogId: "dog-1",
        generation: 1,
        activePlan: sampleCanonicalPlan,
        plans: [sampleCanonicalPlan],
        legacyPlan: null,
        error: null,
        integrityConflict: null,
        parsingErrors: [],
      });

      render(<NutritionPlanManagement initialDogId="dog-1" />);

      expect(mockExecuteCreate).not.toHaveBeenCalled();
      expect(mockExecuteUpdate).not.toHaveBeenCalled();
      expect(mockExecuteCancel).not.toHaveBeenCalled();
    });

    it("should gracefully handle optional plan fields without displaying undefined, null, or [object Object]", () => {
      const minimalCanonicalPlan: NutritionPlan = {
        id: "plan-min-1",
        dogId: "dog-1",
        foodType: "Ração Básica",
        amountGramsPerDay: 400,
        mealsPerDay: 2,
        mealSchedule: [],
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
        timezone: "UTC",
        recordedBy: { uid: "u-1", name: "", internalRole: "" },
        status: "active",
        schemaVersion: 1,
        revision: 1,
      };

      mockPlanState.mockReturnValue({
        status: "canonical",
        dogId: "dog-1",
        generation: 1,
        activePlan: minimalCanonicalPlan,
        plans: [minimalCanonicalPlan],
        legacyPlan: null,
        error: null,
        integrityConflict: null,
        parsingErrors: [],
      });

      render(<NutritionPlanManagement initialDogId="dog-1" />);

      const containerText = document.body.textContent ?? "";
      expect(containerText).not.toContain("undefined");
      expect(containerText).not.toContain("null");
      expect(containerText).not.toContain("[object Object]");
      expect(containerText).not.toContain("NaN");
      expect(containerText).not.toContain("Invalid Date");
    });

    it("should render dynamic professional registration type and number without hardcoded CRMV", () => {
      const dynamicProfPlan: NutritionPlan = {
        ...sampleCanonicalPlan,
        professional: {
          name: "Dr. Fernando Vet",
          registration_type: "CRFA",
          registration_number: "98765-SP",
          specialty: "Nutrição Canina Especializada",
          clinic: "Hospital Veterinário Central",
        },
      };

      mockPlanState.mockReturnValue({
        status: "canonical",
        dogId: "dog-1",
        generation: 1,
        activePlan: dynamicProfPlan,
        plans: [dynamicProfPlan],
        legacyPlan: null,
        error: null,
        integrityConflict: null,
        parsingErrors: [],
      });

      render(<NutritionPlanManagement initialDogId="dog-1" />);

      expect(screen.getByText("Dr. Fernando Vet")).toBeInTheDocument();
      expect(screen.getByText("CRFA · 98765-SP")).toBeInTheDocument();
      expect(screen.getByText("Especialidade: Nutrição Canina Especializada")).toBeInTheDocument();
      expect(screen.getByText("Clínica: Hospital Veterinário Central")).toBeInTheDocument();
    });
  });
});
