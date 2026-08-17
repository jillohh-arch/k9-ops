"use client";

import type { K9ActivityItem } from "@/features/effective/lib/k9-profile-activity";

import { K9ActivityTimeline } from "./k9-profile-timeline";
import {
  ProfileCard,
  ProfileEmpty,
  ProfileError,
  ProfileSkeleton,
} from "./k9-profile-ui";

const MAX_ITEMS = 40;

export type K9ProfileHistoryProps = {
  activity: K9ActivityItem[];
  error: string | null;
  loading: boolean;
};

/**
 * Aba Histórico — timeline agregada de fatos reais.
 *
 * A agregação e a ordenação vivem em `buildK9Activity()`: só entram registros
 * com timestamp confiável, e nada é derivado do estado atual do cão. Não há
 * reclassificação clínica aqui — cada item mostra o que o registro diz.
 */
export function K9ProfileHistory({
  activity,
  error,
  loading,
}: K9ProfileHistoryProps) {
  const items = activity.slice(0, MAX_ITEMS);

  return (
    <div className="space-y-4">
      {error ? (
        <ProfileError>Falha ao carregar o histórico: {error}</ProfileError>
      ) : null}

      <ProfileCard title="Linha do tempo">
        {loading && !items.length ? (
          <div className="space-y-3">
            <ProfileSkeleton className="h-12" />
            <ProfileSkeleton className="h-12" />
            <ProfileSkeleton className="h-12" />
          </div>
        ) : items.length ? (
          <>
            {/* Mesma apresentação da Visão Geral, em variante completa. */}
            <K9ActivityTimeline items={items} />
            {activity.length > MAX_ITEMS ? (
              <p className="mt-3 text-[11px] text-slate-500">
                Exibindo os {MAX_ITEMS} eventos mais recentes de{" "}
                {activity.length} registrados.
              </p>
            ) : null}
          </>
        ) : (
          <ProfileEmpty>
            Nenhum evento com data confiável foi localizado para este K9.
            Registros sem timestamp não são exibidos.
          </ProfileEmpty>
        )}
      </ProfileCard>
    </div>
  );
}
