"use client";

/**
 * K9 Ops Web — Health Web v1 / WEB-01B.6
 * Replace NutritionPlan dialog — structural replacement of the active plan.
 *
 * REPLACE is NOT a fourth callable and NOT a client-side "cancel then create".
 * It is the CREATE callable plus the expectation pair
 * (`expectedActivePlanId` + `expectedActiveRevision`), which the backend applies
 * as supersede-old + activate-new inside ONE transaction (WEB-01B.3). A
 * client-side sequence would leave a window with zero or two active plans and
 * would lose the atomic supersede, so this dialog never touches the CANCEL
 * track.
 *
 * Adapted from the pre-Foundation `nutrition-plan-replace-dialog`. Dropped:
 * `useEntities`, the inline dog selector and the parallel access control that
 * lived in its parent (`nutrition-plan-management`) — `dogId` and `plan` arrive
 * as props, and eligibility is decided by the panel.
 *
 * Two properties the source did NOT have, added here:
 *
 *   1. `supersededPlanId` correlation. The source displayed it; it never checked
 *      it against the plan the operator meant to replace (§31).
 *   2. Post-success reconciliation. The source left EDIT/REPLACE live against a
 *      plan the backend had already superseded (§23–§26). This dialog reports
 *      the outcome through `onReplaced` so the panel can withhold actions until
 *      the reader leaves the dead snapshot.
 */

import { useCallback, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isPotentiallyCommittedOutcome } from "../data/nutrition-plan-mutation-service";
import { useNutritionPlanMutations } from "../hooks/use-nutrition-plan-mutations";
import type { CreateNutritionPlanCommand } from "../mutation-types";
import type { MealPeriod, NutritionPlan } from "../types";

const PERIOD_OPTIONS: Array<{ value: MealPeriod; label: string }> = [
  { value: "morning", label: "Manhã" },
  { value: "afternoon", label: "Tarde" },
  { value: "evening", label: "Noite" },
  { value: "night", label: "Madrugada" },
  { value: "extra", label: "Extra" },
];

interface SlotDraft {
  id: string;
  period: MealPeriod;
  scheduledTime: string;
  targetGrams: string;
}

/**
 * PURE — WEB-01B.6
 *
 * Staleness of the REPLACE form against the reader.
 *
 * The dialog froze an expectation pair when it opened. If the reader has since
 * moved — the revision advanced, the plan was swapped, or the plan stopped being
 * active — that pair no longer describes the authority the operator is looking
 * at, and submitting it would be refused by the backend as a conflict.
 *
 * The expectations are deliberately NOT auto-refreshed to the new values (§16,
 * §17): silently re-pointing a structural replacement at a plan the operator
 * never reviewed is exactly the corruption this gate exists to prevent. The form
 * blocks and asks for a fresh read instead.
 *
 * `mutationStatus` suppresses a FALSE stale warning in the window where our own
 * successful REPLACE is the reason the reader changed — at that point the
 * dialog's own result explains the movement.
 */
export function shouldShowNutritionReplaceStale(input: {
  mutationStatus: string;
  planId: string;
  planRevision: number;
  planStatus: string;
  expectedActivePlanId: string;
  expectedActiveRevision: number;
}): boolean {
  if (input.mutationStatus !== "idle" && input.mutationStatus !== "ready") return false;
  return (
    input.planId !== input.expectedActivePlanId ||
    input.planRevision !== input.expectedActiveRevision ||
    input.planStatus !== "active"
  );
}

/**
 * PURE — WEB-01B.6
 *
 * Correlates a successful REPLACE response against the expectation the dialog
 * sent, and reports whether the backend superseded the plan the operator meant
 * to replace.
 *
 * The source repo displayed `supersededPlanId` without ever comparing it, so a
 * backend that superseded a DIFFERENT plan would have been reported to the
 * operator as a plain success. This does not attempt to repair such a response —
 * the transaction already happened — it only refuses to claim a specific
 * outcome that the response does not support.
 *
 * Deliberately tolerant about absence: `supersededPlanId` is optional in the
 * contract (`CreateNutritionPlanResult`), so a response that omits it is
 * "unconfirmed", NOT "mismatched". Treating a missing field as a mismatch would
 * invent an integrity alarm out of a contract-legal response.
 */
export type SupersedeCorrelation = "confirmed" | "unconfirmed" | "mismatch";

export function correlateSupersededPlan(input: {
  expectedActivePlanId: string;
  supersededPlanId?: string | null;
}): SupersedeCorrelation {
  if (input.supersededPlanId == null || input.supersededPlanId.trim() === "") {
    return "unconfirmed";
  }
  return input.supersededPlanId === input.expectedActivePlanId ? "confirmed" : "mismatch";
}

/**
 * PURE — WEB-01B.6
 *
 * Seeds the structural form from an existing plan.
 *
 * REPLACE pre-fills rather than starting blank because the operator is almost
 * always changing PART of the structure (grams, one meal time) and retyping the
 * rest invites transcription errors in a clinical record.
 *
 * Meal slot ids are preserved from the source plan where present. They identify
 * a slot within the schedule, not the plan document, so carrying them keeps the
 * grid stable while the operator edits.
 */
export function seedReplaceSlots(plan: NutritionPlan): SlotDraft[] {
  const schedule = plan.mealSchedule ?? [];
  if (schedule.length === 0) {
    return [{ id: "slot-1", period: "morning", scheduledTime: "08:00", targetGrams: "" }];
  }
  return schedule.map((slot, index) => ({
    id: slot.id || `slot-${index + 1}`,
    period: slot.period,
    scheduledTime: slot.scheduledTime,
    targetGrams: String(slot.targetGrams ?? ""),
  }));
}

/** Administrative values carried from the replaced plan onto the new one. */
export interface PreservedAdministrative {
  specialInstructions: string | null;
  professional: NutritionPlan["professional"] | null;
  sourceDocument: NutritionPlan["sourceDocument"] | null;
  attachmentRefs: string[] | null;
  supplements: NutritionPlan["supplements"] | null;
}

/** Formats a Date for a `type="date"` input, or "" when absent. */
export function toDateInputValue(value: Date | null | undefined): string {
  if (value == null) return "";
  const time = value.getTime();
  if (!Number.isFinite(time)) return "";
  return value.toISOString().slice(0, 10);
}

/**
 * PURE — WEB-01B.6
 *
 * Normalizes the read model's `sourceDocument` into the wire contract's
 * `HealthDocumentRef`, or reports that it cannot be carried.
 *
 * This is NOT a formality. The reader stores `source_document` as an arbitrary
 * `Record<string, unknown>` (nutrition-plan-service.ts:265) with no guarantee of
 * `health_document_id`, while the wire contract requires that field as a string.
 * Passing the read-model object straight through would emit
 * `health_document_id: undefined` — the reference to the vet's document would be
 * silently lost on the new plan, or the payload would be rejected.
 *
 * `null` means "the new plan carries no source document", which the UI states
 * explicitly rather than implying the reference survived.
 */
export function normalizeSourceDocument(
  sourceDocument: NutritionPlan["sourceDocument"] | null,
): { health_document_id: string; description?: string | null } | null {
  if (sourceDocument == null) return null;
  const raw =
    sourceDocument["health_document_id"] ??
    sourceDocument["healthDocumentId"] ??
    sourceDocument["id"];
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const description = sourceDocument["description"];
  return {
    health_document_id: raw.trim(),
    description: typeof description === "string" ? description : null,
  };
}

export type ReplaceCommandResult =
  | { ok: true; command: CreateNutritionPlanCommand }
  | { ok: false; error: string };

/**
 * PURE — WEB-01B.6
 *
 * Builds the REPLACE command: a CREATE command carrying the frozen expectation
 * pair. Extracted and exported for the same reason `buildNutritionPlanUpdatePatch`
 * was in WEB-01B.5R — every validation branch is then directly testable without
 * mounting the dialog.
 *
 * That matters more here than it looks. The numeric inputs carry `min` attributes,
 * so native constraint validation blocks a browser submit before this code runs;
 * the JS guards are the layer that holds when a value arrives any other way. A
 * rendered test cannot reach them at all, which would leave them unverified.
 *
 * `now` is injected rather than read from the clock so the validity-window check
 * is deterministic under test.
 *
 * IMPORTANT: the expectation pair arrives as explicit parameters and is emitted
 * as a unit (§18). The live plan is never a source here — see the frozen-snapshot
 * discipline in the dialog.
 */
export function buildNutritionPlanReplaceCommand(params: {
  dogId: string;
  expectedActivePlanId: string;
  expectedActiveRevision: number;
  foodType: string;
  timezone: string;
  hydrationMl: string;
  /**
   * The operator's validity end for the NEW plan, as a `yyyy-mm-dd` input value.
   * Empty means open-ended.
   *
   * This is an explicit form field rather than a value inherited from the replaced
   * plan. Inheriting it created a dead end: the reader only enforces
   * `validUntil > validFrom`, never `validUntil > now`, so an active plan whose
   * window has already closed parses as canonical and offers REPLACE — and an
   * inherited past date can then never produce a valid new plan. See §21.
   */
  validUntil: string;
  slots: SlotDraft[];
  preserved: PreservedAdministrative;
  now: Date;
}): ReplaceCommandResult {
  const cleanFoodType = params.foodType.trim();
  if (!cleanFoodType) {
    return { ok: false, error: "Informe o tipo de alimento do novo plano." };
  }

  const cleanTimezone = params.timezone.trim();
  if (!cleanTimezone) {
    return { ok: false, error: "Informe o fuso horário do plano." };
  }

  if (params.slots.length === 0) {
    return { ok: false, error: "Cadastre pelo menos uma refeição no cronograma." };
  }

  const mealSchedule = params.slots.map((slot) => ({
    id: slot.id,
    period: slot.period,
    scheduledTime: slot.scheduledTime,
    targetGrams: Number(slot.targetGrams),
  }));

  if (
    mealSchedule.some((slot) => !Number.isFinite(slot.targetGrams) || slot.targetGrams <= 0)
  ) {
    return { ok: false, error: "Cada refeição precisa de uma quantidade maior que zero." };
  }

  if (mealSchedule.some((slot) => !slot.scheduledTime.trim())) {
    return { ok: false, error: "Cada refeição precisa de um horário." };
  }

  const totalGrams = mealSchedule.reduce((sum, slot) => sum + slot.targetGrams, 0);

  let parsedHydrationMl: number | null = null;
  if (params.hydrationMl.trim() !== "") {
    const parsed = Number(params.hydrationMl);
    // Number.isFinite rejects Infinity and NaN together; the source's isNaN check
    // let Infinity through.
    if (!Number.isFinite(parsed) || parsed < 0) {
      return {
        ok: false,
        error: "A meta de hidratação deve ser maior ou igual a zero (ml/dia).",
      };
    }
    parsedHydrationMl = parsed;
  }

  /*
   * §21/§34 — the validity window comes from the OPERATOR, not from the plan being
   * replaced.
   *
   * The backend requires `valid_until > valid_from` strictly. Since the new plan's
   * `validFrom` is now, an end date at or before now is refused — but the operator
   * can always clear the field or pick a later date, so this is a correctable
   * validation rather than a dead end.
   *
   * Empty means open-ended (`null`), which is a legitimate plan shape and the
   * common case.
   */
  let resolvedValidUntil: string | null = null;
  if (params.validUntil.trim() !== "") {
    // A date-only input is interpreted at end of day, so choosing "today" means a
    // window that closes tonight rather than one that is already invalid.
    const until = new Date(`${params.validUntil.trim()}T23:59:59.999Z`);
    if (!Number.isFinite(until.getTime())) {
      return { ok: false, error: "A data de término de vigência é inválida." };
    }
    if (until.getTime() <= params.now.getTime()) {
      return {
        ok: false,
        error:
          "O término de vigência deve ser posterior ao início do novo plano. Ajuste ou limpe a data.",
      };
    }
    resolvedValidUntil = until.toISOString();
  }

  return {
    ok: true,
    command: {
      dogId: params.dogId,
      // Both halves, always together (§18).
      expectedActivePlanId: params.expectedActivePlanId,
      expectedActiveRevision: params.expectedActiveRevision,
      planData: {
        foodType: cleanFoodType,
        amountGramsPerDay: totalGrams,
        mealsPerDay: mealSchedule.length,
        timezone: cleanTimezone,
        validFrom: params.now.toISOString(),
        validUntil: resolvedValidUntil,
        mealSchedule,
        // Carried explicitly onto the new plan — CREATE authors a whole document,
        // so nothing is preserved implicitly.
        supplements: params.preserved.supplements ?? undefined,
        hydrationMl: parsedHydrationMl,
        specialInstructions: params.preserved.specialInstructions,
        professional: params.preserved
          .professional as CreateNutritionPlanCommand["planData"]["professional"],
        // Normalized, not passed through: the read model's shape does not
        // guarantee the wire contract's required health_document_id.
        sourceDocument: normalizeSourceDocument(params.preserved.sourceDocument),
        attachmentRefs: params.preserved.attachmentRefs,
      },
    },
  };
}

export interface NutritionPlanReplaceDialogProps {
  dogId: string;
  plan: NutritionPlan;
  open: boolean;
  onClose: () => void;
  /**
   * Fired once the backend confirmed the replacement, BEFORE the realtime reader
   * reports the new plan. The caller uses this to withhold EDIT and REPLACE
   * while the read model still shows the plan that was just superseded — acting
   * on a dead authority is a guaranteed dead end for the operator.
   *
   * Reports the snapshot that DIED (`supersededPlanId` / `supersededRevision`)
   * plus the plan the backend activated (`newPlanId`), so the caller can key its
   * latch on the exact snapshot it is waiting to see replaced. Also fires for an
   * idempotent replay (`wasNoOp`), which is a confirmed replacement just the
   * same.
   *
   * Success-only: it asserts `newPlanId` exists and is active. Never fired for an
   * unverifiable response — see `onReplaceOutcomeUncertain`.
   */
  onReplaced?: (outcome: {
    supersededPlanId: string;
    supersededRevision: number;
    newPlanId: string;
  }) => void;
  /**
   * Fired when the backend answered `success: true` but the client could not
   * verify the response (`invalid-mutation-response`).
   *
   * No `newPlanId`: the response is precisely what we refused to trust, so
   * `result.planId` carries no authority here. The latch does not need it — what
   * it needs is that the plan on screen MAY already be superseded, which is fully
   * expressed by the frozen expectation pair. The reader decides what replaced it.
   */
  onReplaceOutcomeUncertain?: (staleSnapshot: {
    planId: string;
    staleRevision: number;
  }) => void;
}

export function NutritionPlanReplaceDialog({
  dogId,
  plan,
  open,
  onClose,
  onReplaced,
  onReplaceOutcomeUncertain,
}: NutritionPlanReplaceDialogProps) {
  const { createState, prepareCreate, executeCreate, retryCreate, resetCreate } =
    useNutritionPlanMutations();

  /*
   * The expectation pair, frozen when the dialog opened.
   *
   * This is the WEB-01B.5R discipline applied to REPLACE: the LIVE plan must
   * never be the authority for what we are replacing. If another operator
   * advances the plan while this dialog is open, reading `plan.revision` at
   * submit time would silently re-point the replacement at a revision this
   * operator never reviewed. Frozen state + the stale gate instead.
   *
   * §18: both halves are frozen together and always sent together. The B.3
   * builder throws on a partial pair before any transport happens, so a UI bug
   * cannot produce a half-expectation on the wire.
   */
  const [expectedActivePlanId, setExpectedActivePlanId] = useState(plan.id);
  const [expectedActiveRevision, setExpectedActiveRevision] = useState(plan.revision);

  /*
   * Administrative fields are NOT edited here — REPLACE is structural, and B.5's
   * EDIT owns the administrative surface. They are frozen at open and carried
   * onto the new plan, so a replacement never silently drops the vet's
   * instructions or the responsible professional.
   *
   * Note this is NOT patch semantics (§35). UPDATE omits an unchanged field and
   * the backend preserves it; CREATE authors a whole new document, so every
   * value the new plan should carry must be stated explicitly in the payload.
   */
  const [preserved, setPreserved] = useState<PreservedAdministrative>(() => ({
    specialInstructions: plan.specialInstructions ?? null,
    professional: plan.professional ?? null,
    sourceDocument: plan.sourceDocument ?? null,
    attachmentRefs: plan.attachmentRefs ?? null,
    supplements: plan.supplements ?? null,
  }));

  const [foodType, setFoodType] = useState(plan.foodType ?? "");
  const [timezone, setTimezone] = useState(plan.timezone || "America/Sao_Paulo");
  const [hydrationMl, setHydrationMl] = useState(
    plan.hydrationMl != null ? String(plan.hydrationMl) : "",
  );
  /*
   * §21 — the operator's own validity end for the NEW plan. Seeded from the plan
   * being replaced as a convenience, but editable and clearable, so an inherited
   * date that has already passed is a correctable value rather than a dead end.
   */
  const [validUntil, setValidUntil] = useState(() => toDateInputValue(plan.validUntil));
  const [slots, setSlots] = useState<SlotDraft[]>(() => seedReplaceSlots(plan));

  const [localError, setLocalError] = useState<string | null>(null);
  const [correlation, setCorrelation] = useState<SupersedeCorrelation | null>(null);
  /*
   * The backend answered `success: true` and we could not verify the response.
   *
   * The panel latch withholds EDIT and REPLACE on the card, but the card is behind
   * this dialog. Without a lock here the submit button is live again (the hook
   * state is `error`, so `isBusy` is false), and another click would mint a NEW
   * operationId — a second structural replacement while the first one's fate is
   * unknown. This is the highest-risk resubmit of the three: plan A may already be
   * superseded and plan B already active.
   *
   * Local to the dialog: cleared on close, while the panel latch survives.
   */
  const [outcomeUncertain, setOutcomeUncertain] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);

  // Re-seed during render on the closed -> open edge, so a reopen never carries
  // values (or an expectation pair) left over from a previous session. Not keyed
  // on the plan prop: a plan change while OPEN is the stale case, and re-seeding
  // there would discard the operator's edits and re-point the expectations.
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setExpectedActivePlanId(plan.id);
      setExpectedActiveRevision(plan.revision);
      setPreserved({
        specialInstructions: plan.specialInstructions ?? null,
        professional: plan.professional ?? null,
        sourceDocument: plan.sourceDocument ?? null,
        attachmentRefs: plan.attachmentRefs ?? null,
        supplements: plan.supplements ?? null,
      });
      setFoodType(plan.foodType ?? "");
      setTimezone(plan.timezone || "America/Sao_Paulo");
      setHydrationMl(plan.hydrationMl != null ? String(plan.hydrationMl) : "");
      setValidUntil(toDateInputValue(plan.validUntil));
      setSlots(seedReplaceSlots(plan));
      setLocalError(null);
      setCorrelation(null);
    }
  }

  const isBusy =
    createState.status === "preparing" || createState.status === "executing";
  const isSuccess = createState.status === "success";
  // An uncertain outcome is NOT an ordinary error: claiming "failed" would invite
  // the retry we must not allow. It gets its own surface below.
  const isError = createState.status === "error" && !outcomeUncertain;

  const isStale = shouldShowNutritionReplaceStale({
    mutationStatus: createState.status,
    planId: plan.id,
    planRevision: plan.revision,
    planStatus: plan.status,
    expectedActivePlanId,
    expectedActiveRevision,
  });

  const totalGrams = useMemo(
    () =>
      slots.reduce((sum, slot) => {
        const parsed = Number(slot.targetGrams);
        return sum + (Number.isFinite(parsed) ? parsed : 0);
      }, 0),
    [slots],
  );

  const addSlot = useCallback(() => {
    setSlots((current) => [
      ...current,
      {
        id: `slot-${current.length + 1}`,
        period: "morning",
        scheduledTime: "08:00",
        targetGrams: "",
      },
    ]);
  }, []);

  const removeSlot = useCallback((id: string) => {
    setSlots((current) =>
      current.length <= 1 ? current : current.filter((slot) => slot.id !== id),
    );
  }, []);

  const updateSlot = useCallback((id: string, patch: Partial<SlotDraft>) => {
    setSlots((current) =>
      current.map((slot) => (slot.id === id ? { ...slot, ...patch } : slot)),
    );
  }, []);

  const handleClose = useCallback(() => {
    // Closing mid-flight would leave a sent mutation without a surface to report
    // on, and the hook's stale-completion guard would discard the result. All
    // four close paths (Escape, backdrop, X, Fechar) funnel through here.
    if (isBusy) return;
    // Only the dialog's local lock is cleared. The panel latch is the caller's
    // state and stays engaged, so closing this cannot buy back EDIT or REPLACE.
    setOutcomeUncertain(false);
    resetCreate();
    onClose();
  }, [isBusy, onClose, resetCreate]);

  /**
   * Delegates to the exported pure builder so every validation branch is testable
   * without mounting the dialog. Only the frozen expectation pair is passed as the
   * replacement authority — never the live plan.
   */
  function buildCommand(): CreateNutritionPlanCommand | null {
    const result = buildNutritionPlanReplaceCommand({
      dogId,
      expectedActivePlanId,
      expectedActiveRevision,
      foodType,
      timezone,
      hydrationMl,
      validUntil,
      slots,
      preserved,
      now: new Date(),
    });
    if (!result.ok) {
      setLocalError(result.error);
      return null;
    }
    return result.command;
  }

  /** Reports the outcome, correlating the supersede against what we expected. */
  function reportOutcome(result: {
    planId: string;
    supersededPlanId?: string | null;
  }) {
    setCorrelation(
      correlateSupersededPlan({
        expectedActivePlanId,
        supersededPlanId: result.supersededPlanId,
      }),
    );
    // The snapshot that died is the one we sent expectations for — NOT the live
    // plan, which may already have moved.
    onReplaced?.({
      supersededPlanId: expectedActivePlanId,
      supersededRevision: expectedActiveRevision,
      newPlanId: result.planId,
    });
  }

  /**
   * Latches the caller against the frozen expectation pair when the outcome is
   * unknowable.
   *
   * Note what is NOT done here: `setCorrelation` is not called. Correlation state
   * describes a response we accepted, and this response was rejected. Normal
   * rejections fall through untouched — the backend refused, so the plan on
   * screen is still the live authority.
   */
  const reportUncertainOutcome = (error: unknown) => {
    if (isPotentiallyCommittedOutcome(error)) {
      setOutcomeUncertain(true);
      onReplaceOutcomeUncertain?.({
        planId: expectedActivePlanId,
        staleRevision: expectedActiveRevision,
      });
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isBusy) return;
    // Belt and braces: the button is disabled, but a form submit can also arrive
    // from Enter or programmatically, and past here we would mint a new
    // operationId for a second structural replacement.
    if (outcomeUncertain) return;

    setLocalError(null);

    // The expectation pair no longer describes what the reader shows. Fail
    // closed: no transport, no silently refreshed expectations.
    if (isStale) {
      setLocalError(
        "O plano foi alterado por outra operação. Recarregue antes de substituir.",
      );
      return;
    }

    const command = buildCommand();
    if (command === null) return;

    try {
      // prepare mints the operationId once and freezes the intent; execute sends
      // that frozen intent. The hook publishes it to a ref synchronously, so it
      // is available to executeCreate in this same turn without a re-render.
      prepareCreate(command);
      const result = await executeCreate();
      reportOutcome(result);
    } catch (error) {
      // Normalized into createState by the hook. The dangerous case: the backend
      // may have superseded the plan still on screen.
      reportUncertainOutcome(error);
    }
  };

  const handleRetry = async () => {
    // Once the outcome is uncertain, no further attempt is safe — not even a
    // same-operationId replay, which would return the same unverifiable payload.
    if (outcomeUncertain) return;
    try {
      // Same prepared intent: same operationId, same planData, same expectation
      // pair. The backend treats it as a replay, never as a second replacement.
      const result = await retryCreate();
      reportOutcome(result);
    } catch (error) {
      // A replay implies a first attempt already persisted a replacement. Same
      // latch as the initial execute.
      reportUncertainOutcome(error);
    }
  };

  const retryable =
    createState.status === "error" &&
    !outcomeUncertain &&
    !("kind" in createState.error) &&
    createState.error.retryable;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Substituir plano alimentar"
      description="Criar um novo plano alimentar e substituir o plano vigente"
      className="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/*
          §28 — a mismatch is NOT a normal success.
          The backend reporting that it superseded a plan the operator never
          authorized is a serious integrity inconsistency. It gets its own alert
          surface instead of a line inside the green banner, so it cannot be
          skimmed past. The transaction already happened, so this does not pretend
          to undo it — it refuses to describe the outcome as routine and tells the
          operator to verify the history before acting again.

          The latch still engages either way (see reportOutcome): whatever the
          backend did, the plan on screen is no longer trustworthy authority.
        */}
        {isSuccess && correlation === "mismatch" && (
          <div
            data-testid="replace-plan-supersede-mismatch"
            role="alert"
            className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200"
          >
            <p className="font-semibold">Inconsistência detectada na substituição.</p>
            <p className="mt-1">
              A operação foi concluída, mas o plano arquivado pelo servidor não é o
              plano que estava em tela. Não faça novas alterações neste K9 antes de
              conferir o histórico de planos alimentares.
            </p>
          </div>
        )}

        {isSuccess && correlation !== "mismatch" && (
          <div
            data-testid="replace-plan-success"
            role="status"
            className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200"
          >
            <p>Novo plano alimentar ativado. O plano anterior foi arquivado.</p>
            {createState.result?.wasNoOp && (
              <p data-testid="replace-plan-replay" className="mt-1 text-emerald-300/80">
                Operação já havia sido registrada anteriormente.
              </p>
            )}
            {/*
              §31 — correlation, not decoration. "confirmed" is the only state that
              may claim WHICH plan was superseded, so "unconfirmed" says plainly
              that the response did not detail it.
            */}
            {correlation === "unconfirmed" && (
              <p
                data-testid="replace-plan-supersede-unconfirmed"
                className="mt-1 text-emerald-300/80"
              >
                O arquivamento do plano anterior não foi detalhado na resposta.
              </p>
            )}
          </div>
        )}

        {isStale && (
          <p
            data-testid="replace-plan-stale"
            role="alert"
            className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-200"
          >
            O plano alimentar foi alterado por outra operação enquanto este formulário
            estava aberto. Recarregue para revisar o plano vigente antes de substituir.
          </p>
        )}

        {localError && (
          <p
            data-testid="replace-plan-local-error"
            role="alert"
            className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-200"
          >
            {localError}
          </p>
        )}

        {/*
          Neither the success nor the error surface. "Falha ao substituir" reads as
          "the old plan is still active", which is the most dangerous thing we
          could imply here: it invites a retry that could produce a second
          replacement. The copy states what we know — unconfirmed — and names both
          possibilities without asserting either. No planId, no revision.
        */}
        {outcomeUncertain && (
          <p
            data-testid="replace-plan-outcome-uncertain"
            role="alert"
            className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100"
          >
            Não foi possível confirmar o resultado desta operação. A substituição
            pode ter sido concluída. Aguarde a atualização das informações antes de
            tentar novamente.
          </p>
        )}

        {isError && (
          <div
            data-testid="replace-plan-error"
            role="alert"
            className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200"
          >
            {/*
              Safe copy only. A stale conflict (active-plan-conflict /
              revision-conflict) is NOT auto-retried and NOT auto-refreshed: the
              operator must review the reconciled state (§22).
            */}
            <p>{createState.error.message}</p>
            {retryable && (
              <Button
                type="button"
                variant="secondary"
                className="mt-3"
                onClick={handleRetry}
                data-testid="replace-plan-retry"
              >
                Tentar novamente
              </Button>
            )}
          </div>
        )}

        {/* The authority being replaced — the frozen pair, not the live plan. */}
        <p className="text-[11px] text-muted-foreground">
          Substituindo o plano{" "}
          <strong data-testid="replace-plan-expected-id">{expectedActivePlanId}</strong>, revisão{" "}
          <strong data-testid="replace-plan-expected-revision">
            {expectedActiveRevision}
          </strong>
          .
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="replace-food-type">Tipo de alimento</Label>
            {/*
              No `required`: native constraint validation would block submit
              before handleSubmit runs, making our own validation unreachable.
            */}
            <Input
              id="replace-food-type"
              value={foodType}
              onChange={(event) => setFoodType(event.target.value)}
              disabled={isBusy || isSuccess}
            />
          </div>
          <div>
            <Label htmlFor="replace-hydration">Hidratação (ml/dia)</Label>
            <Input
              id="replace-hydration"
              type="number"
              min={0}
              value={hydrationMl}
              onChange={(event) => setHydrationMl(event.target.value)}
              disabled={isBusy || isSuccess}
            />
          </div>
        </div>

        <fieldset className="rounded-2xl border border-border/60 p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Nova grade de refeições
          </legend>

          <ul className="mt-2 space-y-3">
            {slots.map((slot) => (
              <li key={slot.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <div>
                  <Label htmlFor={`${slot.id}-replace-period`}>Período</Label>
                  <select
                    id={`${slot.id}-replace-period`}
                    value={slot.period}
                    disabled={isBusy || isSuccess}
                    onChange={(event) =>
                      updateSlot(slot.id, { period: event.target.value as MealPeriod })
                    }
                    className="h-10 w-full rounded-xl border border-border/60 bg-background/40 px-3 text-sm"
                  >
                    {PERIOD_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor={`${slot.id}-replace-time`}>Horário</Label>
                  <Input
                    id={`${slot.id}-replace-time`}
                    type="time"
                    value={slot.scheduledTime}
                    disabled={isBusy || isSuccess}
                    onChange={(event) =>
                      updateSlot(slot.id, { scheduledTime: event.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor={`${slot.id}-replace-grams`}>Quantidade (g)</Label>
                  <Input
                    id={`${slot.id}-replace-grams`}
                    type="number"
                    min={1}
                    value={slot.targetGrams}
                    disabled={isBusy || isSuccess}
                    onChange={(event) =>
                      updateSlot(slot.id, { targetGrams: event.target.value })
                    }
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label="Remover refeição"
                    disabled={isBusy || isSuccess || slots.length <= 1}
                    onClick={() => removeSlot(slot.id)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex items-center justify-between">
            <Button
              type="button"
              variant="secondary"
              onClick={addSlot}
              disabled={isBusy || isSuccess}
            >
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Adicionar refeição
            </Button>
            <p className="text-xs text-muted-foreground">
              Total diário: <strong data-testid="replace-plan-total">{totalGrams}</strong> g
            </p>
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="replace-timezone">Fuso horário</Label>
            <Input
              id="replace-timezone"
              value={timezone}
              disabled={isBusy || isSuccess}
              onChange={(event) => setTimezone(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="replace-valid-until">Término de vigência (opcional)</Label>
            {/*
              §21 — editable and clearable. An inherited date that has already
              passed must be correctable here, or REPLACE would be unreachable for
              a plan whose window has closed.
            */}
            <Input
              id="replace-valid-until"
              type="date"
              value={validUntil}
              disabled={isBusy || isSuccess}
              onChange={(event) => setValidUntil(event.target.value)}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Deixe vazio para vigência sem prazo definido.
            </p>
          </div>
        </div>

        {/*
          §22/§23 — REPLACE authors a NEW document, so what the new plan carries
          must be stated, not implied. Editing these values is EDIT (B.5).

          The source-document line distinguishes two genuinely different outcomes:
          carried with its reference intact, versus present on the old plan but not
          resolvable into the wire contract's required health_document_id — in which
          case the new plan will NOT have it. Calling that "preserved" would be
          false.
        */}
        <div
          className="rounded-2xl border border-border/60 p-4 text-[11px] text-muted-foreground"
          data-testid="replace-plan-preserved"
        >
          <p className="font-semibold uppercase tracking-[0.14em]">
            O novo plano receberá
          </p>
          <ul className="mt-2 space-y-1">
            <li>
              Instruções especiais:{" "}
              {preserved.specialInstructions ? "mantidas" : "nenhuma"}
            </li>
            <li>
              Profissional responsável: {preserved.professional ? "mantido" : "nenhum"}
            </li>
            <li data-testid="replace-plan-supplements-disposition">
              Suplementos do plano:{" "}
              {(preserved.supplements?.length ?? 0) > 0
                ? `${preserved.supplements!.length} mantido(s)`
                : "nenhum"}
            </li>
            <li data-testid="replace-plan-source-document-disposition">
              Documento de origem:{" "}
              {preserved.sourceDocument == null
                ? "nenhum"
                : normalizeSourceDocument(preserved.sourceDocument) !== null
                  ? "mantido"
                  : "não será vinculado (referência do plano atual incompleta)"}
            </li>
            <li>
              Anexos:{" "}
              {(preserved.attachmentRefs?.length ?? 0) > 0
                ? `${preserved.attachmentRefs!.length} mantido(s)`
                : "nenhum"}
            </li>
          </ul>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isBusy}
            data-testid="replace-plan-close"
          >
            Fechar
          </Button>
          {!isSuccess && (
            <Button
              type="submit"
              disabled={isBusy || isStale || outcomeUncertain}
              data-testid="replace-plan-submit"
            >
              {isBusy ? "Substituindo..." : "Substituir plano"}
            </Button>
          )}
        </div>
      </form>
    </Dialog>
  );
}
