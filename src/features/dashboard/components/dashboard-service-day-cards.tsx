"use client";

import { Award, Dog, ShieldCheck } from "lucide-react";

import type {
  ServiceDayCrew,
  ServiceDayMember,
  ServiceDayShift,
  ServiceDogMember,
} from "./dashboard-types";
import { PngIcon } from "./png-icon";
import { HudStatusDot } from "@/components/hud-status-dot";

/* ─── Avatar ─── */

function MemberAvatar({
  photoUrl,
  callsign,
  size = "sm",
}: {
  photoUrl?: string;
  callsign: string;
  size?: "sm" | "md";
}) {
  const initials = callsign
    .split(/[\s-]+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const sizeClasses = size === "sm"
    ? "h-7 w-7 text-[10px]"
    : "h-10 w-10 text-xs";

  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt={callsign}
        className={`${sizeClasses} rounded-full object-cover ring-1 ring-white/20`}
        src={photoUrl}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses} flex shrink-0 items-center justify-center rounded-full bg-cyan-500/20 font-bold text-cyan-200 ring-1 ring-cyan-400/30`}
    >
      {(initials || callsign[0]?.toUpperCase()) ?? "?"}
    </div>
  );
}

/* ─── Dog Avatar ─── */

function DogAvatar({
  photoUrl,
  name,
}: {
  photoUrl?: string;
  name: string;
}) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt={name}
        className="h-10 w-10 rounded-full object-cover ring-1 ring-amber-400/30"
        src={photoUrl}
      />
    );
  }

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/20 ring-1 ring-amber-400/30">
      <Dog className="h-5 w-5 text-amber-300" />
    </div>
  );
}

/* ─── Tag Instrutor K9 ─── */

function InstructorTag() {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full border border-violet-400/30 bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-300">
      <Award className="h-2.5 w-2.5" />
      Instrutor K9
    </span>
  );
}

/* ─── GCM Member chip ─── */

function MemberChip({ member }: { member: ServiceDayMember & { role?: string } }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-2">
      <MemberAvatar callsign={member.callsign} photoUrl={member.photoUrl} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">
          {member.callsign}
        </p>
        <p className="font-mono text-[10px] text-cyan-300/70">RA {member.ra}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {member.isK9Instructor && <InstructorTag />}
        {member.role && member.role !== "Integrante" && (
          <span className="rounded-full border border-cyan-400/25 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-cyan-200">
            {member.role}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Crew member row ─── */

function CrewMemberRow({
  member,
}: {
  member: ServiceDayMember & { role: string };
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2">
      <MemberAvatar callsign={member.callsign} photoUrl={member.photoUrl} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">
          {member.callsign}
        </p>
        <p className="font-mono text-[10px] text-cyan-300/70">RA {member.ra}</p>
      </div>
      <div className="flex items-center gap-1.5">
        {member.isK9Instructor && <InstructorTag />}
        <span className="rounded-full border border-cyan-400/25 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-200">
          {member.role}
        </span>
      </div>
    </div>
  );
}

/* ─── Card 1 — Plantão de serviço ─── */

export function PlantaoCard({ shifts }: { shifts: ServiceDayShift[] }) {
  return (
    <article className="relative min-h-[320px] overflow-hidden rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
      {/* Background image */}
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-right"
        style={{ backgroundImage: "url('/assets/card_plantao.png')" }}
      />
      {/* Gradient overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0b1628]/[0.97] via-[#0b1628]/[0.88] to-transparent" />

      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-500/10 text-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.15)]">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-white">Plantão de serviço</h2>
            <p className="text-sm text-slate-400">GCMs escalados no dia.</p>
          </div>
        </div>

        {shifts.length === 0 ? (
          <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-10 text-center">
            <ShieldCheck className="h-8 w-8 text-slate-600" />
            <p className="mt-3 text-sm font-semibold text-slate-500">
              Nenhum plantão ativo hoje
            </p>
            <p className="mt-1 text-xs text-slate-600">
              A escala de hoje não possui GCMs vinculados.
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {shifts.map((shift) => (
              <div key={shift.id}>
                {/* Seal */}
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 shadow-[inset_0_0_14px_rgba(34,211,238,0.06)]">
                  <HudStatusDot color="cyan" size={6} />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100">
                    Hoje · Plantão {shift.name}
                  </span>
                </div>

                {shift.members.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Nenhum GCM vinculado a este plantão.
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {shift.members.map((member) => (
                      <MemberChip key={member.id} member={member} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

/* ─── Card 2 — Equipe de serviço ─── */

export function EquipeCard({ crew }: { crew: ServiceDayCrew | null }) {
  return (
    <article className="relative min-h-[320px] overflow-hidden rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
      {/* Background image */}
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-right"
        style={{ backgroundImage: "url('/assets/card_equipe.png')" }}
      />
      {/* Gradient overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0b1628]/[0.97] via-[#0b1628]/[0.88] to-transparent" />

      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-center gap-3">
          <PngIcon
            alt="Equipe de serviço"
            fallbackTone="emerald"
            size={48}
            src="/assets/icones/equipe_servico.png"
          />
          <div>
            <h2 className="text-lg font-bold text-white">Equipe de serviço</h2>
            <p className="text-sm text-slate-400">Guarnição em operação.</p>
          </div>
        </div>

        {!crew ? (
          <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-10 text-center">
            <ShieldCheck className="h-8 w-8 text-slate-600" />
            <p className="mt-3 text-sm font-semibold text-slate-500">
              Nenhuma equipe em serviço
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Não há viatura com guarnição ativa no momento.
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {/* Vehicle badge */}
            <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 shadow-[inset_0_0_14px_rgba(16,185,129,0.06)]">
              <HudStatusDot color="emerald" size={6} />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-100">
                {crew.vehicleLabel} · Em serviço
              </span>
            </div>

            {/* Vehicle info */}
            <p className="text-sm font-medium text-slate-300">
              {crew.vehicleModel && crew.vehicleModel !== crew.vehicleLabel
                ? crew.vehicleModel
                : null}
              {crew.vehicleUnit ? ` · ${crew.vehicleUnit}` : ""}
            </p>

            {/* Crew members */}
            <div className="grid gap-2 sm:grid-cols-2">
              {crew.members.map((member) => (
                <MemberChip key={member.id} member={member} />
              ))}
            </div>

            {/* K9 */}
            {crew.dog && (
              <div className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/5 p-3">
                <div className="flex items-center gap-2.5">
                  <DogAvatar name={crew.dog!.name} photoUrl={crew.dog!.photoUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">
                      {crew.dog!.name}
                    </p>
                    <p className="text-xs text-slate-400">K9 · binômio operacional</p>
                  </div>
                </div>
                {crew.dog!.specializations.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {crew.dog!.specializations.map((spec) => (
                      <span
                        key={spec}
                        className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300"
                      >
                        {spec}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
