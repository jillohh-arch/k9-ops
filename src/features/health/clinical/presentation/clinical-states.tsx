/**
 * K9 Ops Web — Health Web v1 HW-6A.I3
 * Loading / forbidden / error technical states for /health/clinical.
 *
 * MANDATES:
 * - The skeleton renders NO real number and NO status label — a loading screen
 *   must never look like an answer (no "0 casos", no "Aberto").
 * - forbidden, error and empty are THREE different screens. A denial is an
 *   authorization outcome; a technical failure is a transport outcome; an empty
 *   scope is a proven zero. None is ever shown as another.
 * - The forbidden screen tells the operator WHICH permission is missing in
 *   HUMAN terms ("Leitura de Saúde"). The raw canonical capability token
 *   (`health.read`) stays in state/logic and is NEVER printed in the UI —
 *   an operator holding only legacy `health.view` should understand what they
 *   lack without reading a developer identifier. (RF §18)
 * - That denial is stated EXACTLY ONCE (RF2 §8): one title, one explanation,
 *   one capability hint. The state's generic `message` is not echoed, because
 *   it only restated the title in slightly different words.
 */

import { AlertOctagon, Ban } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Human-facing label for a canonical capability token. The forbidden screen
 * never renders the raw token; it renders this institutional phrasing. Unknown
 * tokens fall back to a generic Health-read phrasing rather than leaking the
 * identifier.
 */
const CAPABILITY_LABELS: Record<string, string> = {
  "health.read": "Leitura de Saúde",
};

function humanCapabilityLabel(capability: string): string {
  return CAPABILITY_LABELS[capability] ?? "Leitura de Saúde";
}

/** Stable skeleton: KPI row, filter bar, two grouped list blocks. No data. */
export function ClinicalListSkeleton() {
  return (
    <div
      className="flex animate-pulse flex-col gap-6"
      data-testid="clinical-skeleton"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Carregando casos clínicos...</span>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="flex h-[104px] flex-col justify-between rounded-2xl border border-cyan-200/12 bg-[#0b1628]/60 p-3.5"
          >
            <div className="flex items-start justify-between">
              <div className="h-8 w-8 rounded-lg bg-muted/50" />
              <div className="h-7 w-8 rounded bg-muted/40" />
            </div>
            <div className="h-3 w-24 rounded bg-muted/30" />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2.5 rounded-2xl border border-cyan-200/12 bg-[#0b1628]/60 p-3 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="h-9 w-full rounded-lg bg-muted/40 lg:max-w-xs" />
        <div className="flex flex-wrap gap-2.5">
          <div className="h-9 w-32 rounded-lg bg-muted/30" />
          <div className="h-9 w-32 rounded-lg bg-muted/30" />
          <div className="h-9 w-32 rounded-lg bg-muted/30" />
        </div>
      </div>

      {Array.from({ length: 2 }).map((_, block) => (
        <div
          key={block}
          className="flex flex-col gap-3 rounded-3xl border border-cyan-200/12 bg-[#0b1628]/60 p-5"
        >
          <div className="h-2.5 w-40 rounded bg-muted/40" />
          {Array.from({ length: 3 }).map((__, row) => (
            <div key={row} className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-lg bg-muted/50" />
              <div className="flex flex-1 flex-col gap-1.5">
                <div className="h-3 w-48 rounded bg-muted/40" />
                <div className="h-2.5 w-64 rounded bg-muted/25" />
              </div>
              <div className="h-6 w-24 shrink-0 rounded-full bg-muted/30" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Authorization denial — NOT emptiness.
 *
 * Rendered when the strict authority gate (or a scope-level Rules denial) says
 * the profile cannot read Clinical. No count and no reassuring zero appears.
 */
export function ClinicalForbidden({
  requiredCapability,
}: {
  requiredCapability?: string;
  /*
   * RF2 §8: `message` is still ACCEPTED (the frozen clinical-view passes it) but
   * deliberately NOT rendered. Every forbidden message the Clinical states
   * produce is a generic restatement of the denial — e.g. "Leitura de casos
   * clínicos não autorizada para o perfil de acesso atual." — so printing it
   * alongside the title produced the duplicated wording the human flagged.
   * Nothing case-specific is lost: no producer puts distinguishing information
   * in this field. The denial itself is unchanged.
   */
  message?: string;
}) {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-3xl border border-red-400/20 bg-red-400/[0.06] p-10 text-center shadow-[0_24px_80px_rgba(0,0,0,0.24)]"
      data-testid="clinical-forbidden"
      role="alert"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-400/25 bg-red-400/10 text-red-300">
        <Ban className="h-6 w-6" aria-hidden="true" />
      </div>
      {/*
        De-duplicated denial (RF2 §8): ONE title, ONE explanation, ONE hint.
        The uppercase kicker carries the title so the card keeps the same visual
        anchor the human already approved.
      */}
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-300/80">
        Acesso clínico não autorizado
      </p>
      <h3 className="max-w-md text-sm font-semibold text-red-200">
        Seu perfil atual não possui permissão para consultar os registros clínicos.
      </h3>
      {requiredCapability && (
        <p className="text-[11px] font-semibold text-muted-foreground">
          Permissão necessária:{" "}
          <span className="text-red-200">
            {humanCapabilityLabel(requiredCapability)}
          </span>
        </p>
      )}
    </div>
  );
}

/** Global technical failure — no state was presumed. */
export function ClinicalError({
  code,
  message,
  onRetry,
}: {
  code?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-3xl border border-red-400/20 bg-red-400/[0.06] p-10 text-center shadow-[0_24px_80px_rgba(0,0,0,0.24)]"
      data-testid="clinical-error"
      role="alert"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-400/25 bg-red-400/10 text-red-300">
        <AlertOctagon className="h-6 w-6" aria-hidden="true" />
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-300/80">
        Falha técnica de leitura
      </p>
      <h3 className="text-sm font-semibold text-red-200">
        Não foi possível carregar os casos clínicos.
      </h3>
      <p className="max-w-md text-xs text-muted-foreground">
        Nenhum caso e nenhum estado clínico foi presumido.{" "}
        {message}
      </p>
      {code && (
        <p className="text-[11px] font-mono text-muted-foreground">Código: {code}</p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            "mt-1 inline-flex items-center rounded-lg border border-border/70 bg-background px-3.5 py-1.5 text-xs font-medium text-foreground",
            "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}
