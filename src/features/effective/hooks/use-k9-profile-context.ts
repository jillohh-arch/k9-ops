"use client";

import { useMemo } from "react";

import {
  useEffectiveData,
  type EffectiveBinomial,
  type EffectiveDog,
  type EffectiveUser,
} from "@/features/effective/hooks/use-effective-data";
import { useK9RosterDetail } from "@/features/effective/hooks/use-k9-roster-detail";
import { buildK9ProfileStatus } from "@/features/effective/lib/k9-profile-status";

export type K9ProfileBinomialContext = {
  binomial: EffectiveBinomial | null;
  conductor: EffectiveUser | null;
  /** Turno ativo real; nunca inferido de `conductorRa`. */
  hasActiveShift: boolean;
  /** `true` quando o condutor veio de `dogs.conductorRa` (fallback legacy). */
  isLegacyFallback: boolean;
};

/**
 * Contexto agregado do Perfil K9.
 *
 * Reúne, nas mesmas fontes conceituais do Drawer do Roster:
 * - prontidão clínica e última atividade (`useK9RosterDetail`);
 * - binômio ativo, condutor e turno ativo (`useEffectiveData`);
 * - os conceitos de status separados (`buildK9ProfileStatus`).
 *
 * O Perfil não abre uma segunda leitura de `health_summary/current` nem
 * reimplementa a resolução de vínculo: divergir do Drawer seria criar uma
 * segunda verdade sobre o mesmo cão.
 */
export function useK9ProfileContext(dog: EffectiveDog | null) {
  const dogId = dog?.id ?? null;
  const detail = useK9RosterDetail(dogId);
  const { binomials, error, loading, shifts, users } = useEffectiveData();

  const binomialContext = useMemo<K9ProfileBinomialContext>(() => {
    if (!dog) {
      return {
        binomial: null,
        conductor: null,
        hasActiveShift: false,
        isLegacyFallback: false,
      };
    }

    // Autoridade preferencial: vínculo ativo real em `binomials`.
    const binomial =
      binomials.find((item) => item.dogId === dog.id && item.active) ?? null;

    const byRa = new Map(users.map((user) => [user.ra, user]));
    const binomialConductor = binomial
      ? (byRa.get(binomial.handlerRa) ?? null)
      : null;

    // `dogs.conductorRa` permanece apenas como compatibilidade: é usado quando
    // não há vínculo ativo resolvível, e o consumidor é informado via
    // `isLegacyFallback` para poder rotular a origem honestamente.
    const legacyConductor =
      !binomial && dog.conductorRa ? (byRa.get(dog.conductorRa) ?? null) : null;

    return {
      binomial,
      conductor: binomialConductor ?? legacyConductor,
      // Turno ativo é fato próprio: vem de `active_shifts` para este cão.
      hasActiveShift: shifts.some((shift) => shift.dogId === dog.id),
      isLegacyFallback: !binomial && legacyConductor != null,
    };
  }, [binomials, dog, shifts, users]);

  const status = useMemo(
    () =>
      buildK9ProfileStatus({
        hasActiveShift: binomialContext.hasActiveShift,
        readiness: detail.readiness?.state ?? null,
        specialties: dog?.specialties ?? null,
        status: dog?.status ?? null,
      }),
    [binomialContext.hasActiveShift, detail.readiness, dog],
  );

  return {
    binomialContext,
    detail,
    /** Erro do contexto secundário — nunca derruba o Perfil inteiro. */
    error,
    loading,
    status,
  };
}
