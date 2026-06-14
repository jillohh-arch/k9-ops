"use client";

import Image from "next/image";
import {
  Grid2X2,
  List,
  Search,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type ViewMode = "grid" | "list";

export function EffectiveHeader({
  eyebrow,
  title,
  description,
}: {
  description: string;
  eyebrow?: string;
  title: string;
}) {
  return (
    <div>
      {eyebrow ? (
        <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="mt-1 text-3xl font-black tracking-tight text-white">
        {title}
      </h1>
      <p className="mt-2 text-sm text-slate-400">{description}</p>
    </div>
  );
}

export function SummaryCard({
  detail,
  icon: Icon,
  label,
  tone,
  value,
}: {
  detail: string;
  icon: LucideIcon;
  label: string;
  tone: "cyan" | "green" | "blue" | "amber" | "violet";
  value: string;
}) {
  const tones = {
    amber: "border-amber-300/20 bg-amber-300/10 text-amber-200",
    blue: "border-blue-300/20 bg-blue-300/10 text-blue-200",
    cyan: "border-cyan-300/20 bg-cyan-300/10 text-cyan-200",
    green: "border-emerald-300/20 bg-emerald-300/10 text-emerald-200",
    violet: "border-violet-300/20 bg-violet-300/10 text-violet-200",
  };

  return (
    <article className="relative overflow-hidden rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.2)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_16%,rgba(34,211,238,0.09),transparent_34%)]" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-300">{label}</p>
          <p className="mt-5 font-mono text-4xl font-black text-white">
            {value}
          </p>
          <p className="mt-2 text-xs text-slate-500">{detail}</p>
        </div>
        <span
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-2xl border",
            tones[tone],
          )}
        >
          <Icon className="h-6 w-6" />
        </span>
      </div>
    </article>
  );
}

export function FilterBar({
  children,
  onSearch,
  placeholder,
  search,
  viewMode,
  onViewMode,
}: {
  children?: React.ReactNode;
  onSearch: (value: string) => void;
  onViewMode: (mode: ViewMode) => void;
  placeholder: string;
  search: string;
  viewMode: ViewMode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-[#0b1628]/72 p-3 xl:flex-row xl:items-center">
      <label className="relative min-w-0 flex-1 xl:max-w-[420px]">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] pl-11 pr-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35"
          onChange={(event) => onSearch(event.target.value)}
          placeholder={placeholder}
          type="search"
          value={search}
        />
      </label>
      <div className="flex flex-1 flex-wrap gap-3">{children}</div>
      <div className="flex rounded-xl border border-white/10 bg-black/15 p-1">
        {[
          { icon: Grid2X2, mode: "grid" as const, title: "Visualizar em grade" },
          { icon: List, mode: "list" as const, title: "Visualizar em lista" },
        ].map((item) => (
          <button
            aria-label={item.title}
            className={cn(
              "flex h-9 w-11 items-center justify-center rounded-lg text-slate-500 transition",
              viewMode === item.mode &&
                "bg-cyan-300/12 text-cyan-200 shadow-[inset_0_0_18px_rgba(34,211,238,0.08)]",
            )}
            key={item.mode}
            onClick={() => onViewMode(item.mode)}
            title={item.title}
            type="button"
          >
            <item.icon className="h-4 w-4" />
          </button>
        ))}
      </div>
    </div>
  );
}

export function FilterSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        className="h-11 min-w-40 appearance-none rounded-xl border border-white/10 bg-white/[0.035] px-4 pr-9 text-sm text-slate-300 outline-none transition focus:border-cyan-300/35"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option
            className="bg-[#0b1628]"
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">
        v
      </span>
    </label>
  );
}

export function EntityImage({
  alt,
  className,
  fallback,
  src,
}: {
  alt: string;
  className?: string;
  fallback: LucideIcon;
  src: string | null;
}) {
  const Fallback = fallback;
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-cyan-200/12 bg-cyan-300/[0.055]",
        className,
      )}
    >
      {src ? (
        <Image
          alt={alt}
          className="object-cover"
          fill
          sizes="160px"
          src={src}
          unoptimized
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_50%_20%,rgba(34,211,238,0.16),transparent_62%)] text-cyan-200/45">
          <Fallback className="h-12 w-12" />
        </div>
      )}
    </div>
  );
}

export function StatusPill({
  label,
  tone = "slate",
}: {
  label: string;
  tone?: "green" | "blue" | "amber" | "violet" | "slate" | "cyan" | "red";
}) {
  const tones = {
    amber: "border-amber-300/25 bg-amber-300/10 text-amber-200",
    blue: "border-blue-300/25 bg-blue-300/10 text-blue-200",
    cyan: "border-cyan-300/25 bg-cyan-300/10 text-cyan-200",
    green: "border-emerald-300/25 bg-emerald-300/10 text-emerald-200",
    red: "border-red-300/25 bg-red-300/10 text-red-200",
    slate: "border-slate-400/20 bg-slate-400/8 text-slate-300",
    violet: "border-violet-300/25 bg-violet-300/10 text-violet-200",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold",
        tones[tone],
      )}
    >
      {label}
    </span>
  );
}

export function SpecialtyTags({ labels }: { labels: string[] }) {
  if (!labels.length) {
    return <span className="text-xs text-slate-600">Sem especialidade ativa</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {labels.slice(0, 3).map((label) => (
        <span
          className="rounded-md border border-blue-300/15 bg-blue-400/[0.07] px-2 py-1 text-[10px] font-semibold text-blue-200"
          key={label}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

export function PageFooter({
  currentPage,
  itemLabel,
  onPage,
  pageSize,
  total,
}: {
  currentPage: number;
  itemLabel: string;
  onPage: (page: number) => void;
  pageSize: number;
  total: number;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total);
  return (
    <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-white/8 bg-[#0b1628]/72 px-5 py-4 text-xs text-slate-500 sm:flex-row">
      <span>
        Exibindo {start}-{end} de {total} {itemLabel}
      </span>
      <div className="flex gap-1.5">
        {Array.from({ length: pageCount }, (_, index) => index + 1).map(
          (page) => (
            <button
              className={cn(
                "h-9 min-w-9 rounded-lg border border-transparent px-2 font-mono transition",
                page === currentPage
                  ? "border-cyan-300/35 bg-cyan-300/12 text-cyan-200"
                  : "text-slate-500 hover:bg-white/[0.04] hover:text-white",
              )}
              key={page}
              onClick={() => onPage(page)}
              type="button"
            >
              {page}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

export function DataState({
  error,
  loading,
  noun,
}: {
  error: string | null;
  loading: boolean;
  noun: string;
}) {
  if (loading) {
    return (
      <div className="rounded-3xl border border-dashed border-cyan-200/12 bg-[#0b1628]/60 p-10 text-center text-sm text-slate-500">
        Carregando {noun}...
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-3xl border border-red-300/15 bg-red-300/[0.04] p-8 text-sm text-red-200/80">
        Falha ao carregar {noun}: {error}
      </div>
    );
  }
  return null;
}
