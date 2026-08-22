"use client";

import {
  CalendarDays,
  Camera,
  Dog,
  ExternalLink,
  GraduationCap,
  KeyRound,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { useAccessControl } from "@/features/access/providers/access-control-provider";
import { useAccessProfiles } from "@/features/access/hooks/use-access-profiles";
import { StatusPill } from "@/features/effective/components/effective-ui";
import {
  resolveHumanAccessReadModel,
  type HumanAccessReadModel,
} from "@/features/effective/lib/human-access-read-model";
import {
  humanText,
  type HumanRecord,
} from "@/features/effective/hooks/use-human-profile-data";
import { paths } from "@/lib/routes/paths";

export type HumanProfileConfigurationCenterProps = {
  activeShift?: HumanRecord | null;
  certifications?: HumanRecord[];
  linkedDogs?: HumanRecord[];
  ra: string;
  user: Record<string, unknown> | null;
};

export function HumanProfileConfigurationCenter({
  activeShift,
  certifications = [],
  linkedDogs = [],
  ra,
  user,
}: HumanProfileConfigurationCenterProps) {
  const { can } = useAccessControl();
  const { profiles: availableProfiles } = useAccessProfiles();

  const accessReadModel: HumanAccessReadModel = useMemo(
    () => resolveHumanAccessReadModel(user, availableProfiles),
    [user, availableProfiles],
  );

  const photo = humanText(user, "photoUrl", "image_url", "profileImageUrl");
  const isInstructor =
    user?.is_k9_instructor === true ||
    user?.training_instructor === true ||
    humanText(user, "training_role") === "instrutor_k9";

  const canManageAccess = can("access", "view") || can("access", "edit");
  const canEditHuman = can("humans", "edit");

  return (
    <section
      aria-label="Configuração do Integrante"
      className="rounded-3xl border border-cyan-200/15 bg-[#0a172a] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.22)]"
      data-testid="human-profile-configuration-center"
    >
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
            Painel Estrutural
          </span>
          <h2 className="mt-0.5 text-lg font-black tracking-tight text-white">
            CONFIGURAÇÃO DO INTEGRANTE
          </h2>
        </div>
        <p className="text-xs text-slate-400">
          Vínculos operacionais e autorização de sistema.
        </p>
      </div>

      <div className="mt-4 divide-y divide-white/8 overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02]">
        {/* ROW 1: FOTO */}
        <div
          className="flex flex-col justify-between gap-3 p-3.5 sm:flex-row sm:items-center"
          data-testid="config-row-foto"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300">
              <Camera className="h-5 w-5 text-cyan-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  1. Foto do integrante
                </p>
                <StatusPill
                  label={photo ? "Cadastrada" : "Sem foto"}
                  tone={photo ? "green" : "slate"}
                />
              </div>
              <p className="mt-0.5 truncate text-sm font-semibold text-slate-200">
                {photo
                  ? "Foto do perfil vinculada"
                  : "Sem foto cadastrada · fluxo pós-cadastro"}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 text-xs text-slate-500 sm:shrink-0">
            <span className="rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-1 font-mono text-[11px] text-slate-400">
              STATUS LEITURA
            </span>
          </div>
        </div>

        {/* ROW 2: ACESSO AO SISTEMA */}
        <div
          className="flex flex-col justify-between gap-3 p-3.5 sm:flex-row sm:items-center"
          data-testid="config-row-acesso"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300">
              <KeyRound className="h-5 w-5 text-cyan-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  2. Acesso ao sistema
                </p>
                <StatusPill
                  label={accessReadModel.statusLabel}
                  tone={
                    accessReadModel.status === "configured"
                      ? "green"
                      : accessReadModel.status === "incomplete"
                        ? "amber"
                        : "slate"
                  }
                />
              </div>
              <p className="mt-0.5 truncate text-sm font-semibold text-slate-200">
                {accessReadModel.status === "configured"
                  ? accessReadModel.profileName ?? "Perfil ativo"
                  : accessReadModel.detail}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 sm:shrink-0">
            {canManageAccess ? (
              <Link
                className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-300/25 bg-cyan-300/[0.08] px-3 py-1.5 text-xs font-bold text-cyan-200 transition hover:bg-cyan-300/[0.16]"
                href={paths.access}
              >
                Gerenciar em Acessos <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <span className="rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-1 font-mono text-[11px] text-slate-400">
                STATUS LEITURA
              </span>
            )}
          </div>
        </div>

        {/* ROW 3: CAPACITAÇÕES */}
        <div
          className="flex flex-col justify-between gap-3 p-3.5 sm:flex-row sm:items-center"
          data-testid="config-row-capacitacoes"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300">
              <GraduationCap className="h-5 w-5 text-cyan-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  3. Capacitações
                </p>
                {isInstructor ? (
                  <StatusPill label="Instrutor K9" tone="amber" />
                ) : certifications.length > 0 ? (
                  <StatusPill
                    label={`${certifications.length} certificação(ões)`}
                    tone="blue"
                  />
                ) : (
                  <StatusPill label="Sem registros" tone="slate" />
                )}
              </div>
              <p className="mt-0.5 truncate text-sm font-semibold text-slate-200">
                {certifications.length > 0
                  ? `${certifications.length} curso(s) ou certificação(ões) ativa(s)`
                  : isInstructor
                    ? "Habilitado como Instrutor K9"
                    : "Nenhuma capacitação registrada"}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 sm:shrink-0">
            <Link
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-white/[0.08]"
              href={`/humans/${encodeURIComponent(ra)}/history`}
            >
              Ver histórico
            </Link>
          </div>
        </div>

        {/* ROW 4: BINÔMIO */}
        <div
          className="flex flex-col justify-between gap-3 p-3.5 sm:flex-row sm:items-center"
          data-testid="config-row-binomio"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300">
              <Dog className="h-5 w-5 text-cyan-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  4. Binômio K9
                </p>
                <StatusPill
                  label={
                    linkedDogs.length > 0
                      ? `${linkedDogs.length} K9 vinculado(s)`
                      : "Sem binômio"
                  }
                  tone={linkedDogs.length > 0 ? "green" : "slate"}
                />
              </div>
              <p className="mt-0.5 truncate text-sm font-semibold text-slate-200">
                {linkedDogs.length > 0
                  ? linkedDogs
                      .map((d) => humanText(d, "name", "nome") ?? d._id)
                      .join(", ")
                  : "Sem binômio vinculado"}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 sm:shrink-0">
            {linkedDogs.length > 0 ? (
              <Link
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-white/[0.08]"
                href={`/k9/${encodeURIComponent(linkedDogs[0]._id)}`}
              >
                Ver K9 <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <span className="rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-1 font-mono text-[11px] text-slate-400">
                STATUS LEITURA
              </span>
            )}
          </div>
        </div>

        {/* ROW 5: ESCALA */}
        <div
          className="flex flex-col justify-between gap-3 p-3.5 sm:flex-row sm:items-center"
          data-testid="config-row-escala"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300">
              <CalendarDays className="h-5 w-5 text-cyan-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  5. Escala operacional
                </p>
                <StatusPill
                  label={activeShift ? "Em turno" : "Sem turno ativo"}
                  tone={activeShift ? "green" : "slate"}
                />
              </div>
              <p className="mt-0.5 truncate text-sm font-semibold text-slate-200">
                {activeShift
                  ? humanText(
                      activeShift,
                      "vehicle_label",
                      "vehicle_prefix",
                      "shiftId",
                    ) ?? "Turno operacional em andamento"
                  : "Disponibilidade operacional não vinculada"}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 text-xs text-slate-500 sm:shrink-0">
            <span className="rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-1 font-mono text-[11px] text-slate-400">
              STATUS LEITURA
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
