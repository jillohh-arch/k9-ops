"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  Download,
  Layers,
  LayoutDashboard,
  Package,
  Plus,
  ScanLine,
  Shield,
  UserCheck,
} from "lucide-react";
import { WarehouseSection } from "./warehouse-view";

interface SectionConfig {
  id: WarehouseSection;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SECTIONS: SectionConfig[] = [
  { id: "overview", label: "Visão geral", href: "/warehouse", icon: LayoutDashboard },
  { id: "materials", label: "Materiais", href: "/warehouse/materials", icon: Package },
  { id: "batches", label: "Lotes (FEFO)", href: "/warehouse/batches", icon: Layers },
  { id: "equipment", label: "Equipamentos", href: "/warehouse/equipment", icon: Shield },
  { id: "custody", label: "Cautelas", href: "/warehouse/custody", icon: UserCheck },
  { id: "movements", label: "Movimentações", href: "/warehouse/movements", icon: ArrowLeftRight },
  { id: "inventory", label: "Inventário", href: "/warehouse/inventory", icon: ScanLine },
];

const SECTION_TITLES: Record<WarehouseSection, string> = {
  overview: "Visão geral",
  materials: "Materiais",
  batches: "Lotes (FEFO)",
  equipment: "Equipamentos",
  custody: "Cautelas",
  movements: "Movimentações",
  inventory: "Inventário",
};

export interface WarehouseHeaderProps {
  section: WarehouseSection;
  onExportReport?: () => void;
  onRegisterEntry?: () => void;
  onNewMaterial?: () => void;
  onNewEquipment?: () => void;
  onNewCustody?: () => void;
  onNewInventory?: () => void;
}

export function WarehouseHeader({
  section,
  onExportReport,
  onRegisterEntry,
  onNewMaterial,
  onNewEquipment,
  onNewCustody,
  onNewInventory,
}: WarehouseHeaderProps) {
  const title = SECTION_TITLES[section] || "Almoxarifado";

  return (
    <div className="space-y-4">
      {/* Top Bar: Kicker, Title, Description, and Action Buttons */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold tracking-wider text-cyan-400 uppercase">
              ALMOXARIFADO • F60
            </span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
            {title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-3xl">
            Controle operacional de materiais, lotes e posições físicas. Estoque legado permanece disponível em{" "}
            <Link
              href="/inventory"
              className="text-cyan-400 hover:text-cyan-300 font-mono underline decoration-cyan-400/40 underline-offset-2"
            >
              /inventory
            </Link>
            .
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0 pt-1">
          {onExportReport && (
            <button
              type="button"
              onClick={onExportReport}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2.5 text-xs font-semibold text-slate-200 transition hover:border-cyan-400/40 hover:bg-slate-900 hover:text-white shadow-sm"
            >
              <Download className="h-3.5 w-3.5 text-cyan-400" />
              <span>Exportar relatório</span>
            </button>
          )}

          {onRegisterEntry && (
            <button
              type="button"
              onClick={onRegisterEntry}
              className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-400 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.22)] transition hover:bg-cyan-300"
            >
              <Plus className="h-3.5 w-3.5 stroke-[3]" />
              <span>Registrar Entrada</span>
            </button>
          )}

          {section === "materials" && onNewMaterial && (
            <button
              type="button"
              onClick={onNewMaterial}
              className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-400 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.22)] transition hover:bg-cyan-300"
            >
              <Plus className="h-3.5 w-3.5 stroke-[3]" />
              <span>Novo Material</span>
            </button>
          )}

          {section === "equipment" && onNewEquipment && (
            <button
              type="button"
              onClick={onNewEquipment}
              className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-400 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.22)] transition hover:bg-cyan-300"
            >
              <Plus className="h-3.5 w-3.5 stroke-[3]" />
              <span>Novo Equipamento</span>
            </button>
          )}

          {section === "custody" && onNewCustody && (
            <button
              type="button"
              onClick={onNewCustody}
              className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-400 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.22)] transition hover:bg-cyan-300"
            >
              <Plus className="h-3.5 w-3.5 stroke-[3]" />
              <span>Nova Cautela</span>
            </button>
          )}

          {section === "inventory" && onNewInventory && (
            <button
              type="button"
              onClick={onNewInventory}
              className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-400 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.22)] transition hover:bg-cyan-300"
            >
              <Plus className="h-3.5 w-3.5 stroke-[3]" />
              <span>Novo Inventário</span>
            </button>
          )}
        </div>
      </div>

      {/* Pill Navigation Tabs (Matching K9 Ops Training/Dashboard & Mockup 1/2) */}
      <nav
        aria-label="Navegação do almoxarifado"
        className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide pt-1"
        role="tablist"
      >
        {SECTIONS.map(({ id, label, href }) => {
          const isActive = section === id;
          return (
            <Link
              key={id}
              href={href}
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? "page" : undefined}
              className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-medium transition ${
                isActive
                  ? "border border-cyan-400 bg-cyan-950/50 text-cyan-300 font-bold shadow-[0_0_14px_rgba(34,211,238,0.18)]"
                  : "border border-white/5 bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:border-white/10"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
