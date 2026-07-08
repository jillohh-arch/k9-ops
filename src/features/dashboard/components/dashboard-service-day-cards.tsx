"use client";

import { Award, Clock, Dog, MapPin, ShieldCheck, Truck } from "lucide-react";

import type {
  ServiceDayCrew,
  ServiceDayMember,
  ServiceDayShift,
  ServiceDogMember,
} from "./dashboard-types";
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

/* ─── Subcomponents — Crew Slot Card (filled or vacant) ─── */

function CrewSlotCard({
  slotRole,
  member,
}: {
  slotRole: string;
  member?: ServiceDayMember & { role: string };
}) {
  if (!member) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/12 bg-white/[0.015] px-2 py-3 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-white/15 bg-white/[0.03]">
          <span className="text-[10px] font-bold text-slate-600">{slotRole}</span>
        </div>
        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-600">
          Posto vago
        </p>
      </div>
    );
  }

  const isLeader = slotRole === "ENC";

  return (
    <div
      className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 text-center ${
        isLeader
          ? "border-cyan-400/30 bg-cyan-500/[0.06] shadow-[0_0_12px_rgba(34,211,238,0.08)]"
          : "border-white/8 bg-white/[0.025]"
      }`}
    >
      <MemberAvatar
        callsign={member.callsign}
        photoUrl={member.photoUrl}
        size="md"
      />
      <div className="w-full min-w-0">
        <p className="truncate text-xs font-semibold text-white">
          {member.callsign}
        </p>
        <p className="font-mono text-[9px] text-cyan-300/60">RA {member.ra}</p>
      </div>
      <span className="rounded-full border border-cyan-400/25 bg-cyan-500/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-cyan-200">
        {member.role}
      </span>
      {member.isK9Instructor && (
        <span className="rounded-full border border-violet-400/25 bg-violet-500/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-violet-300">
          Condutor K9
        </span>
      )}
    </div>
  );
}

/* ─── Subcomponents — K9 Operational Panel ─── */

function K9OperationalPanel({
  dog,
  conductorName,
}: {
  dog: ServiceDogMember;
  conductorName?: string;
}) {
  const breedLabel = dog.breed || (dog.specializations.length > 0 ? dog.specializations[0] : undefined);
  const statusLabel = dog.status || "Pronto para emprego";

  return (
    <div className="flex h-full flex-col rounded-xl border border-amber-400/25 bg-amber-500/[0.04] p-3">
      {/* Section label */}
      <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.15em] text-amber-400/70">
        K9 Operacional
      </p>
      <div className="flex items-start gap-2.5">
        <DogAvatar name={dog.name} photoUrl={dog.photoUrl} />
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="truncate text-sm font-bold text-white">{dog.name}</p>
          <p className="text-[11px] text-slate-400">
            K9{breedLabel ? ` · ${breedLabel}` : ""}
          </p>
          {conductorName && (
            <p className="text-[10px] text-amber-300/80">
              <span className="font-semibold uppercase tracking-wider">
                Binômio
              </span>{" "}
              com {conductorName}
            </p>
          )}
        </div>
      </div>

      {/* Status */}
      <div className="mt-auto pt-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">
          <HudStatusDot color="amber" size={5} pulse={false} />
          {statusLabel}
        </span>
      </div>

      {/* Specializations */}
      {dog.specializations.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {dog.specializations.map((spec) => (
            <span
              key={spec}
              className="rounded-full border border-amber-400/15 bg-amber-500/8 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-200/80"
            >
              {spec}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Crew completeness helper ─── */

const CREW_SLOTS = ["ENC", "MOT", "AUX1", "AUX2"] as const;

function isCrewOperational(members: Array<ServiceDayMember & { role: string }>) {
  // Operacional = pelo menos motorista E encarregado ativos
  const roles = new Set(members.map((m) => m.role));
  return roles.has("MOT") && roles.has("ENC");
}

function formatCrewTime(isoOrTimestamp: string | undefined): string {
  if (!isoOrTimestamp) return "";
  try {
    const date = new Date(isoOrTimestamp);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

/* ─── Card 2 — Equipe de serviço ─── */

export function EquipeCard({ crew }: { crew: ServiceDayCrew | null }) {
  // Determine conductor name (first member who is K9 instructor, or titular)
  const conductorName = crew?.members.find((m) => m.isK9Instructor)?.callsign
    ?? crew?.members[0]?.callsign;

  // Map members to slots
  const memberByRole = new Map(
    crew?.members.map((m) => [m.role, m]) ?? [],
  );

  const operational = crew ? isCrewOperational(crew.members) : false;
  const crewStartTime = crew ? formatCrewTime(crew.createdAt) : "";

  return (
    <article className="relative min-h-[320px] overflow-hidden rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
      {/* Background image */}
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-right"
        style={{ backgroundImage: "url('/assets/card_equipe.png')" }}
      />
      {/* Gradient overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0b1628]/[0.97] via-[#0b1628]/[0.85] to-[#0b1628]/[0.4]" />

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col">
        {/* Section label + online dot */}
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-cyan-400/60">
            Equipe de serviço
          </p>
          {crew && (
            <div className="flex items-center gap-1.5">
              <HudStatusDot color="emerald" size={7} />
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                Online
              </span>
            </div>
          )}
        </div>

        {!crew ? (
          /* ─── Estado vazio ─── */
          <div className="mt-4 flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-10 text-center">
            <ShieldCheck className="h-8 w-8 text-slate-600" />
            <p className="mt-3 text-sm font-semibold text-slate-500">
              Nenhuma equipe em serviço
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Não há viatura com guarnição ativa no momento.
            </p>
          </div>
        ) : (
          /* ─── Estado ativo ─── */
          <div className="mt-3 flex flex-1 flex-col space-y-3">
            {/* ─── Header operacional (viatura + status) ─── */}
            <div className="rounded-xl border border-cyan-400/15 bg-cyan-500/[0.04] px-3 py-2.5">
              {/* L1: Vehicle label + status chip */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Truck className="h-4 w-4 shrink-0 text-cyan-300" />
                  <span className="truncate text-sm font-bold text-white">
                    {crew.vehicleLabel}
                  </span>
                  <HudStatusDot color="emerald" size={6} />
                  <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                    Em serviço
                  </span>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                    operational
                      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                      : "border-amber-400/30 bg-amber-500/10 text-amber-300"
                  }`}
                >
                  {operational ? "Operacional" : "Incompleta"}
                </span>
              </div>

              {/* L2: Model + unit */}
              {(crew.vehicleModel || crew.vehicleUnit) && (
                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
                  {crew.vehicleModel && crew.vehicleModel !== crew.vehicleLabel && (
                    <span>{crew.vehicleModel}</span>
                  )}
                  {crew.vehicleModel && crew.vehicleModel !== crew.vehicleLabel && crew.vehicleUnit && (
                    <span className="text-slate-600">·</span>
                  )}
                  {crew.vehicleUnit && (
                    <span className="inline-flex items-center gap-0.5">
                      <MapPin className="h-3 w-3 text-cyan-400/50" />
                      {crew.vehicleUnit}
                    </span>
                  )}
                </p>
              )}

              {/* L3: Shift label + crew start time */}
              {(crew.shiftStart || crewStartTime) && (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                  <Clock className="h-3 w-3 text-cyan-400/50" />
                  {crew.shiftStart && (
                    <span>Turno {crew.shiftStart}{crew.shiftEnd ? `–${crew.shiftEnd}` : ""}</span>
                  )}
                  {crew.shiftStart && crewStartTime && (
                    <span className="text-slate-600">·</span>
                  )}
                  {crewStartTime && (
                    <span>desde {crewStartTime}</span>
                  )}
                </p>
              )}
            </div>

            {/* ─── Bottom section: Slots grid + K9 ─── */}
            <div className="flex flex-1 flex-col gap-3 lg:flex-row">
              {/* Guarnição embarcada — 4 slots always visible */}
              <div className="flex-1">
                <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.15em] text-cyan-400/60">
                  Guarnição embarcada
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {CREW_SLOTS.map((slotRole) => (
                    <CrewSlotCard
                      key={slotRole}
                      slotRole={slotRole}
                      member={memberByRole.get(slotRole)}
                    />
                  ))}
                </div>
              </div>

              {/* K9 panel */}
              {crew.dog && (
                <div className="w-full lg:w-[200px] xl:w-[220px]">
                  <K9OperationalPanel
                    dog={crew.dog}
                    conductorName={conductorName}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
