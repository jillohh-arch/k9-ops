/**
 * K9 Ops Web — Health Web v1 HW-3D
 * Single-dog cockpit loader for /health/readiness/[dogId] (SCR-03).
 *
 * CRITICAL MANDATES:
 * - Readiness is NEVER computed here. `health_summary/current` is a server-owned
 *   read-only projection; this loader only reads and composes it.
 * - A missing summary is a TECHNICAL state ("Sem projeção válida"). It must never
 *   become the operational status `not_evaluated`.
 * - Active restrictions are read from their own canonical authority
 *   (`operational_restrictions`), never derived from the summary.
 * - Dog identity comes from the institutional catalog, reusing the exact mapping
 *   the workforce list uses. Health does not own dog identity.
 * - A per-source failure degrades only that source. The cockpit is a composition
 *   of several sources, so one failure must not collapse the whole screen.
 */

import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { readCanonicalHealthSummary } from "../../data/readers/summary-reader";
import { readCanonicalOperationalRestrictions } from "../../data/readers/restrictions-reader";
import { aggregateReadinessCockpit } from "../../domain/readiness-aggregator";
import { toDogIdentity } from "./load-readiness-scope";
import type {
  CanonicalHealthSummaryDoc,
  CanonicalRestrictionDoc,
  ReadinessCockpit,
} from "../../domain/readiness-types";
import type { ReadState } from "../../domain/read-states";

/** Outcome of a cockpit load. `not_found` is distinct from every failure mode. */
export type CockpitLoadResult =
  | { status: "not_found" }
  | {
      status: "loaded";
      cockpit: ReadinessCockpit;
      /** True when any composed source degraded; successful blocks still render. */
      isPartial: boolean;
      /** False when the restrictions read failed: absence must not be affirmed. */
      restrictionsCoverageComplete: boolean;
    };

/**
 * Loads one dog's cockpit.
 *
 * Throws only when the institutional dog document itself cannot be read, which
 * the caller surfaces as a controlled global error. Everything else degrades
 * into `isPartial` / `restrictionsCoverageComplete` so partial truth survives.
 */
export async function loadReadinessCockpit(dogId: string): Promise<CockpitLoadResult> {
  const dogSnap = await getDoc(doc(db, "dogs", dogId));

  // Out of scope or nonexistent are deliberately indistinguishable here: the UI
  // must not reveal whether a dog exists outside the caller's authorized scope.
  if (!dogSnap.exists()) {
    return { status: "not_found" };
  }

  const dog = toDogIdentity(dogSnap.id, dogSnap.data());

  let isPartial = false;

  const summaryState = await readCanonicalHealthSummary(dog.id);
  const dataQuality: ReadState = summaryState;
  let summary: CanonicalHealthSummaryDoc | null = null;

  if (summaryState.status === "success") {
    summary = summaryState.data;
  } else if (summaryState.status === "error" || summaryState.status === "partial") {
    // Degraded read. `summary` stays null, which the aggregator renders as
    // "Sem projeção válida" — never as `not_evaluated`.
    isPartial = true;
  }

  let restrictions: CanonicalRestrictionDoc[] = [];
  let restrictionsCoverageComplete = true;
  const restrictionsState = await readCanonicalOperationalRestrictions(dog.id);

  if (restrictionsState.status === "success") {
    restrictions = restrictionsState.data;
  } else if (restrictionsState.status === "error") {
    isPartial = true;
    restrictionsCoverageComplete = false;
  }

  return {
    status: "loaded",
    cockpit: aggregateReadinessCockpit({ dog, summary, restrictions, dataQuality }),
    isPartial,
    restrictionsCoverageComplete,
  };
}
