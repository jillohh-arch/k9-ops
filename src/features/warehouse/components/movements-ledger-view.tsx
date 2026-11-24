"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  ClipboardList,
  Dog,
  MapPin,
  Search,
  User,
} from "lucide-react";
import { MovementTypeBadge } from "../presentation/warehouse-ui";
import { useWarehouseData } from "../hooks/use-warehouse-data";
import { WarehouseKpiCard } from "./warehouse-kpi-card";
import {
  staggerContainerVariants,
  staggerItemVariants,
  ViewToggle,
} from "../presentation/warehouse-motion";

export function MovementsLedgerView() {
  const { movements, status, error } = useWarehouseData();

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [materialFilter, setMaterialFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Sorted movements (most recent first)
  const sortedMovements = useMemo(() => {
    return [...movements].sort((a, b) => {
      const timeA = a.performed_at ? new Date(a.performed_at).getTime() : 0;
      const timeB = b.performed_at ? new Date(b.performed_at).getTime() : 0;
      return timeB - timeA;
    });
  }, [movements]);

  // Unique materials in movements
  const movementMaterials = useMemo(() => {
    const map = new Map<string, string>();
    movements.forEach((m) => {
      if (m.material_id && m.material_name) {
        map.set(m.material_id, m.material_name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [movements]);

  const filteredMovements = useMemo(() => {
    return sortedMovements.filter((mov) => {
      if (typeFilter !== "all" && mov.type !== typeFilter) {
        return false;
      }
      if (materialFilter !== "all" && mov.material_id !== materialFilter) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesLot = mov.lot_number?.toLowerCase().includes(q);
        const matchesReason = mov.reason?.toLowerCase().includes(q);
        const matchesUser = mov.performed_by_name?.toLowerCase().includes(q);
        const matchesDog = mov.related_dog_name?.toLowerCase().includes(q);
        const matchesMat = mov.material_name?.toLowerCase().includes(q);
        if (!matchesLot && !matchesReason && !matchesUser && !matchesDog && !matchesMat) {
          return false;
        }
      }
      return true;
    });
  }, [sortedMovements, typeFilter, materialFilter, searchTerm]);

  // Contextual KPIs
  const entriesCount = useMemo(() => movements.filter((m) => m.type === "entry").length, [movements]);
  const consumptionCount = useMemo(() => movements.filter((m) => m.type === "consumption").length, [movements]);
  const transferCount = useMemo(() => movements.filter((m) => m.type === "transfer").length, [movements]);

  return (
    <div className="space-y-6" data-testid="movements-ledger-view">
      {/* 1. Contextual KPI Cards */}
      <section
        aria-label="Indicadores de movimentações"
        className="grid grid-cols-2 gap-3.5 sm:grid-cols-4"
      >
        <WarehouseKpiCard
          label="TOTAL DE TRANSAÇÕES"
          value={movements.length}
          subtext="registros no livro-razão"
          icon={ClipboardList}
          colorVariant="cyan"
          trend={{ text: "Auditado", direction: "neutral", variant: "cyan" }}
        />

        <WarehouseKpiCard
          label="ENTRADAS HOMOLOGADAS"
          value={entriesCount}
          subtext="aquisições e recebimentos"
          icon={ArrowDownLeft}
          colorVariant="emerald"
          trend={{ text: "Suprimento", direction: "neutral", variant: "emerald" }}
        />

        <WarehouseKpiCard
          label="SAÍDAS / CONSUMOS"
          value={consumptionCount}
          subtext="atendimentos operacionais"
          icon={ArrowUpRight}
          colorVariant="blue"
          trend={{ text: "Consumo", direction: "neutral", variant: "cyan" }}
        />

        <WarehouseKpiCard
          label="TRANSFERÊNCIAS INTERNAS"
          value={transferCount}
          subtext="entre locais físicos e viaturas"
          icon={ArrowLeftRight}
          colorVariant="purple"
          trend={{ text: "Manejo", direction: "neutral", variant: "slate" }}
        />
      </section>

      {/* 2. Main Card: Content and Filters */}
      <section
        aria-label="Livro-Razão de Movimentações"
        className="rounded-2xl border border-white/[0.08] bg-[#0b1424]/90 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.25)] space-y-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-cyan-400" />
              Livro-Razão de Movimentações
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Registro imutável de auditoria de todas as entradas, consumos, transferências e baixas operacionais.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              id="mov-search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por lote, motivo, responsável ou cão..."
              className="h-9 w-full rounded-xl border border-white/10 bg-slate-900/60 pl-8 pr-3 text-xs text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/40"
            />
          </div>

          <select
            id="mov-type-filter"
            aria-label="Tipo de Movimentação"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-9 w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 text-xs text-slate-200 outline-none transition focus:border-cyan-400/40"
          >
            <option value="all">Todos os tipos</option>
            <option value="entry">Entrada (+)</option>
            <option value="consumption">Consumo (-)</option>
            <option value="transfer">Transferência (delta 0)</option>
            <option value="inventory_adjustment">Ajuste de Inventário</option>
            <option value="loss">Perda (-)</option>
            <option value="disposal">Descarte (-)</option>
          </select>

          <select
            id="mov-mat-filter"
            aria-label="Material"
            value={materialFilter}
            onChange={(e) => setMaterialFilter(e.target.value)}
            className="h-9 w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 text-xs text-slate-200 outline-none transition focus:border-cyan-400/40"
          >
            <option value="all">Todos os materiais</option>
            {movementMaterials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-slate-400">
          Mostrando <strong>{filteredMovements.length}</strong> de <strong>{movements.length}</strong> movimentações
        </div>

        {status === "loading" && <p role="status" className="py-4 text-xs text-slate-400">Carregando movimentações…</p>}
        {status === "error" && <p role="alert" className="py-4 text-xs text-rose-400">Erro: {error}</p>}
        {status === "forbidden" && <p role="alert" className="py-4 text-xs text-rose-400">Sem autorização.</p>}

        {status === "ready" && viewMode === "grid" && (
          <motion.div
            variants={staggerContainerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-3 pt-1"
          >
            {filteredMovements.map((mov) => {
              const isEntry = mov.type === "entry";
              const isTransfer = mov.type === "transfer";
              const isLoss = mov.type === "loss" || mov.type === "disposal";
              const dateStr = mov.performed_at
                ? new Date(mov.performed_at).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—";

              return (
                <motion.div
                  key={mov.id}
                  variants={staggerItemVariants}
                  className="group relative rounded-2xl border border-white/[0.06] bg-slate-900/60 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-500/40 hover:shadow-[0_6px_24px_rgba(6,182,212,0.10)]"
                >
                  {/* Top Bar: Badges + Timestamp + Quantity Delta */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.04] pb-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <MovementTypeBadge type={mov.type} />
                      <span className="font-mono text-[11px] text-slate-400">{dateStr}</span>
                      {mov.lot_number && (
                        <span className="rounded-md border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-300">
                          LOTE {mov.lot_number}
                        </span>
                      )}
                    </div>

                    <div
                      className={`font-mono text-sm font-bold tracking-tight ${
                        isEntry
                          ? "text-emerald-400"
                          : isTransfer
                          ? "text-purple-300"
                          : isLoss
                          ? "text-rose-400"
                          : "text-sky-300"
                      }`}
                    >
                      {isEntry ? "+" : isTransfer ? "⇄ " : "-"}
                      {mov.quantity} {mov.unit}
                    </div>
                  </div>

                  {/* Main Info */}
                  <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <Link
                        href={`/warehouse/materials/${mov.material_id}`}
                        className="text-sm font-bold text-white hover:text-cyan-300 transition"
                      >
                        {mov.material_name}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                        {/* Locations */}
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-slate-500" />
                          {isTransfer ? (
                            <span>
                              {mov.origin_location_name} &rarr; {mov.destination_location_name}
                            </span>
                          ) : isEntry ? (
                            <span>&rarr; {mov.destination_location_name}</span>
                          ) : (
                            <span>{mov.origin_location_name || "—"}</span>
                          )}
                        </span>

                        {/* Responsible Handler */}
                        <span className="inline-flex items-center gap-1">
                          <User className="h-3 w-3 text-slate-500" />
                          <span>{mov.performed_by_name || "—"}</span>
                        </span>

                        {/* Dog */}
                        {mov.related_dog_name && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-300">
                            <Dog className="h-3 w-3" />
                            <span>{mov.related_dog_name}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Reason */}
                    {mov.reason && (
                      <div className="max-w-xs text-right sm:text-right">
                        <span className="text-[10px] font-mono uppercase text-slate-500 block">Motivo</span>
                        <p className="text-xs text-slate-300 truncate" title={mov.reason}>
                          {mov.reason}
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}

            {filteredMovements.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-400">
                Nenhuma movimentação corresponde aos filtros informados.
              </div>
            )}
          </motion.div>
        )}

        {status === "ready" && viewMode === "list" && (
          <div className="overflow-x-auto rounded-xl border border-white/[0.06] pt-1">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/[0.06] bg-slate-950/40 text-slate-400 font-mono text-[10px] uppercase">
                <tr>
                  <th className="py-2.5 px-3">Data / Hora</th>
                  <th className="py-2.5 px-3">Material</th>
                  <th className="py-2.5 px-3">Tipo</th>
                  <th className="py-2.5 px-3">Quantidade</th>
                  <th className="py-2.5 px-3">Lote</th>
                  <th className="py-2.5 px-3">Origem &rarr; Destino</th>
                  <th className="py-2.5 px-3">Responsável</th>
                  <th className="py-2.5 px-3">Vínculos</th>
                  <th className="py-2.5 px-3">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredMovements.map((mov) => {
                  const isEntry = mov.type === "entry";
                  const isTransfer = mov.type === "transfer";
                  const isLoss = mov.type === "loss" || mov.type === "disposal";

                  return (
                    <tr key={mov.id} className="hover:bg-white/[0.02] transition">
                      <td className="py-2.5 px-3 font-mono text-slate-400 whitespace-nowrap text-[11px]">
                        {mov.performed_at ? new Date(mov.performed_at).toLocaleString("pt-BR") : "—"}
                      </td>

                      <td className="py-2.5 px-3 font-semibold text-white">
                        <Link
                          href={`/warehouse/materials/${mov.material_id}`}
                          className="hover:text-cyan-300 transition"
                        >
                          {mov.material_name}
                        </Link>
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <MovementTypeBadge type={mov.type} />
                      </td>

                      <td
                        className={`py-2.5 px-3 font-mono font-bold whitespace-nowrap ${
                          isEntry
                            ? "text-emerald-400"
                            : isTransfer
                            ? "text-purple-300"
                            : isLoss
                            ? "text-rose-400"
                            : "text-sky-300"
                        }`}
                      >
                        {isEntry ? "+" : isTransfer ? "⇄ " : "-"}
                        {mov.quantity} {mov.unit}
                      </td>

                      <td className="py-2.5 px-3 font-mono text-slate-300 text-[11px] whitespace-nowrap">
                        {mov.lot_number || "—"}
                      </td>

                      <td className="py-2.5 px-3 text-slate-300 text-[11px]">
                        {isTransfer ? (
                          <span>
                            {mov.origin_location_name} &rarr; {mov.destination_location_name}
                          </span>
                        ) : isEntry ? (
                          <span>&rarr; {mov.destination_location_name}</span>
                        ) : (
                          <span>{mov.origin_location_name || "—"}</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-slate-300 text-[11px] whitespace-nowrap">
                        {mov.performed_by_name || "—"}
                      </td>

                      <td className="py-2.5 px-3 text-[11px]">
                        {mov.related_dog_name ? (
                          <span className="inline-flex items-center gap-1 text-cyan-300">
                            <Dog className="h-3 w-3" />
                            <span>{mov.related_dog_name}</span>
                          </span>
                        ) : (
                          <span className="text-slate-600 font-mono">—</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-slate-400 text-[11px] truncate max-w-[200px]">
                        {mov.reason || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredMovements.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-400">
                Nenhuma movimentação corresponde aos filtros informados.
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
