/**
 * K9 Ops Backend — Health Web v1 HW-3P
 * Firestore Reconciler & Projection Persister
 *
 * Implements server-side reconciliation and persistence to dogs/{dogId}/health_summary/current
 * according to:
 * - HW-3P Specification §15 (Idempotency), §17 (Reconciliation/Rebuild), §18 (Persistence)
 */

import type { Firestore } from "firebase-admin/firestore";
import { buildHealthSummary, type SourceDocument } from "./health-summary-builder";

export async function rebuildHealthSummary(
  db: Firestore,
  dogId: string
): Promise<Record<string, unknown>> {
  if (!dogId || typeof dogId !== "string") {
    throw new Error("rebuildHealthSummary requires a valid dogId string.");
  }

  const dogRef = db.collection("dogs").doc(dogId);

  // 1. Read existing health summary document if present
  const existingDoc = await dogRef.collection("health_summary").doc("current").get();
  const existingSummary = existingDoc.exists ? (existingDoc.data() as Record<string, unknown>) : null;

  // 2. Read canonical sources
  const [
    restrictionsSnap,
    weightSnap,
    vaccinationSnap,
    nutritionSnap,
    clinicalCasesSnap,
    treatmentsSnap,
    scheduleSnap,
  ] = await Promise.all([
    dogRef.collection("operational_restrictions").where("status", "==", "active").get(),
    dogRef.collection("weight_records").get(),
    dogRef.collection("vaccination_records").get(),
    dogRef.collection("nutrition_plans").where("status", "==", "active").get(),
    dogRef.collection("clinical_cases").get(),
    dogRef.collection("treatment_protocols").where("status", "==", "active").get(),
    dogRef.collection("health_schedule").get(),
  ]);

  const restrictions: SourceDocument[] = restrictionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const weightRecords: SourceDocument[] = weightSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const vaccinationRecords: SourceDocument[] = vaccinationSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const nutritionPlans: SourceDocument[] = nutritionSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const clinicalCases: SourceDocument[] = clinicalCasesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const treatmentProtocols: SourceDocument[] = treatmentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const healthSchedule: SourceDocument[] = scheduleSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // 3. Build pure projection output
  const output = buildHealthSummary({
    dogId,
    restrictions,
    weightRecords,
    vaccinationRecords,
    nutritionPlans,
    clinicalCases,
    treatmentProtocols,
    healthSchedule,
    existingSummary,
  });

  // 4. Persist to dogs/{dogId}/health_summary/current via Admin SDK
  const currentSummaryRef = dogRef.collection("health_summary").doc("current");
  await currentSummaryRef.set(output, { merge: false });

  return output as unknown as Record<string, unknown>;
}
