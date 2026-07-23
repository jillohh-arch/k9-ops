"use client";

import type { ReactNode } from "react";

import {
  K9_LOADING_FOOTER,
  K9_LOADING_STEPS,
  K9_LOADING_TITLE,
  stageOrder,
  type K9LoadingStage,
} from "./k9-ops-loading-constants";

/**
 * Loading oficial do K9 Ops (Web) — camada **puramente apresentacional**.
 *
 * ## Estado de transição
 *
 * Este componente é o novo loading oficial, mas na Fase 1 ele **ainda não está
 * conectado** ao bootstrap. O loading ativo em produção continua sendo
 * `src/components/feedback/loading-screen.tsx`. A substituição controlada (e a
 * decisão do ponto correto de integração entre `authStatus` e `accessStatus`)
 * ocorrerá na fase de integração. Não devem coexistir dois sistemas de loading
 * ativos em produção após aquela fase.
 *
 * ## Estado externo
 *
 * O componente recebe `stage`, `progress` e `message` externamente. Ele não
 * autentica, não consulta permissões e não decide navegação. A derivação de
 * estágio a partir dos estados técnicos vive em `deriveK9LoadingStage`
 * (função pura, testável), aplicada pela camada de integração.
 *
 * ## Área do asset (`visual`)
 *
 * O Malinois é **injetável e opcional**. Enquanto o Lottie oficial e o fallback
 * estático oficial não estiverem no repositório, o componente exibe uma moldura
 * HUD neutra — sem depender de nenhum arquivo futuro. Quando os assets forem
 * entregues, passe o Malinois (Lottie ou <Image>) via `visual`.
 */
export interface K9OpsLoadingScreenProps {
  /** Estágio visual atual. */
  stage?: K9LoadingStage;
  /** Progresso 0.0–1.0 recebido externamente. `null`/`undefined` = indeterminado. */
  progress?: number | null;
  /** Mensagem de status opcional (ex.: "Finalizando inicialização..."). */
  message?: string;
  /** Mensagem de erro exibida quando `stage === "error"`. */
  errorMessage?: string;
  /** Callback opcional de retry, exibido apenas no estado de erro. */
  onRetry?: () => void;
  /** Malinois injetável (Lottie/Image). `undefined` → moldura HUD neutra. */
  visual?: ReactNode;
  /** Build/versão exibida no HUD superior direito. */
  build?: string;
}

export function K9OpsLoadingScreen({
  stage = "validatingAccess",
  progress = null,
  message,
  errorMessage,
  onRetry,
  visual,
  build,
}: K9OpsLoadingScreenProps) {
  const isError = stage === "error";
  const currentOrder = stageOrder(stage);
  const isReady = stage === "ready";

  const clampedProgress =
    progress == null ? null : Math.max(0, Math.min(1, progress));

  return (
    <main
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#040a10]"
      role="status"
      aria-live="polite"
      aria-label="Carregando painel operacional K9 Ops"
    >
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/[0.06] blur-[120px]" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent" />
      </div>

      {/* Corner HUD */}
      <div className="absolute left-6 top-6 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-400/70">
        <p className="font-bold">K9 OPS SYSTEMS</p>
        <p className="mt-1 text-cyan-400/40">SECURE. CONTROL. DEPLOY.</p>
      </div>
      {build ? (
        <div className="absolute right-6 top-6 text-right font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-400/40">
          <p>
            {build}
            <span className="ml-1 inline-block h-2 w-2 rounded-full bg-emerald-400" />
          </p>
        </div>
      ) : null}

      {/* Center content */}
      <div className="relative flex flex-col items-center gap-8 px-6">
        {/* Asset stage — Malinois injetável ou moldura HUD neutra */}
        <div className="relative flex h-44 w-44 items-center justify-center sm:h-52 sm:w-52">
          <div className="hud-rotate-slow absolute inset-1 rounded-full border border-cyan-400/20 border-t-cyan-400/60" />
          <div className="absolute inset-0 rounded-full bg-cyan-400/[0.06] blur-2xl" />
          <div className="relative z-10 flex h-full w-full items-center justify-center">
            {visual ?? <NeutralAssetMarker />}
          </div>
        </div>

        {/* Título */}
        <p className="text-center font-mono text-sm font-bold uppercase tracking-[0.25em] text-cyan-100/80">
          {K9_LOADING_TITLE}
        </p>

        {isError ? (
          <ErrorBlock
            message={errorMessage ?? "Não foi possível preparar o painel."}
            onRetry={onRetry}
          />
        ) : (
          <>
            {/* Mensagem de status opcional (não duplica rótulos de etapa) */}
            {message ? (
              <p className="text-center text-[11px] text-slate-400">{message}</p>
            ) : null}

            {/* Barra de progresso */}
            <ProgressBar value={clampedProgress} />

            {/* Etapas */}
            <div className="mt-2 space-y-3">
              {K9_LOADING_STEPS.map((step, index) => {
                const done = isReady || index < currentOrder;
                const active = !isReady && index === currentOrder;
                return (
                  <StepRow
                    key={step.stage}
                    label={step.label}
                    detail={step.detail}
                    done={done}
                    active={active}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <p className="absolute bottom-6 font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-400/25">
        {K9_LOADING_FOOTER}
      </p>
    </main>
  );
}

/**
 * Marcador neutro exibido enquanto o asset oficial não está presente.
 * Não simula o Malinois nem finge ser o asset final.
 */
function NeutralAssetMarker() {
  return (
    <svg
      className="h-20 w-20 text-cyan-400/40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" strokeDasharray="3 3" />
      <path
        d="M8 14c0-2 1.5-3.5 4-3.5S16 12 16 14M9.5 9.5h.01M14.5 9.5h.01"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ProgressBar({ value }: { value: number | null }) {
  const percent = value == null ? null : Math.round(value * 100);
  const width = value == null ? 0 : value * 100;
  return (
    <div className="w-72">
      <div className="h-1 w-full overflow-hidden rounded-full bg-cyan-400/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-cyan-300 transition-[width] duration-300 ease-out motion-reduce:transition-none"
          style={{ width: `${width}%` }}
        />
      </div>
      {percent != null ? (
        <p className="mt-2 text-right font-mono text-[10px] tabular-nums text-cyan-400/50">
          {percent}%
        </p>
      ) : null}
    </div>
  );
}

function StepRow({
  label,
  detail,
  done,
  active,
}: {
  label: string;
  detail: string;
  done: boolean;
  active: boolean;
}) {
  const state = done ? "concluído" : active ? "em andamento" : "pendente";
  return (
    <div className="flex items-center gap-3" aria-label={`${label}: ${state}`}>
      <span className="flex h-5 w-5 items-center justify-center">
        {done ? (
          <svg
            className="h-3 w-3 text-emerald-400"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M2.5 6l2.5 2.5 4.5-5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <span
            className={`h-2 w-2 rounded-full ${
              active
                ? "bg-cyan-400 motion-safe:animate-pulse"
                : "bg-cyan-400/30"
            }`}
          />
        )}
      </span>
      <div>
        <p
          className={`text-sm font-bold ${
            done || active ? "text-cyan-200" : "text-slate-500"
          }`}
        >
          {label}
        </p>
        <p className="mt-0.5 text-[11px] text-slate-500">{detail}</p>
      </div>
    </div>
  );
}

function ErrorBlock({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="max-w-sm text-center text-sm text-slate-300">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-5 py-2.5 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/50"
        >
          Tentar novamente
        </button>
      ) : null}
    </div>
  );
}
