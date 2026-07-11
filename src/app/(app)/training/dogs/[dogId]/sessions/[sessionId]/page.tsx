"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Clock, MapPin, Target } from "lucide-react";
import { collection, doc, getDoc } from "firebase/firestore";

import { Badge } from "@/components/ui/badge";
import { paths } from "@/lib/routes/paths";
import { db } from "@/lib/firebase/client";
import { canônicalModality, canônicalModalityLabel } from "@/features/effective/lib/k9-modalities";
import { useEffectiveData } from "@/features/effective/hooks/use-effective-data";
import { useTrainingK9Data } from "@/features/training-k9/hooks/use-training-k9-data";
import {
  TrainingK9Empty,
  TrainingK9Error,
  TrainingK9Skeleton,
} from "@/features/training-k9/components/training-k9-shell";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SessionDetail {
  conductorName: string | null;
  date: Date | null;
  distanceM: number | null;
  dogId: string;
  dogName: string;
  dogPhotoUrl: string | null;
  durationS: number | null;
  environment: string | null;
  events: string[];
  hasResultOrEvents: boolean;
  id: string;
  matrixLabel: string | null;
  modality: string;
  modalityLabel: string;
  moduleLabel: string | null;
  notes: string | null;
  phase: string | null;
  phaseLabel: string;
  repetitions: number | null;
  result: string | null;
  resultLabel: string;
  technique: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateValue(v: unknown): Date | null {
  if (v instanceof Date) return v;
  if (v && typeof v === "object" && "toDate" in v) {
    const fn = (v as { toDate?: unknown }).toDate;
    if (typeof fn === "function") {
      const d = fn.call(v);
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
    }
  }
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function text(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string" || typeof v === "number") {
      const s = String(v).trim();
      if (s) return s;
    }
  }
  return null;
}

function numberValue(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  return null;
}

function eventNames(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((e) => {
      if (typeof e === "string") return e;
      if (e && typeof e === "object") {
        return String((e as Record<string, unknown>).type ?? (e as Record<string, unknown>).event_type ?? (e as Record<string, unknown>).name ?? "");
      }
      return "";
    })
    .filter((s) => s.length > 0);
}

function formatDateLong(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function formatTime(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} minutos`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}min` : `${h} horas`;
}

function formatResult(result: string | null): string {
  if (!result) return "Não informado";
  const r = result.toLowerCase().trim();
  if (r === "satisfatorio" || r === "satisfatório" || r === "success" || r === "approved") return "Satisfatório";
  if (r === "insatisfatorio" || r === "insatisfatório" || r === "failure" || r === "failed") return "Insatisfatório";
  if (r === "parcial" || r === "partial") return "Parcial";
  if (r === "completed" || r === "concluido" || r === "concluído") return "Concluída";
  return result.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function resultTone(result: string | null): "cyan" | "green" | "yellow" | "red" | "slate" {
  if (!result) return "slate";
  const r = result.toLowerCase().trim();
  if (["satisfatorio", "satisfatório", "success", "approved", "completed", "concluido", "concluído"].includes(r)) return "green";
  if (["insatisfatorio", "insatisfatório", "failure", "failed"].includes(r)) return "red";
  if (["parcial", "partial"].includes(r)) return "yellow";
  return "cyan";
}

function formatPhase(phase: string | null): string {
  if (!phase) return "Não informada";
  const p = phase.trim();
  if (/^\d+[a-zA-Z]?$/.test(p)) return `Fase ${p.toUpperCase()}`;
  const lower = p.toLowerCase();
  if (lower === "formation" || lower === "formacao") return "Formação";
  if (lower === "maintenance" || lower === "manutencao") return "Manutenção";
  if (lower === "evaluation" || lower === "avaliacao") return "Avaliação";
  if (lower === "warm_up" || lower === "aquecimento") return "Aquecimento";
  if (/^\d/.test(p)) return `Fase ${p.toUpperCase()}`;
  return p.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Detail Field ─────────────────────────────────────────────────────────────

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm text-slate-200">{value}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SessionDetailPage() {
  const params = useParams<{ dogId: string; sessionId: string }>();
  const sessionId = params.sessionId;
  const dogId = params.dogId;

  const effective = useEffectiveData();
  const trainingData = useTrainingK9Data();

  const [rawDoc, setRawDoc] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dogId || !sessionId) {
      Promise.resolve().then(() => {
        setError("Parâmetros insuficientes para localizar a sessão.");
        setLoading(false);
      });
      return;
    }

    const ref = doc(collection(db, `dogs/${dogId}/training_sessions`), sessionId);
    getDoc(ref)
      .then((snap) => {
        if (snap.exists()) {
          setRawDoc(snap.data() as Record<string, unknown>);
        } else {
          setError("Sessão não encontrada.");
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Erro ao carregar sessão.");
        setLoading(false);
      });
  }, [dogId, sessionId]);

  const session = useMemo((): SessionDetail | null => {
    if (!rawDoc || !dogId) return null;

    const track = asRecord(rawDoc.track);
    const rawModality = text(
      rawDoc.modality as string,
      rawDoc.modality_id as string,
      rawDoc.trainingType as string,
      rawDoc.training_type as string,
      rawDoc.type as string,
    );
    const modality = rawModality ? canônicalModality(rawModality) : "treino_geral";
    const date = dateValue(rawDoc.started_at ?? rawDoc.startedAt ?? rawDoc.performed_at ?? rawDoc.performedAt ?? rawDoc.date ?? rawDoc.created_at ?? rawDoc.createdAt);

    const handlerRa = text(rawDoc.handlerId as string, rawDoc.handler_id as string, rawDoc.performed_by as string, rawDoc.conductor_ra as string);
    const dog = effective.dogs.find((d) => d.id === dogId);
    const userMap = new Map(effective.users.map((u) => [u.ra, u]));
    const conductor = handlerRa ? userMap.get(handlerRa) : (dog?.conductorRa ? userMap.get(dog.conductorRa) : null);

    const moduleId = text(rawDoc.module_id as string, rawDoc.moduleId as string);
    const program = trainingData.programs.find((p) => p.modality === modality);
    let moduleLabel: string | null = null;
    if (moduleId && program) {
      const mod = program.modules.find((m) => m.id === moduleId || m.title === moduleId);
      moduleLabel = mod?.title ?? null;
    }
    if (!moduleLabel && moduleId) {
      const num = Number(moduleId.replace(/\D/g, ""));
      moduleLabel = Number.isFinite(num) && num > 0 ? `Módulo ${num}` : moduleId.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }

    const rawPhase = text(rawDoc.phase as string, rawDoc.training_phase as string, rawDoc.trainingPhase as string);
    const result = text(rawDoc.result as string, rawDoc.outcome as string);
    const events = eventNames(rawDoc.events ?? track?.events);
    const notes = text(rawDoc.notes as string, rawDoc.observations as string, rawDoc.observacoes as string, rawDoc.comments as string);

    return {
      conductorName: conductor?.fullName ?? conductor?.callsign ?? null,
      date,
      distanceM: numberValue(rawDoc.distance_m ?? rawDoc.distanceM ?? track?.distance_m ?? track?.distanceM),
      dogId,
      dogName: dog?.name ?? `K9 ${dogId}`,
      dogPhotoUrl: (dog as Record<string, unknown> | undefined)?.photoUrl as string | null ?? null,
      durationS: numberValue(rawDoc.duration_s ?? rawDoc.durationS ?? track?.duration_s ?? track?.durationS),
      environment: text(rawDoc.environment as string, rawDoc.ambiente as string),
      events,
      hasResultOrEvents: !!(result || events.length > 0 || notes),
      id: sessionId,
      matrixLabel: program?.label ?? null,
      modality,
      modalityLabel: canônicalModalityLabel(modality),
      moduleLabel,
      notes,
      phase: rawPhase,
      phaseLabel: formatPhase(rawPhase),
      repetitions: numberValue(rawDoc.repetitions ?? rawDoc.reps ?? track?.repetitions),
      result,
      resultLabel: formatResult(result),
      technique: text(rawDoc.technique as string, rawDoc.tecnica as string),
    };
  }, [dogId, effective, rawDoc, sessionId, trainingData.programs]);

  if (loading || effective.loading || trainingData.loading) {
    return <TrainingK9Skeleton />;
  }

  if (error) {
    return <TrainingK9Error errors={[error]} />;
  }

  if (!session) {
    return (
      <TrainingK9Empty
        title="Sessão não encontrada"
        description="A sessão solicitada não foi localizada nos registros."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-cyan-300"
        href={`${paths.training}?tab=sessions`}
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para Sessões
      </Link>

      {/* Header */}
      <div className="rounded-2xl border border-cyan-200/10 bg-slate-950/60 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            {session.dogPhotoUrl ? (
              <Image
                alt={session.dogName}
                className="h-14 w-14 rounded-2xl border border-cyan-300/15 object-cover"
                height={56}
                src={session.dogPhotoUrl}
                width={56}
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/15 bg-slate-800/60 text-xl font-black text-cyan-300">
                {session.dogName.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-black text-white">
                Sessão de {session.modalityLabel}
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                {session.dogName}
                {session.date ? ` · ${formatDateLong(session.date)}, ${formatTime(session.date)}` : ""}
              </p>
            </div>
          </div>
          {session.result ? (
            <div className="flex items-center gap-3">
              <Badge tone={resultTone(session.result)}>
                {session.resultLabel}
              </Badge>
            </div>
          ) : null}
        </div>
      </div>

      {/* Details — adaptive layout */}
      {session.hasResultOrEvents ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <SessionInfoPanel session={session} />
          <SessionResultPanel session={session} />
        </div>
      ) : (
        <div className="space-y-6">
          <SessionInfoPanel session={session} fullWidth />
          <div className="rounded-[1.75rem] border border-cyan-200/10 bg-slate-950/60 p-5">
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Target className="mb-3 h-8 w-8 text-slate-600" />
              <p className="text-sm font-semibold text-slate-400">
                Nenhum resultado registrado
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Esta sessão não possui resultado ou eventos informados.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Info Panel ──────────────────────────────────────────────────────────────

function SessionInfoPanel({ session, fullWidth }: { session: SessionDetail; fullWidth?: boolean }) {
  return (
    <section className="rounded-[1.75rem] border border-cyan-200/10 bg-slate-950/60 p-5">
      <h2 className="mb-4 text-sm font-black uppercase tracking-[0.18em] text-slate-300">
        Informações da Sessão
      </h2>
      <div className={`grid gap-4 ${fullWidth ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {session.date ? (
          <DetailField label="Data" value={`${formatDateLong(session.date)} às ${formatTime(session.date)}`} />
        ) : null}
        {session.conductorName ? (
          <DetailField label="Condutor" value={session.conductorName} />
        ) : null}
        {session.matrixLabel ? (
          <DetailField label="Matriz" value={session.matrixLabel} />
        ) : null}
        {session.moduleLabel ? (
          <DetailField label="Módulo" value={session.moduleLabel} />
        ) : null}
        {session.phaseLabel !== "Não informada" ? (
          <DetailField label="Fase" value={session.phaseLabel} />
        ) : null}
        {session.durationS ? (
          <DetailField label="Duração" value={formatDuration(session.durationS)} />
        ) : null}
        {session.distanceM ? (
          <DetailField label="Distância" value={`${session.distanceM} m`} />
        ) : null}
        {session.repetitions ? (
          <DetailField label="Repetições" value={String(session.repetitions)} />
        ) : null}
        {session.environment ? (
          <DetailField label="Ambiente" value={session.environment} />
        ) : null}
        {session.technique ? (
          <DetailField label="Técnica" value={session.technique} />
        ) : null}
      </div>
    </section>
  );
}

// ─── Result Panel ────────────────────────────────────────────────────────────

function SessionResultPanel({ session }: { session: SessionDetail }) {
  return (
    <section className="rounded-[1.75rem] border border-cyan-200/10 bg-slate-950/60 p-5">
      <h2 className="mb-4 text-sm font-black uppercase tracking-[0.18em] text-slate-300">
        Resultado e Eventos
      </h2>
      <div className="space-y-4">
        {session.result ? (
          <div className="flex items-center gap-3">
            <Badge tone={resultTone(session.result)} className="px-3 py-1.5">
              <Target className="mr-1.5 h-3.5 w-3.5" />
              {session.resultLabel}
            </Badge>
          </div>
        ) : null}

        {session.events.length > 0 ? (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Eventos registrados
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {session.events.map((event, i) => (
                <span
                  className="rounded-lg border border-cyan-300/10 bg-cyan-300/5 px-2.5 py-1 text-xs text-slate-300"
                  key={`${event}-${i}`}
                >
                  {event.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {session.notes ? (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Observações
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
              {session.notes}
            </p>
          </div>
        ) : null}

        {session.durationS || session.distanceM ? (
          <div className="flex gap-6 pt-2">
            {session.durationS ? (
              <div className="flex items-center gap-2 text-slate-400">
                <Clock className="h-4 w-4" />
                <span className="text-sm">{formatDuration(session.durationS)}</span>
              </div>
            ) : null}
            {session.distanceM ? (
              <div className="flex items-center gap-2 text-slate-400">
                <MapPin className="h-4 w-4" />
                <span className="text-sm">{session.distanceM} metros</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
