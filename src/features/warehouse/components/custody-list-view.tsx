"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { EquipmentCustody } from "../domain/contracts";
import { deriveCustodyDueState, isCustodyOverdue } from "../domain/custody";
import { defaultBusinessClock } from "../domain/business-clock";
import { useWarehouseData } from "../hooks/use-warehouse-data";
import { resolveWarehousePermissions } from "../hooks/use-warehouse-permissions";
import { formatDateTime, getDueBadge } from "./equipment-detail-view";
import { formatCustodyPurpose } from "../presentation/warehouse-ui";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Dog,
  Search,
  ShieldCheck,
  User,
  UserCheck,
} from "lucide-react";
import { ReturnCustodyDialog } from "./return-custody-dialog";
import { CancelCustodyDialog } from "./cancel-custody-dialog";
import { WarehouseKpiCard } from "./warehouse-kpi-card";
import {
  staggerContainerVariants,
  staggerItemVariants,
  WarehouseItemThumbnail,
  ViewToggle,
} from "../presentation/warehouse-motion";

export function CustodyListView() {
  const { custodies, equipment, locations, status, error, permissions } = useWarehouseData();
  const perms = resolveWarehousePermissions(permissions);
  const now = defaultBusinessClock.now();

  // Filters state
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "returned" | "cancelled">("all");
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [searchResponsible, setSearchResponsible] = useState("");
  const [searchEquipment, setSearchEquipment] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Dialog state
  const [selectedCustodyForReturn, setSelectedCustodyForReturn] = useState<EquipmentCustody | null>(null);
  const [selectedCustodyForCancel, setSelectedCustodyForCancel] = useState<EquipmentCustody | null>(null);

  // Equipment lookup map
  const equipmentMap = useMemo(() => {
    const map = new Map<string, typeof equipment[0]>();
    equipment.forEach((eq) => map.set(eq.id, eq));
    return map;
  }, [equipment]);

  // Process rows with derived due states
  const processedCustodies = useMemo(() => {
    return custodies.map((c) => {
      const dueState = deriveCustodyDueState(c, now);
      const overdue = isCustodyOverdue(c, now);
      return {
        ...c,
        derivedDueState: dueState,
        isOverdue: overdue,
      };
    });
  }, [custodies, now]);

  // Filtered rows
  const filteredCustodies = useMemo(() => {
    return processedCustodies
      .filter((c) => {
        // Status filter
        if (statusFilter !== "all" && c.status !== statusFilter) {
          return false;
        }

        // Quick overdue filter
        if (onlyOverdue && !c.isOverdue) {
          return false;
        }

        // Search by responsible
        if (searchResponsible.trim()) {
          const q = searchResponsible.toLowerCase();
          const matchesName = c.borrower_name.toLowerCase().includes(q);
          const matchesRa = c.borrower_ra.toLowerCase().includes(q);
          if (!matchesName && !matchesRa) return false;
        }

        // Search by equipment
        if (searchEquipment.trim()) {
          const q = searchEquipment.toLowerCase();
          const matchesName = c.equipment_name.toLowerCase().includes(q);
          const matchesCode = c.equipment_code.toLowerCase().includes(q);
          if (!matchesName && !matchesCode) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Active custodies first, then by date descending
        if (a.status === "active" && b.status !== "active") return -1;
        if (b.status === "active" && a.status !== "active") return 1;
        const timeA = a.dispatched_at ? new Date(a.dispatched_at).getTime() : 0;
        const timeB = b.dispatched_at ? new Date(b.dispatched_at).getTime() : 0;
        return timeB - timeA;
      });
  }, [processedCustodies, statusFilter, onlyOverdue, searchResponsible, searchEquipment]);

  // Overdue count
  const overdueCount = useMemo(() => {
    return processedCustodies.filter((c) => c.isOverdue).length;
  }, [processedCustodies]);

  // Contextual KPIs
  const activeCount = useMemo(() => processedCustodies.filter((c) => c.status === "active").length, [processedCustodies]);
  const returnedCount = useMemo(() => processedCustodies.filter((c) => c.status === "returned").length, [processedCustodies]);
  const onTimeActive = Math.max(0, activeCount - overdueCount);
  const onTimePercent = activeCount > 0 ? Math.round((onTimeActive / activeCount) * 100) : 100;

  if (status === "loading") {
    return <div className="p-8 text-center text-xs text-slate-400">Carregando registro de cautelas...</div>;
  }

  if (status === "error") {
    return (
      <div role="alert" className="p-6 text-center text-xs text-rose-400">
        Erro ao carregar cautelas: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="custody-list-view">
      {/* 1. Contextual KPI Cards with Count-up */}
      <section
        aria-label="Indicadores de cautelas de equipamentos"
        className="grid grid-cols-2 gap-3.5 sm:grid-cols-4"
      >
        <WarehouseKpiCard
          label="CAUTELAS ATIVAS"
          value={activeCount}
          subtext="equipamentos em uso em serviço"
          icon={UserCheck}
          colorVariant="cyan"
          trend={{ text: "Em andamento", direction: "up", variant: "cyan" }}
        />

        <WarehouseKpiCard
          label="CAUTELAS ATRASADAS"
          value={overdueCount}
          subtext="devoluções com prazo extrapolado"
          icon={Clock}
          colorVariant="rose"
          trend={{ text: overdueCount > 0 ? "Crítico" : "Zero atrasos", direction: "neutral", variant: "rose" }}
        />

        <WarehouseKpiCard
          label="TAXA NO PRAZO"
          value={`${onTimePercent}%`}
          subtext="conformidade de devoluções"
          icon={ShieldCheck}
          colorVariant="emerald"
          trend={{ text: `${onTimeActive}/${activeCount}`, direction: "up", variant: "emerald" }}
        />

        <WarehouseKpiCard
          label="DEVOLUÇÕES CONCLUÍDAS"
          value={returnedCount}
          subtext="equipamentos restituídos"
          icon={CheckCircle2}
          colorVariant="purple"
          trend={{ text: "Histórico", direction: "neutral", variant: "slate" }}
        />
      </section>

      {/* 2. Main Card: Table / Cards and Filters */}
      <section
        aria-label="Livro de cautelas"
        className="rounded-2xl border border-white/[0.08] bg-[#0b1424]/90 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.25)] space-y-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-cyan-400" />
              Livro de Cautelas de Equipamentos
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Rastreamento de empréstimos operacionais, prazos de devolução e vistorias de retorno.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/warehouse/equipment"
              className="rounded-xl bg-cyan-400 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-cyan-300 transition shadow"
            >
              Ver Catálogo de Equipamentos
            </Link>
            <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-1">
          {/* Search Responsible */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              id="search-resp"
              type="text"
              value={searchResponsible}
              onChange={(e) => setSearchResponsible(e.target.value)}
              placeholder="Policial / RA..."
              className="h-9 w-full rounded-xl border border-white/10 bg-slate-900/60 pl-8 pr-3 text-xs text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/40"
            />
          </div>

          {/* Search Equipment */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              id="search-eq"
              type="text"
              value={searchEquipment}
              onChange={(e) => setSearchEquipment(e.target.value)}
              placeholder="Equipamento ou patrimônio..."
              className="h-9 w-full rounded-xl border border-white/10 bg-slate-900/60 pl-8 pr-3 text-xs text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/40"
            />
          </div>

          {/* Status Filter */}
          <select
            id="filter-custody-status"
            aria-label="Situação da Cautela"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="h-9 w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 text-xs text-slate-200 outline-none transition focus:border-cyan-400/40"
          >
            <option value="all">Todas as cautelas</option>
            <option value="active">Ativas (Em andamento)</option>
            <option value="returned">Devolvidas</option>
            <option value="cancelled">Canceladas</option>
          </select>

          {/* Overdue Quick Filter Button */}
          <button
            type="button"
            onClick={() => setOnlyOverdue(!onlyOverdue)}
            className={`h-9 rounded-xl border px-3 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              onlyOverdue
                ? "border-rose-500/50 bg-rose-500/20 text-rose-300 shadow-sm"
                : "border-white/10 bg-slate-900/60 text-slate-300 hover:text-white"
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Apenas Atrasadas</span>
            {overdueCount > 0 && (
              <span className="rounded-full bg-rose-500 px-1.5 py-0.2 text-[10px] text-white font-mono">
                {overdueCount}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
          <div>
            Ativas: <strong className="text-white">{activeCount}</strong> ·{" "}
            Atrasadas: <strong className={overdueCount > 0 ? "text-rose-400 font-bold" : "text-slate-300"}>{overdueCount}</strong>
          </div>
          <div>
            Mostrando <strong>{filteredCustodies.length}</strong> de <strong>{custodies.length}</strong> registros
          </div>
        </div>

        {/* View Mode: Cards Grid (Mockup 5 Parity) */}
        {viewMode === "grid" ? (
          <motion.div
            variants={staggerContainerVariants}
            initial={false}
            animate="visible"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-2"
          >
            {filteredCustodies.map((custody) => {
              const isActive = custody.status === "active";
              const eq = equipmentMap.get(custody.equipment_id);

              const borderGlowClass = custody.isOverdue
                ? "border-rose-500/40 shadow-[0_4px_20px_rgba(244,63,94,0.15)] bg-rose-950/10"
                : isActive
                ? "border-cyan-500/30 shadow-[0_4px_20px_rgba(6,182,212,0.12)] bg-[#0c1629]/80"
                : "border-white/[0.08] bg-[#0c1629]/60";

              return (
                <motion.div
                  key={custody.id}
                  variants={staggerItemVariants}
                  className={`group relative flex flex-col justify-between rounded-2xl border ${borderGlowClass} p-4 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/50 hover:shadow-[0_8px_30px_rgba(6,182,212,0.16)] focus-within:ring-2 focus-within:ring-cyan-400/50`}
                >
                  <div>
                    {/* Top Row: Large Thumbnail + Item + Badges (Mockup 5 Parity) */}
                    <div className="flex items-start gap-3">
                      <WarehouseItemThumbnail
                        size="card"
                        categoryName="Equipamentos"
                        src={(eq as unknown as { photo_url?: string; image_url?: string })?.photo_url ?? (eq as unknown as { image_url?: string })?.image_url}
                        alt={custody.equipment_name}
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <Link
                            href={`/warehouse/equipment/${custody.equipment_id}`}
                            className="font-bold text-sm text-white group-hover:text-cyan-300 transition line-clamp-1 block"
                            title={custody.equipment_name}
                          >
                            {custody.equipment_name}
                          </Link>

                          {isActive && getDueBadge(custody.derivedDueState)}
                        </div>

                        <div className="mt-0.5 font-mono text-xs font-bold text-cyan-300">
                          {custody.equipment_code}
                        </div>

                        {/* Officer & Purpose Section */}
                        <div className="mt-2.5 p-2 rounded-xl bg-slate-950/40 border border-white/[0.04] space-y-1 text-xs">
                          <div className="flex items-center gap-2">
                            <div className="rounded-full bg-cyan-500/10 p-1 text-cyan-400 shrink-0">
                              <User className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0">
                              <span className="font-semibold text-white text-xs block truncate">
                                {custody.borrower_name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono block">
                                RA: {custody.borrower_ra}
                              </span>
                            </div>
                          </div>

                          <div className="pt-1 border-t border-white/[0.04] flex items-center justify-between text-[11px] text-slate-400">
                            <span>Finalidade:</span>
                            <span className="text-slate-200 font-medium truncate max-w-[130px]">
                              {formatCustodyPurpose(custody.purpose)}
                            </span>
                          </div>

                          {custody.linked_dog_name && (
                            <div className="pt-1 border-t border-white/[0.04] flex items-center justify-between text-[11px] text-slate-400">
                              <span className="flex items-center gap-1">
                                <Dog className="h-3 w-3 text-cyan-400" />
                                <span>Cão:</span>
                              </span>
                              <span className="text-cyan-200 font-medium truncate max-w-[130px]">
                                {custody.linked_dog_name}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Date Details */}
                        <div className="grid grid-cols-2 gap-2 mt-2 text-[10px] text-slate-400">
                          <div>
                            <span className="block font-mono uppercase text-slate-500 text-[9px]">Expedição</span>
                            <span className="font-mono text-slate-300 block truncate">{formatDateTime(custody.dispatched_at)}</span>
                          </div>

                          <div>
                            <span className="block font-mono uppercase text-slate-500 text-[9px]">Devolução</span>
                            <span
                              className={`font-mono font-bold block truncate ${
                                custody.isOverdue ? "text-rose-400" : "text-slate-300"
                              }`}
                            >
                              {formatDateTime(custody.expected_return_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions Footer: Status Pill + Action Buttons */}
                  <div className="mt-3.5 pt-3 border-t border-white/[0.06] flex items-center justify-between gap-2">
                    <div>
                      {isActive ? (
                        <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-bold text-cyan-300 uppercase">
                          Ativa
                        </span>
                      ) : custody.status === "returned" ? (
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300 uppercase">
                          Devolvida
                        </span>
                      ) : (
                        <span className="rounded-full border border-slate-700 bg-slate-800/40 px-2.5 py-0.5 text-[10px] font-medium text-slate-400 uppercase">
                          Cancelada
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/warehouse/equipment/${custody.equipment_id}`}
                        className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-cyan-400/40 hover:text-white transition"
                      >
                        Detalhes
                      </Link>

                      {isActive && perms.canReturnCustody && (
                        <button
                          type="button"
                          onClick={() => setSelectedCustodyForReturn(custody)}
                          className="rounded-xl bg-cyan-400 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-cyan-300 transition shadow"
                        >
                          Devolver
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          /* View Mode: Table */
          <div className="overflow-x-auto rounded-xl border border-white/[0.06] pt-1">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/[0.06] bg-slate-950/40 text-slate-400 font-mono text-[10px] uppercase">
                <tr>
                  <th className="py-2.5 px-3">Equipamento</th>
                  <th className="py-2.5 px-3">Responsável</th>
                  <th className="py-2.5 px-3">Finalidade</th>
                  <th className="py-2.5 px-3">Expedição</th>
                  <th className="py-2.5 px-3">Devolução Prevista</th>
                  <th className="py-2.5 px-3">Prazo</th>
                  <th className="py-2.5 px-3">Situação</th>
                  <th className="py-2.5 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredCustodies.map((custody) => {
                  const isActive = custody.status === "active";

                  return (
                    <tr
                      key={custody.id}
                      className={`transition hover:bg-white/[0.02] ${
                        custody.isOverdue ? "bg-rose-950/20" : ""
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <Link
                          href={`/warehouse/equipment/${custody.equipment_id}`}
                          className="font-semibold text-white hover:text-cyan-300 transition"
                        >
                          {custody.equipment_name}
                        </Link>
                        <div className="font-mono text-[11px] text-cyan-200">
                          {custody.equipment_code}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-white text-xs">{custody.borrower_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">RA: {custody.borrower_ra}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        {formatCustodyPurpose(custody.purpose)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 font-mono">
                        {formatDateTime(custody.dispatched_at)}
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        {custody.expected_return_at ? (
                          <span className={custody.isOverdue ? "font-bold text-rose-300" : "text-slate-300"}>
                            {formatDateTime(custody.expected_return_at)}
                          </span>
                        ) : (
                          <span className="text-slate-500 font-mono">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {isActive ? (
                          getDueBadge(custody.derivedDueState)
                        ) : (
                          <span className="text-slate-600 font-mono">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {isActive ? (
                          <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-300 uppercase">
                            Ativa
                          </span>
                        ) : custody.status === "returned" ? (
                          <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300 uppercase">
                            Devolvida
                          </span>
                        ) : (
                          <span className="rounded-md border border-slate-700 bg-slate-800/40 px-2 py-0.5 text-[10px] font-medium text-slate-400 uppercase">
                            Cancelada
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {isActive && perms.canReturnCustody && (
                            <button
                              type="button"
                              onClick={() => setSelectedCustodyForReturn(custody)}
                              className="rounded-lg bg-cyan-400 px-2.5 py-1 text-[11px] font-bold text-slate-950 hover:bg-cyan-300 transition shadow"
                            >
                              Devolver
                            </button>
                          )}
                          <Link
                            href={`/warehouse/equipment/${custody.equipment_id}`}
                            className="rounded-lg border border-white/10 px-2 py-1 text-[11px] font-medium text-slate-300 hover:border-cyan-400/30 hover:text-white transition"
                          >
                            Item
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {filteredCustodies.length === 0 && (
          <div className="p-8 text-center text-xs text-slate-400">
            Nenhuma cautela encontrada com os filtros informados.
          </div>
        )}
      </section>

      {/* Return Custody Dialog */}
      {selectedCustodyForReturn && (
        <ReturnCustodyDialog
          isOpen={true}
          onClose={() => setSelectedCustodyForReturn(null)}
          custody={selectedCustodyForReturn}
          equipment={equipmentMap.get(selectedCustodyForReturn.equipment_id)}
          locations={locations}
        />
      )}

      {/* Cancel Custody Dialog */}
      {selectedCustodyForCancel && (
        <CancelCustodyDialog
          isOpen={true}
          onClose={() => setSelectedCustodyForCancel(null)}
          custody={selectedCustodyForCancel}
        />
      )}
    </div>
  );
}