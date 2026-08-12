"use client";

/**
 * K9 Ops Web — Health Web v1 / WEB-01B.2
 * Dog context resolution for the individual Nutrition route.
 *
 * Dog identity is NOT owned by Nutrition. This hook composes it through the
 * Foundation's institutional mapping (`toDogIdentity`), which the readiness
 * cockpit loader also uses — there must never be a second dog identity engine.
 *
 * `not_found` is a distinct state, never an error and never an empty plan:
 * "absent from the authorized scope" and "does not exist" are deliberately
 * indistinguishable so scope membership is never revealed.
 *
 * Read-only: no writes, no callables.
 */

import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";

import { db } from "@/lib/firebase/client";
import type { DogIdentityReadModel } from "../../domain/readiness-types";
import { toDogIdentity } from "../../presentation/hooks/load-readiness-scope";

export interface NutritionDogContextState {
  status: "loading" | "success" | "not_found" | "error";
  dog: DogIdentityReadModel | null;
  errorMessage: string | null;
}

/**
 * An unusable dogId is decided synchronously, so no effect ever has to publish
 * it — this keeps the effect body free of synchronous setState calls.
 */
function initialStateFor(dogId: string): NutritionDogContextState {
  if (!dogId.trim()) {
    return { status: "not_found", dog: null, errorMessage: null };
  }
  return { status: "loading", dog: null, errorMessage: null };
}

export function useNutritionDogContext(dogId: string): NutritionDogContextState {
  const [prevDogId, setPrevDogId] = useState(dogId);
  const [state, setState] = useState<NutritionDogContextState>(() =>
    initialStateFor(dogId),
  );

  // Re-baseline during render when the route dog changes, so the previous K9's
  // context is never shown against the new dogId. Same pattern as
  // use-nutrition-plans.
  if (dogId !== prevDogId) {
    setPrevDogId(dogId);
    setState(initialStateFor(dogId));
  }

  useEffect(() => {
    const trimmed = dogId.trim();
    if (!trimmed) {
      return;
    }

    let active = true;

    getDoc(doc(db, "dogs", trimmed))
      .then((snap) => {
        if (!active) return;
        if (!snap.exists()) {
          setState({ status: "not_found", dog: null, errorMessage: null });
          return;
        }
        setState({
          status: "success",
          dog: toDogIdentity(snap.id, snap.data()),
          errorMessage: null,
        });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState({
          status: "error",
          dog: null,
          errorMessage:
            err instanceof Error ? err.message : "Falha ao resolver o contexto do K9",
        });
      });

    return () => {
      active = false;
    };
  }, [dogId]);

  return state;
}
