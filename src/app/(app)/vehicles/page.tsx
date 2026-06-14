"use client";

import {
  Activity,
  Car,
  Eye,
  Gauge,
  Pencil,
  Plus,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { useAccessControl } from "@/features/access/providers/access-control-provider";
import {
  DataState,
  EffectiveHeader,
  FilterBar,
  FilterSelect,
  PageFooter,
  StatusPill,
  SummaryCard,
  type ViewMode,
} from "@/features/effective/components/effective-ui";
import { useEffectiveData } from "@/features/effective/hooks/use-effective-data";
import { cn } from "@/lib/utils";

const pageSize = 8;

function searchText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function statusTone(status: string, active: boolean) {
  const normalized = searchText(status);
  if (!active || normalized.includes("baix")) return "violet" as const;
  if (normalized.includes("manut")) return "amber" as const;
  if (normalized.includes("reserva")) return "blue" as const;
  return "green" as const;
}

function dateLabel(date: Date | null) {
  return date
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date)
    : "--";
}

export default function VehiclesPage() {
  const { can } = useAccessControl();
  const { error, loading, shifts, vehicles } = useEffectiveData();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [page, setPage] = useState(1);
  const occupiedVehicleIds = useMemo(
    () => new Set(shifts.map((shift) => shift.vehicleId).filter(Boolean)),
    [shifts],
  );
  const typeOptions = useMemo(
    () =>
      Array.from(new Set(vehicles.map((vehicle) => vehicle.model).filter(Boolean)))
        .sort()
        .map((value) => ({ label: value!, value: value! })),
    [vehicles],
  );
  const filtered = useMemo(() => {
    const needle = searchText(search);
    return vehicles.filter((vehicle) => {
      const normalizedStatus = searchText(vehicle.status);
      const matchesSearch =
        !needle ||
        [
          vehicle.label,
          vehicle.prefix,
          vehicle.plate,
          vehicle.model,
          vehicle.unit,
          vehicle.base,
        ].some((value) => searchText(value).includes(needle));
      const matchesStatus =
        status === "all" ||
        (status === "active" && vehicle.active && !normalizedStatus.includes("manut")) ||
        (status === "maintenance" && normalizedStatus.includes("manut")) ||
        (status === "reserve" && normalizedStatus.includes("reserva")) ||
        (status === "archived" && !vehicle.active);
      const matchesType = type === "all" || vehicle.model === type;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [search, status, type, vehicles]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const active = vehicles.filter((vehicle) => vehicle.active).length;
  const maintenance = vehicles.filter((vehicle) =>
    searchText(vehicle.status).includes("manut"),
  ).length;
  const inUse = vehicles.filter((vehicle) =>
    occupiedVehicleIds.has(vehicle.id),
  ).length;
  const canCreateVehicle = can("vehicles", "create");
  const canEditVehicle = can("vehicles", "edit");

  function updateFilter(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <EffectiveHeader
          description="Frota operacional, manutenção e disponibilidade das viaturas K9."
          title="Viaturas"
        />
        {canCreateVehicle ? (
          <Link
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-[0_0_24px_rgba(77,208,225,0.24)] hover:bg-cyan-200"
            href="/vehicles/new"
          >
            <Plus className="h-4 w-4" /> Nova viatura
          </Link>
        ) : null}
      </div>

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <SummaryCard
          detail="cadastros visíveis"
          icon={Car}
          label="Viaturas cadastradas"
          tone="cyan"
          value={loading ? "..." : String(vehicles.length)}
        />
        <SummaryCard
          detail="aptas ou reservadas"
          icon={ShieldCheck}
          label="Ativas"
          tone="green"
          value={loading ? "..." : String(active)}
        />
        <SummaryCard
          detail="presentes em active_shifts"
          icon={Activity}
          label="Em uso agora"
          tone="blue"
          value={loading ? "..." : String(inUse)}
        />
        <SummaryCard
          detail="status contem manutenção"
          icon={Wrench}
          label="Em manutenção"
          tone="amber"
          value={loading ? "..." : String(maintenance)}
        />
      </section>

      <FilterBar
        onSearch={(value) => updateFilter(setSearch, value)}
        onViewMode={setViewMode}
        placeholder="Buscar por prefixo, placa, modelo ou base..."
        search={search}
        viewMode={viewMode}
      >
        <FilterSelect
          label="Status"
          onChange={(value) => updateFilter(setStatus, value)}
          options={[
            { label: "Status: Todos", value: "all" },
            { label: "Ativas", value: "active" },
            { label: "Em manutenção", value: "maintenance" },
            { label: "Reserva", value: "reserve" },
            { label: "Baixadas", value: "archived" },
          ]}
          value={status}
        />
        <FilterSelect
          label="Modelo"
          onChange={(value) => updateFilter(setType, value)}
          options={[{ label: "Modelo: Todos", value: "all" }, ...typeOptions]}
          value={type}
        />
      </FilterBar>

      <DataState error={error} loading={loading} noun="as viaturas" />

      {!loading && !error ? (
        visible.length ? (
          <section
            className={cn(
              "grid gap-4",
              viewMode === "grid" ? "md:grid-cols-2 2xl:grid-cols-4" : "grid-cols-1",
            )}
          >
            {visible.map((vehicle) => (
              <article
                className={cn(
                  "relative overflow-hidden rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-4 shadow-[0_22px_60px_rgba(0,0,0,0.2)]",
                  viewMode === "list" && "grid items-center gap-5 lg:grid-cols-[1fr_440px]",
                )}
                key={vehicle.id}
              >
                <div className="absolute right-0 top-2 h-28 w-52 bg-[url('/assets/card_viatura.png')] bg-contain bg-right bg-no-repeat opacity-25" />
                <div className="relative">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs font-bold text-cyan-300">
                        Prefixo {vehicle.prefix}
                      </p>
                      <h2 className="mt-1 text-xl font-black text-white">
                        {vehicle.label}
                      </h2>
                    </div>
                    <StatusPill
                      label={vehicle.status}
                      tone={statusTone(vehicle.status, vehicle.active)}
                    />
                  </div>
                  <div className="mt-5 grid gap-3 border-y border-white/8 py-4 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                        Modelo
                      </p>
                      <p className="mt-1 font-semibold text-slate-200">
                        {vehicle.model ?? "--"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                        Placa
                      </p>
                      <p className="mt-1 font-mono font-semibold text-slate-200">
                        {vehicle.plate ?? "--"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                        Quilometragem
                      </p>
                      <p className="mt-1 font-semibold text-slate-200">
                        {vehicle.mileageKm == null
                          ? "--"
                          : `${vehicle.mileageKm.toLocaleString("pt-BR")} km`}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                        Próxima revisão
                      </p>
                      <p className="mt-1 font-semibold text-slate-200">
                        {dateLabel(vehicle.nextReviewAt)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Gauge className="h-3.5 w-3.5 text-cyan-300/70" />
                      {vehicle.crewSize} vagas na guarnição
                    </span>
                    <span>{vehicle.unit ?? "Sem lotação"}</span>
                  </div>
                </div>
                <div className="relative mt-4 flex gap-2 border-t border-white/8 pt-3">
                  <Link
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-2.5 text-xs font-bold text-cyan-200 hover:bg-cyan-300/[0.12]"
                    href={`/vehicles/${encodeURIComponent(vehicle.id)}`}
                  >
                    <Eye className="h-4 w-4" /> Visualizar
                  </Link>
                  {canEditVehicle ? (
                    <Link
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-2.5 text-xs font-bold text-cyan-200 hover:bg-cyan-300/[0.12]"
                      href={`/vehicles/${encodeURIComponent(vehicle.id)}/edit`}
                    >
                      <Pencil className="h-4 w-4" /> Editar
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </section>
        ) : (
          <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
            Nenhuma viatura corresponde aos filtros selecionados.
          </div>
        )
      ) : null}

      {!loading && !error ? (
        <PageFooter
          currentPage={safePage}
          itemLabel="viaturas"
          onPage={setPage}
          pageSize={pageSize}
          total={filtered.length}
        />
      ) : null}
    </div>
  );
}
