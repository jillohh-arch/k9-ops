"use client";

import {
  Activity,
  AlertTriangle,
  Dog,
  Eye,
  GraduationCap,
  IdCard,
  Plus,
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
import {
  ageInYears,
  normalizedStatus,
  specialtyLabel,
  useEffectiveData,
  type EffectiveDog,
} from "@/features/effective/hooks/use-effective-data";
import { paths } from "@/lib/routes/paths";
import { cn } from "@/lib/utils";

const pageSize = 6;

function searchText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function dogStage(dog: EffectiveDog) {
  const status = normalizedStatus(dog.status);
  if (!["ativo", "active"].includes(status)) return "unavailable";
  if (dog.specialties.some((item) => item.status === "operational")) {
    return "operational";
  }
  if (dog.specialties.some((item) => item.status === "in_formation")) {
    return "formation";
  }
  return "active";
}

function stagePresentation(stage: ReturnType<typeof dogStage>) {
  if (stage === "operational") {
    return { label: "Operacional", tone: "green" as const };
  }
  if (stage === "formation") {
    return { label: "Em formação", tone: "blue" as const };
  }
  if (stage === "unavailable") {
    return { label: "Fora de operação", tone: "violet" as const };
  }
  return { label: "Ativo", tone: "slate" as const };
}

export default function K9Page() {
  const { can } = useAccessControl();
  const { dogs, error, loading, users } = useEffectiveData();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [specialty, setSpecialty] = useState("all");
  const [handler, setHandler] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [page, setPage] = useState(1);
  const usersByRa = useMemo(
    () => new Map(users.map((user) => [user.ra, user])),
    [users],
  );
  const specialtyOptions = useMemo(
    () =>
      Array.from(
        new Set(dogs.flatMap((dog) => dog.specialties.map((item) => item.type))),
      )
        .sort()
        .map((type) => ({ label: specialtyLabel(type), value: type })),
    [dogs],
  );
  const handlerOptions = useMemo(
    () =>
      users
        .filter((user) => dogs.some((dog) => dog.conductorRa === user.ra))
        .map((user) => ({ label: user.callsign, value: user.ra })),
    [dogs, users],
  );
  const filtered = useMemo(() => {
    const needle = searchText(search);
    return dogs.filter((dog) => {
      const conductor = dog.conductorRa
        ? usersByRa.get(dog.conductorRa)?.callsign
        : "";
      const matchesSearch =
        !needle ||
        [
          dog.name,
          dog.registrationNumber,
          dog.breed,
          conductor,
          dog.conductorRa,
        ].some((value) => searchText(value).includes(needle));
      const matchesStatus = status === "all" || dogStage(dog) === status;
      const matchesSpecialty =
        specialty === "all" ||
        dog.specialties.some((item) => item.type === specialty);
      const matchesHandler =
        handler === "all" || dog.conductorRa === handler;
      return (
        matchesSearch &&
        matchesStatus &&
        matchesSpecialty &&
        matchesHandler
      );
    });
  }, [dogs, handler, search, specialty, status, usersByRa]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );
  const operational = dogs.filter(
    (dog) => dogStage(dog) === "operational",
  ).length;
  const formation = dogs.filter((dog) => dogStage(dog) === "formation").length;
  const unavailable = dogs.filter(
    (dog) => dogStage(dog) === "unavailable",
  ).length;
  const canCreateK9 = can("k9", "create");

  function updateFilter(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <EffectiveHeader
          description="Cadastro, formação e situação operacional da matilha."
          title="Efetivo K9"
        />
        {canCreateK9 ? (
          <Link
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 shadow-[0_0_24px_rgba(77,208,225,0.24)] transition hover:bg-cyan-200"
            href={paths.k9New}
          >
            <Plus className="h-4 w-4" />
            Cadastrar K9
          </Link>
        ) : null}
      </div>

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <SummaryCard
          detail="total visível na unidade"
          icon={Dog}
          label="K9 cadastrados"
          tone="cyan"
          value={loading ? "..." : String(dogs.length)}
        />
        <SummaryCard
          detail="com especialidade operacional"
          icon={Activity}
          label="Operacionais"
          tone="green"
          value={loading ? "..." : String(operational)}
        />
        <SummaryCard
          detail="com especialidade em formação"
          icon={GraduationCap}
          label="Em formação"
          tone="blue"
          value={loading ? "..." : String(formation)}
        />
        <SummaryCard
          detail="licenca, inativo ou aposentado"
          icon={AlertTriangle}
          label="Fora de operação"
          tone="violet"
          value={loading ? "..." : String(unavailable)}
        />
      </section>

      <FilterBar
        onSearch={(value) => updateFilter(setSearch, value)}
        onViewMode={setViewMode}
        placeholder="Buscar por nome, matrícula, raça ou operador..."
        search={search}
        viewMode={viewMode}
      >
        <FilterSelect
          label="Status do K9"
          onChange={(value) => updateFilter(setStatus, value)}
          options={[
            { label: "Status: Todos", value: "all" },
            { label: "Operacional", value: "operational" },
            { label: "Em formação", value: "formation" },
            { label: "Ativo", value: "active" },
            { label: "Fora de operação", value: "unavailable" },
          ]}
          value={status}
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
        <FilterSelect
          label="Operador"
          onChange={(value) => updateFilter(setHandler, value)}
          options={[
            { label: "Operador: Todos", value: "all" },
            ...handlerOptions,
          ]}
          value={handler}
        />
      </FilterBar>

      <DataState error={error} loading={loading} noun="o efetivo K9" />

      {!loading && !error ? (
        visible.length ? (
          <section
            className={cn(
              "grid gap-4",
              viewMode === "grid"
                ? "md:grid-cols-2 2xl:grid-cols-3"
                : "grid-cols-1",
            )}
          >
            {visible.map((dog) => {
              const stage = stagePresentation(dogStage(dog));
              const conductor = dog.conductorRa
                ? usersByRa.get(dog.conductorRa)
                : null;
              const age = ageInYears(dog.dateOfBirth);
              const labels = dog.specialties.map(
                (item) =>
                  `${specialtyLabel(item.type)}${item.status === "in_formation" ? " - formação" : ""}`,
              );

              return (
                <article
                  className={cn(
                    "rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-4 shadow-[0_22px_60px_rgba(0,0,0,0.2)]",
                    viewMode === "list" &&
                      "grid items-center gap-5 lg:grid-cols-[120px_1fr_auto]",
                  )}
                  key={dog.id}
                >
                  <div
                    className={cn(
                      "flex gap-4",
                      viewMode === "list" && "contents",
                    )}
                  >
                    <EntityImage
                      alt={dog.name}
                      className={cn(
                        "h-32 w-28 shrink-0",
                        viewMode === "list" && "h-24 w-28",
                      )}
                      fallback={Dog}
                      src={dog.profileImageUrl}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="truncate text-xl font-black text-cyan-300">
                            {dog.name}
                          </h2>
                          <p className="mt-1 font-mono text-xs text-slate-500">
                            {dog.registrationNumber
                              ? `MAT. ${dog.registrationNumber}`
                              : `ID ${dog.id}`}
                          </p>
                        </div>
                        <StatusPill label={stage.label} tone={stage.tone} />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                        <span>{dog.breed ?? "Raça não informada"}</span>
                        <span>{dog.sex ?? "Sexo não informado"}</span>
                        <span>{age == null ? "Idade não informada" : `${age} anos`}</span>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                        <UserRound className="h-4 w-4 text-cyan-300/60" />
                        <span>
                          Operador:{" "}
                          <strong className="text-slate-200">
                            {conductor?.callsign ??
                              dog.conductorRa ??
                              "Não vinculado"}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>
                  <div
                    className={cn(
                      "mt-4 border-t border-white/8 pt-4",
                      viewMode === "list" &&
                        "mt-0 min-w-[320px] border-t-0 border-l pl-5 pt-0",
                    )}
                  >
                    <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                      <IdCard className="h-3.5 w-3.5" />
                      Especialidades
                    </p>
                    <SpecialtyTags labels={labels} />
                  </div>
                  <div
                    className={cn(
                      "mt-4 border-t border-white/8 pt-3",
                      viewMode === "list" &&
                        "col-span-full mt-0 flex justify-end border-t pt-3",
                    )}
                  >
                    <Link
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] px-4 py-2.5 text-xs font-bold text-cyan-200 transition hover:border-cyan-300/40 hover:bg-cyan-300/[0.12] lg:w-auto"
                      href={`/k9/${encodeURIComponent(dog.id)}`}
                    >
                      <Eye className="h-4 w-4" />
                      Ver perfil
                    </Link>
                  </div>
                </article>
              );
            })}
          </section>
        ) : (
          <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
            Nenhum K9 corresponde aos filtros selecionados.
          </div>
        )
      ) : null}

      {!loading && !error ? (
        <PageFooter
          currentPage={safePage}
          itemLabel="K9"
          onPage={setPage}
          pageSize={pageSize}
          total={filtered.length}
        />
      ) : null}
    </div>
  );
}
