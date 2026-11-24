"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWarehouseData } from "../hooks/use-warehouse-data";
import { useAccessControl } from "@/features/access/providers/access-control-provider";
import { InventorySession } from "../domain/contracts";
import { Plus, Info, ClipboardCheck, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { OpenInventoryDialog } from "./open-inventory-dialog";
import { deriveInventoryCategories } from "../domain/inventory-categories";
import { WarehouseKpiCard } from "./warehouse-kpi-card";

export function InventorySessionsListView() {
  const router = useRouter();
  const { sessions, locations, materials, canAuditSessions } = useWarehouseData();
  const { can } = useAccessControl();
  const canAudit = canAuditSessions ?? can("inventory", "audit");

  const [isOpenDialogOpen, setIsOpenDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const hasActiveSession = useMemo(() => {
    return sessions.some((s) => s.status === "in_progress" || s.status === "reconciling");
  }, [sessions]);

  // Contextual KPIs
  const homologatedCount = useMemo(() => {
    return sessions.filter((s) => s.status === "homologated").length;
  }, [sessions]);

  const activeCount = useMemo(() => {
    return sessions.filter((s) => s.status === "in_progress" || s.status === "reconciling").length;
  }, [sessions]);

  const totalDiscrepantItems = useMemo(() => {
    return sessions.reduce((acc, s) => acc + (s.discrepant_items ?? 0), 0);
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    let list = [...sessions];
    if (statusFilter !== "all") {
      list = list.filter((s) => s.status === statusFilter);
    }
    // Sort recent first
    return list.sort((a, b) => {
      const timeA = a.opened_at instanceof Date ? a.opened_at.getTime() : new Date(a.opened_at).getTime();
      const timeB = b.opened_at instanceof Date ? b.opened_at.getTime() : new Date(b.opened_at).getTime();
      return timeB - timeA;
    });
  }, [sessions, statusFilter]);

  const getStatusBadge = (sessionStatus: InventorySession["status"]) => {
    switch (sessionStatus) {
      case "in_progress":
        return (
          <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400 border border-amber-500/30">
            Em Andamento
          </span>
        );
      case "reconciling":
        return (
          <span className="inline-flex items-center rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-300 border border-cyan-500/30">
            Reconciliando
          </span>
        );
      case "homologated":
        return (
          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-300 border border-emerald-500/30">
            Homologado
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center rounded-full bg-slate-500/10 px-2.5 py-0.5 text-xs font-semibold text-slate-400 border border-slate-500/30">
            Cancelado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-slate-500/10 px-2.5 py-0.5 text-xs font-semibold text-slate-300">
            {sessionStatus}
          </span>
        );
    }
  };

  const getScopeLabel = (session: InventorySession) => {
    switch (session.scope_type) {
      case "full_warehouse":
        return "Geral (Todo o Almoxarifado)";
      case "by_location":
        return `Por Local (${session.scope_label || session.scope_ref_id})`;
      case "by_category":
        return `Por Categoria (${session.scope_label || session.scope_ref_id})`;
      default:
        return session.scope_type;
    }
  };

  if (!canAudit) {
    return (
      <div
        role="alert"
        className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-6 text-amber-200 shadow-xl"
        data-testid="inventory-sessions-restricted"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-6 w-6 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-base font-bold text-amber-100">Acesso Restrito ao Inventário Físico</h2>
            <p className="mt-1 text-xs text-amber-200/90">
              Seu perfil possui acesso operacional ao almoxarifado, mas a visualização e gestão de sessões de auditoria física de estoque é restrita à administração e almoxarifado (permissão inventory.audit).
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="inventory-sessions-list-view">
      {/* 4 Contextual KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <WarehouseKpiCard
          label="SESSÕES CONCLUÍDAS"
          value={homologatedCount}
          subtext="Homologadas com ajuste"
          icon={CheckCircle2}
          colorVariant="emerald"
          trend={{ text: "Histórico", direction: "neutral", variant: "emerald" }}
        />
        <WarehouseKpiCard
          label="SESSÃO ATIVA"
          value={activeCount}
          subtext={hasActiveSession ? "Inventário em contagem" : "Nenhuma contagem aberta"}
          icon={Clock}
          colorVariant="cyan"
          trend={{ text: hasActiveSession ? "Em aberto" : "Em dia", direction: "neutral", variant: hasActiveSession ? "cyan" : "slate" }}
        />
        <WarehouseKpiCard
          label="DIVERGÊNCIAS TOTAIS"
          value={totalDiscrepantItems}
          subtext="Itens com ajuste de saldo"
          icon={AlertTriangle}
          colorVariant={totalDiscrepantItems > 0 ? "amber" : "blue"}
          trend={{ text: totalDiscrepantItems > 0 ? "Atenção" : "0 divergências", direction: "neutral", variant: totalDiscrepantItems > 0 ? "amber" : "slate" }}
        />
        <WarehouseKpiCard
          label="HISTÓRICO REGISTRADO"
          value={sessions.length}
          subtext="Ciclos de auditoria física"
          icon={ClipboardCheck}
          colorVariant="cyan"
          trend={{ text: "Auditoria", direction: "neutral", variant: "cyan" }}
        />
      </div>

      {/* Top action bar & Filter */}
      <div className="rounded-2xl border border-[#1e293b] bg-[#0b1424] p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shadow-sm">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">Sessões de Inventário Físico</h2>
          <p className="text-xs text-slate-400">
            Conferências físicas periódicas, travas de escopo e homologação de ajustes de saldo.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            aria-label="Filtrar por Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 appearance-none rounded-xl border border-[#1e293b] bg-[#0f172a] px-3 text-xs text-slate-200 outline-none transition focus:border-cyan-500/40"
          >
            <option value="all" className="bg-[#0b1424]">Todos os status</option>
            <option value="in_progress" className="bg-[#0b1424]">Em Andamento</option>
            <option value="reconciling" className="bg-[#0b1424]">Reconciliando</option>
            <option value="homologated" className="bg-[#0b1424]">Homologado</option>
            <option value="cancelled" className="bg-[#0b1424]">Cancelado</option>
          </select>

          <button
            type="button"
            disabled={hasActiveSession}
            onClick={() => setIsOpenDialogOpen(true)}
            title={hasActiveSession ? "Já existe uma sessão ativa em andamento" : undefined}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950 transition shadow disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" /> Iniciar Inventário
          </button>
        </div>
      </div>

      {hasActiveSession && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          <Info className="h-4 w-4 shrink-0 text-amber-400" />
          <span>Já existe uma sessão de inventário ativa no almoxarifado. Para iniciar um novo inventário, a sessão ativa deve ser homologada ou cancelada.</span>
        </div>
      )}

      {/* Sessions table */}
      <div className="overflow-x-auto rounded-2xl border border-[#1e293b] bg-[#0b1424] shadow-[0_16px_40px_rgba(0,0,0,0.3)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#0f172a]/60 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-[#1e293b]">
            <tr>
              <th className="p-3">Título da Sessão</th>
              <th className="p-3">Escopo</th>
              <th className="p-3">Status</th>
              <th className="p-3">Aberto por</th>
              <th className="p-3">Data Abertura</th>
              <th className="p-3">Progresso</th>
              <th className="p-3">Divergências</th>
              <th className="p-3">Encerramento</th>
              <th className="p-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e293b]/60">
            {filteredSessions.map((session) => {
              const openedDate =
                session.opened_at instanceof Date
                  ? session.opened_at.toLocaleDateString("pt-BR")
                  : String(session.opened_at || "-");

              const isClosed = session.status === "homologated" || session.status === "cancelled";
              const closedDate =
                isClosed && session.closed_at
                  ? session.closed_at instanceof Date
                    ? session.closed_at.toLocaleDateString("pt-BR")
                    : String(session.closed_at)
                  : "-";

              const total = session.total_items ?? 0;
              const counted = session.counted_items ?? 0;
              const discrepant = session.discrepant_items ?? 0;

              return (
                <tr key={session.id} className="hover:bg-slate-800/20 transition">
                  <td className="p-3">
                    <Link
                      href={`/warehouse/inventory/${session.id}`}
                      className="font-semibold text-cyan-400 hover:text-cyan-300 hover:underline"
                    >
                      {session.title}
                    </Link>
                  </td>
                  <td className="p-3 text-xs text-slate-300">{getScopeLabel(session)}</td>
                  <td className="p-3">{getStatusBadge(session.status)}</td>
                  <td className="p-3 text-xs text-slate-300">{session.opened_by_name}</td>
                  <td className="p-3 text-xs text-slate-300">{openedDate}</td>
                  <td className="p-3 text-xs font-mono text-slate-300">
                    {total > 0 ? `${counted}/${total} contados` : `${counted} contados`}
                  </td>
                  <td className="p-3 text-xs">
                    {discrepant > 0 ? (
                      <span className="font-semibold text-amber-400">{discrepant} itens</span>
                    ) : (
                      <span className="text-slate-500">0</span>
                    )}
                  </td>
                  <td className="p-3 text-xs text-slate-400">{closedDate}</td>
                  <td className="p-3 text-right">
                    <Link
                      href={`/warehouse/inventory/${session.id}`}
                      className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 transition"
                    >
                      Detalhes →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredSessions.length === 0 && (
          <div className="p-8 text-center text-slate-400">
            Nenhuma sessão de inventário encontrada para o filtro selecionado.
          </div>
        )}
      </div>

      <OpenInventoryDialog
        isOpen={isOpenDialogOpen}
        onClose={() => setIsOpenDialogOpen(false)}
        onSuccess={(sessionId) => router.push(`/warehouse/inventory/${sessionId}`)}
        locations={locations}
        categories={deriveInventoryCategories(materials)}
      />
    </div>
  );
}
