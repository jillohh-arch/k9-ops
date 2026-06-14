"use client";

import Link from "next/link";
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Clock,
  Dog,
  LoaderCircle,
  UserCheck,
  XCircle,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/form/form-primitives";
import { textareaClass } from "@/components/form/form-classes";
import { useAccessControl } from "@/features/access/providers/access-control-provider";
import {
  usePromotionRequests,
  type PromotionRequest,
  type PromotionStatus,
} from "@/features/training/hooks/use-promotion-requests";
import { canônicalModalityLabel } from "@/features/effective/lib/k9-modalities";
import { formatDate } from "@/lib/format";
import { paths } from "@/lib/routes/paths";
import { cn } from "@/lib/utils";
import { callDecidePromotionRequest } from "@/lib/firebase/functions";

// ─── Toast ────────────────────────────────────────────────────────────────────

type ToastType = "success" | "error";

function Toast({
  message,
  onDismiss,
  type,
}: {
  message: string;
  onDismiss: () => void;
  type: ToastType;
}) {
  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-[0_20px_60px_rgba(0,0,0,0.5)]",
        type === "success"
          ? "border-emerald-400/30 bg-emerald-950/90 text-emerald-200"
          : "border-red-400/30 bg-red-950/90 text-red-200",
      )}
    >
      {type === "success" ? (
        <CheckCircle2 className="h-5 w-5 text-emerald-300" />
      ) : (
        <XCircle className="h-5 w-5 text-red-300" />
      )}
      {message}
      <button
        className="ml-1 text-white/40 transition hover:text-white"
        onClick={onDismiss}
        type="button"
      >
        <XCircle className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Tab config ─────────────────────────────────────────────────────────────

type TabKey = PromotionStatus;

type TabItem = {
  count: number;
  icon: typeof Clock;
  key: TabKey;
  label: string;
  tone: "cyan" | "green" | "red";
};

// ─── Local components ───────────────────────────────────────────────────────

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-cyan-200/15 bg-black/16 px-5 py-7 text-center text-sm text-slate-400">
      {label}
    </div>
  );
}

function StatusBadge({ status }: { status: PromotionStatus }) {
  const config: Record<PromotionStatus, { label: string; tone: "cyan" | "green" | "red" }> = {
    pending: { label: "Pendente", tone: "cyan" },
    approved: { label: "Aprovada", tone: "green" },
    rejected: { label: "Rejeitada", tone: "red" },
  };
  const { label, tone } = config[status];
  return <Badge tone={tone}>{label}</Badge>;
}

function PromotionCard({
  canApprove,
  item,
  onApprove,
  onReject,
}: {
  canApprove: boolean;
  item: PromotionRequest;
  onApprove: (id: string, note: string) => Promise<void>;
  onReject: (id: string, reason: string) => Promise<void>;
}) {
  const [rejectionReason, setRejectionReason] = useState("");
  const [approvalNote, setApprovalNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    setLoading(true);
    setError(null);
    try {
      await onApprove(item.id, approvalNote.trim());
      setApprovalNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao aprovar solicitação.");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (rejectionReason.trim().length < 5) {
      setError("O motivo da rejeição deve ter pelo menos 5 caracteres.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onReject(item.id, rejectionReason.trim());
      setRejectionReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao rejeitar solicitação.");
    } finally {
      setLoading(false);
    }
  };

  const toneMap: Record<PromotionStatus, string> = {
    pending: "border-cyan-300/20 hover:border-cyan-300/35",
    approved: "border-emerald-400/20 hover:border-emerald-400/35",
    rejected: "border-red-400/20 hover:border-red-400/35",
  };

  return (
    <article
      className={cn(
        "rounded-2xl border bg-slate-950/60 p-4 transition",
        toneMap[item.status],
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10">
            <Dog className="h-5 w-5 text-cyan-200" />
          </span>
          <div>
            <p className="font-black text-white">{item.dog_name}</p>
            <p className="text-xs text-slate-400">
              <UserCheck className="mr-1 inline h-3 w-3" />
              {item.handler_name} ({item.handler_ra})
            </p>
          </div>
        </div>
        <StatusBadge status={item.status} />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Modalidade
          </span>
          <p className="text-sm text-slate-200">
            {canônicalModalityLabel(item.modality)}
          </p>
        </div>
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Evolução
          </span>
          <p className="text-sm text-slate-200">
            {item.current_module_name ?? "--"}
            {item.next_module_name ? (
              <>
                {" "}
                <ArrowRight className="mx-1 inline h-3 w-3 text-cyan-300" />{" "}
                {item.next_module_name}
              </>
            ) : null}
          </p>
        </div>
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Solicitado em
          </span>
          <p className="text-sm text-slate-200">
            {formatDate(item.created_at, true)}
          </p>
        </div>
      </div>

      {item.reason && (
        <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.02] p-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Motivo da solicitação
          </span>
          <p className="mt-1 text-sm text-slate-300">{item.reason}</p>
        </div>
      )}

      {item.status === "rejected" && (item.rejection_reason || item.decision_reason) && (
        <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[0.06] p-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-red-400">
            Motivo da rejeição
          </span>
          <p className="mt-1 text-sm text-red-200">
            {item.rejection_reason ?? item.decision_reason}
          </p>
          {(item.rejected_by ?? item.decision_by) && (
            <p className="mt-1 text-xs text-slate-500">
              Por {item.rejected_by ?? item.decision_by}
            </p>
          )}
        </div>
      )}

      {item.status === "approved" && (item.approved_by || item.decision_by) && (
        <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
            Aprovado por
          </span>
          <p className="mt-1 text-sm text-emerald-200">
            {item.approved_by ?? item.decision_by}
          </p>
        </div>
      )}

      {item.status === "pending" && canApprove && (
        <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
          {error && (
            <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-xs text-red-200">
              {error}
            </p>
          )}
          <div className="flex items-center gap-3">
            <Button
              disabled={loading}
              onClick={handleApprove}
              variant="primary"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {loading ? "Salvando..." : "Aprovar"}
            </Button>
            <Button
              disabled={loading || rejectionReason.trim().length < 5}
              onClick={handleReject}
              variant="danger"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Rejeitar
            </Button>
          </div>
          <details className="text-xs text-slate-500">
            <summary className="cursor-pointer hover:text-slate-300">
              Adicionar observação / motivo
            </summary>
            <div className="mt-2 space-y-2">
              <div>
                <label className="mb-1 block font-semibold text-slate-400">
                  Observação (opcional para aprovação)
                </label>
                <textarea
                  className={textareaClass}
                  placeholder="Observação sobre a aprovação..."
                  rows={2}
                  value={approvalNote}
                  onChange={(e) => setApprovalNote(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-400">
                  Motivo da rejeição (obrigatório para rejeitar — min. 5 caracteres)
                </label>
                <textarea
                  className={textareaClass}
                  placeholder="Informe o motivo da rejeição..."
                  rows={2}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </div>
            </div>
          </details>
        </div>
      )}
    </article>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function TrainingPromotionsPage() {
  const { can } = useAccessControl();
  const { pending, approved, rejected, loading, error } = usePromotionRequests();
  const [activeTab, setActiveTab] = useState<TabKey>("pending");

  const canApprove = can("training", "approve");

  const tabs: TabItem[] = [
    { key: "pending", label: "Pendentes", icon: Clock, tone: "cyan", count: pending.length },
    { key: "approved", label: "Aprovadas", icon: CheckCircle2, tone: "green", count: approved.length },
    { key: "rejected", label: "Rejeitadas", icon: XCircle, tone: "red", count: rejected.length },
  ];

  const currentItems: PromotionRequest[] =
    activeTab === "pending"
      ? pending
      : activeTab === "approved"
        ? approved
        : rejected;

  const handleApprove = async (requestId: string, note: string) => {
    try {
      await callDecidePromotionRequest({
        requestId,
        decision: "approved",
        note: note || undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      throw new Error(
        `Não foi possível aprovar (${message}). Verifique se você tem permissão de instrutor K9.`,
      );
    }
  };

  const handleReject = async (requestId: string, reason: string) => {
    try {
      await callDecidePromotionRequest({
        requestId,
        decision: "rejected",
        reason,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      throw new Error(
        `Não foi possível rejeitar (${message}). Verifique se você tem permissão de instrutor K9.`,
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">
            Solicitações de Evolução
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Avalie e decida sobre as promoções de módulo solicitadas pelos condutores.
          </p>
        </div>
        <Link
          className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200 transition hover:bg-cyan-300/[0.12]"
          href={paths.training}
        >
          voltar
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition",
                isActive
                  ? tab.tone === "cyan"
                    ? "border-cyan-300/30 bg-cyan-300/[0.12] text-cyan-100"
                    : tab.tone === "green"
                      ? "border-emerald-400/30 bg-emerald-400/[0.12] text-emerald-100"
                      : "border-red-400/30 bg-red-400/[0.12] text-red-100"
                  : "border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.06] hover:text-slate-200",
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={cn(
                    "ml-1 rounded-full px-2 py-0.5 text-xs font-bold",
                    tab.tone === "cyan"
                      ? "bg-cyan-300/20 text-cyan-200"
                      : tab.tone === "green"
                        ? "bg-emerald-400/20 text-emerald-200"
                        : "bg-red-400/20 text-red-200",
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="rounded-full border border-cyan-300/20 bg-slate-950/90 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-100">
            carregando
          </div>
        </div>
      ) : error ? (
        <Panel title="Erro ao carregar solicitações">
          <p className="text-sm text-red-300">{error}</p>
        </Panel>
      ) : currentItems.length === 0 ? (
        <EmptyState
          label={
            activeTab === "pending"
              ? "Nenhuma solicitação de evolução pendente."
              : activeTab === "approved"
                ? "Nenhuma solicitação aprovada."
                : "Nenhuma solicitação rejeitada."
          }
        />
      ) : (
        <div className="space-y-3">
          {currentItems.map((item) => (
            <PromotionCard
              canApprove={canApprove}
              item={item}
              key={item.id}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ))}
        </div>
      )}
    </div>
  );
}
