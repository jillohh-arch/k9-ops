"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertOctagon,
  Calendar,
  Eye,
  Layers,
  MapPin,
  MinusCircle,
  Search,
} from "lucide-react";
import { useWarehouseData } from "../hooks/use-warehouse-data";
import { getBatchTemporalState } from "../domain/projections";
import { defaultBusinessClock } from "../domain/business-clock";
import { EntryDialog } from "./entry-dialog";
import { BatchStatusBadge, BatchTemporalBadge } from "../presentation/warehouse-ui";
import { WarehouseKpiCard } from "./warehouse-kpi-card";
import {
  staggerContainerVariants,
  staggerItemVariants,
  ViewToggle,
  WarehouseItemThumbnail,
} from "../presentation/warehouse-motion";

function getRelativeDaysText(expirationDate: string, todayStr: string): { text: string; isPast: boolean } {
  const exp = new Date(expirationDate + "T00:00:00");
  const today = new Date(todayStr + "T00:00:00");
  const diffTime = exp.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    return { text: `Vencido há ${Math.abs(diffDays)}d`, isPast: true };
  } else if (diffDays === 0) {
    return { text: "Vence hoje", isPast: false };
  } else if (diffDays <= 30) {
    return { text: `Vence em ${diffDays}d`, isPast: false };
  } else {
    return { text: `Válido (${diffDays}d)`, isPast: false };
  }
}

export function BatchesTableView() {
  const { materials, batches, positions, locations, status, error } = useWarehouseData();
  const today = defaultBusinessClock.today();

  const [searchTerm, setSearchTerm] = useState("");
  const [temporalFilter, setTemporalFilter] = useState<"all" | "valid" | "expiring_soon" | "expired">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "depleted" | "blocked">("active");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isEntryOpen, setIsEntryOpen] = useState(false);

  // Batches ordered by FEFO strictly (expired first, then nearest expiration)
  const processedBatches = useMemo(() => {
    return batches
      .map((batch) => {
        const material = materials.find((m) => m.id === batch.material_id);
        const temporal = getBatchTemporalState(batch, today);
        const batchPositions = positions.filter((p) => p.batch_id === batch.id && p.quantity > 0);
        const relativeDays = getRelativeDaysText(batch.expiration_date, today);

        return {
          batch,
          material,
          temporal,
          positionsCount: batchPositions.length,
          relativeDays,
        };
      })
      .sort((a, b) => {
        // Primary FEFO: expiration date ascending
        if (a.batch.expiration_date !== b.batch.expiration_date) {
          return a.batch.expiration_date.localeCompare(b.batch.expiration_date);
        }
        return a.batch.lot_number.localeCompare(b.batch.lot_number);
      });
  }, [batches, materials, positions, today]);

  const filteredBatches = useMemo(() => {
    return processedBatches.filter(({ batch, material, temporal }) => {
      // Status filter
      if (statusFilter !== "all" && batch.status !== statusFilter) {
        return false;
      }

      // Temporal filter
      if (temporalFilter !== "all" && temporal !== temporalFilter) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesLot = batch.lot_number.toLowerCase().includes(q);
        const matchesMat = material?.name.toLowerCase().includes(q);
        const matchesSupplier = batch.supplier_name?.toLowerCase().includes(q);
        if (!matchesLot && !matchesMat && !matchesSupplier) return false;
      }

      return true;
    });
  }, [processedBatches, statusFilter, temporalFilter, searchTerm]);

  // Contextual KPIs
  const activeBatchesCount = useMemo(() => {
    return batches.filter((b) => b.status === "active" && Number(b.current_quantity ?? 0) > 0).length;
  }, [batches]);

  const expiringSoonCount = useMemo(() => {
    return processedBatches.filter((b) => b.temporal === "expiring_soon" && Number(b.batch.current_quantity ?? 0) > 0).length;
  }, [processedBatches]);

  const expiredCount = useMemo(() => {
    return processedBatches.filter((b) => b.temporal === "expired" && Number(b.batch.current_quantity ?? 0) > 0).length;
  }, [processedBatches]);

  const depletedOrBlockedCount = useMemo(() => {
    return batches.filter((b) => b.status === "depleted" || b.status === "blocked").length;
  }, [batches]);

  return (
    <div className="space-y-6" data-testid="batches-table-view">
      {/* 1. Contextual KPI Cards with Count-up */}
      <section
        aria-label="Indicadores de lotes FEFO"
        className="grid grid-cols-2 gap-3.5 sm:grid-cols-4"
      >
        <WarehouseKpiCard
          label="LOTES ATIVOS COM SALDO"
          value={activeBatchesCount}
          subtext="disponíveis para consumo"
          icon={Layers}
          colorVariant="emerald"
          trend={{ text: "Normal", direction: "up", variant: "emerald" }}
        />

        <WarehouseKpiCard
          label="VENCENDO EM BREVE (≤ 30d)"
          value={expiringSoonCount}
          subtext="prioridade máxima de consumo"
          icon={Calendar}
          colorVariant="amber"
          trend={{ text: expiringSoonCount > 0 ? "Atenção" : "Zero risco", direction: "up", variant: "amber" }}
        />

        <WarehouseKpiCard
          label="LOTES VENCIDOS (COM SALDO)"
          value={expiredCount}
          subtext="bloqueio imediato requerido"
          icon={AlertOctagon}
          colorVariant="rose"
          trend={{ text: expiredCount > 0 ? "Crítico" : "Em dia", direction: "neutral", variant: "rose" }}
        />

        <WarehouseKpiCard
          label="ESGOTADOS / BLOQUEADOS"
          value={depletedOrBlockedCount}
          subtext="histórico sem saldo ativo"
          icon={MinusCircle}
          colorVariant="purple"
          trend={{ text: "Arquivo", direction: "neutral", variant: "slate" }}
        />
      </section>

      {/* 2. Main Card: Table and Filters */}
      <section
        aria-label="Monitoramento de Lotes FEFO"
        className="rounded-2xl border border-white/[0.08] bg-[#0b1424]/90 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.25)] space-y-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Calendar className="h-4 w-4 text-cyan-400" />
              Lotes de Almoxarifado (FEFO)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Monitoramento ordenado por First-Expire, First-Out: o que vence primeiro é priorizado no consumo.
            </p>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              id="batch-search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por lote, material ou fornecedor..."
              className="h-9 w-full rounded-xl border border-white/10 bg-slate-900/60 pl-8 pr-3 text-xs text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/40"
            />
          </div>

          <select
            id="batch-filter-temporal"
            aria-label="Situação Temporal"
            value={temporalFilter}
            onChange={(e) =>
              setTemporalFilter(
                e.target.value as "all" | "valid" | "expiring_soon" | "expired",
              )
            }
            className="h-9 w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 text-xs text-slate-200 outline-none transition focus:border-cyan-400/40"
          >
            <option value="all">Todas as validades</option>
            <option value="expiring_soon">Vence em breve (≤ 30 dias)</option>
            <option value="expired">Vencidos</option>
            <option value="valid">Válidos (&gt; 30 dias)</option>
          </select>

          <select
            id="batch-filter-status"
            aria-label="Status do Lote"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value as "all" | "active" | "depleted" | "blocked",
              )
            }
            className="h-9 w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 text-xs text-slate-200 outline-none transition focus:border-cyan-400/40"
          >
            <option value="active">Apenas Ativos com Saldo</option>
            <option value="depleted">Esgotados</option>
            <option value="blocked">Bloqueados</option>
            <option value="all">Todos</option>
          </select>
        </div>

        {status === "loading" && <p role="status" className="py-4 text-xs text-slate-400">Carregando lotes…</p>}
        {status === "error" && <p role="alert" className="py-4 text-xs text-rose-400">Erro: {error}</p>}
        {status === "forbidden" && <p role="alert" className="py-4 text-xs text-rose-400">Sem autorização.</p>}

        {status === "ready" && (
          <>
            {/* VIEW MODE: FEFO CARDS (Mockup 3 Parity) */}
            {viewMode === "grid" ? (
              <motion.div
                variants={staggerContainerVariants}
                initial={false}
                animate="visible"
                className="space-y-3 pt-2"
              >
                {filteredBatches.map(({ batch, material, temporal, positionsCount, relativeDays }) => {
                  const borderLeftColor =
                    temporal === "expired"
                      ? "border-l-rose-500"
                      : temporal === "expiring_soon"
                      ? "border-l-amber-500"
                      : "border-l-emerald-500";

                  return (
                    <motion.div
                      key={batch.id}
                      variants={staggerItemVariants}
                      className={`group relative rounded-2xl border border-white/[0.08] border-l-4 ${borderLeftColor} bg-[#0c1629]/90 p-4 shadow-[0_4px_16px_rgba(0,0,0,0.2)] transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-500/30 hover:shadow-[0_8px_24px_rgba(6,182,212,0.1)]`}
                    >
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-center">
                        {/* Col 1: Thumbnail + Material Name + Category + Lot (lg:col-span-4) */}
                        <div className="flex items-center gap-3 lg:col-span-4 min-w-0">
                          <WarehouseItemThumbnail
                            size="sm"
                            categoryName={material?.category_name || "Alimentação"}
                            src={(material as unknown as { photo_url?: string; image_url?: string })?.photo_url ?? (material as unknown as { image_url?: string })?.image_url}
                            alt={material?.name || batch.material_name}
                          />

                          <div className="min-w-0 flex-1">
                            {material ? (
                              <Link
                                href={`/warehouse/materials/${material.id}`}
                                className="font-bold text-sm text-white group-hover:text-cyan-300 transition truncate block"
                                title={material.name}
                              >
                                {material.name}
                              </Link>
                            ) : (
                              <span className="font-bold text-sm text-white truncate block">{batch.material_name}</span>
                            )}

                            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                              <span>{material?.category_name || "Geral"}</span>
                              {(batch.supplier_name || batch.invoice_reference) && (
                                <>
                                  <span>·</span>
                                  <span className="truncate max-w-[150px]">{batch.supplier_name}</span>
                                </>
                              )}
                            </div>

                            <div className="mt-1 flex items-center gap-1.5">
                              <span className="font-mono text-[11px] font-bold text-cyan-300 bg-cyan-950/40 border border-cyan-500/20 rounded px-1.5 py-0.5">
                                LOTE {batch.lot_number}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Col 2: Validade (lg:col-span-2) */}
                        <div className="lg:col-span-2 flex items-start gap-2 text-xs">
                          <Calendar className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
                          <div>
                            <span className="block font-mono font-bold text-white text-xs">
                              {batch.expiration_date}
                            </span>
                            <span
                              className={`text-[10px] font-bold block mt-0.5 ${
                                relativeDays.isPast ? "text-rose-400" : "text-amber-400"
                              }`}
                            >
                              {relativeDays.text}
                            </span>
                          </div>
                        </div>

                        {/* Col 3: Condição FEFO Badge (lg:col-span-2) */}
                        <div className="lg:col-span-2 flex items-center">
                          <BatchTemporalBadge state={temporal} />
                        </div>

                        {/* Col 4: Saldo Atual (lg:col-span-2) */}
                        <div className="lg:col-span-2 flex items-start gap-2 text-xs">
                          <Layers className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
                          <div>
                            <span className="font-mono font-bold text-sm text-white block">
                              {batch.current_quantity} {material?.unit}
                            </span>
                            {Number(batch.initial_quantity ?? 0) > Number(batch.current_quantity ?? 0) ? (
                              <span className="block text-[10px] font-mono text-slate-500">
                                de {batch.initial_quantity} {material?.unit}
                              </span>
                            ) : (
                              <span className="block text-[10px] font-mono text-slate-500">
                                saldo integral
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Col 5: Posições & Ações (lg:col-span-2) */}
                        <div className="lg:col-span-2 flex items-center justify-between lg:justify-end gap-3">
                          <div className="flex items-center gap-1.5 text-xs text-slate-300">
                            <MapPin className="h-3.5 w-3.5 text-cyan-400" />
                            <span className="font-mono text-xs font-semibold text-cyan-200">
                              {positionsCount > 0 ? `${positionsCount} pos.` : "Sem pos."}
                            </span>
                          </div>

                          {material && (
                            <Link
                              href={`/warehouse/materials/${material.id}`}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-cyan-400/40 hover:text-white transition"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>Ver detalhes</span>
                            </Link>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            ) : (
              /* VIEW MODE: TABLE */
              <div className="overflow-x-auto rounded-xl border border-white/[0.06] pt-1">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/[0.06] bg-slate-950/40 text-slate-400 font-mono text-[10px] uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Lote</th>
                      <th className="py-2.5 px-3">Material</th>
                      <th className="py-2.5 px-3">Data de Validade</th>
                      <th className="py-2.5 px-3">Condição FEFO</th>
                      <th className="py-2.5 px-3">Saldo Atual</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Posições Físicas</th>
                      <th className="py-2.5 px-3">Fornecedor / NF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {filteredBatches.map(({ batch, material, temporal, positionsCount }) => (
                      <tr key={batch.id} className="hover:bg-white/[0.02] transition">
                        <td className="py-2.5 px-3 font-mono font-bold text-white">
                          {batch.lot_number}
                        </td>

                        <td className="py-2.5 px-3">
                          {material ? (
                            <Link
                              href={`/warehouse/materials/${material.id}`}
                              className="font-semibold text-slate-200 hover:text-cyan-300 transition"
                            >
                              {material.name}
                            </Link>
                          ) : (
                            <span className="text-slate-400">{batch.material_name}</span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 font-mono">
                          {batch.expiration_date}
                        </td>

                        <td className="py-2.5 px-3">
                          <BatchTemporalBadge state={temporal} />
                        </td>

                        <td className="py-2.5 px-3 font-mono font-bold text-white">
                          {batch.current_quantity} <span className="font-normal text-slate-400">{material?.unit}</span>
                        </td>

                        <td className="py-2.5 px-3">
                          <BatchStatusBadge status={batch.status} />
                        </td>

                        <td className="py-2.5 px-3 text-slate-300 font-mono text-center">
                          {positionsCount > 0 ? (
                            <span className="inline-flex items-center gap-1 text-cyan-300 font-bold">
                              {positionsCount} {positionsCount === 1 ? "posição" : "posições"}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                          {batch.supplier_name || batch.invoice_reference ? (
                            <span>
                              {batch.supplier_name}
                              {batch.invoice_reference && ` · NF: ${batch.invoice_reference}`}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {filteredBatches.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-400">
                Nenhum lote corresponde aos filtros selecionados.
              </div>
            )}
          </>
        )}
      </section>

      {/* Entry Dialog */}
      <EntryDialog
        isOpen={isEntryOpen}
        onClose={() => setIsEntryOpen(false)}
        materials={materials}
        locations={locations}
      />
    </div>
  );
}