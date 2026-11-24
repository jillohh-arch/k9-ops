"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  ChevronRight,
  Dog,
  Plus,
  Search,
  Shield,
  UserCheck,
  Wrench,
} from "lucide-react";
import { EquipmentCondition, EquipmentStatus } from "../domain/contracts";
import { useWarehouseData } from "../hooks/use-warehouse-data";
import { EquipmentFormDialog } from "./equipment-form-dialog";
import { ConditionBadge, EquipmentStatusBadge } from "../presentation/warehouse-ui";
import { WarehouseKpiCard } from "./warehouse-kpi-card";
import {
  staggerContainerVariants,
  staggerItemVariants,
  WarehouseItemThumbnail,
  ViewToggle,
} from "../presentation/warehouse-motion";

export function getConditionBadge(condition: EquipmentCondition) {
  return <ConditionBadge condition={condition} />;
}

export function getStatusBadge(status: EquipmentStatus) {
  return <EquipmentStatusBadge status={status} />;
}

export function EquipmentCatalogView() {
  const { equipment, custodies, locations, status, error } = useWarehouseData();

  // Filters state
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [conditionFilter, setConditionFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [onlyInCustody, setOnlyInCustody] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Dialog state
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);

  // Unique categories from items
  const categories = useMemo(() => {
    const map = new Map<string, string>();
    equipment.forEach((item) => {
      if (item.category_id && item.category_name) {
        map.set(item.category_id, item.category_name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [equipment]);

  // Active custodies lookup map by equipment_id
  const activeCustodiesMap = useMemo(() => {
    const map = new Map<string, typeof custodies[0]>();
    custodies
      .filter((c) => c.status === "active")
      .forEach((c) => {
        map.set(c.equipment_id, c);
      });
    return map;
  }, [custodies]);

  // Filtered rows
  const filteredEquipment = useMemo(() => {
    return equipment.filter((item) => {
      // In custody toggle
      if (onlyInCustody && item.status !== "in_custody") {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(query);
        const matchesCode = item.identifier_code.toLowerCase().includes(query);
        const matchesSerial = item.serial_number?.toLowerCase().includes(query);
        const matchesBrand = item.brand?.toLowerCase().includes(query);
        if (!matchesName && !matchesCode && !matchesSerial && !matchesBrand) {
          return false;
        }
      }

      // Category
      if (categoryFilter !== "all" && item.category_id !== categoryFilter) {
        return false;
      }

      // Condition
      if (conditionFilter !== "all" && item.condition !== conditionFilter) {
        return false;
      }

      // Status
      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }

      // Location
      if (locationFilter !== "all" && item.current_location_id !== locationFilter) {
        return false;
      }

      return true;
    });
  }, [
    equipment,
    searchTerm,
    categoryFilter,
    conditionFilter,
    statusFilter,
    locationFilter,
    onlyInCustody,
  ]);

  // Contextual KPIs
  const activeEquipment = useMemo(() => equipment.filter((e) => e.active && e.status !== "retired"), [equipment]);
  const availableCount = useMemo(() => activeEquipment.filter((e) => e.status === "available").length, [activeEquipment]);
  const inCustodyCount = useMemo(() => activeEquipment.filter((e) => e.status === "in_custody").length, [activeEquipment]);
  const maintenanceCount = useMemo(
    () => activeEquipment.filter((e) => e.status === "maintenance" || e.status === "damaged").length,
    [activeEquipment],
  );

  return (
    <div className="space-y-6" data-testid="equipment-catalog-view">
      {/* 1. Contextual KPI Cards with Count-up */}
      <section
        aria-label="Indicadores de equipamentos e ativos"
        className="grid grid-cols-2 gap-3.5 sm:grid-cols-4"
      >
        <WarehouseKpiCard
          label="TOTAL DE ATIVOS"
          value={activeEquipment.length}
          subtext="cadastrados e em operação"
          icon={Shield}
          colorVariant="cyan"
          trend={{ text: "Patrimônio", direction: "up", variant: "cyan" }}
        />

        <WarehouseKpiCard
          label="DISPONÍVEIS"
          value={availableCount}
          subtext="prontos para acautelamento"
          icon={CheckCircle2}
          colorVariant="emerald"
          trend={{ text: "No estoque", direction: "up", variant: "emerald" }}
        />

        <WarehouseKpiCard
          label="EM CAUTELA"
          value={inCustodyCount}
          subtext="em serviço operacional"
          icon={UserCheck}
          colorVariant="blue"
          trend={{ text: "Em uso", direction: "up", variant: "cyan" }}
        />

        <WarehouseKpiCard
          label="MANUTENÇÃO / AVARIA"
          value={maintenanceCount}
          subtext="indisponíveis temporariamente"
          icon={Wrench}
          colorVariant="amber"
          trend={{ text: maintenanceCount > 0 ? "Atenção" : "Zero avarias", direction: "up", variant: "amber" }}
        />
      </section>

      {/* 2. Main Card: Table / Cards and Filters */}
      <section
        aria-label="Catálogo analítico de equipamentos"
        className="rounded-2xl border border-white/[0.08] bg-[#0b1424]/90 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.25)] space-y-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Shield className="h-4 w-4 text-cyan-400" />
              Catálogo de Equipamentos e Ativos
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Controle patrimonial de bens duráveis e apetrechos operacionais do K9 Ops.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/warehouse/custody"
              className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:text-white transition"
            >
              Ver Todas Cautelas
            </Link>
            <button
              type="button"
              onClick={() => setIsNewDialogOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-400 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-cyan-300 transition shadow"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Novo Equipamento</span>
            </button>
            <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              id="search-equipment"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nome, código patrimonial ou nº de série..."
              className="h-9 w-full rounded-xl border border-white/10 bg-slate-900/60 pl-8 pr-3 text-xs text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/40"
            />
          </div>

          <select
            id="filter-cat"
            aria-label="Filtrar por categoria"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 text-xs text-slate-200 outline-none transition focus:border-cyan-400/40"
          >
            <option value="all">Todas as categorias</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            id="filter-cond"
            aria-label="Filtrar por condição física"
            value={conditionFilter}
            onChange={(e) => setConditionFilter(e.target.value)}
            className="h-9 w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 text-xs text-slate-200 outline-none transition focus:border-cyan-400/40"
          >
            <option value="all">Todas as condições</option>
            <option value="new">Novo</option>
            <option value="good">Bom</option>
            <option value="fair">Regular</option>
            <option value="damaged">Danificado</option>
          </select>

          <select
            id="filter-status"
            aria-label="Filtrar por situação operacional"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 text-xs text-slate-200 outline-none transition focus:border-cyan-400/40"
          >
            <option value="all">Todas as situações</option>
            <option value="available">Disponível</option>
            <option value="in_custody">Em Cautela</option>
            <option value="maintenance">Manutenção</option>
            <option value="damaged">Avariado / Danificado</option>
            <option value="retired">Baixado</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-1 text-xs text-slate-400">
          <div className="flex items-center gap-4">
            {locations.length > 0 && (
              <div className="flex items-center gap-2">
                <span>Local:</span>
                <select
                  id="filter-loc"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="rounded-lg border border-white/10 bg-slate-900/60 px-2.5 py-1 text-xs text-white focus:border-cyan-400 focus:outline-none"
                >
                  <option value="all">Todos os locais</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={onlyInCustody}
                onChange={(e) => setOnlyInCustody(e.target.checked)}
                aria-label="Apenas itens em cautela ativa"
                className="rounded border-white/20 bg-slate-800 text-cyan-500 focus:ring-cyan-400"
              />
              <span>Apenas itens em cautela ativa</span>
            </label>
          </div>

          <div>
            Mostrando <strong>{filteredEquipment.length}</strong> de <strong>{equipment.length}</strong> itens
          </div>
        </div>

        {status === "loading" && <p role="status" className="py-4 text-xs text-slate-400">Carregando catálogo de equipamentos...</p>}
        {status === "error" && <p role="alert" className="py-4 text-xs text-rose-400">Erro ao carregar equipamentos: {error}</p>}
        {status === "forbidden" && <p role="alert" className="py-4 text-xs text-rose-400">Sem autorização.</p>}

        {status === "ready" && (
          <>
            {/* VIEW MODE: CARDS GRID (Mockup 4 Parity) */}
            {viewMode === "grid" ? (
              <motion.div
                variants={staggerContainerVariants}
                initial={false}
                animate="visible"
                className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-2"
              >
                {filteredEquipment.map((item) => {
                  const activeCustody = activeCustodiesMap.get(item.id);

                  return (
                    <motion.div
                      key={item.id}
                      variants={staggerItemVariants}
                      className="group relative flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#0c1629]/90 p-4 shadow-[0_4px_20px_rgba(0,0,0,0.25)] transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/30 hover:shadow-[0_8px_30px_rgba(6,182,212,0.12)] focus-within:ring-2 focus-within:ring-cyan-400/50"
                    >
                      {/* Top Section: Large Thumbnail + Item info */}
                      <div>
                        <div className="flex items-start gap-3">
                          <WarehouseItemThumbnail
                            size="card"
                            categoryName={item.category_name || "Equipamentos"}
                            src={(item as unknown as { photo_url?: string; image_url?: string }).photo_url ?? (item as unknown as { image_url?: string }).image_url}
                            alt={item.name}
                          />

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-1">
                              <Link
                                href={`/warehouse/equipment/${item.id}`}
                                className="font-bold text-sm text-white group-hover:text-cyan-300 transition line-clamp-1 block"
                                title={item.name}
                              >
                                {item.name}
                              </Link>
                              <Link
                                href={`/warehouse/equipment/${item.id}`}
                                className="text-slate-400 hover:text-cyan-300 transition p-0.5 shrink-0"
                                title="Ver detalhes"
                              >
                                <ChevronRight className="h-4 w-4" />
                              </Link>
                            </div>

                            {(item.brand || item.model) && (
                              <div className="text-[11px] text-slate-400 truncate mt-0.5">
                                {[item.brand, item.model].filter(Boolean).join(" ")}
                              </div>
                            )}

                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              {getStatusBadge(item.status)}
                              {getConditionBadge(item.condition)}
                            </div>
                          </div>
                        </div>

                        {/* Metadata 2x2 Grid (Mockup 4 Parity) */}
                        <div className="grid grid-cols-2 gap-2 mt-3.5 p-2.5 rounded-xl bg-slate-950/40 border border-white/[0.04] text-xs">
                          <div>
                            <span className="block text-[9px] font-mono uppercase text-slate-500">
                              Código Patrimonial
                            </span>
                            <span className="block font-mono text-xs font-bold text-cyan-300 truncate mt-0.5">
                              {item.identifier_code}
                            </span>
                          </div>

                          <div>
                            <span className="block text-[9px] font-mono uppercase text-slate-500">
                              Categoria
                            </span>
                            <span className="block text-slate-200 truncate mt-0.5 font-medium">
                              {item.category_name || "Operacional"}
                            </span>
                          </div>

                          <div className="pt-1.5 border-t border-white/[0.04]">
                            <span className="block text-[9px] font-mono uppercase text-slate-500">
                              Local Físico
                            </span>
                            <span className="block text-slate-200 truncate mt-0.5 font-medium">
                              {item.current_location_name || "Almoxarifado Central"}
                            </span>
                          </div>

                          <div className="pt-1.5 border-t border-white/[0.04]">
                            <span className="block text-[9px] font-mono uppercase text-slate-500">
                              Responsável Atual
                            </span>
                            {item.status === "in_custody" && activeCustody ? (
                              <div className="mt-0.5 truncate text-xs">
                                <span className="font-semibold text-cyan-200 block truncate">
                                  {activeCustody.borrower_name}
                                </span>
                                {activeCustody.borrower_ra && (
                                  <span className="text-[10px] text-slate-400 font-mono block">
                                    RA: {activeCustody.borrower_ra}
                                  </span>
                                )}
                              </div>
                            ) : item.status === "in_custody" ? (
                              <span className="text-xs text-amber-400 mt-0.5 block">Em cautela</span>
                            ) : item.assigned_dog_name ? (
                              <span className="inline-flex items-center gap-1 text-xs text-cyan-300 mt-0.5 truncate">
                                <Dog className="h-3 w-3" />
                                <span>Cão {item.assigned_dog_name}</span>
                              </span>
                            ) : (
                              <span className="text-xs text-slate-500 mt-0.5 block">
                                Almoxarifado Central
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Card Action Footer: Full-Width Detalhes button */}
                      <div className="mt-3.5 pt-3 border-t border-white/[0.06]">
                        <Link
                          href={`/warehouse/equipment/${item.id}`}
                          className="flex items-center justify-center gap-1.5 w-full rounded-xl border border-white/10 bg-slate-900/60 py-2 text-xs font-semibold text-slate-200 hover:border-cyan-400/40 hover:text-white hover:bg-slate-800/80 transition"
                        >
                          <span>Detalhes do Equipamento</span>
                          <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-cyan-300 transition" />
                        </Link>
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
                      <th className="py-2.5 px-3">Equipamento</th>
                      <th className="py-2.5 px-3">Código Patrimonial</th>
                      <th className="py-2.5 px-3">Categoria</th>
                      <th className="py-2.5 px-3">Condição</th>
                      <th className="py-2.5 px-3">Situação</th>
                      <th className="py-2.5 px-3">Local Físico</th>
                      <th className="py-2.5 px-3">Responsável Atual</th>
                      <th className="py-2.5 px-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {filteredEquipment.map((item) => {
                      const activeCustody = activeCustodiesMap.get(item.id);
                      return (
                        <tr key={item.id} className="hover:bg-white/[0.02] transition">
                          <td className="py-2.5 px-3">
                            <Link
                              href={`/warehouse/equipment/${item.id}`}
                              className="font-semibold text-white hover:text-cyan-300 transition"
                            >
                              {item.name}
                            </Link>
                            {(item.brand || item.model) && (
                              <div className="text-[11px] text-slate-400">
                                {[item.brand, item.model].filter(Boolean).join(" ")}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-cyan-200">
                            {item.identifier_code}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">
                            {item.category_name || "Geral"}
                          </td>
                          <td className="py-2.5 px-3">
                            {getConditionBadge(item.condition)}
                          </td>
                          <td className="py-2.5 px-3">
                            {getStatusBadge(item.status)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">
                            {item.current_location_name || "Almoxarifado"}
                          </td>
                          <td className="py-2.5 px-3">
                            {item.status === "in_custody" && activeCustody ? (
                              <div>
                                <div className="font-semibold text-indigo-200 text-xs">
                                  {activeCustody.borrower_name}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  RA: {activeCustody.borrower_ra}
                                </div>
                              </div>
                            ) : item.status === "in_custody" ? (
                              <span className="text-xs text-amber-400">Em cautela</span>
                            ) : (
                              <span className="text-xs text-slate-500 font-mono">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <Link
                              href={`/warehouse/equipment/${item.id}`}
                              className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:border-cyan-400/30 hover:text-white transition"
                            >
                              Detalhes
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {filteredEquipment.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-400">
                Nenhum equipamento encontrado com os filtros aplicados.
              </div>
            )}
          </>
        )}
      </section>

      {/* New Equipment Dialog */}
      <EquipmentFormDialog
        isOpen={isNewDialogOpen}
        onClose={() => setIsNewDialogOpen(false)}
        categories={categories}
        locations={locations}
      />
    </div>
  );
}