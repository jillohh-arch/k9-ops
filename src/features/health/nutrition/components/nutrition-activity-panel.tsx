"use client";

import {
  AlertCircle,
  CalendarClock,
  History,
  Loader2,
  ShieldCheck,
  Utensils,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEntities } from "@/features/effective/providers/entities-provider";
import {
  useNutritionActivity,
  type NutritionActivity,
} from "../hooks/use-nutrition-activity";

interface NutritionActivityPanelProps {
  mode: "execution" | "history";
  initialDogId?: string;
  onDogIdChange?: (dogId: string) => void;
}

export const EXECUTION_WINDOW_MILLISECONDS = 7 * 24 * 60 * 60 * 1000;

export function isWithinNutritionExecutionWindow(
  occurredAt: Date,
  referenceTime: number,
) {
  const timestamp = occurredAt.getTime();
  return (
    Number.isFinite(timestamp) &&
    timestamp >= referenceTime - EXECUTION_WINDOW_MILLISECONDS &&
    timestamp <= referenceTime
  );
}

function recordDate(record: NutritionActivity) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(record.occurredAt);
}

function getDogName(dog: Record<string, unknown> | undefined) {
  const value = dog?.name;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function ActivityRow({ record }: { record: NutritionActivity }) {
  return (
    <li className="grid gap-3 border-b border-white/8 px-4 py-4 last:border-b-0 md:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,0.8fr)]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-slate-100">{record.title}</span>
          <Badge tone={record.kind === "meal" ? "cyan" : "yellow"}>
            {record.kind === "meal" ? "Refeição" : "Suplemento"}
          </Badge>
          <Badge tone="slate">
            {record.origin === "canonical" ? "Canônico" : "Legado"}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-slate-300">{record.detail}</p>
        {record.notes && (
          <p className="mt-2 max-w-[72ch] text-xs leading-5 text-slate-500">
            {record.notes}
          </p>
        )}
      </div>

      <div className="text-sm">
        <p className="text-slate-300">{recordDate(record)}</p>
        <p className="mt-1 text-xs text-slate-500">
          Responsável: {record.responsible ?? "Não informado"}
        </p>
      </div>

      <div className="flex flex-wrap items-start gap-2 md:justify-end">
        <Badge tone={record.planned ? "green" : "slate"}>
          {record.planned ? "Planejado" : "Avulso"}
        </Badge>
        {record.status && <Badge tone="slate">{record.status}</Badge>}
      </div>
    </li>
  );
}

export function NutritionActivityPanel({
  mode,
  initialDogId,
  onDogIdChange,
}: NutritionActivityPanelProps) {
  const { dogs, dogsLoading } = useEntities();
  const [kind, setKind] = useState<"all" | "meal" | "supplement">("all");
  const [executionReference] = useState(() => Date.now());
  const requestedDogId = initialDogId?.trim() ?? "";
  const requestedDogExists = dogs.some((dog) => dog._id === requestedDogId);
  const currentDogId =
    requestedDogId && requestedDogExists ? requestedDogId : "";
  const invalidDogId = !dogsLoading && Boolean(requestedDogId) && !requestedDogExists;
  const missingDogId = !dogsLoading && !requestedDogId;
  const state = useNutritionActivity(currentDogId);
  const hasSourceError = Object.values(state.sources).some((source) => source.error);
  const allPermissionDenied = Object.values(state.sources).every(
    (source) => source.error === "permission-denied",
  );

  const visibleRecords = useMemo(
    () =>
      state.records.filter((record) => {
        if (kind !== "all" && record.kind !== kind) return false;
        return (
          mode === "history" ||
          isWithinNutritionExecutionWindow(record.occurredAt, executionReference)
        );
      }),
    [executionReference, kind, mode, state.records],
  );

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/55 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-cyan-300">
            {mode === "execution" ? (
              <CalendarClock className="h-5 w-5" />
            ) : (
              <History className="h-5 w-5" />
            )}
            <h2 className="font-bold text-slate-100">
              {mode === "execution" ? "Execução recente" : "Histórico nutricional"}
            </h2>
          </div>
          <p className="mt-2 max-w-[70ch] text-sm text-slate-500">
            {mode === "execution"
              ? "Acompanhamento somente leitura das últimas 168 horas, incluindo exatamente o limite inicial. Horários exibidos em America/Sao_Paulo."
              : "Fatos nutricionais preservados por origem, responsável e data. Dados ausentes permanecem não informados."}
          </p>
        </div>

        <label className="grid gap-1.5 text-xs font-semibold text-slate-400">
          K9 consultado
          <select
            aria-label="Selecionar K9 para atividade nutricional"
            value={currentDogId}
            onChange={(event) => onDogIdChange?.(event.target.value)}
            disabled={dogsLoading || dogs.length === 0}
            className="min-h-11 min-w-56 rounded-xl border border-cyan-300/20 bg-slate-950 px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/15"
          >
            <option value="">
              {dogs.length === 0 ? "Nenhum K9 disponível" : "Selecione um K9"}
            </option>
            {dogs.map((dog) => (
              <option key={dog._id} value={dog._id}>
                K9 {getDogName(dog) ?? dog._id}
              </option>
            ))}
          </select>
        </label>
      </div>

      {mode === "history" && (
        <div className="flex flex-wrap gap-2" aria-label="Filtrar histórico">
          {(["all", "meal", "supplement"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setKind(value)}
              aria-pressed={kind === value}
              className={`min-h-10 rounded-xl px-4 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 ${
                kind === value
                  ? "bg-cyan-300 text-slate-950"
                  : "border border-white/10 bg-slate-950/60 text-slate-300 hover:border-cyan-300/35"
              }`}
            >
              {value === "all" ? "Todos" : value === "meal" ? "Refeições" : "Suplementos"}
            </button>
          ))}
        </div>
      )}

      {invalidDogId && (
        <div className="flex gap-3 rounded-2xl border border-amber-400/30 bg-amber-950/20 p-5 text-sm text-amber-100">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-300" />
          <div>
            <p className="font-bold">K9 inválido</p>
            <p className="mt-1 text-amber-100/80">
              O K9 informado na URL não está disponível. Selecione um K9 válido.
            </p>
          </div>
        </div>
      )}

      {missingDogId && dogs.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-5 py-10 text-center">
          <p className="font-semibold text-slate-200">Selecione um K9</p>
          <p className="mt-2 text-sm text-slate-500">
            Nenhum K9 é selecionado automaticamente.
          </p>
        </div>
      )}

      {(dogsLoading ||
        (!invalidDogId &&
          !missingDogId &&
          (state.status === "idle" || state.status === "loading"))) && (
        <div className="flex min-h-48 items-center justify-center gap-3 rounded-2xl border border-white/10 bg-slate-950/55 text-sm text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />
          Consultando registros nutricionais…
        </div>
      )}

      {state.status === "error" && (
        <div className="flex gap-3 rounded-2xl border border-red-400/30 bg-red-950/20 p-5 text-sm text-red-200">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-300" />
          <div>
            <p className="font-bold">Falha na leitura nutricional</p>
            <p className="mt-1 text-red-200/80">
              {allPermissionDenied
                ? "Acesso negado às fontes nutricionais deste K9."
                : "As fontes nutricionais estão indisponíveis no momento."}
            </p>
            <Button
              type="button"
              variant="secondary"
              onClick={state.retry}
              className="mt-3"
            >
              Tentar novamente
            </Button>
          </div>
        </div>
      )}

      {state.status === "degraded" && (
        <div className="flex gap-3 rounded-2xl border border-yellow-400/30 bg-yellow-950/20 p-5 text-sm text-yellow-100">
          <AlertCircle className="h-5 w-5 shrink-0 text-yellow-300" />
          <div>
            <p className="font-bold">Leitura nutricional parcial</p>
            <ul className="mt-1 space-y-1 text-yellow-100/80">
              {state.issues.some((issue) => issue.kind === "malformed-documents") && (
                <li>Há registros malformados; somente documentos válidos são exibidos.</li>
              )}
              {state.issues.some((issue) => issue.kind === "source-error") && (
                <li>
                  {Object.values(state.sources).some(
                    (source) => source.error === "permission-denied",
                  )
                    ? "O acesso a pelo menos uma fonte foi negado."
                    : "Pelo menos uma fonte está indisponível."}
                </li>
              )}
              {state.issues.some((issue) => issue.kind === "canonical-conflict") && (
                <li>Há conflito entre registros canônicos; nenhum foi ocultado.</li>
              )}
              {state.issues.some(
                (issue) => issue.kind === "possible-cross-source-duplicate",
              ) && (
                <li>
                  Há possível duplicidade entre fontes; os dois registros foram preservados.
                </li>
              )}
            </ul>
            {hasSourceError && (
              <Button
                type="button"
                variant="secondary"
                onClick={state.retry}
                className="mt-3"
              >
                Tentar novamente
              </Button>
            )}
          </div>
        </div>
      )}

      {state.status === "empty" && (
        <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-5 py-12 text-center">
          <Utensils className="mx-auto h-8 w-8 text-slate-600" />
          <p className="mt-4 font-semibold text-slate-200">Nenhum registro encontrado</p>
          <p className="mt-2 text-sm text-slate-500">
            As três fontes foram consultadas sem erros ou documentos inválidos.
          </p>
        </div>
      )}

      {(state.status === "ready" || state.status === "degraded") &&
        state.records.length > 0 &&
        visibleRecords.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-5 py-12 text-center">
            <Utensils className="mx-auto h-8 w-8 text-slate-600" />
            <p className="mt-4 font-semibold text-slate-200">
              Nenhum registro corresponde ao filtro
            </p>
          </div>
        )}

      {(state.status === "ready" || state.status === "degraded") &&
        visibleRecords.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/55">
            <div className="flex items-center justify-between border-b border-white/8 px-4 py-3 text-xs text-slate-500">
              <span>
                {visibleRecords.length} registro{visibleRecords.length === 1 ? "" : "s"}
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                Somente leitura
              </span>
            </div>
            <ul>
              {visibleRecords.map((record) => (
                <ActivityRow key={record.id} record={record} />
              ))}
            </ul>
          </div>
        )}
    </section>
  );
}
