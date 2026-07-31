"use client";

import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";

import { db } from "@/lib/firebase/client";
import {
  parseNutritionPlan,
  parseLegacyNutritionPlan,
  consolidateActivePlan,
} from "../data/nutrition-plan-service";
import {
  NutritionPlan,
  LegacyNutritionPlanView,
  NutritionPlanState,
} from "../types";

/**
 * Returns the default initial state for a given dogId and generation.
 */
function getInitialState(dId: string, gen: number): NutritionPlanState {
  const trimmed = dId.trim();
  if (!trimmed) {
    return {
      status: "empty",
      dogId: dId,
      generation: gen,
      activePlan: null,
      plans: [],
      legacyPlan: null,
      error: "dogId inválido",
      integrityConflict: null,
      parsingErrors: [],
    };
  }
  return {
    status: "loading",
    dogId: trimmed,
    generation: gen,
    activePlan: null,
    plans: [],
    legacyPlan: null,
    error: null,
    integrityConflict: null,
    parsingErrors: [],
  };
}

/**
 * Custom hook to subscribe to canonical and legacy nutrition plans in real-time.
 * Strictly read-only, coordinated to avoid flicker, and robust against dog switching race conditions.
 */
export function useNutritionPlans(dogId: string): NutritionPlanState {
  const [generation, setGeneration] = useState(0);
  const [prevDogId, setPrevDogId] = useState(dogId);
  const [state, setState] = useState<NutritionPlanState>(() => getInitialState(dogId, 0));

  // Sync state and generation token sychronously during rendering if dogId changed.
  // This executes prior to any effect execution, eliminating race condition windows.
  if (dogId !== prevDogId) {
    const nextGen = generation + 1;
    setPrevDogId(dogId);
    setGeneration(nextGen);
    setState(getInitialState(dogId, nextGen));
  }

  useEffect(() => {
    const trimmedId = dogId.trim();
    if (!trimmedId) {
      return;
    }

    // Capture the exact generation number associated with this effect subscription cycle
    const myGeneration = generation;

    // Local tracking of snapshot loading states and data
    let canonicalLoaded = false;
    let primaryLegacyLoaded = false;
    let fallbackLegacyLoaded = false;

    let canonicalPlans: NutritionPlan[] = [];
    let legacyPrimary: LegacyNutritionPlanView[] = [];
    let legacyFallback: LegacyNutritionPlanView[] = [];

    let canonicalError: string | null = null;
    let canonicalParsingErrors: Array<{
      documentId: string;
      error: string;
      collection: string;
      rawStatus?: string;
    }> = [];
    let primaryLegacyParsingErrors: Array<{
      documentId: string;
      error: string;
      collection: string;
    }> = [];
    let fallbackLegacyParsingErrors: Array<{
      documentId: string;
      error: string;
      collection: string;
    }> = [];

    // Helper to evaluate and publish consolidations once sources are ready
    const handleUpdate = () => {
      // Discard update if this callback belongs to a previous dog subscription cycle
      // (Validated sychronously in functional state updater to catch render-phase race conditions)
      setState((prev) => {
        if (prev.generation !== myGeneration || prev.dogId !== trimmedId) {
          return prev;
        }

        // Coordination layer to prevent flicker:
        // Wait until all 3 listeners have emitted their first payload.
        if (!canonicalLoaded || !primaryLegacyLoaded || !fallbackLegacyLoaded) {
          return prev;
        }

        // Combine parsing errors from all sources
        const allParsingErrors = [
          ...canonicalParsingErrors,
          ...primaryLegacyParsingErrors,
          ...fallbackLegacyParsingErrors,
        ];

        // If we failed to read the canonical collection, propagate the error (fail-closed)
        if (canonicalError) {
          return {
            status: "error",
            reason: "firestore-read-error",
            dogId: trimmedId,
            generation: myGeneration,
            activePlan: null,
            plans: [],
            legacyPlan: null,
            error: canonicalError,
            integrityConflict: null,
            parsingErrors: allParsingErrors,
          };
        }

        // Consolidate states using the deterministic domain merge policy
        const consolidated = consolidateActivePlan({
          dogId: trimmedId,
          canonicalPlans,
          legacyPrimary,
          legacyFallback,
          canonicalError: null,
          parsingErrors: allParsingErrors,
        });

        return {
          ...consolidated,
          generation: myGeneration,
        };
      });
    };

    // 1. Subscribe to canonical 'nutrition_plans'
    const unsubCanonical = onSnapshot(
      collection(db, "dogs", trimmedId, "nutrition_plans"),
      (snapshot) => {
        canonicalPlans = [];
        canonicalParsingErrors = [];
        canonicalError = null;

        snapshot.docs.forEach((d) => {
          const rawData = d.data();
          try {
            const parsed = parseNutritionPlan(d.id, trimmedId, rawData);
            canonicalPlans.push(parsed);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Erro desconhecido de parsing";
            canonicalParsingErrors.push({
              documentId: d.id,
              error: msg,
              collection: "nutrition_plans",
              rawStatus: rawData.status,
            });
          }
        });

        canonicalLoaded = true;
        handleUpdate();
      },
      (err) => {
        canonicalError = `Erro ao ler nutrition_plans: ${err.message}`;
        canonicalLoaded = true;
        handleUpdate();
      }
    );

    // 2. Subscribe to primary legacy 'nutritional_prescriptions'
    const unsubPrimaryLegacy = onSnapshot(
      collection(db, "dogs", trimmedId, "nutritional_prescriptions"),
      (snapshot) => {
        legacyPrimary = [];
        primaryLegacyParsingErrors = [];

        snapshot.docs.forEach((d) => {
          try {
            const parsed = parseLegacyNutritionPlan(
              d.id,
              trimmedId,
              d.data(),
              "nutritional_prescriptions"
            );
            legacyPrimary.push(parsed);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Erro de parsing legado";
            primaryLegacyParsingErrors.push({
              documentId: d.id,
              error: msg,
              collection: "nutritional_prescriptions",
            });
          }
        });

        primaryLegacyLoaded = true;
        handleUpdate();
      },
      (err) => {
        // Log legacy load failures but don't crash canonical priority
        console.error(`Erro ao ler nutritional_prescriptions: ${err.message}`);
        primaryLegacyLoaded = true;
        handleUpdate();
      }
    );

    // 3. Subscribe to fallback legacy 'nutrition_prescriptions'
    const unsubFallbackLegacy = onSnapshot(
      collection(db, "dogs", trimmedId, "nutrition_prescriptions"),
      (snapshot) => {
        legacyFallback = [];
        fallbackLegacyParsingErrors = [];

        snapshot.docs.forEach((d) => {
          try {
            const parsed = parseLegacyNutritionPlan(
              d.id,
              trimmedId,
              d.data(),
              "nutrition_prescriptions"
            );
            legacyFallback.push(parsed);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Erro de parsing legado";
            fallbackLegacyParsingErrors.push({
              documentId: d.id,
              error: msg,
              collection: "nutrition_prescriptions",
            });
          }
        });

        fallbackLegacyLoaded = true;
        handleUpdate();
      },
      (err) => {
        console.error(`Erro ao ler nutrition_prescriptions: ${err.message}`);
        fallbackLegacyLoaded = true;
        handleUpdate();
      }
    );

    // Cleanup listeners on unmount/dog switch
    return () => {
      unsubCanonical();
      unsubPrimaryLegacy();
      unsubFallbackLegacy();
    };
  }, [dogId, generation]);

  return state;
}
