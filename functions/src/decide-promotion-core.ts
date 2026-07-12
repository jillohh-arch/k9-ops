import { type Firestore, type FieldValue as FieldValueType } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

import {
  buildDecisionFields,
  buildProgressUpdate,
  resolveNextModule,
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
  success: boolean;
  decision: "approved" | "rejected";
  dogId: string;
  modality: string;
  moduleId: string;
  isLastModule?: boolean;
  nextModuleId?: string | null;
}

// ─── Core Transaction ───────────────────────────────────────────────────────

/**
 * Core transactional logic for deciding a promotion request.
 * Separated from the callable wrapper for Emulator testability.
 *
 * This function:
 * 1. Reads the promotion request, progress doc, and program modules inside a transaction.
 * 2. Validates state consistency (version, module, status).
 * 3. On approval: updates progress (next module, completed_modules) and promotion doc.
 * 4. On rejection: updates only the promotion doc.
 *
 * All writes happen atomically inside the transaction.
 */
export async function decidePromotionCore(
  db: Firestore,
  FieldValue: typeof FieldValueType,
  decider: DeciderContext,
  payload: DecisionPayload,
): Promise<DecisionResult> {
  const { requestId, decision, reason, note } = payload;

  return db.runTransaction(async (transaction) => {
    // ── Read promotion request ──
    const promotionRef = db.collection("promotion_requests").doc(requestId);
    const promotionSnap = await transaction.get(promotionRef);

    if (!promotionSnap.exists) {
      throw new HttpsError("not-found", "Solicitação de promoção não encontrada.");
    }

    const promotion = promotionSnap.data() as PromotionDoc;

    // ── Read progress doc ──
    const progressRef = db
      .collection("training_progress")
      .doc(`${promotion.dog_id}_${promotion.program_id}`);
    const progressSnap = await transaction.get(progressRef);

    if (!progressSnap.exists) {
      throw new HttpsError("not-found", "Progresso do K9 não encontrado.");
    }

    const progress = progressSnap.data() as ProgressDoc;

    // ── Read program modules ──
    const modulesSnap = await transaction.get(
      db.collection("training_programs").doc(promotion.program_id).collection("modules"),
    );

    const modules: ModuleEntry[] = modulesSnap.docs.map((doc) => ({
      id: doc.id,
      order: (doc.data().order as number) ?? 0,
      title: (doc.data().title as string) ?? "",
    }));

    // ── Validate ──
    const validation = validatePromotionState(promotion, progress, modules);
    if (!validation.valid) {
      throw new HttpsError("failed-precondition", validation.error!);
    }

    // ── Build decision fields ──
    const decisionFields = buildDecisionFields(
      decision,
      decider.ra,
      decider.uid,
      decider.email,
      reason ?? null,
      note ?? null,
    );

    const decidedAt = new Date();

    // ── Write promotion doc ──
    transaction.update(promotionRef, {
      ...decisionFields,
      decided_at: decidedAt,
      decided_by_name: decider.deciderName,
      updated_at: FieldValue.serverTimestamp(),
    });

    // ── If approved, update progress ──
    let isLastModule = false;
    let nextModuleId: string | null = null;

    if (decision === "approved") {
      const progressUpdate = buildProgressUpdate(
        progress,
        promotion,
        modules,
        decider.ra,
        decidedAt,
      );

      const resolved = resolveNextModule(modules, promotion.module_id);
      isLastModule = resolved.isLastModule;
      nextModuleId = resolved.nextModuleId;

      transaction.update(progressRef, {
        ...progressUpdate,
        program_version: promotion.program_version,
        updated_at: FieldValue.serverTimestamp(),
      });

      // Update dog status if last module (operational)
      if (isLastModule) {
        const dogRef = db.collection("dogs").doc(promotion.dog_id);
        transaction.update(dogRef, {
          [`training_status.${promotion.modality}`]: "operational",
          [`training_status.${promotion.modality}_since`]: decidedAt,
          updated_at: FieldValue.serverTimestamp(),
        });
      }
    }

    return {
      success: true,
      decision,
      dogId: promotion.dog_id,
      modality: promotion.modality,
      moduleId: promotion.module_id,
      isLastModule,
      nextModuleId,
    };
  });
}
