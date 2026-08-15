import {
  classifyK9,
  type K9Classification,
  type K9HealthReadiness,
  type K9RosterGroup,
} from "@/features/effective/lib/k9-roster-classification";

export type RosterDogInput = {
  breed?: string | null;
  conductorRa?: string | null;
  id: string;
  name: string;
  registrationNumber?: string | null;
  specialties?: readonly { status?: string | null; type?: string | null }[]
    | null;
  status?: string | null;
};

export type RosterFilters = {
  /** Grupo de emprego/situação derivado da classificação. */
  employment: string;
  handler: string;
  search: string;
  specialty: string;
  /** Status administrativo cru (`Ativo`, `Licenca`, ...). */
  status: string;
};

export const emptyRosterFilters: RosterFilters = {
  employment: "all",
  handler: "all",
  search: "",
  specialty: "all",
  status: "all",
};

export function hasActiveFilters(filters: RosterFilters) {
  return (
    filters.search.trim() !== "" ||
    filters.status !== "all" ||
    filters.employment !== "all" ||
    filters.specialty !== "all" ||
    filters.handler !== "all"
  );
}

export function searchText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/**
 * Fluxo canônico: dados base → filtros → classificação → grupos.
 *
 * O filtro de emprego é a única exceção: ele consulta a classificação, porque
 * é exatamente isso que ele significa. A classificação é calculada uma vez por
 * cão e reaproveitada, então isso não reintroduz trabalho duplicado.
 */
export function filterRosterDogs<T extends RosterDogInput>({
  classifications,
  dogs,
  filters,
  handlerLabelByRa,
}: {
  classifications: Map<string, K9Classification>;
  dogs: readonly T[];
  filters: RosterFilters;
  handlerLabelByRa?: Map<string, string>;
}): T[] {
  const needle = searchText(filters.search.trim());

  return dogs.filter((dog) => {
    const handlerLabel = dog.conductorRa
      ? handlerLabelByRa?.get(dog.conductorRa)
      : null;

    const matchesSearch =
      !needle ||
      [
        dog.name,
        dog.registrationNumber,
        dog.breed,
        handlerLabel,
        dog.conductorRa,
      ].some((value) => searchText(value).includes(needle));

    const matchesStatus =
      filters.status === "all" ||
      searchText(dog.status) === searchText(filters.status);

    const group = classifications.get(dog.id)?.group;
    const matchesEmployment =
      filters.employment === "all" || group === filters.employment;

    const matchesSpecialty =
      filters.specialty === "all" ||
      (dog.specialties ?? []).some((item) => item.type === filters.specialty);

    const matchesHandler =
      filters.handler === "all" || dog.conductorRa === filters.handler;

    return (
      matchesSearch &&
      matchesStatus &&
      matchesEmployment &&
      matchesSpecialty &&
      matchesHandler
    );
  });
}

export function classifyRosterDogs<T extends RosterDogInput>(
  dogs: readonly T[],
  readinessByDog?: Map<string, K9HealthReadiness | null>,
): Map<string, K9Classification> {
  return new Map(
    dogs.map((dog) => [
      dog.id,
      classifyK9({
        readiness: readinessByDog?.get(dog.id) ?? null,
        specialties: dog.specialties ?? [],
        status: dog.status,
      }),
    ]),
  );
}

/**
 * Agrupa os cães já filtrados. Grupos sem registros não são devolvidos, para
 * que a UI nunca renderize uma seção vazia.
 */
export function groupRosterDogs<T extends RosterDogInput>({
  classifications,
  dogs,
  order,
}: {
  classifications: Map<string, K9Classification>;
  dogs: readonly T[];
  order: readonly K9RosterGroup[];
}): Array<{ dogs: T[]; group: K9RosterGroup }> {
  const buckets = new Map<K9RosterGroup, T[]>();

  for (const dog of dogs) {
    const group = classifications.get(dog.id)?.group;
    if (!group) continue;
    const bucket = buckets.get(group);
    if (bucket) {
      bucket.push(dog);
    } else {
      buckets.set(group, [dog]);
    }
  }

  return order
    .filter((group) => (buckets.get(group)?.length ?? 0) > 0)
    .map((group) => ({ dogs: buckets.get(group) ?? [], group }));
}
