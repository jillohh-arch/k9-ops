"use client";

import { ArrowLeft, CalendarDays, Car, Search } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import {
  DataState,
  StatusPill,
} from "@/features/effective/components/effective-ui";
import {
  useVehicleProfileData,
  vehicleRecordDate,
  vehicleText,
} from "@/features/effective/hooks/use-vehicle-profile-data";
import { paths } from "@/lib/routes/paths";

function normalize(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function formatDate(date: Date | null) {
  return date
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(date)
    : "--";
}

function sourceLabel(source: string) {
  const labels: Record<string, string> = {
    active_shifts: "Turno ativo",
    occurrences: "Ocorrencia",
    shift_logs: "Historico de turno",
    vehicle_events: "Evento da viatura",
  };
  return labels[source] ?? source;
}

function title(record: Record<string, unknown>) {
  return (
    vehicleText(record, "title", "type_name", "nature", "type", "status") ??
    sourceLabel(String(record._source ?? "registro"))
  );
}

export default function VehicleHistoryPage() {
  const params = useParams<{ vehicleId: string }>();
  const vehicleId = decodeURIComponent(params.vehicleId ?? "");
  const data = useVehicleProfileData(vehicleId);
  const [source, setSource] = useState("all");
  const [search, setSearch] = useState("");
  const events = useMemo(() => {
    const needle = normalize(search);
    return data.timeline.filter((record) => {
      const matchesSource = source === "all" || record._source === source;
      const matchesSearch =
        !needle ||
        [
          title(record),
          record._source,
          vehicleText(record, "notes", "summary", "status"),
        ].some((value) => normalize(value).includes(needle));
      return matchesSource && matchesSearch;
    });
  }, [data.timeline, search, source]);

  if (data.loading || data.error || !data.vehicle) {
    return (
      <DataState
        error={data.error ?? (!data.loading ? "Viatura nao localizada." : null)}
        loading={data.loading}
        noun="o historico da viatura"
      />
    );
  }

  const label =
    vehicleText(data.vehicle, "label") ??
    `${vehicleText(data.vehicle, "name") ?? "Viatura"} ${vehicleId}`;

  return (
    <div className="space-y-5">
      <div>
        <Link
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-300"
          href={`/vehicles/${encodeURIComponent(vehicleId)}`}
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao perfil
        </Link>
        <h1 className="mt-3 text-3xl font-black text-white">
          Historico da Viatura
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Linha do tempo completa de {label}.
        </p>
      </div>

      <section className="rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] pl-11 pr-4 text-sm text-slate-100 outline-none focus:border-cyan-300/35"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar no historico..."
              value={search}
            />
          </label>
          <select
            className="h-11 rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm text-slate-300 outline-none"
            onChange={(event) => setSource(event.target.value)}
            value={source}
          >
            <option className="bg-[#0b1628]" value="all">Todas as origens</option>
            <option className="bg-[#0b1628]" value="vehicle_events">Eventos da viatura</option>
            <option className="bg-[#0b1628]" value="active_shifts">Turnos ativos</option>
            <option className="bg-[#0b1628]" value="shift_logs">Historico de turno</option>
            <option className="bg-[#0b1628]" value="occurrences">Ocorrencias</option>
          </select>
        </div>

        <div className="mt-6 space-y-4">
          {events.length ? (
            events.map((record) => (
              <div
                className="grid gap-4 rounded-2xl border border-white/8 bg-white/[0.025] p-4 md:grid-cols-[44px_1fr_auto]"
                key={`${record._source}-${record._id}`}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
                  {record._source === "vehicle_events" ? (
                    <Car className="h-5 w-5" />
                  ) : (
                    <CalendarDays className="h-5 w-5" />
                  )}
                </span>
                <div>
                  <p className="font-bold text-white">{title(record)}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {vehicleText(record, "notes", "summary", "status") ??
                      sourceLabel(record._source)}
                  </p>
                </div>
                <div className="flex items-center gap-3 md:justify-end">
                  <StatusPill label={sourceLabel(record._source)} tone="blue" />
                  <span className="font-mono text-xs text-slate-500">
                    {formatDate(vehicleRecordDate(record))}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
              Nenhum evento encontrado para os filtros.
            </div>
          )}
        </div>
      </section>

      <Link className="inline-flex text-sm font-bold text-cyan-300" href={paths.vehicles}>
        Voltar para viaturas
      </Link>
    </div>
  );
}
