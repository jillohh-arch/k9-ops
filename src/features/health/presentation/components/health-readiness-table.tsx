/**
 * K9 Ops Web — Health Web v1 HW-3C
 * Main readiness list for /health/readiness
 *
 * Follows approved mockup HW-M02-READINESS-v1.png column composition:
 * K9 | Prontidão atual | Motivo principal | Restrições | Última atualização |
 * Estado da leitura | Fonte | Ação
 *
 * CRITICAL MANDATES:
 * - INVARIANT: missing projection !== not_evaluated (§15/§16).
 * - partial != conflict (§19/§20).
 * - Read-only: no mutation controls whatsoever (§17).
 * - No raw Firestore path, no schema_version, no wire enum exposed (§14).
 * - Status never conveyed by colour alone: every badge carries an icon + text.
 */

import Link from "next/link";
import {
  Dog,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ShieldOff,
  HelpCircle,
  ShieldAlert,
  GitCompareArrows,
  RotateCcw,
  SearchX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { QualityStateLabel, ReadinessListItem, ReadinessStatus } from "../../domain/readiness-types";

interface HealthReadinessTableProps {
  items: ReadinessListItem[];
  /** True when filters/search are narrowing the list (changes the empty copy). */
  filtersActive: boolean;
  onResetFilters: () => void;
}

interface BadgeStyle {
  label: string;
  bg: string;
  text: string;
  border: string;
  icon: typeof CheckCircle2;
}

const STATUS_BADGES: Record<ReadinessStatus, BadgeStyle> = {
  operational: {
    label: "Operacional",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
    icon: CheckCircle2,
  },
  operational_attention: {
    label: "Operacional com atenção",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
    icon: AlertTriangle,
  },
  fit_with_restrictions: {
    label: "Apto com restrições",
    bg: "bg-indigo-500/10",
    text: "text-indigo-300",
    border: "border-indigo-500/20",
    icon: AlertCircle,
  },
  temporarily_unfit: {
    label: "Temporariamente inapto",
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/20",
    icon: ShieldOff,
  },
  not_evaluated: {
    label: "Não avaliado",
    bg: "bg-muted/40",
    text: "text-slate-300",
    border: "border-border/70",
    icon: HelpCircle,
  },
};

/**
 * TECHNICAL state badge — NOT an operational readiness status.
 * Rendered when there is no valid canonical projection, so that "Não avaliado"
 * (a real Backend status) is never fabricated.
 */
const MISSING_PROJECTION_BADGE: BadgeStyle = {
  label: "Sem projeção válida",
  bg: "bg-muted/40",
  text: "text-muted-foreground",
  border: "border-border/70",
  icon: HelpCircle,
};

const QUALITY_STYLES: Record<QualityStateLabel, string> = {
  Atualizada: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Desatualizada: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  Parcial: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Conflito: "bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20",
  "Sem projeção válida": "bg-muted/40 text-muted-foreground border-border/70",
};

function formatUpdatedAt(updatedAt: Date | null): string {
  if (!updatedAt) return "—";

  return updatedAt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function StatusBadge({ badge }: { badge: BadgeStyle }) {
  const Icon = badge.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        badge.bg,
        badge.text,
        badge.border,
      )}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>{badge.label}</span>
    </span>
  );
}

export function HealthReadinessTable({
  items,
  filtersActive,
  onResetFilters,
}: HealthReadinessTableProps) {
  if (items.length === 0) {
    return (
      /*
        Two distinct meanings, kept distinct: zero RESULTS from filtering is not
        the same as zero K9s in scope, and neither is a technical failure.
      */
      <div
        className="flex flex-col items-center justify-center rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 px-6 py-10 text-center shadow-[0_24px_80px_rgba(0,0,0,0.24)]"
        data-testid="health-readiness-no-results"
      >
        <span
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-2xl border",
            filtersActive
              ? "border-cyan-300/25 bg-cyan-300/[0.08] text-cyan-300"
              : "border-slate-500/25 bg-slate-500/10 text-slate-300",
          )}
        >
          {filtersActive ? (
            <SearchX className="h-7 w-7" aria-hidden="true" />
          ) : (
            <Dog className="h-7 w-7" aria-hidden="true" />
          )}
        </span>

        <p
          className={cn(
            "mt-3.5 text-[10px] font-black uppercase tracking-[0.22em]",
            filtersActive ? "text-cyan-300/80" : "text-slate-400",
          )}
        >
          {filtersActive ? "Filtros operacionais" : "Efetivo monitorado"}
        </p>

        <p className="mt-1.5 text-sm font-semibold text-foreground">
          {filtersActive
            ? "Nenhum K9 corresponde aos filtros aplicados."
            : "Nenhum K9 disponível no escopo atual."}
        </p>

        {filtersActive && (
          <button
            type="button"
            onClick={onResetFilters}
            className={cn(
              "mt-4 inline-flex items-center gap-1.5 rounded-xl border border-cyan-300/25 bg-cyan-300/[0.08] px-3.5 py-1.5 text-xs font-semibold text-cyan-200 transition-colors",
              "hover:bg-cyan-300/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Limpar filtros</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 shadow-[0_24px_80px_rgba(0,0,0,0.24)]"
      data-testid="health-readiness-table"
    >
      {/* Desktop/tablet: semantic table. Narrow widths reflow to stacked cards below. */}
      <div className="hidden lg:block">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">
            Prontidão operacional consolidada do efetivo K9, com estado da leitura canônica.
          </caption>
          <thead>
            <tr className="border-b border-border bg-muted/30 text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
              <th className="px-4 py-3 font-medium" scope="col">
                K9
              </th>
              <th className="px-3 py-3 font-medium" scope="col">
                Prontidão atual
              </th>
              <th className="px-3 py-3 font-medium" scope="col">
                Motivo principal
              </th>
              <th className="px-3 py-3 font-medium" scope="col">
                Restrições
              </th>
              <th className="px-3 py-3 font-medium" scope="col">
                Última atualização
              </th>
              <th className="px-3 py-3 font-medium" scope="col">
                Estado da leitura
              </th>
              <th className="px-3 py-3 font-medium" scope="col">
                Fonte
              </th>
              <th className="px-4 py-3 text-right font-medium" scope="col">
                Ação
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {items.map((item) => {
              const valid = item.summary !== null;
              const badge = valid
                ? STATUS_BADGES[item.readinessStatus] ?? MISSING_PROJECTION_BADGE
                : MISSING_PROJECTION_BADGE;
              const restrictionCount = item.activeRestrictionsSummary.length;

              return (
                <tr
                  key={item.dog.id}
                  className="transition-colors hover:bg-cyan-300/[0.04] focus-within:bg-cyan-300/[0.06]"
                >
                  <th className="px-4 py-3 font-normal" scope="row">
                    <div className="flex items-center gap-2.5">
                      {/*
                        Rounded-rect frame with a cyan edge (HW-M02 + homologated
                        /health), kept at 36px so dense rows stay compact.
                      */}
                      {item.dog.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.dog.photoUrl}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded-lg border border-cyan-200/20 object-cover"
                        />
                      ) : (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-200/20 bg-muted/60 text-muted-foreground">
                          <Dog className="h-4 w-4" aria-hidden="true" />
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground">{item.dog.name}</span>
                        {item.dog.registrationNumber && (
                          <span className="font-mono text-[10px] text-muted-foreground">
                            MAT.: {item.dog.registrationNumber}
                          </span>
                        )}
                        {item.dog.conductor && (
                          <span className="text-[10px] text-muted-foreground">
                            Condutor: {item.dog.conductor.name ?? item.dog.conductor.ra}
                          </span>
                        )}
                      </div>
                    </div>
                  </th>

                  <td className="px-3 py-3">
                    <StatusBadge badge={badge} />
                  </td>

                  <td className="max-w-[16rem] px-3 py-3 text-muted-foreground">
                    {valid
                      ? item.reason || "Sem observações de prontidão."
                      : "A prontidão operacional ainda não pôde ser determinada."}
                  </td>

                  <td className="px-3 py-3">
                    {!valid ? (
                      <span className="text-muted-foreground">—</span>
                    ) : restrictionCount === 0 ? (
                      <span className="text-muted-foreground">Nenhuma restrição ativa</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[11px] font-semibold text-indigo-300">
                        <ShieldAlert className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span>
                          {restrictionCount} {restrictionCount === 1 ? "restrição" : "restrições"}
                        </span>
                      </span>
                    )}
                  </td>

                  <td className="whitespace-nowrap px-3 py-3 font-mono text-[11px] text-muted-foreground">
                    {formatUpdatedAt(item.updatedAt)}
                  </td>

                  <td className="px-3 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold",
                        QUALITY_STYLES[item.qualityLabel],
                      )}
                    >
                      {item.conflict?.hasConflict && (
                        <GitCompareArrows className="h-3 w-3 shrink-0" aria-hidden="true" />
                      )}
                      <span>{item.qualityLabel}</span>
                    </span>
                  </td>

                  <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                    Fonte: Canônica
                  </td>

                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/health/readiness/${item.dog.id}`}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-xl border border-border bg-background/60 px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm transition-colors",
                        "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      )}
                      aria-label={`Ver cockpit de prontidão do K9 ${item.dog.name}`}
                    >
                      <span>Ver cockpit</span>
                      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/*
        Tablet/mobile: the 8-column table is not forced into 1024px (HW-3B lesson).
        Secondary detail moves into row subtext; hierarchy and full labels survive.
      */}
      <ul className="divide-y divide-border/40 lg:hidden" data-testid="health-readiness-cards">
        {items.map((item) => {
          const valid = item.summary !== null;
          const badge = valid
            ? STATUS_BADGES[item.readinessStatus] ?? MISSING_PROJECTION_BADGE
            : MISSING_PROJECTION_BADGE;
          const restrictionCount = item.activeRestrictionsSummary.length;

          return (
            <li key={item.dog.id} className="flex flex-col gap-2.5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  {item.dog.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.dog.photoUrl}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-xl border border-cyan-200/20 object-cover"
                    />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-200/20 bg-muted/60 text-muted-foreground">
                      <Dog className="h-5 w-5" aria-hidden="true" />
                    </div>
                  )}
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {item.dog.name}
                    </span>
                    {item.dog.registrationNumber && (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        MAT.: {item.dog.registrationNumber}
                      </span>
                    )}
                    {item.dog.conductor && (
                      <span className="truncate text-[10px] text-muted-foreground">
                        Condutor: {item.dog.conductor.name ?? item.dog.conductor.ra}
                      </span>
                    )}
                  </div>
                </div>

                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold",
                    QUALITY_STYLES[item.qualityLabel],
                  )}
                >
                  {item.qualityLabel}
                </span>
              </div>

              <StatusBadge badge={badge} />

              <p className="text-xs text-muted-foreground">
                {valid
                  ? item.reason || "Sem observações de prontidão."
                  : "A prontidão operacional ainda não pôde ser determinada."}
              </p>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span>
                  {!valid
                    ? "Restrições: —"
                    : restrictionCount === 0
                      ? "Nenhuma restrição ativa"
                      : `${restrictionCount} ${restrictionCount === 1 ? "restrição ativa" : "restrições ativas"}`}
                </span>
                <span className="font-mono">{formatUpdatedAt(item.updatedAt)}</span>
                <span>Fonte: Canônica</span>
              </div>

              <Link
                href={`/health/readiness/${item.dog.id}`}
                className={cn(
                  "inline-flex w-fit items-center gap-1 rounded-lg border border-border/80 bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors",
                  "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
                aria-label={`Ver cockpit de prontidão do K9 ${item.dog.name}`}
              >
                <span>Ver cockpit</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
