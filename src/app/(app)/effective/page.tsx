"use client";

import { Car, ChevronRight, Dog, Link2, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  collection,
  onSnapshot,
  query,
  where,
  type Query,
} from "firebase/firestore";
import { useEffect, useMemo, useState, type ComponentType } from "react";

import BinomialsPage from "../binomials/page";
import HumansPage from "../humans/page";
import K9Page from "../k9/page";
import VehiclesPage from "../vehicles/page";
import { useAccessControl } from "@/features/access/providers/access-control-provider";
import { db } from "@/lib/firebase/client";
import { cn } from "@/lib/utils";

type EffectiveTabId = "k9" | "humans" | "vehicles" | "binomials";

const tabMeta: Record<
  EffectiveTabId,
  { description: string; image: string; imageClassName: string; tone: string }
> = {
  k9: {
    description: "matilha, status e especialidades",
    image: "/assets/card_k9.png",
    imageClassName: "right-0 -bottom-2 h-[130px] w-[300px]",
    tone: "cyan",
  },
  humans: {
    description: "GCMs, funcoes e disponibilidade",
    image: "/assets/card_humano.png",
    imageClassName: "right-0 -bottom-2 h-[130px] w-[300px]",
    tone: "emerald",
  },
  vehicles: {
    description: "frota, uso e manutencao",
    image: "/assets/card_viatura.png",
    imageClassName: "right-0 -bottom-2 h-[130px] w-[300px]",
    tone: "violet",
  },
  binomials: {
    description: "vinculos K9 + condutor",
    image: "/assets/card_binomio.png",
    imageClassName: "right-0 -bottom-2 h-[130px] w-[300px]",
    tone: "amber",
  },
};

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
    label: "Binômios",
  },
];

// ─── Count loading ────────────────────────────────────────────────────────────

type CountState = { loading: boolean; value: number };

function useCollectionCount(
  path: string,
  filterActive = false,
): CountState {
  const [state, setState] = useState<CountState>({ loading: true, value: 0 });

  useEffect(() => {
    const constraints = filterActive ? [where("active", "==", true)] : [];
    const ref: Query = constraints.length
      ? query(collection(db, path), ...constraints)
      : collection(db, path);

    const unsub = onSnapshot(
      ref,
      (snap) => setState({ loading: false, value: snap.size }),
      () => setState((s) => ({ ...s, loading: false })),
    );
    return unsub;
  }, [path, filterActive]);

  return state;
}

function useEffectiveCounts() {
  const dogs = useCollectionCount("dogs", true);
  const users = useCollectionCount("users", true);
  const vehicles = useCollectionCount("vehicles", true);
  const binomials = useCollectionCount("binomials", true);

  return useMemo(
    () => ({ dogs, users, vehicles, binomials }),
    [dogs, users, vehicles, binomials],
  );
}

// ─── Rich nav card ───────────────────────────────────────────────────────────

const toneBorderClasses: Record<string, string> = {
  amber: "group-hover:border-amber-300/60 group-hover:shadow-[0_0_32px_rgba(251,191,36,0.22)]",
  cyan: "group-hover:border-cyan-300/60 group-hover:shadow-[0_0_32px_rgba(34,211,238,0.22)]",
  emerald: "group-hover:border-emerald-300/60 group-hover:shadow-[0_0_32px_rgba(52,211,153,0.22)]",
  violet: "group-hover:border-violet-300/60 group-hover:shadow-[0_0_32px_rgba(168,85,247,0.22)]",
};

function EffectiveNavCard({
  active,
  count,
  countLoading,
  description,
  icon: Icon,
  id,
  label,
  onClick,
  tone,
}: {
  active: boolean;
  count: number;
  countLoading: boolean;
  description: string;
  icon: ComponentType<{ className?: string }>;
  id: EffectiveTabId;
  label: string;
  onClick: () => void;
  tone: string;
}) {
  const meta = tabMeta[id];
  const borderClass = toneBorderClasses[tone] ?? toneBorderClasses.cyan;

  return (
    <button
      className={cn(
        "group relative min-h-[154px] overflow-hidden rounded-3xl border border-white/10 bg-[#0b1628]/82 p-5 text-left transition-all duration-300",
        active
          ? "border-cyan-300/40 bg-[#0d1e30]/90 shadow-[0_0_40px_rgba(34,211,238,0.18)]"
          : "hover:border-white/20 hover:bg-[#0d1a2a]/90 hover:shadow-[0_0_24px_rgba(0,0,0,0.3)]",
        !active && borderClass,
      )}
      onClick={onClick}
      type="button"
    >
      {/* Background image */}
      <div
        className={cn(
          "pointer-events-none absolute opacity-40 mix-blend-screen",
          "[mask-image:linear-gradient(90deg,transparent,transparent_8%,black_34%,black_92%,transparent)]",
          meta.imageClassName,
        )}
      >
        <Image
          alt=""
          className="object-contain object-right-bottom"
          fill
          priority={id === "k9"}
          sizes="200px"
          src={meta.image}
          unoptimized
        />
      </div>

      {/* Gradient overlay */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(77,208,225,0.1),transparent_34%)]" />

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col justify-between">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border",
              active
                ? "border-cyan-300/30 bg-cyan-300/15 text-cyan-100"
                : "border-white/10 bg-white/[0.035] text-slate-400 group-hover:border-cyan-300/25 group-hover:text-cyan-200",
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-black text-white">{label}</p>
            <p className="mt-0.5 text-xs text-slate-400">{description}</p>
          </div>
        </div>

        <div className="mt-4 flex items-end justify-between">
          <div>
            <p
              className={cn(
                "font-mono text-4xl font-black leading-none",
                active ? "text-cyan-100" : "text-white",
              )}
            >
              {countLoading ? "..." : count}
            </p>
            <p className="mt-1 text-xs text-slate-500">registros</p>
          </div>
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-transparent text-slate-500 transition-all duration-300",
              active
                ? "border-cyan-300/20 bg-cyan-300/10 text-cyan-200"
                : "group-hover:border-cyan-300/20 group-hover:bg-cyan-300/10 group-hover:text-cyan-200",
            )}
          >
            <ChevronRight
              className={cn(
                "h-4 w-4 transition-transform duration-300",
                active ? "rotate-90" : "group-hover:translate-x-0.5 group-hover:rotate-90",
              )}
            />
          </span>
        </div>
      </div>

      {/* Bottom gradient line */}
      <span className="absolute bottom-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </button>
  );
}

export default function EffectivePage() {
  const { can, status } = useAccessControl();
  const counts = useEffectiveCounts();

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

  const countMap = useMemo(
    () => ({
      dogs: counts.dogs,
      humans: counts.users,
      vehicles: counts.vehicles,
      binomials: counts.binomials,
    }),
    [counts],
  );

  return (
    <div className="space-y-6">
      <header className="rounded-[2rem] border border-cyan-200/12 bg-[#081320]/82 p-5 shadow-[0_26px_90px_rgba(0,0,0,0.24)]">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
          Efetivo
        </p>
        <div className="mt-2 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <h1 className="text-3xl font-black text-white md:text-4xl">
              Gestão do efetivo operacional
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              K9, humanos, viaturas e binômios ficam em uma única area, com
              abas dedicadas para consulta e manutenção.
            </p>
          </div>
          <span className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.07] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
            4 núcleos
          </span>
        </div>
      </header>

      <nav className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        {allowedTabs.map((tab) => {
          const meta = tabMeta[tab.id];
          const countKey = tab.id === "k9" ? "dogs" : tab.id;
          const countData = countMap[countKey as "dogs" | "humans" | "vehicles" | "binomials"];

          return (
            <EffectiveNavCard
              active={currentTab === tab.id}
              count={countData.value}
              countLoading={countData.loading}
              description={tab.description}
              icon={tab.icon}
              id={tab.id}
              key={tab.id}
              label={tab.label}
              onClick={() => setActiveTab(tab.id)}
              tone={meta.tone}
            />
          );
        })}
      </nav>

      <section className="rounded-[2rem] border border-cyan-200/10 bg-[#07111f]/55 p-4">
        {!allowedTabs.length && status !== "loading" ? (
          <div className="rounded-3xl border border-amber-300/20 bg-amber-300/[0.06] p-8 text-center">
            <h2 className="text-xl font-black text-white">
              Nenhum núcleo liberado
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Seu perfil não possui acesso aos módulos de efetivo.
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
