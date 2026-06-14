"use client";

import { ArrowLeft, CalendarDays, Search, ShieldCheck, Target } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import {
  DataState,
  StatusPill,
} from "@/features/effective/components/effective-ui";
import {
  binomialRecordDate,
  binomialText,
  useBinomialProfileData,
  type BinomialRecord,
} from "@/features/effective/hooks/use-binomial-profile-data";
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

function category(record: BinomialRecord) {
  if (record._source.startsWith("training_sessions")) return "training";
  if (record._source.startsWith("occurrences")) return "occurrence";
  if (record._source === "shift_logs") return "shift";
  return "other";
}

function categoryLabel(value: string) {
  const labels: Record<string, string> = {
    occurrence: "Ocorrência",
    other: "Outro",
    shift: "Turno",
    training: "Treino",
  };
  return labels[value] ?? value;
}

function title(record: BinomialRecord) {
  return (
    binomialText(
      record,
      "trainingType",
      "type_name",
      "nature",
      "modality",
      "status",
      "summary",
    ) ?? categoryLabel(category(record))
  );
}

export default function BinomialHistoryPage() {
  const params = useParams<{ binomialId: string }>();
  const binomialId = decodeURIComponent(params.binomialId ?? "");
  const data = useBinomialProfileData(binomialId);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const events = useMemo(() => {
    const needle = normalize(search);
    return data.events.filter((record) => {
      const recordCategory = category(record);
      const matchesCategory = filter === "all" || recordCategory === filter;
      const matchesSearch =
        !needle ||
        [
          title(record),
          record._source,
          binomialText(record, "status", "result", "location", "notes"),
        ].some((value) => normalize(value).includes(needle));
      return matchesCategory && matchesSearch;
    });
  }, [data.events, filter, search]);

  if (data.loading || data.error || (!data.dog && !data.handler)) {
    return (
      <DataState
        error={data.error ?? (!data.loading ? "Binômio não localizado." : null)}
        loading={data.loading}
        noun="o histórico do binômio"
      />
    );
  }

  const dogName =
    binomialText(data.dog, "name", "nome") ??
    binomialText(data.binomial, "dog_name") ??
    "K9";
  const handlerName =
    binomialText(data.handler, "callsign", "callSign", "name") ??
    binomialText(data.binomial, "handler_name") ??
    "Condutor";

  return (
    <div className="space-y-5">
      <div>
        <Link
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-300"
          href={`/binomials/${encodeURIComponent(binomialId)}`}
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao perfil
        </Link>
        <h1 className="mt-3 text-3xl font-black text-white">
          Histórico do Binômio
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Linha do tempo de {handlerName} + {dogName}.
        </p>
      </div>

      <section className="rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] pl-11 pr-4 text-sm text-slate-100 outline-none focus:border-cyan-300/35"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar treino, ocorrência ou turno..."
              value={search}
            />
          </label>
          <select
            className="h-11 rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm text-slate-300 outline-none"
            onChange={(event) => setFilter(event.target.value)}
            value={filter}
          >
            <option className="bg-[#0b1628]" value="all">Todos</option>
            <option className="bg-[#0b1628]" value="training">Treinos</option>
            <option className="bg-[#0b1628]" value="occurrence">Ocorrências</option>
            <option className="bg-[#0b1628]" value="shift">Turnos</option>
          </select>
        </div>

        <div className="mt-6 space-y-4">
          {events.length ? (
            events.map((record) => {
              const recordCategory = category(record);
              return (
                <div
                  className="grid gap-4 rounded-2xl border border-white/8 bg-white/[0.025] p-4 md:grid-cols-[44px_1fr_auto]"
                  key={`${record._source}-${record._id}`}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
                    {recordCategory === "training" ? (
                      <Target className="h-5 w-5" />
                    ) : recordCategory === "occurrence" ? (
                      <ShieldCheck className="h-5 w-5" />
                    ) : (
                      <CalendarDays className="h-5 w-5" />
                    )}
                  </span>
                  <div>
                    <p className="font-bold text-white">{title(record)}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {binomialText(record, "result", "status", "location", "notes") ??
                        record._source.replaceAll("_", " ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 md:justify-end">
                    <StatusPill label={categoryLabel(recordCategory)} tone="blue" />
                    <span className="font-mono text-xs text-slate-500">
                      {formatDate(binomialRecordDate(record))}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
              Nenhum evento encontrado para os filtros.
            </div>
          )}
        </div>
      </section>

      <Link className="inline-flex text-sm font-bold text-cyan-300" href={paths.binomials}>
        Voltar para binômios
      </Link>
    </div>
  );
}
