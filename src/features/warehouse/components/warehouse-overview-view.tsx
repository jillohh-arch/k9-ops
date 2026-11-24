"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Boxes,
  Calendar,
  CheckCircle2,
  Clock,
  Package,
  Shield,
  UserCheck,
} from "lucide-react";
import { useWarehouseData } from "../hooks/use-warehouse-data";
import { resolveWarehousePermissions } from "../hooks/use-warehouse-permissions";
import { deriveInventoryCategories } from "../domain/inventory-categories";
import { deriveWarehouseOverview } from "../domain/overview";
import { defaultBusinessClock } from "../domain/business-clock";
import { HudStatusDot } from "@/components/hud-status-dot";
import { MovementTypeBadge } from "../presentation/warehouse-ui";
import { WarehouseKpiCard } from "./warehouse-kpi-card";
import { OpenInventoryDialog } from "./open-inventory-dialog";
import {
  AnimatedProgressBar,
  PriorityPulseDot,
  staggerContainerVariants,
  staggerItemVariants,
  WarehouseItemThumbnail,
} from "../presentation/warehouse-motion";

export function WarehouseOverviewView() {
  const warehouseData = useWarehouseData();
  const { materials, batches, equipment, custodies, sessions, locations, status, error } =
    warehouseData;
  const perms = resolveWarehousePermissions(warehouseData.permissions);

  const [isNewInventoryOpen, setIsNewInventoryOpen] = useState(false);

  const overview = useMemo(() => {
    return deriveWarehouseOverview(warehouseData, { clock: defaultBusinessClock });
  }, [warehouseData]);

  // Derived stock counts
  const totalActiveMaterials = materials.filter((m) => m.active).length;
  const lowStockCount = overview.materials.low_stock;
  const outOfStockCount = overview.materials.out_of_stock;
  const regularMaterialsCount = Math.max(0, totalActiveMaterials - lowStockCount - outOfStockCount);
  const validityAtRiskCount = overview.materials.expired_batches_with_stock + overview.materials.expiring_soon_batches_with_stock;

  const isAttention = overview.overall_status === "attention";
  const isWarning = overview.overall_status === "warning";
  const criticalAndWarningAlerts = useMemo(() => {
    return overview.alerts.filter((a) => a.severity === "critical" || a.severity === "warning");
  }, [overview.alerts]);

  // Derived timestamp
  const updatedTime = useMemo(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} (Brasília)`;
  }, []);

  // Stock Situation percentages
  const stockSituation = useMemo(() => {
    const total = Math.max(1, totalActiveMaterials);
    const regularPercent = Math.round((regularMaterialsCount / total) * 100);
    const lowPercent = Math.round((lowStockCount / total) * 100);
    const outPercent = Math.round((outOfStockCount / total) * 100);
    const reserveCount = materials.filter((m) => (m.current_quantity ?? 0) > (m.minimum_quantity ?? 0)).length;
    const reservePercent = Math.round((reserveCount / total) * 100);

    return {
      regular: { count: regularMaterialsCount, percent: regularPercent },
      low: { count: lowStockCount, percent: lowPercent },
      out: { count: outOfStockCount, percent: outPercent },
      reserve: { count: reserveCount, percent: reservePercent },
    };
  }, [totalActiveMaterials, regularMaterialsCount, lowStockCount, outOfStockCount, materials]);

  // Conferência física: SOMENTE dados reais (sessões homologadas + sessão ativa).
  // Sem datas, prazos ou percentuais fictícios (F07).
  const inventoryInfo = useMemo(() => {
    const toTime = (value?: Date | string | null) => (value ? new Date(value).getTime() : 0);
    const lastHomologated = sessions
      .filter((s) => s.status === "homologated")
      .map((s) => toTime(s.closed_at ?? s.updated_at ?? s.opened_at))
      .filter((time) => Number.isFinite(time) && time > 0)
      .sort((a, b) => b - a)[0];
    const active = overview.inventory.active_session;
    return {
      lastDate: lastHomologated ? new Date(lastHomologated).toLocaleDateString("pt-BR") : null,
      progressPercent: active
        ? Math.round(((active.counted_items ?? 0) / Math.max(1, active.total_items ?? 1)) * 100)
        : null,
    };
  }, [sessions, overview.inventory.active_session]);
  const inventoryBadge = !perms.canAudit
    ? { label: "RESTRITO", tone: "border-slate-500/30 bg-slate-500/10 text-slate-300" }
    : overview.inventory.active_session
      ? { label: "EM ANDAMENTO", tone: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300" }
      : inventoryInfo.lastDate
        ? { label: "CONCLUÍDA", tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" }
        : { label: "SEM REGISTRO", tone: "border-amber-500/30 bg-amber-500/10 text-amber-300" };
  const inventoryCategories = useMemo(() => deriveInventoryCategories(materials), [materials]);

  // Equipamentos mais cautelados: derivado das cautelas reais (nada fixo).
  const topCustodied = useMemo(() => {
    const counts = new Map<string, { name: string; count: number }>();
    for (const c of custodies) {
      const name = equipment.find((e) => e.id === c.equipment_id)?.name || c.equipment_name || c.equipment_code || c.equipment_id;
      const current = counts.get(c.equipment_id);
      counts.set(c.equipment_id, { name, count: (current?.count ?? 0) + 1 });
    }
    const sorted = Array.from(counts.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    const max = sorted[0]?.count ?? 0;
    return sorted.map((item) => ({ ...item, percent: max > 0 ? Math.round((item.count / max) * 100) : 0 }));
  }, [custodies, equipment]);

  // Featured Materials (Destaque)
  const featuredMaterials = useMemo(() => {
    return materials.slice(0, 4).map((m) => {
      const mBatches = (batches || []).filter((b) => b.material_id === m.id && b.status === "active");
      const nextBatch = mBatches.sort((a, b) => a.expiration_date.localeCompare(b.expiration_date))[0];
      const validUntil = nextBatch ? nextBatch.expiration_date.slice(0, 7) : "—";
      const isLow = (m.current_quantity ?? 0) <= (m.minimum_quantity ?? 0);
      const isOut = (m.current_quantity ?? 0) === 0;

      let statusPill = { label: "Em estoque", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" };
      if (isOut) {
        statusPill = { label: "Indisponível", color: "bg-rose-500/20 text-rose-300 border-rose-500/30" };
      } else if (isLow) {
        statusPill = { label: "Estoque baixo", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" };
      }

      return {
        material: m,
        code: `K9-${(m.category_id || "MAT").slice(0, 3).toUpperCase()}-${m.id.slice(0, 3).toUpperCase()}`,
        statusPill,
        validUntil,
        unitsCount: `${m.current_quantity ?? 0} ${m.unit}`,
      };
    });
  }, [materials, batches]);

  // Custody Breakdown (Em uso, Atrasadas, Indisponíveis, Disponíveis)
  const custodyBreakdown = useMemo(() => {
    const active = overview.custody.active;
    const overdue = overview.custody.overdue;
    const available = equipment.filter((e) => e.status === "available" && e.active).length;
    const maintenance = equipment.filter((e) => e.status === "maintenance" || e.condition === "damaged").length;

    return {
      active,
      overdue,
      available,
      maintenance,
    };
  }, [overview.custody, equipment]);

  if (status === "loading") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-slate-400"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
        <p className="text-sm font-medium">Carregando visão geral e alertas operacionais…</p>
      </div>
    );
  }

  if (status === "forbidden") {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200"
      >
        <div className="flex items-center gap-3 font-bold text-rose-300">
          <AlertOctagon className="h-5 w-5" />
          <span>Acesso não autorizado</span>
        </div>
        <p className="mt-2 text-sm text-slate-300">
          Você não possui permissão para visualizar o Almoxarifado (módulo inventory.view requerido).
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200"
      >
        <div className="flex items-center gap-3 font-bold text-rose-300">
          <AlertTriangle className="h-5 w-5" />
          <span>Erro ao carregar dados do almoxarifado</span>
        </div>
        <p className="mt-2 text-sm text-slate-300">{error || "Falha de rede Firestore"}</p>
      </div>
    );
  }

  return (
    <motion.div
      variants={staggerContainerVariants}
      initial={false}
      animate="visible"
      className="space-y-6"
    >
      {/* 1. Operational Attention / Compliance Banner */}
      <motion.section
        variants={staggerItemVariants}
        aria-label="Situação operacional do almoxarifado"
        className={`flex flex-col gap-3 rounded-2xl border p-4 shadow-sm transition sm:flex-row sm:items-center sm:justify-between ${
          isAttention
            ? "border-rose-500/30 bg-rose-950/20 shadow-[0_0_30px_rgba(244,63,94,0.12)]"
            : isWarning
            ? "border-amber-500/30 bg-amber-950/20 shadow-[0_0_30px_rgba(245,158,11,0.12)]"
            : "border-emerald-500/30 bg-emerald-950/20 shadow-[0_0_30px_rgba(16,185,129,0.12)]"
        }`}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold font-mono uppercase tracking-wider ${
              isAttention
                ? "border border-rose-500/40 bg-rose-500/20 text-rose-200"
                : isWarning
                ? "border border-amber-500/40 bg-amber-500/20 text-amber-200"
                : "border border-emerald-500/40 bg-emerald-500/20 text-emerald-200"
            }`}
          >
            <HudStatusDot
              color={isAttention ? "red" : isWarning ? "amber" : "emerald"}
              size={7}
            />
            <span>{isAttention ? "Atenção Requerida" : isWarning ? "Alerta Operacional" : "Operação Normal"}</span>
          </span>

          <p className="text-xs sm:text-sm text-slate-200 font-medium">
            {criticalAndWarningAlerts.length > 0 ? (
              <>
                Existem <strong className="text-white font-bold">{criticalAndWarningAlerts.length} pendências críticas</strong> que exigem ação imediata (itens sem estoque, lotes vencidos ou cautelas atrasadas).
              </>
            ) : (
              "Operação em conformidade. Nenhuma pendência crítica ou em risco detectada no almoxarifado."
            )}
          </p>
        </div>

        <div className="text-[11px] font-mono text-slate-400 shrink-0">
          Atualizado em: <span className="text-slate-300 font-semibold">{updatedTime}</span>
        </div>
      </motion.section>

      {/* 2. Active Inventory Banner (if session is in progress) */}
      {overview.inventory.active_session && (
        <motion.section
          variants={staggerItemVariants}
          aria-label="Inventário ativo em andamento"
          className="rounded-2xl border border-cyan-500/30 bg-cyan-950/30 p-4 text-cyan-100 shadow-md"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                <h3 className="text-sm font-bold text-white">
                  Inventário Físico: {overview.inventory.active_session.title}
                </h3>
                <span className="rounded-md border border-cyan-400/30 bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-200 uppercase">
                  {overview.inventory.active_session.status === "reconciling" ? "Reconciliando" : "Em Contagem"}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Aberto por: <strong className="text-white">{overview.inventory.active_session.opened_by_name}</strong>
                {overview.inventory.active_session.total_items !== undefined && (
                  <span>
                    {" "}· {overview.inventory.active_session.counted_items ?? 0} de {overview.inventory.active_session.total_items} posições contadas
                  </span>
                )}
              </p>
            </div>
            <Link
              href={`/warehouse/inventory/${overview.inventory.active_session.id}`}
              className="inline-flex items-center justify-center rounded-xl bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-300 transition shadow whitespace-nowrap"
            >
              Continuar Contagem
            </Link>
          </div>
        </motion.section>
      )}

      {/* 3. Five KPI Status Cards Row (Mockup 1 Parity) */}
      <motion.section
        variants={staggerItemVariants}
        aria-label="Indicadores operacionais"
        className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-5"
      >
        <WarehouseKpiCard
          label="MATERIAIS ATIVOS"
          value={totalActiveMaterials}
          subtext="cadastrados no catálogo"
          icon={Boxes}
          colorVariant="cyan"
          trend={{
            text: "Catálogo",
            direction: "neutral",
            variant: "cyan",
          }}
        />

        <WarehouseKpiCard
          label="ESTOQUE BAIXO"
          value={lowStockCount}
          subtext="itens abaixo do mínimo"
          icon={AlertTriangle}
          colorVariant="rose"
          trend={{
            text: lowStockCount > 0 ? "Atenção" : "Normal",
            direction: lowStockCount > 0 ? "up" : "neutral",
            variant: lowStockCount > 0 ? "rose" : "emerald",
          }}
        />

        <WarehouseKpiCard
          label="VALIDADE EM RISCO"
          value={validityAtRiskCount}
          subtext="lotes vencendo em até 30 dias"
          icon={Calendar}
          colorVariant="amber"
          trend={{
            text: validityAtRiskCount > 0 ? "Atenção" : "Em dia",
            direction: validityAtRiskCount > 0 ? "up" : "neutral",
            variant: validityAtRiskCount > 0 ? "amber" : "emerald",
          }}
        />

        <WarehouseKpiCard
          label="EM CAUTELA"
          value={overview.custody.active}
          subtext="equipamentos em uso"
          icon={Shield}
          colorVariant="cyan"
          trend={{
            text: "Em uso",
            direction: "neutral",
            variant: "cyan",
          }}
        />

        <WarehouseKpiCard
          label="CAUTELAS ATRASADAS"
          value={overview.custody.overdue}
          subtext="fora do prazo de devolução"
          icon={Clock}
          colorVariant="rose"
          trend={{
            text: overview.custody.overdue > 0 ? "Atrasadas" : "Sem atrasos",
            direction: overview.custody.overdue > 0 ? "up" : "neutral",
            variant: overview.custody.overdue > 0 ? "rose" : "emerald",
          }}
        />
      </motion.section>

      {/* 4. Middle Section (3 Cards: Situação do Estoque, Alertas & Pendências, Conferência Física) */}
      <motion.section
        variants={staggerItemVariants}
        className="grid grid-cols-1 gap-4 lg:grid-cols-12"
      >
        {/* Left: Situação do Estoque with Progress Bars (Mockup 1 Parity) */}
        <div className="lg:col-span-4 flex flex-col">
          <div className="flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#0b1424]/90 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.25)] h-full">
            <div>
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <h3 className="text-xs font-bold font-mono uppercase tracking-[0.16em] text-slate-300">
                  SITUAÇÃO DO ESTOQUE
                </h3>
                <Link
                  href="/warehouse/materials"
                  className="flex items-center gap-1 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 transition"
                >
                  <span>Ver detalhes</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="mt-4 space-y-4">
                {/* 1. Estoque adequado */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="flex items-center gap-2 text-slate-300 font-medium">
                      <span className="h-2 w-2 rounded-full bg-cyan-400" />
                      Estoque adequado
                    </span>
                    <span className="font-mono text-slate-200">
                      <strong>{stockSituation.regular.count}</strong> itens{" "}
                      <span className="text-slate-500">({stockSituation.regular.percent}%)</span>
                    </span>
                  </div>
                  <AnimatedProgressBar percentage={stockSituation.regular.percent} colorVariant="cyan" />
                </div>

                {/* 2. Estoque baixo */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="flex items-center gap-2 text-slate-300 font-medium">
                      <span className="h-2 w-2 rounded-full bg-amber-400" />
                      Estoque baixo
                    </span>
                    <span className="font-mono text-slate-200">
                      <strong>{stockSituation.low.count}</strong> itens{" "}
                      <span className="text-slate-500">({stockSituation.low.percent}%)</span>
                    </span>
                  </div>
                  <AnimatedProgressBar percentage={stockSituation.low.percent} colorVariant="amber" />
                </div>

                {/* 3. Indisponível */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="flex items-center gap-2 text-slate-300 font-medium">
                      <span className="h-2 w-2 rounded-full bg-rose-400" />
                      Indisponível
                    </span>
                    <span className="font-mono text-slate-200">
                      <strong>{stockSituation.out.count}</strong> itens{" "}
                      <span className="text-slate-500">({stockSituation.out.percent}%)</span>
                    </span>
                  </div>
                  <AnimatedProgressBar percentage={stockSituation.out.percent} colorVariant="rose" />
                </div>

                {/* 4. Em reserva */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="flex items-center gap-2 text-slate-300 font-medium">
                      <span className="h-2 w-2 rounded-full bg-purple-400" />
                      Em reserva
                    </span>
                    <span className="font-mono text-slate-200">
                      <strong>{stockSituation.reserve.count}</strong> itens{" "}
                      <span className="text-slate-500">({stockSituation.reserve.percent}%)</span>
                    </span>
                  </div>
                  <AnimatedProgressBar percentage={stockSituation.reserve.percent} colorVariant="purple" />
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-slate-400">
              <span>Total monitorado</span>
              <span className="font-mono font-bold text-white">{totalActiveMaterials} materiais</span>
            </div>
          </div>
        </div>

        {/* Center: Alertas e Pendências with Priority Pulse */}
        <div className="lg:col-span-5 flex flex-col">
          <div className="flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#0b1424]/90 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.25)] h-full">
            <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
              <div className="flex items-center gap-2.5">
                <h3 className="text-xs font-bold font-mono uppercase tracking-[0.16em] text-slate-300">
                  ALERTAS E PENDÊNCIAS
                </h3>
                {criticalAndWarningAlerts.length > 0 && (
                  <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold font-mono text-rose-300">
                    {criticalAndWarningAlerts.length} {criticalAndWarningAlerts.length === 1 ? "alerta" : "alertas"}
                  </span>
                )}
              </div>
              <Link
                href="/warehouse/materials"
                className="flex items-center gap-1 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 transition"
              >
                <span>Ver todos ({overview.alerts.length})</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {overview.alerts.length === 0 ? (
              <div
                data-testid="healthy-empty-state"
                className="flex flex-1 flex-col items-center justify-center py-8 text-center"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <p className="mt-3 text-xs font-semibold text-emerald-200">
                  Nenhuma pendência crítica no almoxarifado.
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Todos os lotes, cautelas e estoques estão em conformidade operacional.
                </p>
              </div>
            ) : (
              <ul data-testid="alerts-list" className="mt-3 divide-y divide-white/[0.04] space-y-1">
                {overview.alerts.slice(0, 5).map((alert) => {
                  const isCritical = alert.severity === "critical";
                  const badgeLabel = isCritical ? "CRÍTICO" : "ATENÇÃO";
                  const badgeClass = isCritical
                    ? "border-rose-500/40 bg-rose-500/20 text-rose-300"
                    : "border-amber-500/40 bg-amber-500/20 text-amber-300";

                  return (
                    <li
                      key={alert.id}
                      className="group flex items-center justify-between gap-3 py-2 px-1 transition hover:bg-white/[0.02] rounded-lg"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {isCritical ? (
                          <PriorityPulseDot tone="rose" className="shrink-0" />
                        ) : (
                          <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
                        )}

                        <span
                          className={`inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-[9px] font-black font-mono tracking-wider shrink-0 ${badgeClass}`}
                        >
                          {badgeLabel}
                        </span>

                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate group-hover:text-cyan-200 transition">
                            {alert.title}
                          </p>
                          {alert.description && (
                            <p className="text-[11px] text-slate-400 truncate mt-0.5 font-mono">
                              {alert.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <Link
                        href={alert.href}
                        className="flex items-center gap-1 shrink-0 text-[11px] font-bold text-cyan-400 hover:text-cyan-300 transition ml-2"
                      >
                        <span>Acessar</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Right: Conferência Física / Inventário Card */}
        <div className="lg:col-span-3 flex flex-col">
          <div className="flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#0b1424]/90 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.25)] h-full">
            <div>
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-cyan-400" />
                  <h3 className="text-xs font-bold font-mono uppercase tracking-[0.16em] text-slate-300">
                    CONFERÊNCIA FÍSICA
                  </h3>
                </div>
                <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${inventoryBadge.tone}`}>
                  {inventoryBadge.label}
                </span>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <span className="text-[11px] text-slate-400 block">Última conferência</span>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="font-mono text-sm font-bold text-white">
                      {!perms.canAudit ? "Restrito ao perfil de auditoria" : inventoryInfo.lastDate ?? "Nenhuma conferência homologada"}
                    </span>
                  </div>
                </div>


                {perms.canAudit && inventoryInfo.progressPercent !== null && (
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-[11px] text-slate-400">Progresso do inventário atual</span>
                    <span className="font-mono text-[11px] font-bold text-cyan-400">
                      {inventoryInfo.progressPercent}%
                    </span>
                  </div>
                  <AnimatedProgressBar percentage={inventoryInfo.progressPercent} colorVariant="cyan" />
                </div>
                )}
              </div>
            </div>

            <div className="pt-6">
              {perms.canAudit && (
              <Link
                href="/warehouse/inventory"
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.22)] transition hover:bg-cyan-300 active:scale-[0.98]"
              >
                <span>Iniciar nova conferência</span>
              </Link>
              )}
            </div>
          </div>
        </div>
      </motion.section>

      {/* 5. NEW SECTION: MATERIAIS EM DESTAQUE (Matching Mockup 1) */}
      <motion.section
        variants={staggerItemVariants}
        aria-label="Materiais em destaque"
        className="rounded-2xl border border-white/[0.08] bg-[#0b1424]/90 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.25)]"
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <Package className="h-4 w-4 text-cyan-400" />
            <h3 className="text-xs font-bold font-mono uppercase tracking-[0.16em] text-slate-300">
              MATERIAIS EM DESTAQUE
            </h3>
          </div>
          <Link
            href="/warehouse/materials"
            className="flex items-center gap-1 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 transition"
          >
            <span>Ver todas</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {featuredMaterials.map((item) => (
            <Link
              key={item.material.id}
              href={`/warehouse/materials/${item.material.id}`}
              className="group relative flex flex-col justify-between rounded-xl border border-white/[0.06] bg-slate-900/60 p-3.5 transition-all duration-200 hover:-translate-y-1 hover:border-cyan-500/40 hover:shadow-[0_8px_24px_rgba(6,182,212,0.12)]"
            >
              {/* Thumbnail + Status Badge */}
              <div className="relative">
                <WarehouseItemThumbnail
                  categoryName={item.material.category_name || item.material.category_id}
                  size="lg"
                  alt={item.material.name}
                  className="mb-3"
                />
                <span
                  className={`absolute top-2 right-2 rounded-full border px-2 py-0.5 text-[9px] font-bold font-mono uppercase ${item.statusPill.color}`}
                >
                  {item.statusPill.label}
                </span>
              </div>

              {/* Title & Code */}
              <div>
                <h4 className="text-xs font-bold text-white group-hover:text-cyan-300 transition line-clamp-1">
                  {item.material.name}
                </h4>
                <p className="text-[10px] font-mono text-slate-400 mt-0.5">{item.code}</p>
              </div>

              {/* Metrics & Validity */}
              <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-300 font-bold">{item.unitsCount}</span>
                <span className="text-[10px] text-slate-400">Validade: {item.validUntil}</span>
              </div>
            </Link>
          ))}
        </div>
      </motion.section>

      {/* 6. Bottom Section (2 Cards: Últimas Movimentações + Resumo de Cautelas) */}
      <motion.section
        variants={staggerItemVariants}
        className="grid grid-cols-1 gap-4 lg:grid-cols-12"
      >
        {/* Left: Últimas Movimentações Table */}
        <div className="lg:col-span-8 flex flex-col">
          <div className="flex flex-col rounded-2xl border border-white/[0.08] bg-[#0b1424]/90 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.25)]">
            <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
              <h3 className="text-xs font-bold font-mono uppercase tracking-[0.16em] text-slate-300">
                ÚLTIMAS MOVIMENTAÇÕES
              </h3>
              <Link
                href="/warehouse/movements"
                className="flex items-center gap-1 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 transition"
              >
                <span>Ver todas</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {overview.recent_movements.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-400">
                Nenhuma movimentação recente registrada.
              </p>
            ) : (
              <div className="space-y-2 mt-3">
                {overview.recent_movements.slice(0, 5).map((m) => {
                  const dateStr = m.performed_at
                    ? new Date(m.performed_at).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—";

                  const isPositive = m.type === "entry";
                  const isTransfer = m.type === "transfer";
                  const isLoss = m.type === "loss" || m.type === "disposal";

                  return (
                    <div
                      key={m.id}
                      className="group flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl border border-white/[0.04] bg-slate-950/40 hover:bg-white/[0.02] hover:border-white/10 transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <MovementTypeBadge type={m.type} />
                        <div className="min-w-0">
                          <Link
                            href="/warehouse/movements"
                            className="text-xs font-bold text-white hover:text-cyan-300 transition truncate block"
                            title={m.material_name}
                          >
                            {m.material_name}
                          </Link>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                            {m.lot_number && (
                              <span className="text-slate-300">
                                Lote <span>{m.lot_number}</span>
                              </span>
                            )}
                            <span>·</span>
                            <span>{dateStr}</span>
                            {m.performed_by_name && (
                              <>
                                <span>·</span>
                                <span className="text-slate-400">{m.performed_by_name}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                        <span
                          className={`font-mono font-bold text-xs flex items-center gap-0.5 ${
                            isPositive
                              ? "text-emerald-400"
                              : isTransfer
                              ? "text-purple-300"
                              : isLoss
                              ? "text-rose-400"
                              : "text-sky-300"
                          }`}
                        >
                          <span>{isPositive ? "+" : isTransfer ? "⇄ " : "-"}</span>
                          <span>{m.quantity} {m.unit}</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Resumo de Cautelas with 4 Mini Cards & Progress (Mockup 1 Parity) */}
        <div className="lg:col-span-4 flex flex-col">
          <div className="flex flex-col rounded-2xl border border-white/[0.08] bg-[#0b1424]/90 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.25)]">
            <div>
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-cyan-400" />
                  <h3 className="text-xs font-bold font-mono uppercase tracking-[0.16em] text-slate-300">
                    RESUMO DE CAUTELAS
                  </h3>
                </div>
                <Link
                  href="/warehouse/custody"
                  className="flex items-center gap-1 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 transition"
                >
                  <span>Ver todas</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              {/* 4 Mini Status Boxes */}
              <div className="grid grid-cols-2 gap-2.5 mt-4">
                <div className="rounded-xl border border-white/[0.06] bg-slate-900/60 p-2.5">
                  <span className="text-[10px] text-slate-400 block font-mono">Em uso</span>
                  <span className="font-mono text-lg font-bold text-cyan-300">
                    {custodyBreakdown.active}
                  </span>
                </div>

                <div className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-2.5">
                  <span className="text-[10px] text-rose-300 block font-mono">Atrasadas</span>
                  <span className="font-mono text-lg font-bold text-rose-400">
                    {custodyBreakdown.overdue}
                  </span>
                </div>

                <div className="rounded-xl border border-white/[0.06] bg-slate-900/60 p-2.5">
                  <span className="text-[10px] text-slate-400 block font-mono">Manutenção</span>
                  <span className="font-mono text-lg font-bold text-slate-300">
                    {custodyBreakdown.maintenance}
                  </span>
                </div>

                <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-2.5">
                  <span className="text-[10px] text-emerald-300 block font-mono">Disponíveis</span>
                  <span className="font-mono text-lg font-bold text-emerald-400">
                    {custodyBreakdown.available}
                  </span>
                </div>
              </div>

              {/* Equipamentos mais cautelados */}
              <div className="mt-5 space-y-3">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                  Equipamentos mais cautelados
                </span>
                {topCustodied.length === 0 && (
                  <p className="text-[11px] text-slate-500">Nenhuma cautela registrada.</p>
                )}
                {topCustodied.map((item) => (
                  <div key={item.id}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-300">{item.name}</span>
                      <span className="font-mono text-slate-400 text-[11px]">{item.count} cautela(s)</span>
                    </div>
                    <AnimatedProgressBar percentage={item.percent} colorVariant="cyan" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Dialog for opening new inventory */}
      {perms.canAudit && (
      <OpenInventoryDialog
        isOpen={isNewInventoryOpen}
        onClose={() => setIsNewInventoryOpen(false)}
        locations={locations}
        categories={inventoryCategories}
      />
      )}
    </motion.div>
  );
}
