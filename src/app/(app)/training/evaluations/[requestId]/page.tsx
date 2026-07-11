"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock, XCircle } from "lucide-react";
import { collection, doc, getDoc, type Timestamp } from "firebase/firestore";

import { Badge } from "@/components/ui/badge";
import { paths } from "@/lib/routes/paths";
import { db } from "@/lib/firebase/client";
import { callDecidePromotionRequest } from "@/lib/firebase/functions";
import { canônicalModality, canônicalModalityLabel } from "@/features/effective/lib/k9-modalities";
import { useAccessControl } from "@/features/access/providers/access-control-provider";
import { useEffectiveData } from "@/features/effective/hooks/use-effective-data";
import {
  TrainingK9Empty,
  TrainingK9Error,
  TrainingK9Skeleton,
} from "@/features/training-k9/components/training-k9-shell";

// ─── Types ────────────────────────────────────────────────────────────────────

type PromotionStatus = "pending" | "approved" | "rejected";

interface AuditEntry {
  action: string;
  at: Date | null;
  by: string | null;
  note?: string;
}

interface RequestDetail {
  id: string;
  auditTrail: AuditEntry[];
  conductorName: string;
  conductorRa: string;
  createdAt: Date | null;
  currentModuleName: string | null;
  decidedAt: Date | null;
  decisionBy: string | null;
  decisionReason: string | null;
  dogId: string;
  dogName: string;
  dogPhotoUrl: string | null;
  modality: string;
  modalityLabel: string;
  nextModuleName: string | null;
  status: PromotionStatus;
  waitingDays: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof (value as Timestamp).toDate === "function") return (value as Timestamp).toDate();
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function parseAudit(raw: unknown): AuditEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((e: Record<string, unknown>) => ({
    action: String(e.action ?? ""),
    at: toDate(e.at),
    by: typeof e.by === "string" ? e.by : null,
    note: typeof e.note === "string" ? e.note : undefined,
  }));
}

function friendlyModule(id: string | null, name: string | null): string | null {
  if (name) return name;
  if (!id) return null;
  const num = Number(id.replace(/\D/g, ""));
  return Number.isFinite(num) && num > 0 ? `Módulo ${num}` : id.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function daysBetween(from: Date | null, to: Date): number | null {
  if (!from) return null;
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86400000));
}

function formatDateLong(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function formatWaiting(days: number | null): string {
  if (days === null) return "";
  if (days === 0) return "Hoje";
  if (days === 1) return "Há 1 dia";
  return `Há ${days} dias`;
}

function statusLabel(s: string): string {
  if (s === "pending") return "Pendente";
  if (s === "approved") return "Aprovada";
  if (s === "rejected") return "Rejeitada";
  return s;
}

function statusTone(s: string): "yellow" | "green" | "red" | "slate" {
  if (s === "pending") return "yellow";
  if (s === "approved") return "green";
  if (s === "rejected") return "red";
  return "slate";
}

// ─── Detail Field ─────────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-200">{value}</p>
    </div>
  );
}

// ─── Decision Dialog ──────────────────────────────────────────────────────────

function DecisionDialog({
  decision,
  dogName,
  currentModule,
  nextModule,
  onCancel,
  onConfirm,
  submitting,
}: {
  decision: "approved" | "rejected";
  dogName: string;
  currentModule: string | null;
  nextModule: string | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  submitting: boolean;
}) {
  const [reason, setReason] = useState("");
  const isReject = decision === "rejected";
  const canSubmit = isReject ? reason.trim().length >= 3 : true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-cyan-200/10 bg-[#0b1628] p-6 shadow-2xl">
        <h3 className="text-lg font-black text-white">
          {isReject ? "Rejeitar solicitação" : "Aprovar evolução"}
        </h3>

        <div className="mt-4 space-y-2 text-sm text-slate-300">
          <p><span className="text-slate-500">K9:</span> {dogName}</p>
          {currentModule && nextModule ? (
            <p><span className="text-slate-500">Avanço:</span> {currentModule} → {nextModule}</p>
          ) : null}
        </div>

        {isReject ? (
          <p className="mt-3 text-xs text-amber-300/80">
            A justificativa será registrada no histórico.
          </p>
        ) : (
          <p className="mt-3 text-xs text-slate-400">
            Esta ação aprovará a evolução do K9 para a próxima etapa da matriz.
          </p>
        )}

        <textarea
          className="mt-4 h-24 w-full rounded-xl border border-white/10 bg-white/[0.035] p-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300/35"
          onChange={(e) => setReason(e.target.value)}
          placeholder={isReject ? "Justificativa (obrigatória)" : "Observação (opcional)"}
          value={reason}
        />

        <div className="mt-4 flex justify-end gap-3">
          <button
            className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-400 transition hover:text-white"
            disabled={submitting}
            onClick={onCancel}
            type="button"
          >
            Cancelar
          </button>
          <button
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${
              isReject
                ? "bg-red-500/20 text-red-300 hover:bg-red-500/30"
                : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
            }`}
            disabled={!canSubmit || submitting}
            onClick={() => onConfirm(reason.trim())}
            type="button"
          >
            {submitting ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" />
            ) : null}
            {isReject ? "Rejeitar" : "Aprovar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EvaluationDetailPage() {
  const params = useParams<{ requestId: string }>();
  const requestId = params.requestId;
  const { can } = useAccessControl();
  const effective = useEffectiveData();
  const canDecide = can("training", "approve") || can("training_matrix", "approve");

  const [rawDoc, setRawDoc] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"approved" | "rejected" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  useEffect(() => {
    if (!requestId) {
      Promise.resolve().then(() => { setError("ID da avaliação não informado."); setLoading(false); });
      return;
    }
    const ref = doc(collection(db, "promotion_requests"), requestId);
    getDoc(ref)
      .then((snap) => {
        if (snap.exists()) setRawDoc(snap.data() as Record<string, unknown>);
        else setError("Avaliação não encontrada.");
        setLoading(false);
      })
      .catch((err) => { setError(err instanceof Error ? err.message : "Erro ao carregar."); setLoading(false); });
  }, [requestId]);

  const detail = useMemo((): RequestDetail | null => {
    if (!rawDoc || !requestId) return null;
    const dogMap = new Map(effective.dogs.map((d) => [d.id, d]));
    const dogId = String(rawDoc.dog_id ?? "");
    const dog = dogMap.get(dogId);
    const rawModality = typeof rawDoc.modality === "string" ? rawDoc.modality : "";
    const modality = canônicalModality(rawModality);
    const createdAt = toDate(rawDoc.created_at);
    const decidedAt = toDate(rawDoc.decided_at);
    const status = (["pending", "approved", "rejected"].includes(rawDoc.status as string)
      ? rawDoc.status : "pending") as PromotionStatus;
    const now = new Date();

    return {
      id: requestId,
      auditTrail: parseAudit(rawDoc.audit_trail),
      conductorName: String(rawDoc.handler_name ?? ""),
      conductorRa: String(rawDoc.handler_ra ?? ""),
      createdAt,
      currentModuleName: friendlyModule(
        typeof rawDoc.current_module_id === "string" ? rawDoc.current_module_id : null,
        typeof rawDoc.current_module_name === "string" ? rawDoc.current_module_name : null,
      ),
      decidedAt,
      decisionBy: typeof rawDoc.decision_by === "string" ? rawDoc.decision_by : null,
      decisionReason: typeof rawDoc.decision_reason === "string" ? rawDoc.decision_reason
        : typeof rawDoc.rejection_reason === "string" ? rawDoc.rejection_reason
        : typeof rawDoc.reason === "string" ? rawDoc.reason : null,
      dogId,
      dogName: dog?.name ?? String(rawDoc.dog_name ?? `K9 ${dogId}`),
      dogPhotoUrl: (dog as Record<string, unknown> | undefined)?.photoUrl as string | null ?? null,
      modality,
      modalityLabel: canônicalModalityLabel(modality),
      nextModuleName: friendlyModule(
        typeof rawDoc.next_module_id === "string" ? rawDoc.next_module_id : null,
        typeof rawDoc.next_module_name === "string" ? rawDoc.next_module_name : null,
      ),
      status,
      waitingDays: status === "pending" ? daysBetween(createdAt, now) : null,
    };
  }, [effective.dogs, rawDoc, requestId]);

  const handleDecision = useCallback(async (decision: "approved" | "rejected", reason: string) => {
    if (!requestId || submitting) return;
    setSubmitting(true);
    setDecisionError(null);
    try {
      await callDecidePromotionRequest({ requestId, decision, reason: reason || undefined });
      const ref = doc(collection(db, "promotion_requests"), requestId);
      const snap = await getDoc(ref);
      if (snap.exists()) setRawDoc(snap.data() as Record<string, unknown>);
      setDialog(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao registrar decisão.";
      if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("já")) {
        setDecisionError("Esta solicitação já foi analisada por outro avaliador.");
        setDialog(null);
        const ref = doc(collection(db, "promotion_requests"), requestId);
        const snap = await getDoc(ref);
        if (snap.exists()) setRawDoc(snap.data() as Record<string, unknown>);
      } else {
        setDecisionError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }, [requestId, submitting]);

  if (loading || effective.loading) return <TrainingK9Skeleton />;
  if (error) return <TrainingK9Error errors={[error]} />;
  if (!detail) return <TrainingK9Empty title="Avaliação não encontrada" description="A solicitação não foi localizada." />;

  const isPending = detail.status === "pending";
  const waiting = formatWaiting(detail.waitingDays);

  return (
    <div className="space-y-6">
      <Link
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-cyan-300"
        href={`${paths.training}?tab=evaluations`}
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para Avaliações
      </Link>

      {/* Header */}
      <div className="rounded-2xl border border-cyan-200/10 bg-slate-950/60 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            {detail.dogPhotoUrl ? (
              <Image alt={detail.dogName} className="h-14 w-14 rounded-2xl border border-cyan-300/15 object-cover" height={56} src={detail.dogPhotoUrl} width={56} />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/15 bg-slate-800/60 text-xl font-black text-cyan-300">
                {detail.dogName.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-black text-white">Avaliação de Evolução</h1>
              <p className="mt-1 text-sm text-slate-400">
                {detail.dogName} · {detail.modalityLabel}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge tone={statusTone(detail.status)}>{statusLabel(detail.status)}</Badge>
            {isPending && waiting ? (
              <span className={`text-xs ${detail.waitingDays! > 7 ? "text-amber-300" : "text-slate-500"}`}>
                {waiting}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Decision error */}
      {decisionError ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {decisionError}
        </div>
      ) : null}

      {/* Content grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Info panel */}
        <section className="rounded-[1.75rem] border border-cyan-200/10 bg-slate-950/60 p-5">
          <h2 className="mb-4 text-sm font-black uppercase tracking-[0.18em] text-slate-300">Informações</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="K9" value={detail.dogName} />
            <Field label="Modalidade" value={detail.modalityLabel} />
            {detail.conductorName ? <Field label="Condutor" value={detail.conductorName} /> : null}
            {detail.currentModuleName ? <Field label="Módulo atual" value={detail.currentModuleName} /> : null}
            {detail.nextModuleName ? <Field label="Próximo módulo" value={detail.nextModuleName} /> : null}
            {detail.createdAt ? <Field label="Data da solicitação" value={formatDateLong(detail.createdAt)} /> : null}
            {detail.decisionBy ? <Field label="Avaliador" value={detail.decisionBy} /> : null}
            {detail.decidedAt ? <Field label="Data da decisão" value={formatDateLong(detail.decidedAt)} /> : null}
          </div>
        </section>

        {/* Advance + decision panel */}
        <section className="rounded-[1.75rem] border border-cyan-200/10 bg-slate-950/60 p-5">
          <h2 className="mb-4 text-sm font-black uppercase tracking-[0.18em] text-slate-300">Evolução Solicitada</h2>
          <div className="space-y-4">
            {detail.currentModuleName && detail.nextModuleName ? (
              <div className="flex items-center gap-3 rounded-xl border border-cyan-300/10 bg-cyan-300/5 p-4">
                <div className="text-center">
                  <p className="text-[10px] font-bold uppercase text-slate-500">Atual</p>
                  <p className="mt-1 text-sm font-semibold text-slate-200">{detail.currentModuleName}</p>
                </div>
                <span className="text-lg text-cyan-300">→</span>
                <div className="text-center">
                  <p className="text-[10px] font-bold uppercase text-slate-500">Próximo</p>
                  <p className="mt-1 text-sm font-semibold text-white">{detail.nextModuleName}</p>
                </div>
              </div>
            ) : null}

            {detail.decisionReason ? (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {detail.status === "rejected" ? "Justificativa da rejeição" : "Observação"}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                  {detail.decisionReason}
                </p>
              </div>
            ) : null}

            {/* Audit trail */}
            {detail.auditTrail.length > 0 ? (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Histórico</p>
                <div className="mt-2 space-y-2">
                  {detail.auditTrail.map((entry, i) => (
                    <div className="flex items-start gap-2 text-xs text-slate-400" key={`${entry.action}-${i}`}>
                      <Clock className="mt-0.5 h-3 w-3 shrink-0 text-slate-600" />
                      <div>
                        <span className="font-medium text-slate-300">
                          {entry.action.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        </span>
                        {entry.by ? <span> por {entry.by}</span> : null}
                        {entry.at ? <span> em {formatDateLong(entry.at)}</span> : null}
                        {entry.note ? <p className="mt-0.5 text-slate-500">{entry.note}</p> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      {/* Actions */}
      {isPending && canDecide ? (
        <div className="flex flex-wrap gap-3">
          <button
            className="flex items-center gap-2 rounded-xl bg-emerald-500/15 px-5 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/25"
            onClick={() => setDialog("approved")}
            type="button"
          >
            <CheckCircle2 className="h-4 w-4" />
            Aprovar evolução
          </button>
          <button
            className="flex items-center gap-2 rounded-xl bg-red-500/15 px-5 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/25"
            onClick={() => setDialog("rejected")}
            type="button"
          >
            <XCircle className="h-4 w-4" />
            Rejeitar solicitação
          </button>
        </div>
      ) : null}

      {/* Dialog */}
      {dialog ? (
        <DecisionDialog
          currentModule={detail.currentModuleName}
          decision={dialog}
          dogName={detail.dogName}
          nextModule={detail.nextModuleName}
          onCancel={() => setDialog(null)}
          onConfirm={(reason) => handleDecision(dialog, reason)}
          submitting={submitting}
        />
      ) : null}
    </div>
  );
}
