import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import {
  parseNutritionPlan,
  parseLegacyNutritionPlan,
  consolidateActivePlan,
  parseDateTime,
  parseRecordedBy,
} from "../data/nutrition-plan-service";
import { useNutritionPlans } from "../hooks/use-nutrition-plans";
import {
  FirestoreNutritionPlanDoc,
  FirestoreLegacyPlanDoc,
  NutritionPlan,
  LegacyNutritionPlanView,
} from "../types";

// Mock do modulo cliente do firebase para evitar inicializacao do SDK real
vi.mock("@/lib/firebase/client", () => {
  return {
    db: {},
    auth: {},
    storage: {},
    functions: {},
    firebaseApp: {},
  };
});

interface MockListener {
  path: string;
  onNext: (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => void;
  onError: (err: Error) => void;
}

// Declaramos a lista de listeners no escopo externo com o prefixo 'mock' para permitir hoisting no Vitest
const mockListenersList: MockListener[] = [];

// Mock firebase/firestore client
vi.mock("firebase/firestore", () => {
  return {
    db: {},
    collection: vi.fn((db, ...paths) => ({ path: paths.join("/") })),
    doc: vi.fn((db, ...paths) => ({ path: paths.join("/") })),
    onSnapshot: vi.fn((colRef, onNext, onError) => {
      mockListenersList.push({
        path: colRef.path,
        onNext: onNext as unknown as MockListener["onNext"],
        onError: onError as unknown as MockListener["onError"],
      });
      return () => {
        const idx = mockListenersList.findIndex((l) => l.path === colRef.path);
        if (idx >= 0) mockListenersList.splice(idx, 1);
      };
    }),
  };
});

describe("K9 Nutrition Plan WEB-N1 Foundation", () => {
  describe("Helper: parseDateTime", () => {
    it("should parse Date instances", () => {
      const now = new Date();
      expect(parseDateTime(now)).toEqual(now);
    });

    it("should parse ISO Date strings", () => {
      const dateStr = "2026-07-19T20:00:00.000Z";
      expect(parseDateTime(dateStr)?.toISOString()).toEqual(dateStr);
    });

    it("should parse milliseconds number", () => {
      const ms = 1784400000000;
      expect(parseDateTime(ms)?.toISOString()).toEqual("2026-07-18T18:40:00.000Z");
    });

    it("should parse object with toDate function", () => {
      const fakeTimestamp = {
        toDate: () => new Date("2026-07-19T20:00:00.000Z"),
      };
      expect(parseDateTime(fakeTimestamp)?.toISOString()).toEqual("2026-07-19T20:00:00.000Z");
    });

    it("should parse seconds and nanoseconds object", () => {
      const raw = { seconds: 1784400000, nanoseconds: 500000000 };
      expect(parseDateTime(raw)?.toISOString()).toEqual("2026-07-18T18:40:00.500Z");
    });

    it("should return null on invalid inputs", () => {
      expect(parseDateTime(null)).toBeNull();
      expect(parseDateTime("not-a-date")).toBeNull();
      expect(parseDateTime({})).toBeNull();
    });
  });

  describe("Helper: parseRecordedBy", () => {
    it("should parse valid recorded_by structures", () => {
      const raw = { uid: "agent-123", name: "Agente Silva", internal_role: "veterinarian" };
      expect(parseRecordedBy(raw)).toEqual({
        uid: "agent-123",
        name: "Agente Silva",
        internalRole: "veterinarian",
      });
    });

    it("should accept fallback role property and trim values", () => {
      const raw = { id: " agent-456 ", name: " Dr. Joao ", role: " handler " };
      expect(parseRecordedBy(raw)).toEqual({
        uid: "agent-456",
        name: "Dr. Joao",
        internalRole: "handler",
      });
    });

    it("should fail parsing on missing properties", () => {
      expect(parseRecordedBy(null)).toBeNull();
      expect(parseRecordedBy({})).toBeNull();
      expect(parseRecordedBy({ name: "Solo Name" })).toBeNull();
    });
  });

  describe("Parser Canônico: parseNutritionPlan", () => {
    const validPlanDoc = (): FirestoreNutritionPlanDoc => ({
      food_type: "Ração Premium K9",
      amount_grams_per_day: 600,
      meals_per_day: 3,
      valid_from: new Date("2026-07-19T10:00:00Z"),
      timezone: "America/Sao_Paulo",
      status: "active",
      recorded_by: { uid: "user-abc", name: "Dra. Ana", internal_role: "veterinarian" },
      schema_version: 1,
      revision: 3,
      hydration_ml: 1500,
      special_instructions: "Servir com água morna",
      professional: { name: "Dra. Ana", crmv: "CRMV-SP 12345" },
      source_document: { id: "doc-999", name: "Receita Nutricional" },
      attachment_refs: ["url1", "url2"],
      supplements: [
        {
          id: "sup-1",
          name: "Condroitina + Glucosamina",
          dose: "1",
          unit: "capsule",
          frequency: "QD",
          instructions: "Junto com a primeira refeição",
        },
      ],
    });

    it("should parse a valid canonical document successfully", () => {
      const doc = validPlanDoc();
      const plan = parseNutritionPlan("plan-id-123", "dog-xyz", doc);

      expect(plan.id).toBe("plan-id-123");
      expect(plan.dogId).toBe("dog-xyz");
      expect(plan.foodType).toBe("Ração Premium K9");
      expect(plan.amountGramsPerDay).toBe(600);
      expect(plan.mealsPerDay).toBe(3);
      expect(plan.validFrom.toISOString()).toBe("2026-07-19T10:00:00.000Z");
      expect(plan.timezone).toBe("America/Sao_Paulo");
      expect(plan.status).toBe("active");
      expect(plan.recordedBy).toEqual({
        uid: "user-abc",
        name: "Dra. Ana",
        internalRole: "veterinarian",
      });
      expect(plan.schemaVersion).toBe(1);
      expect(plan.revision).toBe(3);
      expect(plan.hydrationMl).toBe(1500);
      expect(plan.specialInstructions).toBe("Servir com água morna");
      expect(plan.professional).toEqual({ name: "Dra. Ana", crmv: "CRMV-SP 12345" });
      expect(plan.sourceDocument).toEqual({ id: "doc-999", name: "Receita Nutricional" });
      expect(plan.attachmentRefs).toEqual(["url1", "url2"]);
      expect(plan.supplements).toHaveLength(1);
      expect(plan.supplements?.[0].name).toBe("Condroitina + Glucosamina");
    });

    it("should accept valid statuses (active, superseded, cancelled)", () => {
      const doc = validPlanDoc();
      doc.status = "superseded";
      expect(parseNutritionPlan("id", "dog", doc).status).toBe("superseded");

      doc.status = "cancelled";
      expect(parseNutritionPlan("id", "dog", doc).status).toBe("cancelled");
    });

    it("should support valid_until optional parameter", () => {
      const doc = validPlanDoc();
      doc.valid_until = new Date("2026-07-20T00:00:00Z");
      const plan = parseNutritionPlan("id", "dog", doc);
      expect(plan.validUntil).toBeDefined();
      expect(plan.validUntil?.toISOString()).toBe("2026-07-20T00:00:00.000Z");
    });

    it("should fail parsing on missing mandatory fields", () => {
      const doc = validPlanDoc();
      delete doc.food_type;
      expect(() => parseNutritionPlan("id", "dog", doc)).toThrow(/food_type/);
    });

    it("should fail parsing on invalid amount_grams_per_day", () => {
      const doc = validPlanDoc();
      doc.amount_grams_per_day = -100;
      expect(() => parseNutritionPlan("id", "dog", doc)).toThrow(/amount_grams_per_day/);
    });

    it("should fail parsing on invalid meals_per_day", () => {
      const doc = validPlanDoc();
      doc.meals_per_day = 0;
      expect(() => parseNutritionPlan("id", "dog", doc)).toThrow(/meals_per_day/);
    });

    it("should fail parsing on invalid valid_until relationship (valid_until <= valid_from)", () => {
      const doc = validPlanDoc();
      doc.valid_from = new Date("2026-07-20T00:00:00Z");
      doc.valid_until = new Date("2026-07-19T00:00:00Z");
      expect(() => parseNutritionPlan("id", "dog", doc)).toThrow(/valid_until/);
    });

    it("should fail parsing on unrecognized timezone", () => {
      const doc = validPlanDoc();
      doc.timezone = "Invalido/Timezone_Ficticio";
      expect(() => parseNutritionPlan("id", "dog", doc)).toThrow(/timezone/);
    });

    it("should fail parsing on invalid MealPeriod", () => {
      const doc = validPlanDoc();
      doc.meal_schedule = [
        {
          id: "1",
          period: "invalid-period",
          scheduled_time: "08:00",
          target_grams: 200,
        },
      ];
      expect(() => parseNutritionPlan("id", "dog", doc)).toThrow(/period/);
    });

    it("should fail parsing on invalid scheduled_time format", () => {
      const doc = validPlanDoc();
      doc.meal_schedule = [
        {
          id: "1",
          period: "morning",
          scheduled_time: "8:00", // Falta zero a esquerda
          target_grams: 200,
        },
      ];
      expect(() => parseNutritionPlan("id", "dog", doc)).toThrow(/scheduled_time/);
    });

    it("should fail parsing on duplicate meal schedule IDs", () => {
      const doc = validPlanDoc();
      doc.meal_schedule = [
        { id: "slot-1", period: "morning", scheduled_time: "08:00", target_grams: 200 },
        { id: "slot-1", period: "evening", scheduled_time: "18:00", target_grams: 200 },
      ];
      expect(() => parseNutritionPlan("id", "dog", doc)).toThrow(/duplicado/);
    });

    it("should fail parsing on incomplete supplements", () => {
      const doc = validPlanDoc();
      doc.supplements = [
        {
          name: "Vitamina C",
          // dose ausente
          unit: "g",
          frequency: "QD",
        },
      ];
      expect(() => parseNutritionPlan("id", "dog", doc)).toThrow(/dose/);
    });
  });

  describe("Parser Legado: parseLegacyNutritionPlan", () => {
    const validLegacyDoc = (): FirestoreLegacyPlanDoc => ({
      food_type: "Ração Standard K9",
      amountGramsPerDay: 500,
      meals: 3,
      vigentFrom: new Date("2026-07-10T00:00:00Z"),
      vigentUntil: new Date("2026-07-15T00:00:00Z"),
      hydration_ml: 1200,
      notes: "Servir morno",
      vet_name: "Dr. Carlos",
      vet_crmv: "CRMV-SP 9876",
      status: "active_legacy",
    });

    it("should parse valid legacy documents", () => {
      const view = parseLegacyNutritionPlan(
        "legacy-id-1",
        "dog-1",
        validLegacyDoc(),
        "nutritional_prescriptions"
      );
      expect(view.id).toBe("legacy-id-1");
      expect(view.foodType).toBe("Ração Standard K9");
      expect(view.amountGramsPerDay).toBe(500);
      expect(view.mealsPerDay).toBe(3);
      expect(view.vigentFrom.toISOString()).toBe("2026-07-10T00:00:00.000Z");
      expect(view.vigentUntil?.toISOString()).toBe("2026-07-15T00:00:00.000Z");
      expect(view.hydrationMl).toBe(1200);
      expect(view.notes).toBe("Servir morno");
      expect(view.professionalName).toBe("Dr. Carlos");
      expect(view.professionalCrmv).toBe("CRMV-SP 9876"); // Fallback check
      expect(view.rawStatus).toBe("active_legacy");
      expect(view.legacySource).toBe("nutritional_prescriptions");
    });

    it("should fail parsing on missing core legacy fields", () => {
      const doc = validLegacyDoc();
      delete doc.food_type;
      expect(() => parseLegacyNutritionPlan("id", "dog", doc, "source")).toThrow();
    });
  });

  describe("Merge e Consolidação: consolidateActivePlan", () => {
    const mockCanonical = (id: string, status: "active" | "superseded" | "cancelled" = "active"): NutritionPlan => ({
      id,
      dogId: "dog-1",
      foodType: "Premium Ração",
      amountGramsPerDay: 400,
      mealsPerDay: 2,
      mealSchedule: [],
      validFrom: new Date("2026-07-19T00:00:00Z"),
      timezone: "America/Sao_Paulo",
      recordedBy: { uid: "user-1", name: "A", internalRole: "v" },
      status,
      schemaVersion: 1,
      revision: 1,
    });

    const mockLegacy = (id: string, source: string, vigentFromStr: string): LegacyNutritionPlanView => ({
      id,
      dogId: "dog-1",
      foodType: "Legado Ração",
      amountGramsPerDay: 350,
      mealsPerDay: 2,
      vigentFrom: new Date(vigentFromStr),
      legacySource: source,
      legacyId: id,
    });

    it("should return empty state when there are zero plans", () => {
      const state = consolidateActivePlan({
        dogId: "dog-1",
        canonicalPlans: [],
        legacyPrimary: [],
        legacyFallback: [],
        canonicalError: null,
        parsingErrors: [],
      });
      expect(state.status).toBe("empty");
      expect(state.reason).toBeUndefined();
      expect(state.activePlan).toBeNull();
    });

    it("should return canonical active plan when exactly one exists", () => {
      const active = mockCanonical("can-1", "active");
      const superseded = mockCanonical("can-2", "superseded");
      const state = consolidateActivePlan({
        dogId: "dog-1",
        canonicalPlans: [active, superseded],
        legacyPrimary: [mockLegacy("leg-1", "nutritional_prescriptions", "2026-07-10T00:00:00Z")],
        legacyFallback: [],
        canonicalError: null,
        parsingErrors: [],
      });
      expect(state.status).toBe("canonical");
      expect(state.reason).toBeUndefined();
      expect(state.activePlan).toEqual(active);
    });

    it("should detect conflict when there are multiple canonical active plans", () => {
      const plan1 = mockCanonical("can-1", "active");
      const plan2 = mockCanonical("can-2", "active");
      const state = consolidateActivePlan({
        dogId: "dog-1",
        canonicalPlans: [plan1, plan2],
        legacyPrimary: [],
        legacyFallback: [],
        canonicalError: null,
        parsingErrors: [],
      });
      expect(state.status).toBe("conflict");
      expect(state.reason).toBe("multiple-active-plans");
      expect(state.integrityConflict?.activePlansCount).toBe(2);
      expect(state.integrityConflict?.activePlanIds).toEqual(["can-1", "can-2"]);
    });

    it("should handle cascaded fallback: primary legacy when no active canonical exists", () => {
      const superseded = mockCanonical("can-old", "superseded");
      const legPrimary1 = mockLegacy("leg-prim-1", "nutritional_prescriptions", "2026-07-10T00:00:00Z");
      const legPrimary2 = mockLegacy("leg-prim-2", "nutritional_prescriptions", "2026-07-12T00:00:00Z");

      const state = consolidateActivePlan({
        dogId: "dog-1",
        canonicalPlans: [superseded],
        legacyPrimary: [legPrimary1, legPrimary2],
        legacyFallback: [mockLegacy("leg-fall-1", "nutrition_prescriptions", "2026-07-14T00:00:00Z")],
        canonicalError: null,
        parsingErrors: [],
      });
      // A cascata diz: se nutritional_prescriptions existe, usa o mais recente dela, ignorando o secundário
      expect(state.status).toBe("legacy");
      expect(state.reason).toBeUndefined();
      expect(state.activePlan).toEqual(legPrimary2);
    });

    it("should fallback to secondary legacy only when canonical is empty/superseded and primary legacy is empty", () => {
      const legFallback1 = mockLegacy("leg-fall-1", "nutrition_prescriptions", "2026-07-10T00:00:00Z");
      const legFallback2 = mockLegacy("leg-fall-2", "nutrition_prescriptions", "2026-07-12T00:00:00Z");

      const state = consolidateActivePlan({
        dogId: "dog-1",
        canonicalPlans: [],
        legacyPrimary: [],
        legacyFallback: [legFallback1, legFallback2],
        canonicalError: null,
        parsingErrors: [],
      });
      expect(state.status).toBe("legacy");
      expect(state.reason).toBeUndefined();
      expect(state.activePlan).toEqual(legFallback2);
    });

    // Teste de Fail-Closed 1: Documento canônico ativo malformado não pode ocultar erro
    it("should NOT return legacy plan if a canonical active document is malformed (fail-closed)", () => {
      const legPrimary = mockLegacy("leg-prim-1", "nutritional_prescriptions", "2026-07-10T00:00:00Z");
      const state = consolidateActivePlan({
        dogId: "dog-1",
        canonicalPlans: [],
        legacyPrimary: [legPrimary],
        legacyFallback: [],
        canonicalError: null,
        parsingErrors: [
          {
            documentId: "can-broken",
            error: "Erro de parsing do schedule",
            collection: "nutrition_plans",
            rawStatus: "active", // Marcado como ativo na base mas corrompido
          },
        ],
      });
      expect(state.status).toBe("degraded");
      expect(state.reason).toBe("malformed-canonical-document");
      expect(state.activePlan).toBeNull(); // Não exibe legado
    });

    // Teste de Fail-Closed 2: Erro de leitura do canônico não pode ocultar erro
    it("should NOT return legacy plan if canonical query returned an error (fail-closed)", () => {
      const legPrimary = mockLegacy("leg-prim-1", "nutritional_prescriptions", "2026-07-10T00:00:00Z");
      const state = consolidateActivePlan({
        dogId: "dog-1",
        canonicalPlans: [],
        legacyPrimary: [legPrimary],
        legacyFallback: [],
        canonicalError: "Permission Denied no Firestore",
        parsingErrors: [],
      });
      expect(state.status).toBe("error");
      expect(state.reason).toBe("firestore-read-error");
      expect(state.activePlan).toBeNull();
      expect(state.error).toBe("Permission Denied no Firestore");
    });

    // Teste de Fail-Closed 3: Erro de parsing no legado primário não pode silenciar e usar legado secundário como se tudo estivesse bem
    it("should NOT return secondary legacy silently if primary legacy parsing failed", () => {
      const legFallback = mockLegacy("leg-fall-1", "nutrition_prescriptions", "2026-07-12T00:00:00Z");
      const state = consolidateActivePlan({
        dogId: "dog-1",
        canonicalPlans: [],
        legacyPrimary: [],
        legacyFallback: [legFallback],
        canonicalError: null,
        parsingErrors: [
          {
            documentId: "leg-prim-broken",
            error: "Data vigent_from inválida",
            collection: "nutritional_prescriptions",
          },
        ],
      });
      expect(state.status).toBe("degraded");
      expect(state.reason).toBe("malformed-primary-legacy");
      expect(state.activePlan).toBeNull();
    });
  });

  describe("Hook: useNutritionPlans - Flicker & Concorrência", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      // Garante que a lista de listeners está vazia
      mockListenersList.length = 0;
    });

    it("should start with loading status", () => {
      const { result } = renderHook(() => useNutritionPlans("dog-1"));
      expect(result.current.status).toBe("loading");
      expect(result.current.dogId).toBe("dog-1");
    });

    it("should prevent flicker: status remains loading until all three sources emit at least once", () => {
      const { result } = renderHook(() => useNutritionPlans("dog-1"));

      // Temos 3 listeners registrados no mockListenersList
      expect(mockListenersList).toHaveLength(3);

      // 1. Emite snapshot canônico
      act(() => {
        const canonical = mockListenersList.find((l) => l.path.includes("nutrition_plans"));
        canonical!.onNext({ docs: [] });
      });
      // Ainda deveria ser loading, porque os legados não emitiram
      expect(result.current.status).toBe("loading");

      // 2. Emite snapshot do legado secundário
      act(() => {
        const secondary = mockListenersList.find((l) => l.path.includes("nutrition_prescriptions"));
        secondary!.onNext({ docs: [] });
      });
      expect(result.current.status).toBe("loading");

      // 3. Emite snapshot do legado primário (agora todos emitiram)
      act(() => {
        const primary = mockListenersList.find((l) => l.path.includes("nutritional_prescriptions"));
        primary!.onNext({ docs: [] });
      });
      // Consolida e vira empty (sem flicker durante a transição parcial)
      expect(result.current.status).toBe("empty");
    });

    it("should prevent race conditions and discard stale callbacks when dogId switches rapidly", () => {
      // 1. Inicia renderizando com cão A
      const { result, rerender } = renderHook(({ dId }) => useNutritionPlans(dId), {
        initialProps: { dId: "dog-A" },
      });

      const firstCycleListeners = [...mockListenersList];
      expect(firstCycleListeners).toHaveLength(3);

      // 2. Troca rapidamente o cão de A para B (desencadeando novos listeners)
      rerender({ dId: "dog-B" });
      const secondCycleListeners = mockListenersList.filter(l => !firstCycleListeners.includes(l));
      expect(secondCycleListeners).toHaveLength(3);

      // 3. Respostas do cão A chegam tardiamente
      act(() => {
        firstCycleListeners.forEach(listener => {
          listener.onNext({ docs: [] });
        });
      });
      // O estado do hook deve permanecer loading do cão B, e os dados do cão A descartados!
      expect(result.current.dogId).toBe("dog-B");
      expect(result.current.status).toBe("loading");

      // 4. Respostas do cão B chegam
      act(() => {
        secondCycleListeners.forEach(listener => {
          listener.onNext({ docs: [] });
        });
      });
      // Vira empty para o cão B
      expect(result.current.dogId).toBe("dog-B");
      expect(result.current.status).toBe("empty");
    });

    // Caso B: Callback do cão A disparado antes da nova subscription/effect de B estar completamente estabelecida
    it("should prevent race conditions even when callback of A is fired before B's effect executes", () => {
      const { result, rerender } = renderHook(({ dId }) => useNutritionPlans(dId), {
        initialProps: { dId: "dog-A" },
      });

      const listenersA = [...mockListenersList];
      expect(listenersA).toHaveLength(3);

      // Rerender síncrono para B
      rerender({ dId: "dog-B" });
      expect(result.current.dogId).toBe("dog-B");
      expect(result.current.status).toBe("loading");

      // Dispara callback tardio de A exatamente agora (antes do effect de B estabelecer novas conexões)
      act(() => {
        listenersA.forEach(listener => {
          listener.onNext({ docs: [] });
        });
      });

      // Deve ignorar o callback antigo de A e manter status loading do cão B
      expect(result.current.dogId).toBe("dog-B");
      expect(result.current.status).toBe("loading");
    });

    // Caso C: A -> B -> A rapidamente, garantindo que uma subscription da geração 1 de A não publique na geração 2 de A
    it("should prevent race conditions on rapid A -> B -> A switches and avoid old generation callback leak", () => {
      const { result, rerender } = renderHook(({ dId }) => useNutritionPlans(dId), {
        initialProps: { dId: "dog-A" },
      });

      const listenersAGen1 = [...mockListenersList];
      expect(listenersAGen1).toHaveLength(3);

      // Rerender para B
      rerender({ dId: "dog-B" });
      const listenersB = mockListenersList.filter(l => !listenersAGen1.includes(l));
      expect(listenersB).toHaveLength(3);

      // Rerender síncrono de volta para A (Geração 2)
      rerender({ dId: "dog-A" });
      const listenersAGen2 = mockListenersList.filter(l => !listenersAGen1.includes(l) && !listenersB.includes(l));
      expect(listenersAGen2).toHaveLength(3);

      expect(result.current.dogId).toBe("dog-A");
      expect(result.current.status).toBe("loading");

      // Dispara callback da Geração 1 de A (obsoleto)
      act(() => {
        listenersAGen1.forEach(listener => {
          listener.onNext({ docs: [] });
        });
      });

      // Hook deve ignorar os dados da Geração 1 de A e continuar em loading para A (Geração 2)
      expect(result.current.status).toBe("loading");

      // Dispara os callbacks da Geração 2 de A (corretos e novos)
      act(() => {
        listenersAGen2.forEach(listener => {
          listener.onNext({ docs: [] });
        });
      });

      // O hook deve processar com sucesso a Geração 2 e transicionar para o estado final
      expect(result.current.status).toBe("empty");
    });
  });
});
