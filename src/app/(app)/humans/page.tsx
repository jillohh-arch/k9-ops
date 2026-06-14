"use client";

import {
  Activity,
  BadgeCheck,
  Dog,
  Eye,
  FileBadge,
  GraduationCap,
  MoveRight,
  Pencil,
  Plus,
  ShieldCheck,
  UserRound,
  Users,
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
  StatusPill,
  SummaryCard,
  type ViewMode,
} from "@/features/effective/components/effective-ui";
import {
  useEffectiveData,
  type EffectiveUser,
} from "@/features/effective/hooks/use-effective-data";
import { cn } from "@/lib/utils";
import { paths } from "@/lib/routes/paths";

const pageSize = 6;

function searchText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isConductor(user: EffectiveUser, linkedDogs: number) {
  return (
    linkedDogs > 0 ||
    searchText(user.accessLevel).includes("condutor") ||
    searchText(user.accessLevel).includes("adestrador")
  );
}

export default function HumansPage() {
  const { can } = useAccessControl();
  const { dogs, error, loading, shifts, users } = useEffectiveData();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [role, setRole] = useState("all");
  const [unit, setUnit] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [page, setPage] = useState(1);
  const dogsByHandler = useMemo(() => {
    const result = new Map<string, typeof dogs>();
    for (const dog of dogs) {
      if (!dog.conductorRa) continue;
      result.set(dog.conductorRa, [
        ...(result.get(dog.conductorRa) ?? []),
        dog,
      ]);
    }
    return result;
  }, [dogs]);
  const activeHandlerIds = useMemo(
    () => new Set(shifts.map((shift) => shift.handlerRa)),
    [shifts],
  );
  const roleOptions = useMemo(
    () =>
      Array.from(new Set(users.map((user) => user.accessLevel).filter(Boolean)))
        .sort()
        .map((value) => ({ label: value, value })),
    [users],
  );
  const unitOptions = useMemo(
    () =>
      Array.from(
        new Set(users.map((user) => user.unit).filter((value): value is string => !!value)),
      )
        .sort()
        .map((value) => ({ label: value, value })),
    [users],
  );
  const filtered = useMemo(() => {
    const needle = searchText(search);
    return users.filter((user) => {
      const linked = dogsByHandler.get(user.ra) ?? [];
      const matchesSearch =
        !needle ||
        [
          user.callsign,
          user.fullName,
          user.ra,
          user.unit,
          user.accessLevel,
          ...linked.map((dog) => dog.name),
        ].some((value) => searchText(value).includes(needle));
      const matchesStatus =
        status === "all" ||
        (status === "active" && user.active) ||
        (status === "inactive" && !user.active) ||
        (status === "on_shift" && activeHandlerIds.has(user.ra));
      const matchesRole = role === "all" || user.accessLevel === role;
      const matchesUnit = unit === "all" || user.unit === unit;
      return matchesSearch && matchesStatus && matchesRole && matchesUnit;
    });
  }, [
    activeHandlerIds,
    dogsByHandler,
    role,
    search,
    status,
    unit,
    users,
  ]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );
  const active = users.filter((user) => user.active).length;
  const instructors = users.filter((user) => user.isK9Instructor).length;
  const conductors = users.filter((user) =>
    isConductor(user, dogsByHandler.get(user.ra)?.length ?? 0),
  ).length;
  const canCreateHuman = can("humans", "create");
  const canEditHuman = can("humans", "edit");

  function updateFilter(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <EffectiveHeader
          description="Pessoas, funções e disponibilidade operacional da equipe."
          title="Efetivo Humano"
        />
        <div className="flex flex-wrap gap-3">
          {canEditHuman ? (
            <>
              <Link
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] px-4 py-2.5 text-sm font-semibold text-cyan-200 hover:bg-cyan-300/[0.12]"
                href={paths.humanCertifications}
              >
                <FileBadge className="h-4 w-4" /> Certificações
              </Link>
              <Link
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] px-4 py-2.5 text-sm font-semibold text-cyan-200 hover:bg-cyan-300/[0.12]"
                href={paths.humanMovements}
              >
                <MoveRight className="h-4 w-4" /> Movimentações
              </Link>
            </>
          ) : null}
          {canCreateHuman ? (
            <Link
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-200 shadow-[0_0_24px_rgba(77,208,225,0.24)]"
              href={paths.humanNew}
            >
              <Plus className="h-4 w-4" /> Novo agente
            </Link>
          ) : null}
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <SummaryCard
          detail="total visível na unidade"
          icon={Users}
          label="Agentes cadastrados"
          tone="cyan"
          value={loading ? "..." : String(users.length)}
        />
        <SummaryCard
          detail="sem baixa ou arquivamento"
          icon={Activity}
          label="Cadastros ativos"
          tone="green"
          value={loading ? "..." : String(active)}
        />
        <SummaryCard
          detail="por função ou vínculo com K9"
          icon={Dog}
          label="Condutores"
          tone="blue"
          value={loading ? "..." : String(conductors)}
        />
        <SummaryCard
          detail="papel Instrutor K9 espelhado"
          icon={GraduationCap}
          label="Instrutores K9"
          tone="violet"
          value={loading ? "..." : String(instructors)}
        />
      </section>

      <FilterBar
        onSearch={(value) => updateFilter(setSearch, value)}
        onViewMode={setViewMode}
        placeholder="Buscar por nome de guerra, RA, unidade ou K9..."
        search={search}
        viewMode={viewMode}
      >
        <FilterSelect
          label="Status do agente"
          onChange={(value) => updateFilter(setStatus, value)}
          options={[
            { label: "Status: Todos", value: "all" },
            { label: "Ativos", value: "active" },
            { label: "Em turno", value: "on_shift" },
            { label: "Inativos", value: "inactive" },
          ]}
          value={status}
        />
        <FilterSelect
          label="Função"
          onChange={(value) => updateFilter(setRole, value)}
          options={[
            { label: "Função: Todas", value: "all" },
            ...roleOptions,
          ]}
          value={role}
        />
        <FilterSelect
          label="Unidade"
          onChange={(value) => updateFilter(setUnit, value)}
          options={[
            { label: "Unidade: Todas", value: "all" },
            ...unitOptions,
          ]}
          value={unit}
        />
      </FilterBar>

      <DataState error={error} loading={loading} noun="o efetivo humano" />

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
            {visible.map((user) => {
              const linkedDogs = dogsByHandler.get(user.ra) ?? [];
              const onShift = activeHandlerIds.has(user.ra);
              return (
                <article
                  className={cn(
                    "rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-4 shadow-[0_22px_60px_rgba(0,0,0,0.2)]",
                    viewMode === "list" &&
                      "grid items-center gap-5 lg:grid-cols-[120px_1fr_320px]",
                  )}
                  key={user.ra}
                >
                  <div className={cn("flex gap-4", viewMode === "list" && "contents")}>
                    <EntityImage
                      alt={user.callsign}
                      className={cn(
                        "h-32 w-28 shrink-0",
                        viewMode === "list" && "h-24 w-28",
                      )}
                      fallback={UserRound}
                      src={user.photoUrl}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="truncate text-xl font-black text-cyan-300">
                            {user.callsign}
                          </h2>
                          <p className="mt-1 font-mono text-xs text-slate-500">
                            RA {user.ra}
                          </p>
                        </div>
                        <StatusPill
                          label={
                            !user.active
                              ? "Inativo"
                              : onShift
                                ? "Em turno"
                                : "Ativo"
                          }
                          tone={!user.active ? "violet" : onShift ? "green" : "slate"}
                        />
                      </div>
                      <p className="mt-3 text-sm font-semibold text-slate-200">
                        {user.accessLevel}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {user.unit ?? "Unidade não informada"}
                      </p>
                      {user.fullName && user.fullName !== user.callsign ? (
                        <p className="mt-2 truncate text-xs text-slate-500">
                          {user.fullName}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div
                    className={cn(
                      "mt-4 grid grid-cols-2 gap-3 border-t border-white/8 pt-4",
                      viewMode === "list" &&
                        "mt-0 border-t-0 border-l pl-5 pt-0",
                    )}
                  >
                    <div className="rounded-xl border border-white/7 bg-white/[0.025] p-3">
                      <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-slate-500">
                        <Dog className="h-3.5 w-3.5" /> K9 vinculados
                      </p>
                      <p className="mt-2 font-mono text-xl font-black text-white">
                        {linkedDogs.length}
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {linkedDogs.map((dog) => dog.name).join(", ") || "Nenhum"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/7 bg-white/[0.025] p-3">
                      <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-slate-500">
                        {user.isK9Instructor ? (
                          <BadgeCheck className="h-3.5 w-3.5" />
                        ) : (
                          <ShieldCheck className="h-3.5 w-3.5" />
                        )}
                        Papel K9
                      </p>
                      <p className="mt-2 text-sm font-bold text-slate-200">
                        {user.isK9Instructor ? "Instrutor K9" : "Operacional"}
                      </p>
                    </div>
                  </div>
                  <div
                    className={cn(
                      "mt-4 flex gap-2 border-t border-white/8 pt-3",
                      viewMode === "list" &&
                        "col-span-full mt-0 justify-end border-t pt-3",
                    )}
                  >
                    <Link
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-2.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-300/[0.12] lg:flex-none"
                      href={`/humans/${encodeURIComponent(user.ra)}`}
                    >
                      <Eye className="h-4 w-4" /> Ver perfil
                    </Link>
                    {canEditHuman ? (
                      <Link
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-2.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-300/[0.12] lg:flex-none"
                        href={`/humans/${encodeURIComponent(user.ra)}/edit`}
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
            Nenhum agente corresponde aos filtros selecionados.
          </div>
        )
      ) : null}

      {!loading && !error ? (
        <PageFooter
          currentPage={safePage}
          itemLabel="agentes"
          onPage={setPage}
          pageSize={pageSize}
          total={filtered.length}
        />
      ) : null}
    </div>
  );
}
