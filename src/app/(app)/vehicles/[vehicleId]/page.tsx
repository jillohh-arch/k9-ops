"use client";

import {
  ArrowLeft,
  CalendarDays,
  Car,
  FileText,
  Gauge,
  History,
  MapPin,
  Pencil,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { useAccessControl } from "@/features/access/providers/access-control-provider";
import {
  DataState,
  EntityImage,
  StatusPill,
  SummaryCard,
} from "@/features/effective/components/effective-ui";
import {
  useVehicleProfileData,
  vehicleDate,
  vehicleNumber,
  vehicleRecordDate,
  vehicleText,
  type VehicleRecord,
} from "@/features/effective/hooks/use-vehicle-profile-data";
import { paths } from "@/lib/routes/paths";

function formatDate(date: Date | null) {
  return date
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date)
    : "--";
}

function statusTone(status: string | null, active: boolean) {
  const value = (status ?? "").toLowerCase();
  if (!active || value.includes("baix")) return "violet" as const;
  if (value.includes("manut")) return "amber" as const;
  if (value.includes("reserva")) return "blue" as const;
  return "green" as const;
}

function eventTitle(record: VehicleRecord) {
  if (record._source === "active_shifts") return "Guarnicao em turno";
  if (record._source === "shift_logs") return "Registro de turno";
  if (record._source === "occurrences") {
    return vehicleText(record, "type_name", "nature", "nature_name") ?? "Ocorrencia";
  }
  return vehicleText(record, "title", "type") ?? "Evento da viatura";
}

export default function VehicleProfilePage() {
  const { can } = useAccessControl();
  const params = useParams<{ vehicleId: string }>();
  const vehicleId = decodeURIComponent(params.vehicleId ?? "");
  const data = useVehicleProfileData(vehicleId);

  if (data.loading || data.error || !data.vehicle) {
    return (
      <DataState
        error={data.error ?? (!data.loading ? "Viatura nao localizada." : null)}
        loading={data.loading}
        noun="o perfil da viatura"
      />
    );
  }

  const vehicle = data.vehicle;
  const prefix = vehicleText(vehicle, "prefix", "vehicle_prefix") ?? vehicleId;
  const name = vehicleText(vehicle, "name") ?? "Viatura";
  const label = vehicleText(vehicle, "label") ?? `${name} ${prefix}`;
  const status = vehicleText(vehicle, "status") ?? "Ativa";
  const active = vehicle.active !== false && vehicle.deleted_at == null;
  const mileage = vehicleNumber(vehicle, "mileage_km", "mileageKm");
  const nextReview = vehicleDate(vehicle.next_review_at ?? vehicle.nextReviewAt);
  const crewSize = vehicleNumber(vehicle, "crew_size", "crewSize") ?? 1;
  const recent = data.timeline.slice(0, 6);
  const canEditVehicle = can("vehicles", "edit");

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <Link
            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-300"
            href={paths.vehicles}
          >
            <ArrowLeft className="h-4 w-4" />
            Viaturas
          </Link>
          <h1 className="mt-3 text-3xl font-black text-white">
            Perfil da Viatura
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Ficha operacional, administrativa e historico da frota.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {canEditVehicle ? (
            <Link
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-300/[0.08] px-4 py-2.5 text-sm font-bold text-cyan-200"
              href={`/vehicles/${encodeURIComponent(vehicleId)}/edit`}
            >
              <Pencil className="h-4 w-4" /> Editar
            </Link>
          ) : null}
          <Link
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-slate-300"
            href={`/vehicles/${encodeURIComponent(vehicleId)}/history`}
          >
            <History className="h-4 w-4" /> Ver historico
          </Link>
        </div>
      </div>

      <section className="relative overflow-hidden rounded-3xl border border-cyan-200/15 bg-[#0a172a]/90 p-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(34,211,238,0.14),transparent_35%)]" />
        <div className="relative grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
            <EntityImage
              alt={label}
              className="h-52 w-full"
              fallback={Car}
              src={vehicleText(vehicle, "photoUrl", "photo_url")}
            />
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-4xl font-black text-white">{label}</h2>
                <StatusPill label={status} tone={statusTone(status, active)} />
              </div>
              <p className="mt-2 font-mono text-sm font-bold text-cyan-300">
                Prefixo {prefix}
              </p>
              <div className="mt-6 grid gap-4 border-y border-white/8 py-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Modelo", vehicleText(vehicle, "model") ?? "--"],
                  ["Placa", vehicleText(vehicle, "plate") ?? "--"],
                  ["Ano", vehicleText(vehicle, "year") ?? "--"],
                  ["Combustivel", vehicleText(vehicle, "fuel") ?? "--"],
                  ["Lotacao", vehicleText(vehicle, "unit") ?? "--"],
                  ["Base", vehicleText(vehicle, "base") ?? "--"],
                  ["Quilometragem", mileage == null ? "--" : `${mileage.toLocaleString("pt-BR")} km`],
                  ["Guarnicao", `${crewSize} vaga(s)`],
                ].map(([itemLabel, value]) => (
                  <div key={itemLabel}>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                      {itemLabel}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-200">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <aside className="space-y-3 rounded-2xl border border-white/8 bg-white/[0.025] p-4">
            <h2 className="text-sm font-black text-white">Resumo da situacao</h2>
            {[
              {
                icon: ShieldCheck,
                label: active ? "Em operacao" : "Fora de operacao",
                detail: active ? "Viatura apta para uso conforme cadastro." : "Cadastro arquivado ou inativo.",
              },
              {
                icon: FileText,
                label: vehicleText(vehicle, "document_valid_until") ? "Documentacao informada" : "Documentacao pendente",
                detail: vehicleText(vehicle, "document_valid_until") ?? "Validade nao cadastrada.",
              },
              {
                icon: Wrench,
                label: vehicleText(vehicle, "maintenance_status") ?? "Manutencao nao informada",
                detail: nextReview ? `Proxima revisao em ${formatDate(nextReview)}` : "Sem proxima revisao cadastrada.",
              },
            ].map((item) => (
              <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.035] p-3" key={item.label}>
                <item.icon className="h-5 w-5 text-cyan-300" />
                <div>
                  <p className="text-sm font-bold text-white">{item.label}</p>
                  <p className="text-xs text-slate-500">{item.detail}</p>
                </div>
              </div>
            ))}
          </aside>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <SummaryCard
          detail="condutores vinculados agora"
          icon={Users}
          label="Guarnicao ativa"
          tone="cyan"
          value={String(data.activeShifts.length)}
        />
        <SummaryCard
          detail="ocorrencias com vehicle_id"
          icon={ShieldCheck}
          label="Ocorrencias"
          tone="blue"
          value={String(data.occurrences.length)}
        />
        <SummaryCard
          detail="eventos administrativos"
          icon={Wrench}
          label="Manutencoes/eventos"
          tone="amber"
          value={String(data.events.length)}
        />
        <SummaryCard
          detail={nextReview ? `em ${formatDate(nextReview)}` : "nao cadastrada"}
          icon={CalendarDays}
          label="Proxima revisao"
          tone="green"
          value={nextReview ? "OK" : "--"}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <section className="rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5">
          <h2 className="text-sm font-black text-white">Dados gerais</h2>
          <div className="mt-4 space-y-3 text-sm">
            {[
              ["Renavam", vehicleText(vehicle, "renavam")],
              ["Chassi", vehicleText(vehicle, "chassis")],
              ["Licenciamento", vehicleText(vehicle, "licensing")],
              ["Seguro", vehicleText(vehicle, "insurance")],
              ["Acessorios", vehicleText(vehicle, "accessories")],
            ].map(([itemLabel, value]) => (
              <div className="flex justify-between gap-4" key={itemLabel}>
                <span className="text-slate-500">{itemLabel}</span>
                <span className="text-right font-medium text-slate-200">
                  {value ?? "--"}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5">
          <h2 className="text-sm font-black text-white">Situacao operacional</h2>
          <div className="mt-4 space-y-3">
            {data.activeShifts.length ? (
              data.activeShifts.map((shift) => (
                <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3" key={shift._id}>
                  <p className="font-mono text-xs text-cyan-300">RA {vehicleText(shift, "handlerId", "handler_id", "_id")}</p>
                  <p className="mt-1 text-sm font-bold text-white">
                    {vehicleText(shift, "crew_role", "crew_status") ?? "Integrante"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Desde {formatDate(vehicleRecordDate(shift))}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">Sem guarnicao ativa vinculada.</p>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5">
          <h2 className="text-sm font-black text-white">Manutencao e revisao</h2>
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.025] p-4">
            <Gauge className="h-6 w-6 text-cyan-300" />
            <div>
              <p className="text-sm font-black text-white">
                {mileage == null ? "--" : `${mileage.toLocaleString("pt-BR")} km`}
              </p>
              <p className="text-xs text-slate-500">Quilometragem atual</p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3 text-sm text-slate-400">
            <CalendarDays className="h-4 w-4 text-cyan-300/70" />
            Revisao: {formatDate(nextReview)}
          </div>
          <div className="mt-3 flex items-center gap-3 text-sm text-slate-400">
            <MapPin className="h-4 w-4 text-cyan-300/70" />
            {vehicleText(vehicle, "base", "unit") ?? "Base nao informada"}
          </div>
        </section>
      </section>

      <section className="rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-black text-white">Historico recente</h2>
          <Link
            className="text-xs font-bold text-cyan-300"
            href={`/vehicles/${encodeURIComponent(vehicleId)}/history`}
          >
            Ver historico completo
          </Link>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {recent.length ? (
            recent.map((record) => (
              <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4" key={`${record._source}-${record._id}`}>
                <p className="text-sm font-bold text-white">{eventTitle(record)}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {record._source.replaceAll("_", " ")}
                </p>
                <p className="mt-4 font-mono text-xs text-cyan-200">
                  {formatDate(vehicleRecordDate(record))}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">Nenhum historico localizado.</p>
          )}
        </div>
      </section>
    </div>
  );
}
