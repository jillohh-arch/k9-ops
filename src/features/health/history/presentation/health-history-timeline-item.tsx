"use client";

/**
 * K9 Ops Web — Health Web v1 F30 History
 * Timeline item presentation card.
 *
 * Implements §24.4 of HEALTH_WEB_INFORMATION_ARCHITECTURE:
 * Displays category, K9, title, summary, effective date, registration date,
 * actor, professional, source entity, impact, canonical/legacy indicator, link.
 */

import Link from "next/link";
import {
  Calendar,
  ExternalLink,
  ShieldAlert,
  Stethoscope,
  User,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { HealthTimelineItem } from "../domain/health-history-types";

interface HealthHistoryTimelineItemProps {
  item: HealthTimelineItem;
}

export function HealthHistoryTimelineItem({ item }: HealthHistoryTimelineItemProps) {
  const getCategoryConfig = (cat: HealthTimelineItem["category"]) => {
    switch (cat) {
      case "clinical":
        return {
          label: "Clínico",
          badgeTone: "green" as const,
          icon: <Stethoscope className="h-4 w-4 text-emerald-400" aria-hidden="true" />,
          dotColor: "bg-emerald-400 ring-emerald-400/30",
        };
      case "schedule":
        return {
          label: "Agenda",
          badgeTone: "cyan" as const,
          icon: <Calendar className="h-4 w-4 text-cyan-400" aria-hidden="true" />,
          dotColor: "bg-cyan-400 ring-cyan-400/30",
        };
      case "restriction":
        return {
          label: "Restrição",
          badgeTone: "yellow" as const,
          icon: <ShieldAlert className="h-4 w-4 text-amber-400" aria-hidden="true" />,
          dotColor: "bg-amber-400 ring-amber-400/30",
        };
    }
  };

  const getImpactBadge = (impact: HealthTimelineItem["impact"]) => {
    switch (impact) {
      case "unfit":
        return <Badge tone="red">Inapto</Badge>;
      case "high":
        return <Badge tone="yellow">Restrição Alta</Badge>;
      case "medium":
        return <Badge tone="yellow">Atenção</Badge>;
      case "low":
        return <Badge tone="cyan">Baixo Impacto</Badge>;
      case "none":
        return <Badge tone="slate">Sem Impacto</Badge>;
    }
  };

  const config = getCategoryConfig(item.category);

  const formattedEffectiveDate =
    item.effectiveDate.getTime() > 0
      ? item.effectiveDate.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : "Data não registrada";

  const formattedRegistrationDate =
    item.registrationDate && item.registrationDate.getTime() > 0
      ? item.registrationDate.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : null;

  const showRegistrationDiff =
    formattedRegistrationDate &&
    formattedRegistrationDate !== formattedEffectiveDate;

  return (
    <div
      className="relative flex gap-4 pl-2 sm:pl-4 group"
      data-testid={`timeline-item-${item.id}`}
    >
      {/* Timeline Node & Connector */}
      <div className="relative flex flex-col items-center">
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-slate-900 shadow-md ring-4",
            config.dotColor
          )}
        >
          {config.icon}
        </div>
        <div className="h-full w-0.5 bg-gradient-to-b from-white/20 to-white/5 group-last:hidden" />
      </div>

      {/* Card Content */}
      <div className="mb-6 flex-1 rounded-xl border border-white/10 bg-slate-900/60 p-4 shadow-sm transition hover:border-white/20 hover:bg-slate-900/80">
        {/* Header badges and K9 identity */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-white tracking-wide">
              {item.dogName}
            </span>
            {item.dogRegistrationNumber && (
              <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                {item.dogRegistrationNumber}
              </span>
            )}
            <Badge tone={config.badgeTone}>{config.label}</Badge>
            <Badge tone="slate">{item.statusLabel}</Badge>
            {getImpactBadge(item.impact)}
          </div>

          <div className="flex items-center gap-2">
            {item.source === "legacy" ? (
              <Badge tone="yellow" className="text-[10px]">
                Legado
              </Badge>
            ) : (
              <Badge tone="slate" className="text-[10px]">
                Canônico
              </Badge>
            )}
          </div>
        </div>

        {/* Title and summary */}
        <div className="mt-2.5">
          <h4 className="text-sm font-semibold text-slate-100">{item.title}</h4>
          <p className="mt-1 text-xs text-slate-300 leading-relaxed">
            {item.summary}
          </p>
        </div>

        {/* Metadata footer */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-2 text-[11px] text-slate-400">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1 text-slate-300">
              <Clock className="h-3 w-3 text-cyan-400" />
              <span>Data efetiva: {formattedEffectiveDate}</span>
            </span>

            {showRegistrationDiff && (
              <span className="text-slate-500">
                (Registrado em: {formattedRegistrationDate})
              </span>
            )}

            {item.actor && (
              <span className="inline-flex items-center gap-1">
                <User className="h-3 w-3 text-slate-400" />
                <span>Ator: {item.actor}</span>
              </span>
            )}

            {item.professional && (
              <span className="inline-flex items-center gap-1 text-slate-300">
                <Stethoscope className="h-3 w-3 text-emerald-400" />
                <span>Profissional: {item.professional}</span>
              </span>
            )}
          </div>

          {/* Action Link to source entity */}
          <Link
            href={item.link}
            className="inline-flex items-center gap-1 text-xs font-medium text-cyan-400 hover:text-cyan-300 hover:underline"
            data-testid={`timeline-link-${item.id}`}
          >
            <span>Ver detalhes</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
