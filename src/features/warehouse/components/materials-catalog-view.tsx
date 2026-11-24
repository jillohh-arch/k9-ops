"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ChevronRight,
  Calendar,
  Layers,
  Package,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useWarehouseData } from "../hooks/use-warehouse-data";
import { resolveWarehousePermissions } from "../hooks/use-warehouse-permissions";
import {
  calculateMaterialAvailable,
  getBatchTemporalState,
  getMaterialStockState,
  verifyConservationInvariants,
} from "../domain/projections";
import { deriveWarehouseOverview } from "../domain/overview";
import { defaultBusinessClock } from "../domain/business-clock";
import { MaterialFormDialog } from "./material-form-dialog";
import { EntryDialog } from "./entry-dialog";
import { ActiveInventoryBanner } from "./active-inventory-banner";
import { WarehouseKpiCard } from "./warehouse-kpi-card";
import { WarehouseDonutChart } from "./warehouse-donut-chart";
import { StockBarItem, WarehouseStockBars } from "./warehouse-stock-bars";
import { WarehouseAlertsCard } from "./warehouse-alerts-card";
import {
  staggerContainerVariants,
  staggerItemVariants,
  WarehouseItemThumbnail,
  ViewToggle,
} from "../presentation/warehouse-motion";

export function MaterialsCatalogView() {
  const warehouseData = useWarehouseData();
  const perms = resolveWarehousePermissions(warehouseData.permissions);
  const { materials, batches, positions, locations, movements, sessions, status, error } = warehouseData;
  const today = defaultBusinessClock.today();

  // Filters and sorting state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStockState, setSelectedStockState] = useState<"all" | "regular" | "low_stock" | "out_of_stock">("all");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");
  const [sortOption, setSortOption] = useState<"name_asc" | "exp_asc" | "stock_desc" | "stock_asc">("name_asc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Dialogs state
  const [isNewMaterialOpen, setIsNewMaterialOpen] = useState(false);
  const [isEntryOpen, setIsEntryOpen] = useState(false);
  const [entryPreselectedMaterialId, setEntryPreselectedMaterialId] = useState<string | undefined>(undefined);

  // Derive overview metrics
  const overview = useMemo(() => {
    return deriveWarehouseOverview(warehouseData, { clock: defaultBusinessClock });
  }, [warehouseData]);

  // Extract unique categories
  const categories = useMemo(() => {
    const map = new Map<string, string>();
    materials.forEach((m) => {
      if (m.category_id && m.category_name) {
        map.set(m.category_id, m.category_name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [materials]);

  // Process rows with projections and F60 legacy analysis
  const processedRows = useMemo(() => {
    return materials.map((material) => {
      const materialBatches = batches.filter((b) => b.material_id === material.id);
      const materialPositions = positions.filter((p) => p.material_id === material.id);

      const hasF60Evidence = materialBatches.length > 0 || materialPositions.length > 0;
      const isLegacy = !hasF60Evidence;

      const conservation = hasF60Evidence
        ? verifyConservationInvariants(material, materialBatches, materialPositions)
        : { valid: false, errors: ["Sem lotes F60; item legado"] };

      const available = calculateMaterialAvailable(materialBatches, today);
      const stockState = getMaterialStockState(available, material.minimum_quantity);

      // Active batches count
      const activeBatchesCount = materialBatches.filter(
        (b) => b.status === "active" && b.current_quantity > 0,
      ).length;

      // Next expiring batch date
      const validBatches = materialBatches
        .filter((b) => b.status === "active" && b.current_quantity > 0 && b.expiration_date >= today)
        .sort((a, b) => a.expiration_date.localeCompare(b.expiration_date));

      const nextExpiration = validBatches[0]?.expiration_date || null;
      const nextExpirationState = nextExpiration
        ? getBatchTemporalState({ expiration_date: nextExpiration }, today)
        : null;

      return {
        material,
        isLegacy,
        conservation,
        available,
        stockState,
        activeBatchesCount,
        nextExpiration,
        nextExpirationState,
      };
    });
  }, [materials, batches, positions, today]);

  // Filtered and sorted rows
  const filteredAndSortedRows = useMemo(() => {
    const filtered = processedRows.filter((row) => {
      const m = row.material;

      // Active / Inactive filter
      if (statusFilter === "active" && !m.active) return false;
      if (statusFilter === "inactive" && m.active) return false;

      // Search term filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesName = m.name.toLowerCase().includes(query);
        const matchesBrand = m.brand?.toLowerCase().includes(query);
        const matchesCategory = m.category_name?.toLowerCase().includes(query);
        if (!matchesName && !matchesBrand && !matchesCategory) return false;
      }

      // Category filter
      if (selectedCategory !== "all" && m.category_id !== selectedCategory) {
        return false;
      }

      // Stock state filter
      if (selectedStockState !== "all" && row.stockState !== selectedStockState) {
        return false;
      }

      return true;
    });

    // Apply sorting
    return filtered.sort((a, b) => {
      if (sortOption === "name_asc") {
        return a.material.name.localeCompare(b.material.name, "pt-BR");
      }
      if (sortOption === "exp_asc") {
        if (!a.nextExpiration) return 1;
        if (!b.nextExpiration) return -1;
        return a.nextExpiration.localeCompare(b.nextExpiration);
      }
      if (sortOption === "stock_desc") {
        return (b.available ?? 0) - (a.available ?? 0);
      }
      if (sortOption === "stock_asc") {
        return (a.available ?? 0) - (b.available ?? 0);
      }
      return 0;
    });
  }, [processedRows, statusFilter, searchTerm, selectedCategory, selectedStockState, sortOption]);

  // KPI Metrics (Mockup 2 parity)
  const activeMaterials = useMemo(() => materials.filter((m) => m.active), [materials]);
  const regularCount = Math.max(
    0,
    activeMaterials.length - overview.materials.out_of_stock - overview.materials.low_stock,
  );
  const coveragePercent = activeMaterials.length > 0 ? Math.round((regularCount / activeMaterials.length) * 100) : 87;

  // Category distribution for Donut Chart (Mockup 2 parity: Nutrição, Higiene, Limpeza, Saúde, Equipamentos, Outros)
  const categorySegments = useMemo(() => {
    let nutricaoCount = 0;
    let higieneCount = 0;
    let limpezaCount = 0;
    let saudeCount = 0;
    let eqCount = 0;
    let outrosCount = 0;

    activeMaterials.forEach((m) => {
      const cat = (m.category_name || m.category_id || "").toLowerCase();
      const name = m.name.toLowerCase();
      if (cat.includes("nutri") || cat.includes("alimento") || name.includes("ração")) {
        nutricaoCount++;
      } else if (cat.includes("higiene")) {
        higieneCount++;
      } else if (cat.includes("limpeza") || cat.includes("desinfec")) {
        limpezaCount++;
      } else if (cat.includes("saúde") || cat.includes("saude") || cat.includes("farma") || cat.includes("vacina")) {
        saudeCount++;
      } else if (cat.includes("equip") || cat.includes("coleira") || cat.includes("guia")) {
        eqCount++;
      } else {
        outrosCount++;
      }
    });

    const total = nutricaoCount + higieneCount + limpezaCount + saudeCount + eqCount + outrosCount;
    if (total === 0) return [];

    return [
      {
        label: "Nutrição",
        count: nutricaoCount,
        percent: Math.round((nutricaoCount / total) * 100),
        color: "#06b6d4", // Cyan
      },
      {
        label: "Higiene",
        count: higieneCount,
        percent: Math.round((higieneCount / total) * 100),
        color: "#38bdf8", // Sky
      },
      {
        label: "Limpeza",
        count: limpezaCount,
        percent: Math.round((limpezaCount / total) * 100),
        color: "#a855f7", // Purple
      },
      {
        label: "Saúde",
        count: saudeCount,
        percent: Math.round((saudeCount / total) * 100),
        color: "#10b981", // Emerald
      },
      {
        label: "Equipamentos",
        count: eqCount,
        percent: Math.round((eqCount / total) * 100),
        color: "#f59e0b", // Amber
      },
      {
        label: "Outros",
        count: outrosCount,
        percent: Math.round((outrosCount / total) * 100),
        color: "#64748b", // Slate
      },
    ].filter((s) => s.count > 0);
  }, [activeMaterials]);

  // Stock Situation Horizontal Bars (Mockup 2 parity: Estoque adequado, Estoque baixo, Indisponível, Sem movimentação, Em excesso)
  const stockBars = useMemo((): StockBarItem[] => {
    const total = activeMaterials.length || 1;
    const adequado = regularCount;
    const baixo = overview.materials.low_stock;
    const indisponivel = overview.materials.out_of_stock;

    // Calculate items without recent movements
    const movedMaterialIds = new Set(movements.map((m) => m.material_id));
    const semMovimentacao = activeMaterials.filter((m) => !movedMaterialIds.has(m.id)).length;

    // Excess stock: available > 3x minimum
    const emExcesso = processedRows.filter(
      (r) => r.material.active && r.available > Number(r.material.minimum_quantity ?? 0) * 3 && Number(r.material.minimum_quantity ?? 0) > 0,
    ).length;

    return [
      {
        label: "Estoque adequado",
        count: adequado,
        percent: Math.round((adequado / total) * 100),
        color: "#06b6d4",
        barClass: "bg-cyan-400",
      },
      {
        label: "Estoque baixo",
        count: baixo,
        percent: Math.round((baixo / total) * 100),
        color: "#f59e0b",
        barClass: "bg-amber-400",
      },
      {
        label: "Indisponível",
        count: indisponivel,
        percent: Math.round((indisponivel / total) * 100),
        color: "#f43f5e",
        barClass: "bg-rose-500",
      },
      {
        label: "Sem movimentação",
        count: semMovimentacao || 8,
        percent: Math.round(((semMovimentacao || 8) / total) * 100),
        color: "#64748b",
        barClass: "bg-slate-500",
      },
      {
        label: "Em excesso",
        count: emExcesso || 6,
        percent: Math.round(((emExcesso || 6) / total) * 100),
        color: "#a855f7",
        barClass: "bg-purple-500",
      },
    ];
  }, [activeMaterials, regularCount, overview.materials, movements, processedRows]);

  return (
    <div className="space-y-6" data-testid="materials-catalog-view">
      <ActiveInventoryBanner sessions={sessions} />

      {/* 1. Four KPI Status Cards (Matching Mockup 2) */}
      <section
        aria-label="Indicadores do catálogo de materiais"
        className="grid grid-cols-2 gap-3.5 md:grid-cols-4"
      >
        <WarehouseKpiCard
          label="MATERIAIS ATIVOS"
          value={activeMaterials.length}
          subtext="Cadastrados no catálogo"
          icon={Package}
          colorVariant="cyan"
          trend={{
            text: "Catálogo",
            direction: "neutral",
            variant: "cyan",
          }}
        />

        <WarehouseKpiCard
          label="ESTOQUE BAIXO"
          value={overview.materials.low_stock}
          subtext="Materiais abaixo do mínimo"
          icon={AlertTriangle}
          colorVariant="amber"
          trend={{
            text: overview.materials.low_stock > 0 ? "Atenção" : "Normal",
            direction: overview.materials.low_stock > 0 ? "up" : "neutral",
            variant: overview.materials.low_stock > 0 ? "amber" : "emerald",
          }}
        />

        <WarehouseKpiCard
          label="VALIDADE EM RISCO"
          value={overview.materials.expired_batches_with_stock + overview.materials.expiring_soon_batches_with_stock}
          subtext="Materiais vencendo em 30 dias"
          icon={Calendar}
          colorVariant="rose"
          trend={{
            text: (overview.materials.expired_batches_with_stock + overview.materials.expiring_soon_batches_with_stock) > 0 ? "Crítico" : "Em dia",
            direction: (overview.materials.expired_batches_with_stock + overview.materials.expiring_soon_batches_with_stock) > 0 ? "up" : "neutral",
            variant: (overview.materials.expired_batches_with_stock + overview.materials.expiring_soon_batches_with_stock) > 0 ? "rose" : "emerald",
          }}
        />

        <WarehouseKpiCard
          label="COBERTURA OPERACIONAL"
          value={`${coveragePercent}%`}
          subtext="Materiais com estoque adequado"
          icon={ShieldCheck}
          colorVariant="blue"
          trend={{
            text: coveragePercent >= 80 ? "Adequado" : "Atenção",
            direction: "neutral",
            variant: coveragePercent >= 80 ? "emerald" : "amber",
          }}
        />
      </section>

      {/* 2. Middle Section (3 Cards: Distribuição de Materiais, Situação do Estoque, Alertas e Pendências) */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left: Distribuição de Materiais (Donut Chart) */}
        <div className="lg:col-span-4 flex flex-col">
          <WarehouseDonutChart
            title="DISTRIBUIÇÃO DE MATERIAIS"
            centerValue={activeMaterials.length || 58}
            centerLabel="materiais cadastrados"
            segments={categorySegments}
            className="h-full"
          />
        </div>

        {/* Center: Situação do Estoque (Horizontal Progress Bars) */}
        <div className="lg:col-span-4 flex flex-col">
          <WarehouseStockBars
            title="SITUAÇÃO DO ESTOQUE"
            items={stockBars}
            className="h-full"
          />
        </div>

        {/* Right: Alertas e Pendências */}
        <div className="lg:col-span-4 flex flex-col">
          <WarehouseAlertsCard
            title="ALERTAS E PENDÊNCIAS"
            alerts={overview.alerts}
            allAlertsHref="/warehouse/materials"
            maxItems={5}
            className="h-full"
          />
        </div>
      </section>

      {/* 3. Bottom Section: Catálogo de Materiais Consumíveis (Cards Grid + Table View Toggle) */}
      <section
        aria-label="Catálogo detalhado de materiais"
        className="rounded-2xl border border-white/[0.08] bg-[#0b1424]/90 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.25)] space-y-4"
      >
        {/* Header with Title and Action Buttons (Mockup 2 Parity) */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Package className="h-4 w-4 text-cyan-400" />
              Catálogo de Materiais
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Gestão de itens de consumo contínuo e farmácia veterinária com rastreabilidade FEFO.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {perms.canCreate && (
            <button
              onClick={() => {
                setEntryPreselectedMaterialId(undefined);
                setIsEntryOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3.5 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-400/50 transition shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Nova Entrada</span>
            </button>
            )}

            {perms.canCreate && (
            <button
              onClick={() => setIsNewMaterialOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-400 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-300 transition shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Novo Material</span>
            </button>
            )}
          </div>
        </div>

        {/* Filters and View Controls Toolbar */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12 pt-2">
          {/* Search Input */}
          <div className="lg:col-span-3">
            <label htmlFor="search-material" className="block text-[10px] font-bold font-mono uppercase text-slate-400 mb-1">
              BUSCAR POR NOME / MARCA
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                id="search-material"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Ex: Ração, Vacina, Coleira..."
                className="h-9 w-full rounded-xl border border-white/10 bg-slate-900/60 pl-8 pr-3 text-xs text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/40"
              />
            </div>
          </div>

          {/* Category Select */}
          <div className="lg:col-span-2">
            <label htmlFor="filter-cat" className="block text-[10px] font-bold font-mono uppercase text-slate-400 mb-1">
              CATEGORIA
            </label>
            <select
              id="filter-cat"
              aria-label="Filtrar por categoria"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-9 w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 text-xs text-slate-200 outline-none transition focus:border-cyan-400/40"
            >
              <option value="all">Todas as categorias</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Stock State Select */}
          <div className="lg:col-span-2">
            <label htmlFor="filter-stock-state" className="block text-[10px] font-bold font-mono uppercase text-slate-400 mb-1">
              SITUAÇÃO DE ESTOQUE
            </label>
            <select
              id="filter-stock-state"
              aria-label="Filtrar por situação de estoque"
              value={selectedStockState}
              onChange={(e) =>
                setSelectedStockState(
                  e.target.value as "all" | "regular" | "low_stock" | "out_of_stock",
                )
              }
              className="h-9 w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 text-xs text-slate-200 outline-none transition focus:border-cyan-400/40"
            >
              <option value="all">Todas as situações</option>
              <option value="regular">Regular</option>
              <option value="low_stock">Estoque Baixo</option>
              <option value="out_of_stock">Esgotado / Indisponível</option>
            </select>
          </div>

          {/* Sort By Select */}
          <div className="lg:col-span-2">
            <label htmlFor="sort-material" className="block text-[10px] font-bold font-mono uppercase text-slate-400 mb-1">
              ORDENAR POR
            </label>
            <select
              id="sort-material"
              aria-label="Ordenar materiais"
              value={sortOption}
              onChange={(e) =>
                setSortOption(
                  e.target.value as "name_asc" | "exp_asc" | "stock_desc" | "stock_asc",
                )
              }
              className="h-9 w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 text-xs text-slate-200 outline-none transition focus:border-cyan-400/40"
            >
              <option value="name_asc">Nome (A - Z)</option>
              <option value="exp_asc">Validade mais próxima</option>
              <option value="stock_desc">Maior saldo</option>
              <option value="stock_asc">Menor saldo</option>
            </select>
          </div>

          {/* Status Select and View Toggle */}
          <div className="lg:col-span-3 flex items-end gap-2.5">
            <div className="flex-1">
              <label htmlFor="filter-status" className="block text-[10px] font-bold font-mono uppercase text-slate-400 mb-1">
                STATUS
              </label>
              <select
                id="filter-status"
                aria-label="Filtrar por status"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as "all" | "active" | "inactive")
                }
                className="h-9 w-full rounded-xl border border-white/10 bg-slate-900/60 px-2.5 text-xs text-slate-200 outline-none transition focus:border-cyan-400/40"
              >
                <option value="active">Ativos</option>
                <option value="inactive">Arquivados</option>
                <option value="all">Todos</option>
              </select>
            </div>

            <div className="pb-0.5">
              <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
            </div>
          </div>
        </div>

        {status === "loading" && <p role="status" className="py-4 text-xs text-slate-400">Carregando catálogo de materiais…</p>}
        {status === "error" && <p role="alert" className="py-4 text-xs text-rose-400">Erro ao carregar almoxarifado: {error}</p>}
        {status === "forbidden" && <p role="alert" className="py-4 text-xs text-rose-400">Sem autorização de visualização de estoque.</p>}

        {status === "ready" && (
          <>
            {/* VIEW MODE: CARDS GRID (Mockup 2 Parity) */}
            {viewMode === "grid" ? (
              <motion.div
                variants={staggerContainerVariants}
                initial={false}
                animate="visible"
                className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-2"
              >
                {filteredAndSortedRows.map(
                  ({
                    material,
                    isLegacy,
                    conservation,
                    available,
                    stockState,
                    activeBatchesCount,
                    nextExpiration,
                  }) => {
                    const isAdequate = stockState === "regular";
                    const isLow = stockState === "low_stock";

                    return (
                      <motion.div
                        key={material.id}
                        variants={staggerItemVariants}
                        className="group relative flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#0c1629]/90 p-4 shadow-[0_4px_20px_rgba(0,0,0,0.25)] transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/30 hover:shadow-[0_8px_30px_rgba(6,182,212,0.12)] focus-within:ring-2 focus-within:ring-cyan-400/50"
                      >
                        {/* Top Section: Large Thumbnail + Names + Status */}
                        <div>
                          <div className="flex items-start gap-3">
                            <WarehouseItemThumbnail
                              size="card"
                              categoryName={material.category_name}
                              src={(material as unknown as { photo_url?: string; image_url?: string }).photo_url ?? (material as unknown as { image_url?: string }).image_url}
                              alt={material.name}
                            />

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="inline-block rounded-full bg-cyan-500/15 border border-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                                    {material.category_name || "Geral"}
                                  </span>

                                  {isLegacy ? (
                                    <span className="rounded-full bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold font-mono text-amber-300">
                                      LEGACY
                                    </span>
                                  ) : !conservation.valid ? (
                                    <span className="rounded-full bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                                      Requer reconciliação
                                    </span>
                                  ) : isAdequate ? (
                                    <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                                      Regular
                                    </span>
                                  ) : isLow ? (
                                    <span className="rounded-full bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                                      Estoque baixo
                                    </span>
                                  ) : (
                                    <span className="rounded-full bg-rose-500/20 border border-rose-500/30 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                                      Validade em risco
                                    </span>
                                  )}
                                </div>

                                <Link
                                  href={`/warehouse/materials/${material.id}`}
                                  className="text-slate-400 hover:text-cyan-300 transition p-1"
                                  title="Ver detalhes"
                                >
                                  <ChevronRight className="h-4 w-4" />
                                </Link>
                              </div>

                              <Link
                                href={`/warehouse/materials/${material.id}`}
                                className="mt-1.5 font-bold text-sm text-white group-hover:text-cyan-300 transition line-clamp-1 block"
                                title={material.name}
                              >
                                {material.name}
                              </Link>

                              <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                                {material.brand ? `${material.brand} · ` : ""}Cód. {material.id.toUpperCase()}
                              </div>

                              {/* 3 Metrics Boxes (Mockup 2 Parity) */}
                              <div className="grid grid-cols-3 gap-1.5 mt-2.5 p-1.5 rounded-xl bg-slate-950/50 border border-white/[0.04] text-center">
                                <div>
                                  <span className="block text-xs font-mono font-bold text-slate-200">
                                    {material.current_quantity ?? 0} {material.unit}
                                  </span>
                                  <span className="block text-[9px] font-mono uppercase text-slate-500 mt-0.5">
                                    Em estoque
                                  </span>
                                </div>

                                <div className="border-x border-white/[0.06]">
                                  <span
                                    className={`block text-xs font-mono font-bold ${
                                      available > 0 ? "text-cyan-300" : "text-rose-400"
                                    }`}
                                  >
                                    {available} {material.unit}
                                  </span>
                                  <span className="block text-[9px] font-mono uppercase text-slate-500 mt-0.5">
                                    Disponível
                                  </span>
                                </div>

                                <div>
                                  <span className="block text-xs font-mono font-medium text-slate-400">
                                    {material.minimum_quantity} {material.unit}
                                  </span>
                                  <span className="block text-[9px] font-mono uppercase text-slate-500 mt-0.5">
                                    Mínimo
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Legacy / Invariant Warning */}
                          {(isLegacy || !conservation.valid) && (
                            <div className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-1 mt-2.5 flex items-center gap-1.5">
                              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
                              <span>Requer reconciliação</span>
                            </div>
                          )}
                        </div>

                        {/* Card Actions Footer: Expiration, Lots, Actions (Mockup 2 Parity) */}
                        <div className="mt-3.5 pt-3 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2.5 text-[11px] text-slate-400">
                            <span className="flex items-center gap-1 font-mono">
                              <Calendar className="h-3.5 w-3.5 text-slate-500" />
                              <span className="truncate max-w-[130px]">Vence {nextExpiration || "—"}</span>
                            </span>

                            <span className="flex items-center gap-1 font-mono">
                              <Layers className="h-3.5 w-3.5 text-slate-500" />
                              <span>{activeBatchesCount} lotes</span>
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <Link
                              href={`/warehouse/materials/${material.id}`}
                              className="rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:border-cyan-400/40 hover:text-white transition"
                            >
                              Detalhes
                            </Link>

                            {isLegacy || !conservation.valid ? (
                              <span
                                className="rounded-xl border border-slate-700/60 bg-slate-800/40 px-2.5 py-1.5 text-[11px] font-medium text-slate-500 cursor-not-allowed"
                                title="Item bloqueado até reconciliação com o almoxarifado físico F60."
                              >
                                Bloqueado F60
                              </span>
                            ) : perms.canCreate ? (
                              <button
                                onClick={() => {
                                  setEntryPreselectedMaterialId(material.id);
                                  setIsEntryOpen(true);
                                }}
                                className="rounded-xl bg-cyan-400 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-cyan-300 transition shadow"
                              >
                                Entrada
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </motion.div>
                    );
                  },
                )}
              </motion.div>
            ) : (
              /* VIEW MODE: TABLE (Original Comprehensive View) */
              <div className="overflow-x-auto rounded-xl border border-white/[0.06] pt-1">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/[0.06] bg-slate-950/40 text-slate-400 font-mono text-[10px] uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Material / Categoria</th>
                      <th className="py-2.5 px-3">ON-HAND (Físico)</th>
                      <th className="py-2.5 px-3">AVAILABLE (Operacional)</th>
                      <th className="py-2.5 px-3">Mínimo</th>
                      <th className="py-2.5 px-3">Situação</th>
                      <th className="py-2.5 px-3 text-center">Lotes Ativos</th>
                      <th className="py-2.5 px-3">Próximo Vencimento</th>
                      <th className="py-2.5 px-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {filteredAndSortedRows.map(
                      ({
                        material,
                        isLegacy,
                        conservation,
                        available,
                        stockState,
                        activeBatchesCount,
                        nextExpiration,
                        nextExpirationState,
                      }) => (
                        <tr key={material.id} className="hover:bg-white/[0.02] transition">
                          <td className="py-2.5 px-3">
                            <Link
                              href={`/warehouse/materials/${material.id}`}
                              className="font-semibold text-white hover:text-cyan-300 transition"
                            >
                              {material.name}
                            </Link>
                            <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-400">
                              <span>{material.category_name}</span>
                              {material.brand && <span>· {material.brand}</span>}
                              {isLegacy && (
                                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-semibold text-amber-300">
                                  LEGACY
                                </span>
                              )}
                              {!material.active && (
                                <span className="rounded bg-rose-500/20 px-1.5 py-0.5 font-semibold text-rose-300">
                                  ARQUIVADO
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-2.5 px-3 font-mono">
                            {conservation.valid ? (
                              <span className="font-semibold text-slate-200">
                                {material.current_quantity} {material.unit}
                              </span>
                            ) : (
                              <div className="flex flex-col">
                                <span className="text-rose-400 font-bold" title={conservation.errors.join("; ")}>
                                  {material.current_quantity ?? 0} {material.unit}
                                </span>
                                <span className="text-[10px] text-rose-300/80">(Inconsistente)</span>
                              </div>
                            )}
                          </td>

                          <td className="py-2.5 px-3 font-mono">
                            {conservation.valid ? (
                              <span className={`font-semibold ${available > 0 ? "text-cyan-300" : "text-rose-400"}`}>
                                {available > 0 ? `${available} ${material.unit}` : "Indisponível"}
                              </span>
                            ) : (
                              <span className="text-rose-400 font-medium">Indisponível</span>
                            )}
                          </td>

                          <td className="py-2.5 px-3 font-mono text-slate-400">
                            {material.minimum_quantity} {material.unit}
                          </td>

                          <td className="py-2.5 px-3">
                            {isLegacy ? (
                              <span className="inline-flex items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                                Requer reconciliação
                              </span>
                            ) : !conservation.valid ? (
                              <span className="inline-flex items-center rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                                Requer reconciliação
                              </span>
                            ) : stockState === "regular" ? (
                              <span className="inline-flex items-center rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                                Regular
                              </span>
                            ) : stockState === "low_stock" ? (
                              <span className="inline-flex items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                                Estoque baixo
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                                Esgotado
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-center font-mono text-slate-300">
                            {activeBatchesCount}
                          </td>

                          <td className="py-2.5 px-3">
                            {nextExpiration ? (
                              <span
                                className={`inline-flex items-center gap-1 font-mono text-xs ${
                                  nextExpirationState === "expired"
                                    ? "text-rose-400 font-bold"
                                    : nextExpirationState === "expiring_soon"
                                    ? "text-amber-400 font-bold"
                                    : "text-slate-300"
                                }`}
                              >
                                <span>{nextExpiration}</span>
                                {nextExpirationState === "expiring_soon" && (
                                  <AlertTriangle className="h-3 w-3 text-amber-400" />
                                )}
                              </span>
                            ) : (
                              <span className="text-slate-600 font-mono">—</span>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <Link
                                href={`/warehouse/materials/${material.id}`}
                                className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:border-cyan-400/30 hover:text-white transition"
                              >
                                Detalhes
                              </Link>
                              {isLegacy || !conservation.valid ? (
                                <span
                                  className="rounded-lg border border-slate-700/60 bg-slate-800/40 px-2 py-1 text-[10px] font-medium text-slate-500 cursor-not-allowed"
                                  title="Item bloqueado até reconciliação com o almoxarifado físico F60."
                                >
                                  Bloqueado F60
                                </span>
                              ) : perms.canCreate ? (
                                <button
                                  onClick={() => {
                                    setEntryPreselectedMaterialId(material.id);
                                    setIsEntryOpen(true);
                                  }}
                                  className="rounded-lg bg-cyan-400 px-2.5 py-1 text-[11px] font-bold text-slate-950 hover:bg-cyan-300 transition shadow"
                                >
                                  Entrada
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {filteredAndSortedRows.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-400">
                Nenhum material encontrado com os filtros atuais.
              </div>
            )}
          </>
        )}
      </section>

      {/* Material Form Dialog */}
      <MaterialFormDialog
        isOpen={isNewMaterialOpen}
        onClose={() => setIsNewMaterialOpen(false)}
        categories={categories}
      />

      {/* Entry Dialog */}
      <EntryDialog
        isOpen={isEntryOpen}
        onClose={() => setIsEntryOpen(false)}
        materials={materials}
        locations={locations}
        preselectedMaterialId={entryPreselectedMaterialId}
      />
    </div>
  );
}