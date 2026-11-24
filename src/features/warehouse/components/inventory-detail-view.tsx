"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWarehouseData, useInventoryCounts } from "../hooks/use-warehouse-data";
import {
  InventoryItemCount,
  InventorySession,
} from "../domain/contracts";
import {
  calculateInventoryProgress,
  deriveCountRowStatus,
} from "../domain/inventory";
import { WarehouseService } from "../data/warehouse-service";
import { Clock, AlertCircle, AlertTriangle, Plus, Check } from "lucide-react";
import { CountItemDialog } from "./count-item-dialog";
import { UnexpectedItemDialog } from "./unexpected-item-dialog";
import { HomologateConfirmDialog } from "./homologate-confirm-dialog";
import { CancelInventoryDialog } from "./cancel-inventory-dialog";

interface InventoryDetailViewProps {
  sessionId: string;
}

export function InventoryDetailView({ sessionId }: InventoryDetailViewProps) {
  const router = useRouter();
  const { sessions, materials, batches, locations, status: warehouseStatus } = useWarehouseData();
  const { counts, status: countsStatus, error: countsError } = useInventoryCounts(sessionId);

  const [selectedCount, setSelectedCount] = useState<InventoryItemCount | null>(null);
  const [isUnexpectedOpen, setIsUnexpectedOpen] = useState(false);
  const [isHomologateOpen, setIsHomologateOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<"all" | "pending" | "divergent">("all");
  const [actionError, setActionError] = useState<string | null>(null);
  const [isStartingRec, setIsStartingRec] = useState(false);

  const session = useMemo(() => {
    return sessions.find((s) => s.id === sessionId);
  }, [sessions, sessionId]);

  const progress = useMemo(() => {
    return calculateInventoryProgress(counts);
  }, [counts]);

  const snapshotStatus = (session as { snapshot_status?: string } | undefined)?.snapshot_status || "complete";
  const isSnapshotBuilding = snapshotStatus === "building";
  const isSnapshotFailed = snapshotStatus === "failed";
  const isSnapshotReady = snapshotStatus === "complete";

  const allCounted = isSnapshotReady && progress.total > 0 && progress.pending === 0;
  const canStartReconciliation = allCounted && session?.status === "in_progress" && !isSnapshotBuilding && !isSnapshotFailed;

  const filteredCounts = useMemo(() => {
    if (filterMode === "pending") {
      return counts.filter((c) => deriveCountRowStatus(c) === "pending");
    }
    if (filterMode === "divergent") {
      return counts.filter((c) => {
        const rowStatus = deriveCountRowStatus(c);
        return rowStatus === "shortage" || rowStatus === "surplus";
      });
    }
    return counts;
  }, [counts, filterMode]);

  const handleStartReconciliation = async () => {
    if (!session) return;
    setActionError(null);
    setIsStartingRec(true);
    try {
      await WarehouseService.startReconciliation({ session_id: session.id });
    } catch (err: unknown) {
      setActionError((err as Error).message || "Falha ao avançar para reconciliação.");
    } finally {
      setIsStartingRec(false);
    }
  };

  if (warehouseStatus === "loading" || countsStatus === "loading") {
    return (
      <div className="p-8 text-center text-slate-400">
        Carregando dados da sessão de inventário...
      </div>
    );
  }

  if (countsStatus === "forbidden" || warehouseStatus === "forbidden") {
    return (
      <div
        role="alert"
        className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-6 text-amber-200 shadow-xl"
        data-testid="inventory-detail-restricted"
      >
        <h2 className="text-base font-bold text-amber-100">Acesso Restrito ao Inventário Físico</h2>
        <p className="mt-1 text-xs text-amber-200/90">
          Seu perfil não possui a permissão necessária (inventory.audit) para visualizar sessões e contagens de inventário físico.
        </p>
        <Link
          href="/warehouse"
          className="mt-4 inline-block text-xs font-semibold text-cyan-400 hover:text-cyan-300 hover:underline"
        >
          ← Voltar ao Almoxarifado
        </Link>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="space-y-4 p-8 text-center">
        <p className="text-red-400">Sessão de inventário não encontrada.</p>
        <Link
          href="/warehouse/inventory"
          className="text-xs text-cyan-400 hover:underline"
        >
          ← Voltar para listagem de inventários
        </Link>
      </div>
    );
  }

  const scopeLabel =
    session.scope_type === "full_warehouse"
      ? "Geral (Todo o Almoxarifado)"
      : session.scope_type === "by_location"
      ? `Por Local (${session.scope_label || session.scope_ref_id})`
      : `Por Categoria (${session.scope_label || session.scope_ref_id})`;

  const openedDate =
    session.opened_at instanceof Date
      ? session.opened_at.toLocaleDateString("pt-BR")
      : String(session.opened_at);

  const isClosed = session.status === "homologated" || session.status === "cancelled";

  const closedDate =
    isClosed && session.closed_at
      ? session.closed_at instanceof Date
        ? session.closed_at.toLocaleDateString("pt-BR")
        : String(session.closed_at)
      : null;

  return (
    <div className="space-y-6" data-testid="inventory-detail-view">
      {/* Header and top navigation */}
      <nav className="flex items-center gap-2 text-xs text-slate-400">
        <Link href="/warehouse" className="hover:text-cyan-300">
          Almoxarifado
        </Link>
        <span>/</span>
        <Link href="/warehouse/inventory" className="hover:text-cyan-300">
          Inventários
        </Link>
        <span>/</span>
        <span className="text-white font-medium">{session.title}</span>
      </nav>

      {actionError && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300"
        >
          {actionError}
        </div>
      )}

      {/* Main card */}
      <div className="relative overflow-hidden rounded-[2rem] border border-cyan-200/12 p-6 bg-[radial-gradient(circle_at_18%_10%,rgba(34,211,238,0.16),transparent_34%),linear-gradient(135deg,rgba(8,19,32,0.96),rgba(4,10,20,0.92))] shadow-[0_26px_90px_rgba(0,0,0,0.24)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-black text-white">{session.title}</h1>
              {session.status === "in_progress" && (
                <span className="rounded-full bg-amber-400/20 px-3 py-0.5 text-xs font-semibold text-amber-300 border border-amber-400/30">
                  Em Andamento
                </span>
              )}
              {session.status === "reconciling" && (
                <span className="rounded-full bg-cyan-400/20 px-3 py-0.5 text-xs font-semibold text-cyan-300 border border-cyan-400/30">
                  Reconciliando
                </span>
              )}
              {session.status === "homologated" && (
                <span className="rounded-full bg-emerald-400/20 px-3 py-0.5 text-xs font-semibold text-emerald-300 border border-emerald-400/30">
                  Homologado
                </span>
              )}
              {session.status === "cancelled" && (
                <span className="rounded-full bg-slate-500/20 px-3 py-0.5 text-xs font-semibold text-slate-400 border border-slate-500/30">
                  Cancelado
                </span>
              )}
            </div>

            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-400">
              <p>Escopo: <strong className="text-slate-200">{scopeLabel}</strong></p>
              <p>Aberto por: <strong className="text-slate-200">{session.opened_by_name}</strong> em {openedDate}</p>
              {isClosed && closedDate && (
                <p>Encerrado por: <strong className="text-slate-200">{session.closed_by_name || "-"}</strong> em {closedDate}</p>
              )}
            </div>
            {session.notes && (
              <p className="mt-2 text-xs italic text-slate-300 bg-white/5 p-2 rounded-lg">
                Obs: {session.notes}
              </p>
            )}
          </div>

          {/* Action buttons on top */}
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              {session.status === "in_progress" && (
                <>
                  <button
                    type="button"
                    disabled={!canStartReconciliation || isStartingRec}
                    onClick={handleStartReconciliation}
                    title={
                      !allCounted
                        ? `Necessário contar todas as ${progress.total} posições (${progress.pending} pendentes)`
                        : undefined
                    }
                    className="rounded-xl bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed shadow"
                  >
                    {isStartingRec ? "Avançando..." : "Avançar para Reconciliação →"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCancelOpen(true)}
                    className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/20"
                  >
                    Cancelar Sessão
                  </button>
                </>
              )}

              {session.status === "reconciling" && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsHomologateOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-emerald-400 shadow"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Homologar Inventário</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCancelOpen(true)}
                    className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/20"
                  >
                    Cancelar Sessão
                  </button>
                </>
              )}
            </div>

            {session.status === "in_progress" && progress.pending > 0 && (
              <p className="text-[11px] font-semibold text-amber-300 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                <span>Conclua as {progress.pending} {progress.pending === 1 ? "posição pendente" : "posições pendentes"} para avançar.</span>
              </p>
            )}
          </div>
        </div>

        {/* Progress bar and metrics */}
        <div className="mt-6 border-t border-white/10 pt-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-xl bg-white/5 p-3">
              <span className="text-[11px] text-slate-400">Total de Posições</span>
              <p className="text-xl font-bold text-white font-mono">{progress.total}</p>
            </div>
            <div className="rounded-xl bg-cyan-500/10 p-3">
              <span className="text-[11px] text-cyan-300">Contadas</span>
              <p className="text-xl font-bold text-cyan-200 font-mono">
                {progress.counted} / {progress.total}
              </p>
            </div>
            <div className="rounded-xl bg-amber-500/10 p-3">
              <span className="text-[11px] text-amber-300">Pendentes</span>
              <p className="text-xl font-bold text-amber-200 font-mono">{progress.pending}</p>
            </div>
            <div className="rounded-xl bg-emerald-500/10 p-3">
              <span className="text-[11px] text-emerald-300">Conferidas s/ Dif.</span>
              <p className="text-xl font-bold text-emerald-200 font-mono">{progress.matching}</p>
            </div>
            <div className="rounded-xl bg-red-500/10 p-3">
              <span className="text-[11px] text-red-300">Com Divergência</span>
              <p className="text-xl font-bold text-red-200 font-mono">{progress.divergent}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Cancelled inventory terminal notice */}
      {session.status === "cancelled" && (
        <div className="rounded-2xl border border-slate-700/50 bg-[#0b1628]/80 p-5 shadow-lg">
          <div className="flex items-start gap-3 text-slate-300">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-600 bg-slate-800 text-slate-400">
              <AlertCircle className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-white">Sessão de Inventário Cancelada</h3>
              <p className="mt-0.5 text-xs text-slate-400 leading-relaxed">
                Este inventário foi encerrado administrativamente em caráter terminal. O registro permanece arquivado para fins de conformidade e auditoria patrimonial, com zero mutação aplicada ao saldo de estoque.
              </p>
              {session.notes && (
                <p className="mt-2 text-xs text-amber-200/90 font-mono bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
                  Motivo registrado: {session.notes}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Snapshot building state notice */}
      {isSnapshotBuilding && (
        <div className="rounded-2xl border border-cyan-500/40 bg-cyan-500/10 p-6 text-center shadow-lg">
          <div className="inline-flex items-center gap-2 text-cyan-300 font-bold text-base mb-2">
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 animate-ping" />
            Preparando snapshot do inventário
          </div>
          <p className="text-xs text-slate-300 max-w-xl mx-auto">
            As posições físicas do escopo estão sendo capturadas e congeladas de forma segura. A contagem física será liberada automaticamente após a finalização da montagem.
          </p>
        </div>
      )}

      {/* Snapshot failed state notice */}
      {isSnapshotFailed && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-6 shadow-lg text-rose-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" /> Falha na montagem de snapshot do inventário
              </h2>
              <p className="mt-1 text-xs text-slate-300">
                A captura das posições físicas não pôde ser completada com sucesso. Para manter a segurança patrimonial, a trava de estoque permanece ativa até que o operador cancele esta sessão formalmente.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCancelOpen(true)}
              className="rounded-xl border border-rose-400/30 bg-rose-500/20 px-4 py-2 text-xs font-bold text-rose-300 hover:bg-rose-500/30 transition shrink-0"
            >
              Cancelar Sessão e Liberar Trava
            </button>
          </div>
        </div>
      )}

      {/* Filter and secondary actions bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Visualizar:</span>
          <div className="inline-flex rounded-lg border border-white/10 bg-slate-900 p-0.5">
            <button
              type="button"
              onClick={() => setFilterMode("all")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                filterMode === "all" ? "bg-white/10 text-white font-semibold" : "text-slate-400 hover:text-white"
              }`}
            >
              Todas ({counts.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("pending")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                filterMode === "pending" ? "bg-white/10 text-white font-semibold" : "text-slate-400 hover:text-white"
              }`}
            >
              Pendentes ({progress.pending})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("divergent")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                filterMode === "divergent" ? "bg-white/10 text-white font-semibold" : "text-slate-400 hover:text-white"
              }`}
            >
              Divergências ({progress.divergent})
            </button>
          </div>
        </div>

        {session.status === "in_progress" && (
          <button
            type="button"
            onClick={() => setIsUnexpectedOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-400/20"
          >
            <Plus className="h-3.5 w-3.5" /> Incluir Item Físico Inesperado
          </button>
        )}
      </div>

      {/* Counts Table */}
      <div className="overflow-x-auto rounded-2xl border border-cyan-200/10 bg-[#0b1628]/82 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-slate-300">
            <tr>
              <th className="p-3">Material</th>
              <th className="p-3">Lote</th>
              <th className="p-3">Local</th>
              <th className="p-3">Unidade</th>
              <th className="p-3 text-right">Esperado</th>
              <th className="p-3 text-right">Contado</th>
              <th className="p-3 text-right">Diferença</th>
              <th className="p-3">Justificativa</th>
              <th className="p-3 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {filteredCounts.map((count) => {
              const rowStatus = deriveCountRowStatus(count);
              const isPending = rowStatus === "pending";
              const isShortage = rowStatus === "shortage";
              const isSurplus = rowStatus === "surplus";
              const isMatching = rowStatus === "matching";

              return (
                <tr key={count.id} className="hover:bg-white/[0.02]">
                  <td className="p-3 font-medium text-white">{count.material_name}</td>
                  <td className="p-3 font-mono text-xs text-cyan-300">{count.lot_number}</td>
                  <td className="p-3 text-xs text-slate-300">{count.location_name}</td>
                  <td className="p-3 text-xs text-slate-400">{count.unit}</td>
                  <td className="p-3 text-right font-mono text-xs text-slate-300">
                    {count.expected_quantity}
                  </td>
                  <td className="p-3 text-right font-mono text-xs">
                    {isPending ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 font-bold text-amber-300">
                        <Clock className="h-3 w-3" /> Não Contado
                      </span>
                    ) : count.counted_quantity === 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 font-bold text-rose-300">
                        <AlertCircle className="h-3 w-3" /> Contado: 0 (Zero)
                      </span>
                    ) : (
                      <span className="font-bold text-white">{count.counted_quantity}</span>
                    )}
                  </td>
                  <td className="p-3 text-right font-mono text-xs">
                    {isPending ? (
                      <span className="text-slate-500">—</span>
                    ) : isMatching ? (
                      <span className="text-emerald-400 font-semibold">0</span>
                    ) : isShortage ? (
                      <span className="text-rose-400 font-bold">{count.discrepancy}</span>
                    ) : (
                      <span className="text-amber-400 font-bold">+{count.discrepancy}</span>
                    )}
                  </td>
                  <td className="p-3 text-xs text-slate-300 max-w-xs truncate" title={count.discrepancy_reason || ""}>
                    {count.discrepancy_reason || "—"}
                  </td>
                  <td className="p-3 text-right">
                    {(session.status === "in_progress" || session.status === "reconciling") ? (
                      <button
                        type="button"
                        disabled={isSnapshotBuilding || isSnapshotFailed}
                        onClick={() => setSelectedCount(count)}
                        className="rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold text-cyan-300 hover:bg-cyan-400/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
                      >
                        {isPending ? "Contar" : "Recontar"}
                      </button>
                    ) : session.status === "cancelled" ? (
                      <span className="text-xs text-slate-500">Cancelado</span>
                    ) : (
                      <span className="text-xs text-emerald-400">Homologado</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredCounts.length === 0 && (
          <div className="p-8 text-center text-slate-400">
            Nenhuma posição encontrada para o filtro ativo.
          </div>
        )}
      </div>

      {/* Dialogs */}
      {selectedCount && (
        <CountItemDialog
          isOpen={true}
          count={selectedCount}
          onClose={() => setSelectedCount(null)}
          onSuccess={() => setSelectedCount(null)}
        />
      )}

      <UnexpectedItemDialog
        isOpen={isUnexpectedOpen}
        onClose={() => setIsUnexpectedOpen(false)}
        sessionId={session.id}
        materials={materials}
        batches={batches}
        locations={locations}
      />

      <HomologateConfirmDialog
        isOpen={isHomologateOpen}
        onClose={() => setIsHomologateOpen(false)}
        session={session}
        onSuccess={() => {
          setIsHomologateOpen(false);
        }}
      />

      <CancelInventoryDialog
        isOpen={isCancelOpen}
        onClose={() => setIsCancelOpen(false)}
        session={session}
        onSuccess={() => {
          setIsCancelOpen(false);
        }}
      />
    </div>
  );
}
