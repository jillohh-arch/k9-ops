"use client";

import { Car, Dog, Link2, Users } from "lucide-react";
import { useMemo, useState, type ComponentType } from "react";

import BinomialsPage from "../binomials/page";
import HumansPage from "../humans/page";
import K9Page from "../k9/page";
import VehiclesPage from "../vehicles/page";
import { useAccessControl } from "@/features/access/providers/access-control-provider";
import { cn } from "@/lib/utils";

type EffectiveTabId = "k9" | "humans" | "vehicles" | "binomials";

const effectiveTabs: Array<{
  description: string;
  icon: ComponentType<{ className?: string }>;
  id: EffectiveTabId;
  label: string;
}> = [
  {
    description: "matilha, status e especialidades",
    icon: Dog,
    id: "k9",
    label: "K9",
  },
  {
    description: "GCMs, funcoes e disponibilidade",
    icon: Users,
    id: "humans",
    label: "Humanos",
  },
  {
    description: "frota, uso e manutencao",
    icon: Car,
    id: "vehicles",
    label: "Viaturas",
  },
  {
    description: "vinculos K9 + condutor",
    icon: Link2,
    id: "binomials",
    label: "Binomios",
  },
];

function EffectiveTabButton({
  active,
  description,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  description: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "group rounded-3xl border p-4 text-left transition",
        active
          ? "border-cyan-300/35 bg-cyan-300/12 text-cyan-100 shadow-[0_0_34px_rgba(34,211,238,0.12)]"
          : "border-white/10 bg-white/[0.035] text-slate-400 hover:border-cyan-300/25 hover:text-slate-100",
      )}
      onClick={onClick}
      type="button"
    >
      <span className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-2xl border transition",
            active
              ? "border-cyan-300/30 bg-cyan-300/15 text-cyan-100"
              : "border-white/10 bg-white/[0.035] text-slate-500 group-hover:text-cyan-200",
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <span>
          <span className="block text-base font-black">{label}</span>
          <span className="mt-1 block text-xs text-slate-500">
            {description}
          </span>
        </span>
      </span>
    </button>
  );
}

export default function EffectivePage() {
  const { can, status } = useAccessControl();
  const allowedTabs = useMemo(
    () =>
      status === "loading"
        ? effectiveTabs
        : effectiveTabs.filter((tab) => can(tab.id, "view")),
    [can, status],
  );
  const [activeTab, setActiveTab] = useState<EffectiveTabId>("k9");
  const currentTab = allowedTabs.some((tab) => tab.id === activeTab)
    ? activeTab
    : allowedTabs[0]?.id;

  return (
    <div className="space-y-6">
      <header className="rounded-[2rem] border border-cyan-200/12 bg-[#081320]/82 p-5 shadow-[0_26px_90px_rgba(0,0,0,0.24)]">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
          Efetivo
        </p>
        <div className="mt-2 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <h1 className="text-3xl font-black text-white md:text-4xl">
              Gestao do efetivo operacional
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              K9, humanos, viaturas e binomios ficam em uma unica area, com
              abas dedicadas para consulta e manutencao.
            </p>
          </div>
          <span className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-100">
            4 nucleos
          </span>
        </div>
      </header>

      <nav className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        {allowedTabs.map((tab) => (
          <EffectiveTabButton
            active={currentTab === tab.id}
            description={tab.description}
            icon={tab.icon}
            key={tab.id}
            label={tab.label}
            onClick={() => setActiveTab(tab.id)}
          />
        ))}
      </nav>

      <section className="rounded-[2rem] border border-cyan-200/10 bg-[#07111f]/55 p-4">
        {!allowedTabs.length && status !== "loading" ? (
          <div className="rounded-3xl border border-amber-300/20 bg-amber-300/[0.06] p-8 text-center">
            <h2 className="text-xl font-black text-white">
              Nenhum nucleo liberado
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Seu perfil nao possui acesso aos modulos de efetivo.
            </p>
          </div>
        ) : null}
        {currentTab === "k9" ? <K9Page /> : null}
        {currentTab === "humans" ? <HumansPage /> : null}
        {currentTab === "vehicles" ? <VehiclesPage /> : null}
        {currentTab === "binomials" ? <BinomialsPage /> : null}
      </section>
    </div>
  );
}
