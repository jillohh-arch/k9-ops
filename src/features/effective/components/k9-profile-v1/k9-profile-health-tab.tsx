"use client";

import { useMemo } from "react";

import type { ProfileRecord } from "@/features/effective/hooks/use-k9-profile-data";
import type { buildK9ProfileStatus } from "@/features/effective/lib/k9-profile-status";
import { useHealthData } from "@/features/health/hooks/use-health-data";

import { K9ProfileHealth } from "./k9-profile-health";

/**
 * Fronteira de carregamento da aba Saúde.
 *
 * `useHealthData()` assina o efetivo inteiro (é a fonte do módulo Saúde), então
 * este componente só é montado quando a aba está ativa — é o que mantém o custo
 * fora do primeiro render do Perfil (seção 26). Consumir o hook, em vez de
 * reimplementar vacina/peso localmente, é o que garante uma única regra.
 */
export function K9ProfileHealthTab({
  dogId,
  events,
  status,
}: {
  dogId: string;
  events: ProfileRecord[];
  status: ReturnType<typeof buildK9ProfileStatus>;
}) {
  // 30 dias é o período padrão do módulo; a métrica de período não é usada
  // aqui, apenas o resumo por cão.
  const health = useHealthData(30);

  const summary = useMemo(
    () => health.dogs.find((item) => item.dogId === dogId) ?? null,
    [health.dogs, dogId],
  );

  return (
    <K9ProfileHealth
      error={health.errors.length ? health.errors.join(" | ") : null}
      events={events}
      loading={health.loading}
      status={status}
      summary={summary}
    />
  );
}
