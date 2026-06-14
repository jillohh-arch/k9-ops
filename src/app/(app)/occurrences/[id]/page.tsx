"use client";

import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Dog,
  FileEdit,
  FileSignature,
  Hash,
  MapPin,
  PawPrint,
  Shield,
  ShieldCheck,
  Siren,
  Truck,
  User,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { DataState } from "@/features/effective/components/effective-ui";
import { useOccurrenceDetail } from "@/features/operations/hooks/use-occurrence-detail";
import type {
  OccurrenceAmendment,
  OccurrenceDetail,
  OccurrenceEvent,
  OccurrenceParticipation,
  OccurrenceSignature,
  OccurrenceStatus,
} from "@/features/operations/types/occurrence-detail";
import { formatDate, formatDateTimeCompact } from "@/lib/format";
import { cn } from "@/lib/utils";

// ─── Constants ──────────────────────────────────────────────────────────────

const statusConfig: Record<
  OccurrenceStatus,
  { label: string; tone: "cyan" | "green" | "yellow" | "red" | "slate" }
> = {
  open: { label: "Aberta", tone: "cyan" },
  in_progress: { label: "Em andamento", tone: "yellow" },
  pending_signatures: { label: "Aguardando assinaturas", tone: "yellow" },
  finalized: { label: "Finalizada", tone: "green" },
  cancelled: { label: "Cancelada", tone: "red" },
};

const eventIcons: Record<string, typeof Clock> = {
  created: Clock,
  started: Siren,
  location_update: MapPin,
  note: FileEdit,
  photo: FileEdit,
  apprehension_registered: Shield,
  team_joined: Users,
  team_left: Users,
  signature_collected: FileSignature,
  amendment_added: FileEdit,
  finalized: CheckCircle2,
  cancelled: Clock,
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function hasRealValue(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed !== "--";
}

// ─── Section wrapper ────────────────────────────────────────────────────────

function Section({
  children,
  title,
  icon: Icon,
  badge,
}: {
  badge?: string;
  children: React.ReactNode;
  icon: typeof Clock;
  title: string;
}) {
  return (
    <section className="rounded-3xl border border-cyan-200/10 bg-[#0b1628]/70 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="text-lg font-bold text-white">{title}</h2>
        {badge ? (
          <span className="ml-auto rounded-full border border-slate-500/25 bg-slate-500/10 px-2.5 py-0.5 text-xs font-semibold text-slate-300">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

// ─── Info row ───────────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: string | null;
}) {
  if (!hasRealValue(value)) return null;
  return (
    <div className="flex items-center gap-3 py-2">
      <Icon className="h-4 w-4 shrink-0 text-slate-500" />
      <span className="text-sm text-slate-400">{label}</span>
      <span className="ml-auto text-sm font-medium text-white">{value}</span>
    </div>
  );
}

// ─── Header ─────────────────────────────────────────────────────────────────

function OccurrenceHeader({ occurrence }: { occurrence: OccurrenceDetail }) {
  const config = statusConfig[occurrence.status] ?? statusConfig.open;

  const startTime = occurrence.start_time ? formatDate(occurrence.start_time, true) : null;
  const endTime = occurrence.end_time ? formatDate(occurrence.end_time, true) : null;

  return (
    <div className="rounded-3xl border border-cyan-200/10 bg-[#0b1628]/70 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-xs font-bold text-cyan-300">
              {occurrence.code || occurrence.id.slice(0, 8).toUpperCase()}
            </p>
            <Badge tone={config.tone}>{config.label}</Badge>
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-white">
            {occurrence.title || occurrence.nature_label || "Ocorrência"}
          </h1>
          {occurrence.description ? (
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              {occurrence.description}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Calendar className="h-3.5 w-3.5" />
          {startTime ?? formatDate(null, true)}
        </div>
      </div>

      {occurrence.nature_label ? (
        <div className="mt-5 flex items-center gap-2 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.06] px-4 py-2.5">
          <Siren className="h-4 w-4 text-cyan-300" />
          <span className="text-sm font-semibold text-cyan-100">{occurrence.nature_label}</span>
        </div>
      ) : null}

      {(occurrence.dog_name || occurrence.handler_name) ? (
        <div className="mt-4 flex flex-wrap gap-4">
          {occurrence.dog_name ? (
            <div className="flex items-center gap-2 rounded-xl border border-amber-300/15 bg-amber-300/[0.05] px-3 py-2">
              <PawPrint className="h-4 w-4 text-amber-300" />
              <span className="text-sm font-semibold text-amber-100">{occurrence.dog_name}</span>
            </div>
          ) : null}
          {occurrence.handler_name ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-300/15 bg-emerald-300/[0.05] px-3 py-2">
              <User className="h-4 w-4 text-emerald-300" />
              <span className="text-sm font-semibold text-emerald-100">{occurrence.handler_name}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 grid gap-px divide-y divide-white/5 rounded-2xl border border-white/5 bg-white/[0.015]">
        <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-3 [&>div]:px-4 [&>div]:py-3">
          <InfoRow icon={Truck} label="Viatura" value={occurrence.vehicle_prefix} />
          <InfoRow icon={MapPin} label="Local" value={occurrence.location_label} />
          <InfoRow icon={Clock} label="Início" value={startTime} />
          <InfoRow icon={Clock} label="Término" value={endTime} />
        </div>
      </div>
    </div>
  );
}

// ─── Timeline ───────────────────────────────────────────────────────────────

function EventTimeline({ events }: { events: OccurrenceEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-slate-500">Nenhum evento registrado.</p>;
  }

  return (
    <div className="relative space-y-0">
      <div className="absolute left-[17px] top-2 bottom-2 w-px bg-gradient-to-b from-cyan-400/30 via-cyan-400/10 to-transparent" />
      {events.map((event) => {
        const Icon = eventIcons[event.type] ?? Clock;
        return (
          <div className="relative flex gap-4 py-3" key={event.id}>
            <span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#0f1d32]">
              <Icon className="h-4 w-4 text-cyan-300" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <p className="text-sm font-semibold text-white">{event.label}</p>
                <span className="text-xs text-slate-500">
                  {formatDateTimeCompact(event.created_at)}
                </span>
              </div>
              {event.description ? (
                <p className="mt-0.5 text-xs text-slate-400">{event.description}</p>
              ) : null}
              <p className="mt-0.5 text-xs text-slate-600">{event.actor_name}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Participations ─────────────────────────────────────────────────────────

function ParticipationList({
  participations,
  occurrence,
}: {
  occurrence: OccurrenceDetail;
  participations: OccurrenceParticipation[];
}) {
  // Build from subcollection OR fallback to team_names on the document
  const items: { name: string; status: string; dog: string | null }[] =
    participations.length > 0
      ? participations.map((p) => ({
          name: p.handler_name,
          status: p.status,
          dog: p.dog_name,
        }))
      : occurrence.team_names.map((name, i) => ({
          name,
          status: occurrence.accepted_handler_ids.includes(occurrence.team_handler_ids[i] ?? "")
            ? "accepted"
            : "pending",
          dog: null,
        }));

  if (items.length === 0) {
    return <p className="text-sm text-slate-500">Nenhuma participação registrada.</p>;
  }

  const statusLabels: Record<string, { text: string; tone: "green" | "yellow" | "red" | "slate" }> = {
    accepted: { text: "Confirmado", tone: "green" },
    pending: { text: "Pendente", tone: "yellow" },
    declined: { text: "Recusou", tone: "red" },
  };

  return (
    <div className="divide-y divide-white/5">
      {items.map((item, i) => {
        const config = statusLabels[item.status] ?? statusLabels.pending;
        return (
          <div className="flex items-center gap-3 py-3" key={i}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
              <User className="h-4 w-4 text-slate-400" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white">{item.name}</p>
              {item.dog ? (
                <p className="text-xs text-slate-500">
                  <Dog className="mr-1 inline h-3 w-3" />
                  {item.dog}
                </p>
              ) : null}
            </div>
            <Badge tone={config.tone}>{config.text}</Badge>
          </div>
        );
      })}
    </div>
  );
}

// ─── Signatures ─────────────────────────────────────────────────────────────

function SignatureList({ signatures, occurrence }: { occurrence: OccurrenceDetail; signatures: OccurrenceSignature[] }) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all"
            style={{
              width: `${occurrence.signatures_required > 0 ? Math.min(100, (occurrence.signatures_collected / occurrence.signatures_required) * 100) : 0}%`,
            }}
          />
        </div>
        <span className="text-xs font-semibold text-slate-300">
          {occurrence.signatures_collected}/{occurrence.signatures_required}
        </span>
      </div>

      {signatures.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma assinatura coletada.</p>
      ) : (
        <div className="divide-y divide-white/5">
          {signatures.map((sig) => (
            <div className="flex items-center gap-3 py-3" key={sig.id}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10">
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">{sig.handler_name}</p>
                <p className="text-xs text-slate-500">{sig.role}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">{formatDateTimeCompact(sig.signed_at)}</p>
                <p className="text-xs text-slate-600">{sig.method}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Amendments ─────────────────────────────────────────────────────────────

function AmendmentList({ amendments }: { amendments: OccurrenceAmendment[] }) {
  if (amendments.length === 0) {
    return <p className="text-sm text-slate-500">Nenhum aditamento registrado.</p>;
  }

  return (
    <div className="space-y-4">
      {amendments.map((amendment) => (
        <div
          className="rounded-2xl border border-amber-300/10 bg-amber-300/[0.03] p-4"
          key={amendment.id}
        >
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-white">{amendment.reason}</p>
            <span className="text-xs text-slate-500">
              {formatDateTimeCompact(amendment.created_at)}
            </span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-slate-400">
            {amendment.description}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-slate-600">por {amendment.author_name}</span>
            {amendment.fields_changed.length > 0 ? (
              <span className="text-xs text-slate-600">
                — campos: {amendment.fields_changed.join(", ")}
              </span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Apprehensions ──────────────────────────────────────────────────────────

function ApprehensionSection({ occurrence }: { occurrence: OccurrenceDetail }) {
  if (occurrence.apprehension_items.length === 0) return null;

  return (
    <Section badge={`${occurrence.apprehension_items.length}`} icon={Shield} title="Apreensões">
      <div className="divide-y divide-white/5">
        {occurrence.apprehension_items.map((item, i) => (
          <div className="flex items-center gap-3 py-3" key={i}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-red-400/20 bg-red-400/10">
              <Shield className="h-4 w-4 text-red-300" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white">
                {item.description || item.type}
              </p>
              <p className="text-xs text-slate-500">
                {item.quantity} {item.unit}
                {item.weight_grams != null ? ` — ${item.weight_grams >= 1000 ? `${(item.weight_grams / 1000).toFixed(2)} kg` : `${item.weight_grams} g`}` : ""}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ─── Integrity block ────────────────────────────────────────────────────────

function IntegrityBlock({ occurrence }: { occurrence: OccurrenceDetail }) {
  if (!occurrence.integrity_hash && !occurrence.verification_code) return null;

  return (
    <Section icon={ShieldCheck} title="Integridade e Verificação">
      <div className="space-y-3 rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.03] p-4">
        {occurrence.verification_code ? (
          <div className="flex items-center gap-3">
            <Hash className="h-4 w-4 text-emerald-400" />
            <span className="text-sm text-slate-400">Código de verificação</span>
            <span className="ml-auto font-mono text-sm font-bold text-emerald-300">
              {occurrence.verification_code}
            </span>
          </div>
        ) : null}

        {occurrence.integrity_hash ? (
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-400">Hash de integridade</p>
              <p className="mt-0.5 break-all font-mono text-xs text-emerald-200/70">
                {occurrence.integrity_hash}
              </p>
            </div>
          </div>
        ) : null}

        {occurrence.sealed_at ? (
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-emerald-400" />
            <span className="text-sm text-slate-400">Selada em</span>
            <span className="ml-auto text-sm text-white">
              {formatDate(occurrence.sealed_at, true)}
            </span>
          </div>
        ) : null}

        {occurrence.verification_url ? (
          <div className="pt-2">
            <a
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-400/20"
              href={occurrence.verification_url}
              rel="noopener noreferrer"
              target="_blank"
            >
              <ShieldCheck className="h-4 w-4" />
              Verificar autenticidade
            </a>
          </div>
        ) : null}
      </div>
    </Section>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────

export default function OccurrenceDetailPage() {
  const params = useParams<{ id: string }>();
  const occurrenceId = decodeURIComponent(params.id ?? "");
  const data = useOccurrenceDetail(occurrenceId);

  if (data.loading || data.error || !data.occurrence) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Link
          className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
          href="/occurrences"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Central Operacional
        </Link>
        <DataState
          error={data.error ?? (!data.loading ? "Ocorrência não localizada." : null)}
          loading={data.loading}
          noun="a ocorrência"
        />
      </div>
    );
  }

  const { occurrence, events, signatures, participations, amendments } = data;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <Link
        className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
        href="/occurrences"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para Central Operacional
      </Link>

      <OccurrenceHeader occurrence={occurrence} />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Timeline */}
        <Section badge={`${events.length}`} icon={Clock} title="Linha do Tempo">
          <EventTimeline events={events} />
        </Section>

        {/* Participations */}
        <Section badge={`${participations.length || occurrence.team_names.length}`} icon={Users} title="Participações">
          <ParticipationList occurrence={occurrence} participations={participations} />
        </Section>
      </div>

      {/* Apprehensions */}
      <ApprehensionSection occurrence={occurrence} />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Signatures */}
        <Section badge={`${signatures.length}`} icon={FileSignature} title="Assinaturas">
          <SignatureList occurrence={occurrence} signatures={signatures} />
        </Section>

        {/* Amendments */}
        <Section badge={`${amendments.length}`} icon={FileEdit} title="Aditamentos">
          <AmendmentList amendments={amendments} />
        </Section>
      </div>

      {/* Integrity */}
      <IntegrityBlock occurrence={occurrence} />
    </div>
  );
}
