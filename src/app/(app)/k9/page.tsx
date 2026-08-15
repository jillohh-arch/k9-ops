"use client";

import { Dog, PawPrint, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";

import { useAccessControl } from "@/features/access/providers/access-control-provider";
import { K9DetailDrawer } from "@/features/effective/components/k9-roster/k9-detail-drawer";
import { K9RosterCard } from "@/features/effective/components/k9-roster/k9-roster-card";
import { K9RosterFilters } from "@/features/effective/components/k9-roster/k9-roster-filters";
import {
  K9RosterSection,
  K9RosterSkeleton,
} from "@/features/effective/components/k9-roster/k9-roster-section";
import { K9RosterSummary } from "@/features/effective/components/k9-roster/k9-roster-summary";
import {
  ageInYears,
  specialtyLabel,
  useEffectiveData,
} from "@/features/effective/hooks/use-effective-data";
import { useK9RosterDetail } from "@/features/effective/hooks/use-k9-roster-detail";
import {
  K9_ROSTER_GROUP_LABEL,
  K9_ROSTER_GROUP_ORDER,
  groupCounts,
} from "@/features/effective/lib/k9-roster-classification";
import {
  classifyRosterDogs,
  emptyRosterFilters,
  filterRosterDogs,
  groupRosterDogs,
  hasActiveFilters as computeHasActiveFilters,
  type RosterFilters,
} from "@/features/effective/lib/k9-roster-filters";
import { paths } from "@/lib/routes/paths";
import { cn } from "@/lib/utils";

/** Largura mínima para o drawer inline; abaixo disso ele vira sheet. */
const INLINE_DRAWER_MIN_WIDTH = 1280;

const inlineDrawerQuery = `(min-width: ${INLINE_DRAWER_MIN_WIDTH}px)`;

function subscribeToInlineDrawer(onChange: () => void) {
  const media = window.matchMedia(inlineDrawerQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function useInlineDrawer() {
  return useSyncExternalStore(
    subscribeToInlineDrawer,
    () => window.matchMedia(inlineDrawerQuery).matches,
    // No servidor assumimos viewport estreito: o sheet é o fallback seguro.
    () => false,
  );
}

export default function K9Page() {
  const { can } = useAccessControl();
  const { binomials, dogs, error, loading, shifts, users } = useEffectiveData();
  const [filters, setFilters] = useState<RosterFilters>(emptyRosterFilters);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedDogId, setSelectedDogId] = useState<string | null>(null);
  const inlineDrawer = useInlineDrawer();

  // Detalhe on-demand: só existe listener enquanto houver seleção.
  const detail = useK9RosterDetail(selectedDogId);

  const usersByRa = useMemo(
    () => new Map(users.map((user) => [user.ra, user])),
    [users],
  );
  const handlerLabelByRa = useMemo(
    () => new Map(users.map((user) => [user.ra, user.callsign])),
    [users],
  );

  // Sem readiness Health canônica nesta branch, a classificação usa apenas
  // dados administrativos e de formação. Nada é inventado.
  const classifications = useMemo(() => classifyRosterDogs(dogs), [dogs]);
  const counts = useMemo(
    () => groupCounts(Array.from(classifications.values())),
    [classifications],
  );

  const statusOptions = useMemo(
    () =>
      Array.from(new Set(dogs.map((dog) => dog.status).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b, "pt-BR"))
        .map((status) => ({ label: status, value: status })),
    [dogs],
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

  const filtered = useMemo(
    () =>
      filterRosterDogs({
        classifications,
        dogs,
        filters,
        handlerLabelByRa,
      }),
    [classifications, dogs, filters, handlerLabelByRa],
  );
  const grouped = useMemo(
    () =>
      groupRosterDogs({
        classifications,
        dogs: filtered,
        order: K9_ROSTER_GROUP_ORDER,
      }),
    [classifications, filtered],
  );

  const hasActiveFilters = computeHasActiveFilters(filters);
  const canCreateK9 = can("k9", "create");

  const selectedDog = useMemo(
    () => dogs.find((dog) => dog.id === selectedDogId) ?? null,
    [dogs, selectedDogId],
  );

  // Se o K9 selecionado sai da lista (filtro ou remoção), a seleção é limpa
  // para não manter um drawer apontando para nada.
  const selectionStillVisible = filtered.some(
    (dog) => dog.id === selectedDogId,
  );
  const activeDog = selectionStillVisible ? selectedDog : null;

  const selectedBinomial = useMemo(
    () =>
      activeDog
        ? (binomials.find(
            (binomial) => binomial.dogId === activeDog.id && binomial.active,
          ) ?? null)
        : null,
    [activeDog, binomials],
  );
  const selectedConductor = activeDog?.conductorRa
    ? (usersByRa.get(activeDog.conductorRa) ?? null)
    : null;
  // Turno ativo real, nunca inferido da existência de um condutor.
  const hasActiveShift = activeDog
    ? shifts.some((shift) => shift.dogId === activeDog.id)
    : false;

  function updateFilters(patch: Partial<RosterFilters>) {
    setFilters((previous) => ({ ...previous, ...patch }));
  }

  const drawerOpen = Boolean(activeDog);
  const showInlineDrawer = drawerOpen && inlineDrawer;

  return (
    <div className="space-y-4">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200 shadow-[0_0_28px_rgba(77,208,225,0.14)]">
            <PawPrint aria-hidden className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h1 className="text-3xl font-black leading-tight text-white">
              Efetivo K9
            </h1>
            <p className="text-sm text-slate-400">
              Visão operacional da matilha da unidade
            </p>
          </div>
        </div>
        {canCreateK9 ? (
          <Link
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 shadow-[0_0_24px_rgba(77,208,225,0.24)] transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/80"
            href={paths.k9New}
          >
            <Plus aria-hidden className="h-4 w-4" />
            Cadastrar K9
          </Link>
        ) : null}
      </header>

      <K9RosterSummary
        formation={counts.formation}
        loading={loading}
        ready={counts.ready}
        total={dogs.length}
        unavailable={counts.unavailable}
      />

      <K9RosterFilters
        filters={filters}
        handlerOptions={handlerOptions}
        hasActiveFilters={hasActiveFilters}
        onChange={updateFilters}
        onClear={() => setFilters(emptyRosterFilters)}
        onViewMode={setViewMode}
        specialtyOptions={specialtyOptions}
        statusOptions={statusOptions}
        viewMode={viewMode}
      />

      {/* Falha da listagem informa o erro e nunca vira contagem zero. */}
      {error ? (
        <div
          className="rounded-3xl border border-red-300/15 bg-red-300/[0.04] p-6 text-sm text-red-200/85"
          role="status"
        >
          <p className="font-bold">Falha ao carregar o efetivo K9.</p>
          <p className="mt-1 text-red-200/70">{error}</p>
          <p className="mt-2 text-xs text-red-200/60">
            Os números acima podem estar incompletos — não interprete como
            efetivo zerado.
          </p>
        </div>
      ) : null}

      <div
        className={cn(
          "gap-4",
          showInlineDrawer ? "grid xl:grid-cols-[minmax(0,1fr)_410px]" : "block",
        )}
      >
        <div className="min-w-0 space-y-5">
          {loading && !error ? <K9RosterSkeleton /> : null}

          {!loading && !error && !dogs.length ? (
            <div className="rounded-3xl border border-dashed border-cyan-200/12 bg-[#0b1628]/60 p-10 text-center">
              <Dog aria-hidden className="mx-auto h-8 w-8 text-cyan-300/50" />
              <p className="mt-3 text-base font-black text-white">
                Nenhum K9 cadastrado
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Cadastre o primeiro K9 para montar o efetivo da unidade.
              </p>
              {canCreateK9 ? (
                <Link
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-200"
                  href={paths.k9New}
                >
                  <Plus aria-hidden className="h-4 w-4" />
                  Cadastrar K9
                </Link>
              ) : null}
            </div>
          ) : null}

          {!loading && !error && dogs.length && !filtered.length ? (
            <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center">
              <p className="text-sm text-slate-400">
                Nenhum K9 corresponde aos filtros selecionados.
              </p>
              <button
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-cyan-300/25 bg-cyan-300/[0.07] px-4 py-2 text-xs font-bold text-cyan-200 transition hover:border-cyan-300/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
                onClick={() => setFilters(emptyRosterFilters)}
                type="button"
              >
                Limpar filtros
              </button>
            </div>
          ) : null}

          {!loading && !error
            ? grouped.map(({ dogs: groupDogs, group }) => (
                <K9RosterSection
                  count={groupDogs.length}
                  group={group}
                  key={group}
                  viewMode={viewMode}
                >
                  {groupDogs.map((dog) => {
                    const classification = classifications.get(dog.id);
                    const handler = dog.conductorRa
                      ? usersByRa.get(dog.conductorRa)
                      : null;

                    return (
                      <K9RosterCard
                        breed={dog.breed}
                        dog={dog}
                        group={classification?.group ?? "unclassified_active"}
                        handlerLabel={
                          handler?.callsign ?? dog.conductorRa ?? null
                        }
                        key={dog.id}
                        onSelect={setSelectedDogId}
                        restrictionNote={
                          classification?.hasNonBlockingRestriction
                            ? "Restrição registrada"
                            : null
                        }
                        selected={dog.id === activeDog?.id}
                        specialtyLabels={dog.specialties.map((item) =>
                          specialtyLabel(item.type),
                        )}
                        statusLabel={
                          classification
                            ? K9_ROSTER_GROUP_LABEL[classification.group]
                            : dog.status
                        }
                        viewMode={viewMode}
                      />
                    );
                  })}
                </K9RosterSection>
              ))
            : null}
        </div>

        {activeDog ? (
          <K9DetailDrawer
            ageYears={ageInYears(activeDog.dateOfBirth)}
            asOverlay={!inlineDrawer}
            binomial={selectedBinomial}
            classification={classifications.get(activeDog.id) ?? null}
            conductor={selectedConductor}
            detail={detail}
            dog={activeDog}
            hasActiveShift={hasActiveShift}
            microchip={activeDog.microchip}
            onClose={() => setSelectedDogId(null)}
            pelage={activeDog.color}
            specialtyLabels={activeDog.specialties.map((item) =>
              specialtyLabel(item.type),
            )}
          />
        ) : null}
      </div>
    </div>
  );
}
