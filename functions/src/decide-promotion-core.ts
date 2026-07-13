import { type Firestore, type FieldValue as FieldValueType } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

import {
  buildDecisionFields,
  buildProgressUpdate,
  validatePromotionState,
  type ModuleEntry,
  type ProgressDoc,
  type PromotionDoc,
} from "./promotion-helpers";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DeciderContext {
  uid: string;
  ra: string;
  email: string;
  deciderName: string;
}

export interface DecisionPayload {
  requestId: string;
  decision: "approved" | "rejected";
  reason?: string;
  note?: string;
}

export interface DecisionResult {
  id: string;
  status: "approved" | "rejected";
}

// ─── Core Transaction ───────────────────────────────────────────────────────

/**
 * Core transactional logic for deciding a promotion request.
 *
 * Admin SDK constraint: all reads must precede all writes in a transaction.
 * Structure: read promotion → read progress → read modules → validate → write all.
 */
export async function decidePromotionCore(
  db: Firestore,
  FieldValue: typeof FieldValueType,
  decider: DeciderContext,
  payload: DecisionPayload,
): Promise<DecisionResult> {
  const { requestId, decision, reason, note } = payload;

  const docRef = db.collection("promotion_requests").doc(requestId);

  const result = await db.runTransaction(async (tx) => {
    // ── Phase 1: ALL READS ──

    const snap = await tx.get(docRef);
    if (!snap.exists) {
      throw new HttpsError("not-found", "Solicitação não encontrada.");
    }

    const data = snap.data()!;
    const promotion: PromotionDoc = {
      dog_id: data.dog_id as string,
      modality: data.modality as string,
      module_id: data.module_id as string,
      module_name: data.module_name as string | undefined,
      module_order: data.module_order as number | undefined,
      program_id: data.program_id as string,
      program_version: data.program_version as number,
      status: data.status as string,
      next_module_id: data.next_module_id as string | null | undefined,
    };

    if (promotion.status !== "pending") {
      throw new HttpsError("failed-precondition", "Esta solicitação já foi analisada.");
    }

    let progress: ProgressDoc | null = null;
    let modules: ModuleEntry[] = [];
    let progressRef: FirebaseFirestore.DocumentReference | null = null;

    if (decision === "approved") {
      const { dog_id: dogId, modality, program_id: programId } = promotion;

      if (!dogId || !modality || !programId || !promotion.module_id) {
        throw new HttpsError(
          "failed-precondition",
          "Dados incompletos na solicitação para aprovação.",
        );
      }

      progressRef = db.doc(`dogs/${dogId}/training/${modality}`);
      const progressSnap = await tx.get(progressRef);

      if (!progressSnap.exists) {
        throw new HttpsError(
          "failed-precondition",
          "Progresso de treinamento não encontrado para este K9 e modalidade.",
        );
      }

      const progressData = progressSnap.data()!;
      progress = {
        current_module: (progressData.current_module ?? null) as string | null,
        completed_module_ids: Array.isArray(progressData.completed_module_ids)
          ? progressData.completed_module_ids
          : [],
        completed_modules: Array.isArray(progressData.completed_modules)
          ? progressData.completed_modules
          : [],
        program_version:
          typeof progressData.program_version === "number"
            ? progressData.program_version
            : null,
        status: (progressData.status ?? "in_formation") as string,
        achieved_milestones: (progressData.achieved_milestones ?? {}) as Record<
          string,
          unknown
        >,
      };

      const modulesSnap = await tx.get(
        db.collection(`training_programs/${programId}/modules`),
      );
      modules = modulesSnap.docs.map((doc) => ({
        id: doc.id,
        order: typeof doc.data().order === "number" ? doc.data().order : 0,
        title: doc.data().title as string | undefined,
      }));

      if (modules.length === 0) {
        throw new HttpsError(
          "failed-precondition",
          "Programa sem módulos cadastrados.",
        );
      }

      const validation = validatePromotionState(promotion, progress, modules);
      if (!validation.valid) {
        throw new HttpsError("failed-precondition", validation.error!);
      }
    }

    // ── Phase 2: ALL WRITES ──

    const nowDate = new Date();
    const now = FieldValue.serverTimestamp();
    const fields = buildDecisionFields(
      decision,
      decider.ra,
      decider.uid,
      decider.email,
      reason ?? null,
      note ?? null,
    );

    const auditEntry = {
      action: decision === "approved" ? "evolution_approved" : "request_rejected",
      at: nowDate,
      by: decider.deciderName,
      by_uid: decider.uid,
      by_ra: decider.ra,
      by_email: decider.email,
      note: fields.decision_reason || undefined,
    };

    const requestUpdate: Record<string, unknown> = {
      ...fields,
      decided_at: now,
      updated_at: now,
      audit_trail: FieldValue.arrayUnion(auditEntry),
    };

    tx.update(
      docRef,
      requestUpdate as FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>,
    );

    if (decision === "approved" && progress && progressRef) {
      const progressUpdate = buildProgressUpdate(
        progress,
        promotion,
        modules,
        decider.ra,
        nowDate,
      );

      const progressWrite: Record<string, unknown> = {
        current_module: progressUpdate.current_module,
        completed_module_ids: progressUpdate.completed_module_ids,
        completed_modules: progressUpdate.completed_modules,
        updated_at: now,
      };

      if (progressUpdate.status) {
        progressWrite.status = progressUpdate.status;
      }

      if (progressUpdate.operational_since) {
        progressWrite.operational_since = progressUpdate.operational_since;
      }

      tx.update(
        progressRef,
        progressWrite as FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>,
      );
    }

    return { id: requestId, status: decision };
  });

  return result;
}
