/**
 * K9 Ops Web — Health Web v1
 * Shared canonical readiness scope loader.
 *
 * Extracted from the HW-3B overview hook so that /health and /health/readiness
 * consume ONE readiness composition path. There must never be a second
 * readiness engine in the client.
 *
 * CRITICAL MANDATES:
 * - Read-only: strictly NO Firestore mutations or write callables.
 * - Zero client-side readiness calculation: status comes from Backend projections.
 * - Dog identity is composed from the institutional source, never owned by
 *   health_summary.
 * - Technical read state is preserved per item (`dataQuality`) so presentation
 *   can distinguish "missing projection" from the domain status "not_evaluated".
 */

import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { readCanonicalHealthSummary } from "../../data/readers/summary-reader";
import { readCanonicalOperationalRestrictions } from "../../data/readers/restrictions-reader";
import {
  aggregateReadinessListItem,
  normalizeRestrictionDoc,
} from "../../domain/readiness-aggregator";
import type {
  CanonicalHealthSummaryDoc,
  CanonicalRestrictionDoc,
  DogIdentityReadModel,
  OperationalRestrictionReadModel,
  ReadinessListItem,
} from "../../domain/readiness-types";
import type { ReadState } from "../../domain/read-states";

export interface ReadinessScope {
  /** Composed read models, one per K9 in institutional scope. */
  items: ReadinessListItem[];
  /** Flattened active restrictions across the scope. */
  activeRestrictions: OperationalRestrictionReadModel[];
  /** True when any summary/restriction read was degraded or failed. */
  isPartial: boolean;
  /** False when at least one restrictions read failed — absence is unknown. */
  restrictionsCoverageComplete: boolean;
  /** True when the institutional scope genuinely contains zero K9s. */
  scopeEmpty: boolean;
}

/**
 * Maps an institutional dog document into the identity read model.
 * Tolerates the legacy pt-BR field names present in the canonical collection.
 */
function toDogIdentity(id: string, data: Record<string, unknown>): DogIdentityReadModel {
  return {
    id,
    name: String(data.name ?? data.nome ?? `K9-${id}`),
    registrationNumber:
      typeof data.registrationNumber === "string"
        ? data.registrationNumber
        : typeof data.rg === "string"
          ? data.rg
          : null,
    photoUrl:
      typeof data.photoUrl === "string"
        ? data.photoUrl
        : typeof data.profileImageUrl === "string"
          ? data.profileImageUrl
          : null,
    breed:
      typeof data.breed === "string"
        ? data.breed
        : typeof data.raca === "string"
          ? data.raca
          : null,
    sex:
      typeof data.sex === "string"
        ? data.sex
        : typeof data.sexo === "string"
          ? data.sexo
          : null,
    dateOfBirth: null,
    conductor: data.conductorRa
      ? {
          ra: String(data.conductorRa),
          name: typeof data.conductorName === "string" ? data.conductorName : null,
        }
      : null,
    specialties: [],
  } as DogIdentityReadModel;
}

/**
 * Loads the full canonical readiness scope: institutional dogs composed with
 * their canonical health summary and active operational restrictions.
 *
 * Throws only when the institutional dog list itself cannot be read, which the
 * caller surfaces as a global controlled error. Per-dog projection failures are
 * degraded, never collapsed into `not_evaluated`.
 */
export async function loadReadinessScope(): Promise<ReadinessScope> {
  const dogsSnap = await getDocs(collection(db, "dogs"));

  if (dogsSnap.empty) {
    return {
      items: [],
      activeRestrictions: [],
      isPartial: false,
      restrictionsCoverageComplete: true,
      scopeEmpty: true,
    };
  }

  const rawDogs = dogsSnap.docs.map((docSnap) => toDogIdentity(docSnap.id, docSnap.data()));

  let encounteredPartial = false;
  let restrictionsFullyRead = true;
  const allItems: ReadinessListItem[] = [];
  const allActiveRestrictions: OperationalRestrictionReadModel[] = [];

  await Promise.all(
    rawDogs.map(async (dog) => {
      const summaryState = await readCanonicalHealthSummary(dog.id);
      let summary: CanonicalHealthSummaryDoc | null = null;
      const dataQuality: ReadState = summaryState;

      if (summaryState.status === "success") {
        summary = summaryState.data;
      } else if (summaryState.status === "error" || summaryState.status === "partial") {
        encounteredPartial = true;
      }

      let restrictions: CanonicalRestrictionDoc[] = [];
      const restrictionsState = await readCanonicalOperationalRestrictions(dog.id);
      if (restrictionsState.status === "success") {
        restrictions = restrictionsState.data;
        const normalized = restrictions.map((r) => normalizeRestrictionDoc(r));
        allActiveRestrictions.push(...normalized);
      } else if (restrictionsState.status === "error") {
        encounteredPartial = true;
        restrictionsFullyRead = false;
      }

      allItems.push(
        aggregateReadinessListItem({
          dog,
          summary,
          restrictions,
          dataQuality,
        }),
      );
    }),
  );

  return {
    items: allItems,
    activeRestrictions: allActiveRestrictions,
    isPartial: encounteredPartial,
    restrictionsCoverageComplete: restrictionsFullyRead,
    scopeEmpty: false,
  };
}
