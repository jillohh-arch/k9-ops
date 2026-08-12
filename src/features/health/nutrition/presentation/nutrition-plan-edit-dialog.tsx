"use client";

/**
 * K9 Ops Web — Health Web v1 / WEB-01B.5
 * Administrative UPDATE of the active NutritionPlan.
 *
 * Adapted from the pre-Foundation `nutrition-plan-edit-dialog`, minus the
 * management orchestrator, the dog selector and the parallel authorization read.
 *
 * ADMINISTRATIVE ONLY. The form exposes `specialInstructions` and
 * `professional`, and nothing else. Structural fields (foodType,
 * amountGramsPerDay, mealsPerDay, timezone, validity window, mealSchedule,
 * supplements, hydration) are absent by design: changing any of them is REPLACE
 * (B.6). They are not rendered even as read-only inputs, so there is no control
 * a user could mistake for editable.
 *
 * `sourceDocument` and `attachmentRefs` are part of the backend's administrative
 * set but are NOT edited here — following the source repo, they are omitted from
 * the patch so existing values are preserved. Editing them needs a document
 * picker/Storage surface, which is out of scope.
 *
 * The patch is minimal and computed by comparison against the snapshot taken
 * when the dialog opened:
 *   unchanged      -> field omitted (backend preserves it)
 *   edited value   -> field sent with the new value
 *   cleared        -> field sent as null (explicit clear)
 * Conflating "unchanged" with "clear" would silently erase a veterinarian's
 * instructions, so the distinction is enforced field by field.
 */

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNutritionPlanMutations } from "../hooks/use-nutrition-plan-mutations";
import type { NutritionPlanUpdateChanges, ProfessionalIdentity } from "../mutation-types";
import type { NutritionPlan } from "../types";
/** Snapshot of the professional object at the moment the dialog opened. */
type FrozenProfessional = NutritionPlan["professional"] | null;

/**
 * The reader moved the plan out from under an open dialog. Exported so the
 * behaviour is directly testable, mirroring the source helper.
 */
export function shouldShowNutritionUpdateStale(input: {
  mutationStatus: string;
  planId: string;
  planRevision: number;
  initialPlanId: string;
  initialRevision: number;
}): boolean {
  // Once the mutation is resolved, its own result explains the revision change.
  if (input.mutationStatus !== "idle" && input.mutationStatus !== "ready") return false;
  return (
    input.planId !== input.initialPlanId || input.planRevision !== input.initialRevision
  );
}

/** Reads a professional field tolerating both wire and camelCase spellings. */
function profField(
  professional: NutritionPlan["professional"] | null,
  snake: string,
  camel: string,
): string {
  const value = professional?.[snake] ?? professional?.[camel];
  return typeof value === "string" ? value : "";
}

export interface NutritionPlanEditDialogProps {
  dogId: string;
  plan: NutritionPlan;
  open: boolean;
  onClose: () => void;
  /**
   * Fired once the backend confirmed the update, BEFORE the realtime reader
   * reports the new revision. The caller uses this to withhold EDIT while the
   * read model still shows the superseded revision, so a follow-up UPDATE cannot
   * be started against a revision that is already stale. Also fires on an
   * idempotent replay (`wasNoOp`).
   */
  onUpdated?: (resultingRevision: number) => void;
}

export function NutritionPlanEditDialog({
  dogId,
  plan,
  open,
  onClose,
  onUpdated,
}: NutritionPlanEditDialogProps) {
  const { updateState, prepareUpdate, executeUpdate, retryUpdate, resetUpdate } =
    useNutritionPlanMutations();

  // Snapshot frozen when the dialog opens. `expectedRevision` and the field
  // baselines come from here, never from the live plan.
  const [initialPlanId, setInitialPlanId] = useState(plan.id);
  const [initialRevision, setInitialRevision] = useState(plan.revision);
  const [initialInstructions, setInitialInstructions] = useState(
    plan.specialInstructions ?? "",
  );
  const [initialProfessional, setInitialProfessional] = useState<FrozenProfessional>(
    plan.professional ?? null,
  );

  const [specialInstructions, setSpecialInstructions] = useState(
    plan.specialInstructions ?? "",
  );
  const [showProfessional, setShowProfessional] = useState(Boolean(plan.professional));
  const [profName, setProfName] = useState(profField(plan.professional, "name", "name"));
  const [profRegType, setProfRegType] = useState(
    profField(plan.professional, "registration_type", "registrationType") || "CRMV",
  );
  const [profRegNum, setProfRegNum] = useState(
    profField(plan.professional, "registration_number", "registrationNumber"),
  );
  const [profClinic, setProfClinic] = useState(profField(plan.professional, "clinic", "clinic"));
  const [profSpecialty, setProfSpecialty] = useState(
    profField(plan.professional, "specialty", "specialty"),
  );

  const [localError, setLocalError] = useState<string | null>(null);
  const [prevOpen, setPrevOpen] = useState(open);

  // Re-seed during render when the dialog opens, so a reopen never shows values
  // left over from a previous session.
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setInitialPlanId(plan.id);
      setInitialRevision(plan.revision);
      setInitialInstructions(plan.specialInstructions ?? "");
      setSpecialInstructions(plan.specialInstructions ?? "");
      setInitialProfessional(plan.professional ?? null);
      setShowProfessional(Boolean(plan.professional));
      setProfName(profField(plan.professional, "name", "name"));
      setProfRegType(
        profField(plan.professional, "registration_type", "registrationType") || "CRMV",
      );
      setProfRegNum(profField(plan.professional, "registration_number", "registrationNumber"));
      setProfClinic(profField(plan.professional, "clinic", "clinic"));
      setProfSpecialty(profField(plan.professional, "specialty", "specialty"));
      setLocalError(null);
    }
  }

  const isBusy = updateState.status === "preparing" || updateState.status === "executing";
  const isSuccess = updateState.status === "success";
  const isError = updateState.status === "error";

  const isStale = shouldShowNutritionUpdateStale({
    mutationStatus: updateState.status,
    planId: plan.id,
    planRevision: plan.revision,
    initialPlanId,
    initialRevision,
  });

  /**
   * Minimal patch against the opening snapshot. A field absent from the returned
   * object means "preserve"; `null` means "clear".
   */
  function buildPatch(): { patch: NutritionPlanUpdateChanges; hasChanges: boolean } {
    const patch: NutritionPlanUpdateChanges = {};
    let hasChanges = false;

    const current = specialInstructions.trim();
    const initial = initialInstructions.trim();
    if (current !== initial) {
      patch.specialInstructions = current.length > 0 ? current : null;
      hasChanges = true;
    }

    const initialProf = initialProfessional;
    if (!showProfessional) {
      // Explicit clear, only if there was something to clear.
      if (initialProf != null) {
        patch.professional = null;
        hasChanges = true;
      }
    } else {
      const name = profName.trim();
      const regType = profRegType.trim();
      const regNum = profRegNum.trim();
      const clinic = profClinic.trim();
      const specialty = profSpecialty.trim();

      const changed =
        name !== profField(initialProf, "name", "name").trim() ||
        regType !== profField(initialProf, "registration_type", "registrationType").trim() ||
        regNum !== profField(initialProf, "registration_number", "registrationNumber").trim() ||
        clinic !== profField(initialProf, "clinic", "clinic").trim() ||
        specialty !== profField(initialProf, "specialty", "specialty").trim();

      if (changed) {
        const professional: ProfessionalIdentity = {
          name,
          registration_type: regType,
          registration_number: regNum,
          clinic: clinic || null,
          specialty: specialty || null,
        };
        patch.professional = professional;
        hasChanges = true;
      }
    }

    return { patch, hasChanges };
  }

  const { hasChanges } = buildPatch();

  const handleClose = () => {
    if (isBusy) return;
    resetUpdate();
    setLocalError(null);
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isBusy) return;

    setLocalError(null);

    if (isStale) {
      setLocalError(
        "O plano foi atualizado em outro contexto. Feche e revise os dados atuais antes de editar.",
      );
      return;
    }

    if (showProfessional) {
      if (!profName.trim()) {
        setLocalError("Informe o nome do profissional responsável.");
        return;
      }
      if (!profRegType.trim()) {
        setLocalError("Informe o tipo de registro do profissional.");
        return;
      }
      if (!profRegNum.trim()) {
        setLocalError("Informe o número de registro do profissional.");
        return;
      }
    }

    const { patch, hasChanges: dirty } = buildPatch();
    if (!dirty) {
      setLocalError("Nenhuma alteração foi realizada nos dados administrativos.");
      return;
    }

    try {
      // planId, expectedRevision, changes and operationId are frozen together by
      // prepareUpdate; retry re-sends that same intent untouched.
      prepareUpdate({
        dogId,
        planId: initialPlanId,
        expectedRevision: initialRevision,
        changes: patch,
      });
      const result = await executeUpdate();
      onUpdated?.(result.revision);
    } catch {
      // Normalized into updateState by the hook.
    }
  };

  const handleRetry = async () => {
    try {
      // Same operationId, same expectedRevision — a replay, not a new operation.
      const result = await retryUpdate();
      onUpdated?.(result.revision);
    } catch {
      // Normalized into updateState by the hook.
    }
  };

  const retryable =
    updateState.status === "error" &&
    !("kind" in updateState.error) &&
    updateState.error.retryable;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Editar dados administrativos"
      description="Alterar instruções especiais e profissional responsável do plano vigente"
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <p className="rounded-2xl border border-cyan-200/12 bg-cyan-300/[0.05] p-3 text-[11px] leading-relaxed text-cyan-100/80">
          Somente dados administrativos podem ser alterados. Mudanças na composição
          do plano (alimento, quantidade, refeições, vigência) exigem substituição
          do plano vigente.
        </p>

        {isSuccess && (
          <p
            data-testid="edit-plan-success"
            role="status"
            className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200"
          >
            Dados administrativos atualizados com sucesso.
          </p>
        )}

        {isStale && !isSuccess && (
          <p
            data-testid="edit-plan-stale"
            role="alert"
            className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-200"
          >
            O plano vigente mudou enquanto esta edição estava aberta. Feche e
            revise os dados atuais.
          </p>
        )}

        {localError && (
          <p
            data-testid="edit-plan-local-error"
            role="alert"
            className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-200"
          >
            {localError}
          </p>
        )}

        {isError && (
          <div
            data-testid="edit-plan-error"
            role="alert"
            className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200"
          >
            {/* Safe copy only; R1 already sanitized internal-integrity details. */}
            <p>{updateState.error.message}</p>
            {retryable && (
              <Button
                type="button"
                variant="secondary"
                className="mt-3"
                onClick={handleRetry}
                data-testid="edit-plan-retry"
              >
                Tentar novamente
              </Button>
            )}
          </div>
        )}

        <div>
          <Label htmlFor="edit-special-instructions">Instruções especiais</Label>
          <textarea
            id="edit-special-instructions"
            value={specialInstructions}
            disabled={isBusy}
            onChange={(event) => setSpecialInstructions(event.target.value)}
            rows={3}
            className="mt-1 w-full rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Deixar em branco remove as instruções registradas.
          </p>
        </div>

        <fieldset className="rounded-2xl border border-border/60 p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Profissional responsável
          </legend>

          <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={showProfessional}
              disabled={isBusy}
              onChange={(event) => setShowProfessional(event.target.checked)}
              data-testid="edit-plan-professional-toggle"
            />
            Registrar profissional responsável
          </label>

          {showProfessional && (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="edit-prof-name">Nome</Label>
                <Input
                  id="edit-prof-name"
                  value={profName}
                  disabled={isBusy}
                  onChange={(event) => setProfName(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="edit-prof-reg-type">Tipo de registro</Label>
                <Input
                  id="edit-prof-reg-type"
                  value={profRegType}
                  disabled={isBusy}
                  onChange={(event) => setProfRegType(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="edit-prof-reg-num">Número do registro</Label>
                <Input
                  id="edit-prof-reg-num"
                  value={profRegNum}
                  disabled={isBusy}
                  onChange={(event) => setProfRegNum(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="edit-prof-clinic">Clínica</Label>
                <Input
                  id="edit-prof-clinic"
                  value={profClinic}
                  disabled={isBusy}
                  onChange={(event) => setProfClinic(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="edit-prof-specialty">Especialidade</Label>
                <Input
                  id="edit-prof-specialty"
                  value={profSpecialty}
                  disabled={isBusy}
                  onChange={(event) => setProfSpecialty(event.target.value)}
                />
              </div>
            </div>
          )}
        </fieldset>

        <p className="text-[11px] text-muted-foreground">
          Revisão base desta edição:{" "}
          <strong data-testid="edit-plan-expected-revision">{initialRevision}</strong>
        </p>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isBusy}
            data-testid="edit-plan-close"
          >
            Fechar
          </Button>
          {!isSuccess && (
            <Button
              type="submit"
              disabled={isBusy || isStale || !hasChanges}
              data-testid="edit-plan-submit"
            >
              {isBusy ? "Salvando..." : "Salvar alterações"}
            </Button>
          )}
        </div>
      </form>
    </Dialog>
  );
}
