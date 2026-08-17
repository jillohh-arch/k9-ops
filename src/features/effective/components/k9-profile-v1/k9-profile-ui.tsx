"use client";

import type { LucideIcon } from "lucide-react";

import type { K9ProfileTone } from "@/features/effective/lib/k9-profile-status";
import { cn } from "@/lib/utils";

/**
 * Primitivas visuais do Perfil K9 V1.
 *
 * Mesma linguagem do Efetivo K9 (superfícies `#0b1628`, borda cyan sutil,
 * labels em caps com tracking largo). Cor nunca é o único sinal: todo tom vem
 * acompanhado de texto.
 */

export const TONE_PILL: Record<K9ProfileTone, string> = {
  amber: "border-amber-300/25 bg-amber-300/10 text-amber-200",
  cyan: "border-cyan-300/25 bg-cyan-300/10 text-cyan-200",
  green: "border-emerald-300/25 bg-emerald-300/10 text-emerald-200",
  red: "border-red-300/25 bg-red-300/10 text-red-200",
  slate: "border-slate-400/20 bg-slate-400/[0.08] text-slate-300",
  violet: "border-violet-300/25 bg-violet-300/10 text-violet-200",
};

export const TONE_ICON: Record<K9ProfileTone, string> = {
  amber: "text-amber-300",
  cyan: "text-cyan-300",
  green: "text-emerald-300",
  red: "text-red-300",
  slate: "text-slate-500",
  violet: "text-violet-300",
};

export function ProfilePill({
  label,
  tone = "slate",
}: {
  label: string;
  tone?: K9ProfileTone;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-bold",
        TONE_PILL[tone],
      )}
    >
      {label}
    </span>
  );
}

/** Card de conteúdo do Perfil. `title` vira um heading real (h3). */
export function ProfileCard({
  action,
  children,
  className,
  title,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col rounded-2xl border border-cyan-200/12 bg-[#0b1628]/82 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.18)]",
        className,
      )}
    >
      {title ? (
        <div className="mb-3 flex items-start justify-between gap-2">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
            {title}
          </h3>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Par label/valor. `dl`/`dt`/`dd` para que leitores de tela associem os dois. */
export function ProfileField({
  label,
  mono,
  value,
}: {
  label: string;
  mono?: boolean;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-0.5 truncate text-[13px] font-semibold text-slate-200",
          mono && "font-mono",
        )}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

/** Estado vazio honesto: diz o que falta, sem sugerir que o valor é zero. */
export function ProfileEmpty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs leading-relaxed text-slate-400">{children}</p>;
}

export function ProfileError({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="rounded-xl border border-red-300/20 bg-red-300/[0.06] p-3 text-xs leading-relaxed text-red-200/85"
      role="status"
    >
      {children}
    </p>
  );
}

export function ProfileSkeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "block animate-pulse rounded-xl bg-white/[0.06] motion-reduce:animate-none",
        className,
      )}
    />
  );
}

/**
 * Linha de estado com ícone + rótulo + detalhe.
 * O ícone é decorativo; a informação vive no texto.
 */
export function ProfileStateRow({
  detail,
  icon: Icon,
  label,
  tone,
}: {
  detail?: string | null;
  icon: LucideIcon;
  label: string;
  tone: K9ProfileTone;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon aria-hidden className={cn("mt-0.5 h-4 w-4 shrink-0", TONE_ICON[tone])} />
      <div className="min-w-0">
        <p className="text-[13px] font-black leading-snug text-white">{label}</p>
        {detail ? (
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
            {detail}
          </p>
        ) : null}
      </div>
    </div>
  );
}

const TONE_BADGE_RING: Record<K9ProfileTone, string> = {
  amber: "border-amber-300/25 bg-amber-300/[0.08] text-amber-200",
  cyan: "border-cyan-300/25 bg-cyan-300/[0.08] text-cyan-200",
  green: "border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-200",
  red: "border-red-300/25 bg-red-300/[0.08] text-red-200",
  slate: "border-slate-400/20 bg-slate-400/[0.06] text-slate-400",
  violet: "border-violet-300/25 bg-violet-300/[0.08] text-violet-200",
};

/**
 * Estado dominante de um card: ícone em medalhão + valor em destaque.
 *
 * Dá hierarquia ao dado principal (o que estava faltando nos cards "planos")
 * sem introduzir número sintético: o valor é sempre um rótulo real vindo da
 * fonte canônica.
 */
export function ProfileHeadlineState({
  detail,
  icon: Icon,
  label,
  tone,
}: {
  detail?: string | null;
  icon: LucideIcon;
  label: string;
  tone: K9ProfileTone;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
          TONE_BADGE_RING[tone],
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        {/* `text-balance` evita uma última linha órfã em rótulos longos. */}
        <p className="text-pretty text-lg font-black leading-[1.15] tracking-tight text-white">
          {label}
        </p>
        {detail ? (
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            {detail}
          </p>
        ) : null}
      </div>
    </div>
  );
}
