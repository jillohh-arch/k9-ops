"use client";

/**
 * K9 Ops Web — Health Web v1 F30 Reports
 * Clinical cases reporting table.
 *
 * Displays active cases requiring attention plus cases opened in the active period.
 */

import { useMemo, useState } from "react";
import { Search, Stethoscope, AlertTriangle, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  CLINICAL_CASE_STATUS_LABELS,
  type ClinicalCaseStatus,
} from "../../domain/read-states";
import { CLINICAL_ACTIVE_STATUSES } from "../../clinical/presentation/types";
import type { ClinicalCaseListEntry } from "../../clinical/data/clinical-scope-loader";

interface HealthReportsClinicalTableProps {
  cases: ClinicalCaseListEntry[];
  periodLabel: string;
}

const STATUS_TONES: Record<ClinicalCaseStatus, "green" | "yellow" | "cyan" | "slate" | "red"> = {
  open: "yellow",
  under_investigation: "cyan",
  under_treatment: "yellow",
  monitoring: "cyan",
  discharged: "slate",
  cancelled: "slate",
};

export function HealthReportsClinicalTable({
  cases,
  periodLabel,
}: HealthReportsClinicalTableProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return cases;
    const term = searchTerm.toLowerCase();
    return cases.filter(
      (c) =>
        c.dog.name.toLowerCase().includes(term) ||
        (c.case.title && c.case.title.toLowerCase().includes(term)) ||
        c.dogId.toLowerCase().includes(term)
    );
  }, [cases, searchTerm]);

  return (
    <Card className="border-white/10 bg-slate-900/80">
      <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
            <Stethoscope className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            Casos Clínicos em Acompanhamento
          </CardTitle>
          <p className="text-xs text-slate-400">
            Casos ativos e ocorrências abertas no período ({periodLabel})
          </p>
        </div>

        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
          <Input
            placeholder="Buscar por cão ou caso..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-9 pl-9 text-xs"
          />
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-200">
            <thead className="border-b border-white/10 bg-slate-950/40 text-[11px] uppercase tracking-wider text-slate-400">
              <tr>
                <th scope="col" className="px-4 py-3">Cão</th>
                <th scope="col" className="px-4 py-3">Caso Clínico</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Data de Abertura</th>
                <th scope="col" className="px-4 py-3 text-center">Restrição</th>
                <th scope="col" className="px-4 py-3 text-center">Agenda Pendente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Nenhum caso clínico encontrado para os critérios selecionados.
                  </td>
                </tr>
              ) : (
                filtered.map((entry) => {
                  const c = entry.case;
                  const status = c.clinicalStatus;
                  const statusLabel = status
                    ? CLINICAL_CASE_STATUS_LABELS[status] ?? c.rawClinicalStatus ?? "Desconhecido"
                    : c.rawClinicalStatus ?? "Não informado";
                  const tone = status ? STATUS_TONES[status] ?? "slate" : "slate";
                  const isActive = status ? CLINICAL_ACTIVE_STATUSES.includes(status) : false;

                  return (
                    <tr
                      key={entry.entryId}
                      className="transition-colors hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3 font-semibold text-white">
                        <div>{entry.dog.name}</div>
                        {entry.dog.registrationNumber && (
                          <div className="text-[10px] text-slate-400">
                            {entry.dog.registrationNumber}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-200">
                          {c.title ?? `Caso #${c.caseId}`}
                        </div>
                        {isActive && (
                          <span className="text-[10px] text-emerald-400">
                            Em andamento
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={tone}>{statusLabel}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {c.openedAt ? (
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            {c.openedAt.toLocaleDateString("pt-BR")}
                          </div>
                        ) : (
                          <span className="text-slate-500">Não informada</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {c.hasActiveRestriction === true ? (
                          <Badge tone="red">Ativa</Badge>
                        ) : c.hasActiveRestriction === false ? (
                          <span className="text-slate-500">-</span>
                        ) : (
                          <span className="text-slate-500">N/D</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {c.hasPendingSchedule === true ? (
                          <Badge tone="cyan">Sim</Badge>
                        ) : c.hasPendingSchedule === false ? (
                          <span className="text-slate-500">-</span>
                        ) : (
                          <span className="text-slate-500">N/D</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
