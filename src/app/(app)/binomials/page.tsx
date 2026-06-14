"use client";

import {
  AlertTriangle,
  Dog,
  Eye,
  GraduationCap,
  Link2,
  Pencil,
  Plus,
  Radio,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { useAccessControl } from "@/features/access/providers/access-control-provider";
import {
  DataState,
  EffectiveHeader,
  EntityImage,
  FilterBar,
  FilterSelect,
  PageFooter,
  SpecialtyTags,
  StatusPill,
  SummaryCard,
  type ViewMode,
} from "@/features/effective/components/effective-ui";
import { binomialIdFor } from "@/features/effective/data/binomial-admin-service";
import {
  specialtyLabel,
  useEffectiveData,
  type EffectiveBinomial,
  type EffectiveDog,
  type EffectiveShift,
  type EffectiveUser,
} from "@/features/effective/hooks/use-effective-data";
import { cn } from "@/lib/utils";

const pageSize = 4;

type BinomialRow = {
  admin: EffectiveBinomial | null;
  dog: EffectiveDog | null;
  handler: EffectiveUser | null;
  id: string;
  origin: "admin" | "legacy" | "shift";
  shift: EffectiveShift | null;
};

function searchText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function binomialStage(row: BinomialRow) {
  const status = searchText(row.admin?.status);
  if (!row.dog || !row.handler) return "incomplete";
  if (row.shift) return "on_shift";
  if (status.includes("formacao")) return "formation";
  if (status.includes("afast")) return "away";
  if (status.includes("encerr") || row.admin?.active === false) return "ended";
  if (status.includes("operacional")) return "operational";
  if (row.dog.specialties.some((item) => item.status === "operational")) {
    return "operational";
  }
  if (row.dog.specialties.some((item) => item.status === "in_formation")) {
    return "formation";
  }
  return "linked";
}

function daysBetween(start: Date | null) {
  if (!start) return "--";
  const days = Math.max(
    0,
    Math.floor((Date.now() - start.getTime()) / 86_400_000),
  );
  if (days < 30) return `${days} dia(s)`;
  if (days < 365) return `${Math.floor(days / 30)} mes(es)`;
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  return months ? `${years} ano(s), ${months} mes(es)` : `${years} ano(s)`;
}

export default function BinomialsPage() {
  const { can } = useAccessControl();
  const { binomials, dogs, error, loading, shifts, users } = useEffectiveData();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [origin, setOrigin] = useState("all");
  const [specialty, setSpecialty] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [page, setPage] = useState(1);
  const usersByRa = useMemo(
    () => new Map(users.map((user) => [user.ra, user])),
    [users],
  );
  const dogsById = useMemo(
    () => new Map(dogs.map((dog) => [dog.id, dog])),
    [dogs],
  );
  const shiftsByPair = useMemo(() => {
    const map = new Map<string, EffectiveShift>();
    for (const shift of shifts) {
      map.set(binomialIdFor(shift.dogId, shift.handlerRa), shift);
    }
    return map;
  }, [shifts]);
  const rows = useMemo(() => {
    const result = new Map<string, BinomialRow>();

    for (const binomial of binomials) {
      const id = binomial.id || binomialIdFor(binomial.dogId, binomial.handlerRa);
      const pairId = binomialIdFor(binomial.dogId, binomial.handlerRa);
      result.set(id, {
        admin: binomial,
        dog: dogsById.get(binomial.dogId) ?? null,
        handler: usersByRa.get(binomial.handlerRa) ?? null,
        id,
        origin: "admin",
        shift: shiftsByPair.get(pairId) ?? null,
      });
    }

    for (const dog of dogs) {
      if (!dog.conductorRa) continue;
      const id = binomialIdFor(dog.id, dog.conductorRa);
      if (result.has(id)) continue;
      result.set(id, {
        admin: null,
        dog,
        handler: usersByRa.get(dog.conductorRa) ?? null,
        id,
        origin: "legacy",
        shift: shiftsByPair.get(id) ?? null,
      });
    }

    for (const shift of shifts) {
      const id = binomialIdFor(shift.dogId, shift.handlerRa);
      if (result.has(id)) continue;
      result.set(id, {
        admin: null,
        dog: dogsById.get(shift.dogId) ?? null,
        handler: usersByRa.get(shift.handlerRa) ?? null,
        id,
        origin: "shift",
        shift,
      });
    }

    return Array.from(result.values()).sort((a, b) => {
      const aName = a.dog?.name ?? a.admin?.dogName ?? a.id;
      const bName = b.dog?.name ?? b.admin?.dogName ?? b.id;
      return aName.localeCompare(bName, "pt-BR");
    });
  }, [binomials, dogs, dogsById, shifts, shiftsByPair, usersByRa]);
  const specialtyOptions = useMemo(
    () =>
      Array.from(
        new Set(
          rows.flatMap((row) =>
            (row.dog?.specialties ?? []).map((item) => item.type),
          ),
        ),
      )
        .sort()
        .map((value) => ({ label: specialtyLabel(value), value })),
    [rows],
  );
  const filtered = useMemo(() => {
    const needle = searchText(search);
    return rows.filter((row) => {
      const stage = binomialStage(row);
      const matchesSearch =
        !needle ||
        [
          row.dog?.name,
          row.dog?.registrationNumber,
          row.handler?.callsign,
          row.handler?.ra,
          row.shift?.vehicleLabel,
          row.admin?.unit,
          row.admin?.team,
        ].some((value) => searchText(value).includes(needle));
      const matchesStatus = status === "all" || stage === status;
      const matchesOrigin = origin === "all" || row.origin === origin;
      const matchesSpecialty =
        specialty === "all" ||
        row.admin?.primarySpecialty === specialty ||
        row.dog?.specialties.some((item) => item.type === specialty);
      return matchesSearch && matchesStatus && matchesOrigin && matchesSpecialty;
    });
  }, [origin, rows, search, specialty, status]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const inShift = rows.filter((row) => row.shift != null).length;
  const adminCount = rows.filter((row) => row.origin === "admin").length;
  const incomplete = rows.filter(
    (row) => binomialStage(row) === "incomplete",
  ).length;
  const formation = rows.filter((row) => binomialStage(row) === "formation").length;
  const canCreateBinomial = can("binomials", "create");
  const canEditBinomial = can("binomials", "edit");

  function updateFilter(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <EffectiveHeader
          description="Vínculos duradouros entre condutores e K9, com coexistência do mobile."
          eyebrow="Composição operacional"
          title="Binômios"
        />
        {canCreateBinomial ? (
          <Link
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-[0_0_24px_rgba(77,208,225,0.24)] hover:bg-cyan-200"
            href="/binomials/new"
          >
            <Plus className="h-4 w-4" /> Novo binômio
          </Link>
        ) : null}
      </div>

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <SummaryCard
          detail="pares únicos consolidados"
          icon={Link2}
          label="Binômios visíveis"
          tone="cyan"
          value={loading ? "..." : String(rows.length)}
        />
        <SummaryCard
          detail="documentos em binomials"
          icon={Dog}
          label="Vínculos administrativos"
          tone="green"
          value={loading ? "..." : String(adminCount)}
        />
        <SummaryCard
          detail="pares presentes em active_shifts"
          icon={Radio}
          label="Em turno agora"
          tone="blue"
          value={loading ? "..." : String(inShift)}
        />
        <SummaryCard
          detail={incomplete ? "K9 ou condutor não localizado" : "duplas em formação"}
          icon={incomplete ? AlertTriangle : GraduationCap}
          label={incomplete ? "Incompletos" : "Em formação"}
          tone={incomplete ? "violet" : "amber"}
          value={loading ? "..." : String(incomplete || formation)}
        />
      </section>

      <FilterBar
        onSearch={(value) => updateFilter(setSearch, value)}
        onViewMode={setViewMode}
        placeholder="Buscar K9, condutor, RA, matrícula ou viatura..."
        search={search}
        viewMode={viewMode}
      >
        <FilterSelect
          label="Status do binômio"
          onChange={(value) => updateFilter(setStatus, value)}
          options={[
            { label: "Status: Todos", value: "all" },
            { label: "Em turno", value: "on_shift" },
            { label: "Operacional", value: "operational" },
            { label: "Em formação", value: "formation" },
            { label: "Vinculado", value: "linked" },
            { label: "Afastado", value: "away" },
            { label: "Encerrado", value: "ended" },
            { label: "Incompleto", value: "incomplete" },
          ]}
          value={status}
        />
        <FilterSelect
          label="Origem do vínculo"
          onChange={(value) => updateFilter(setOrigin, value)}
          options={[
            { label: "Origem: Todas", value: "all" },
            { label: "Cadastro web", value: "admin" },
            { label: "Legado do K9", value: "legacy" },
            { label: "Somente turno", value: "shift" },
          ]}
          value={origin}
        />
        <FilterSelect
          label="Especialidade"
          onChange={(value) => updateFilter(setSpecialty, value)}
          options={[
            { label: "Especialidade: Todas", value: "all" },
            ...specialtyOptions,
          ]}
          value={specialty}
        />
      </FilterBar>

      <DataState error={error} loading={loading} noun="os binômios" />

      {!loading && !error ? (
        visible.length ? (
          <section
            className={cn(
              "grid gap-4",
              viewMode === "grid" ? "2xl:grid-cols-2" : "grid-cols-1",
            )}
          >
            {visible.map((row) => {
              const stage = binomialStage(row);
              const stageView =
                stage === "on_shift"
                  ? { label: "Em turno", tone: "green" as const }
                  : stage === "operational"
                    ? { label: "Operacional", tone: "green" as const }
                    : stage === "formation"
                      ? { label: "Em formação", tone: "blue" as const }
                      : stage === "away"
                        ? { label: "Afastado", tone: "amber" as const }
                        : stage === "ended"
                          ? { label: "Encerrado", tone: "violet" as const }
                          : stage === "incomplete"
                            ? { label: "Incompleto", tone: "violet" as const }
                            : { label: "Vinculado", tone: "slate" as const };
              const labels =
                row.dog?.specialties.map((item) => specialtyLabel(item.type)) ??
                (row.admin?.primarySpecialty
                  ? [specialtyLabel(row.admin.primarySpecialty)]
                  : []);
              return (
                <article
                  className="overflow-hidden rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 shadow-[0_22px_60px_rgba(0,0,0,0.2)]"
                  key={row.id}
                >
                  <div className="flex items-start justify-between gap-4 border-b border-white/8 p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.7)]" />
                      <h2 className="truncate text-xl font-black text-white">
                        <span className="text-cyan-300">
                          {row.dog?.name ?? row.admin?.dogName ?? "K9 não localizado"}
                        </span>{" "}
                        + {row.handler?.callsign ?? row.admin?.handlerName ?? "Condutor não localizado"}
                      </h2>
                    </div>
                    <StatusPill label={stageView.label} tone={stageView.tone} />
                  </div>

                  <div
                    className={cn(
                      "grid gap-5 p-4",
                      viewMode === "grid"
                        ? "md:grid-cols-[220px_1fr]"
                        : "lg:grid-cols-[280px_1fr]",
                    )}
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <EntityImage
                          alt={row.dog?.name ?? "K9"}
                          className="h-32 w-full"
                          fallback={Dog}
                          src={row.dog?.profileImageUrl ?? null}
                        />
                        <p className="mt-2 truncate text-center text-xs font-bold text-cyan-200">
                          {row.dog?.name ?? "Não localizado"}
                        </p>
                      </div>
                      <div>
                        <EntityImage
                          alt={row.handler?.callsign ?? "Condutor"}
                          className="h-32 w-full"
                          fallback={UserRound}
                          src={row.handler?.photoUrl ?? null}
                        />
                        <p className="mt-2 truncate text-center text-xs font-bold text-slate-200">
                          {row.handler?.callsign ?? "Não localizado"}
                        </p>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-xl border border-white/7 bg-white/[0.025] p-3">
                          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                            Identificação
                          </p>
                          <p className="mt-2 font-mono text-xs text-slate-300">
                            K9 {row.dog?.registrationNumber ?? row.dog?.id ?? "--"}
                          </p>
                          <p className="mt-1 font-mono text-xs text-slate-300">
                            RA {row.handler?.ra ?? row.admin?.handlerRa ?? "--"}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/7 bg-white/[0.025] p-3">
                          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                            Vínculo
                          </p>
                          <p className="mt-2 text-sm font-bold text-slate-200">
                            {row.admin?.type ?? (row.origin === "legacy" ? "Legado do K9" : "Turno")}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {daysBetween(row.admin?.startAt ?? null)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/7 bg-white/[0.025] p-3">
                          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                            Contexto atual
                          </p>
                          <p className="mt-2 text-sm font-bold text-slate-200">
                            {row.shift?.vehicleLabel ?? row.admin?.unit ?? "Fora de turno"}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/7 bg-white/[0.025] p-3">
                          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                            Prontidão
                          </p>
                          <p className="mt-2 font-mono text-sm font-black text-cyan-200">
                            {row.admin?.readinessScore == null
                              ? "--"
                              : `${row.admin.readinessScore}%`}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                          Especialidades
                        </p>
                        <SpecialtyTags labels={labels} />
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <StatusPill
                          label={
                            row.origin === "admin"
                              ? "Cadastro web"
                              : row.origin === "legacy"
                                ? "Legado do K9"
                                : "Somente turno"
                          }
                          tone={row.origin === "admin" ? "blue" : "slate"}
                        />
                        {row.shift ? <StatusPill label="Ativo no turno" tone="green" /> : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 border-t border-white/8 p-3">
                    <Link
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-2.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-300/[0.12]"
                      href={`/binomials/${encodeURIComponent(row.id)}`}
                    >
                      <Eye className="h-4 w-4" /> Ver perfil
                    </Link>
                    {canEditBinomial ? (
                      <Link
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-2.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-300/[0.12]"
                        href={`/binomials/${encodeURIComponent(row.id)}/edit`}
                      >
                        <Pencil className="h-4 w-4" /> Editar
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </section>
        ) : (
          <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
            Nenhum binômio corresponde aos filtros selecionados.
          </div>
        )
      ) : null}

      {!loading && !error ? (
        <PageFooter
          currentPage={safePage}
          itemLabel="binômios"
          onPage={setPage}
          pageSize={pageSize}
          total={filtered.length}
        />
      ) : null}
    </div>
  );
}
