"use client";

import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";

import {
  parseHealthReadiness,
  type K9HealthReadiness,
} from "@/features/effective/lib/k9-roster-classification";
import { db } from "@/lib/firebase/client";

type RawRecord = Record<string, unknown> & { _id: string };

export type K9ReadinessSummary = {
  evaluatedAt: Date | null;
  state: K9HealthReadiness;
};

export type K9RosterDetail = {
  /** Erro localizado do drawer — nunca derruba o roster. */
  error: string | null;
  lastTrainingSession: {
    date: Date | null;
    modality: string | null;
    title: string;
  } | null;
  loading: boolean;
  /**
   * `null` significa fonte de prontidão indisponível nesta branch.
   * Não confundir com `not_evaluated`, que é uma afirmação clínica.
   */
  readiness: K9ReadinessSummary | null;
  /** `true` quando a fonte Health canônica não pôde ser lida. */
  readinessUnavailable: boolean;
};

const emptyDetail: K9RosterDetail = {
  error: null,
  lastTrainingSession: null,
  loading: false,
  readiness: null,
  readinessUnavailable: true,
};

function text(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" || typeof value === "number") {
      const parsed = String(value).trim();
      if (parsed) return parsed;
    }
  }
  return null;
}

function dateValue(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (value && typeof value === "object" && "toDate" in value) {
    const toDate = (value as { toDate?: unknown }).toDate;
    if (typeof toDate === "function") {
      const parsed = toDate.call(value);
      return parsed instanceof Date && !Number.isNaN(parsed.getTime())
        ? parsed
        : null;
    }
  }
  return null;
}

function recordDate(record: RawRecord) {
  return (
    dateValue(record.date) ??
    dateValue(record.performed_at ?? record.performedAt) ??
    dateValue(record.started_at ?? record.startedAt) ??
    dateValue(record.finalized_at ?? record.finalizedAt) ??
    dateValue(record.created_at ?? record.createdAt)
  );
}

function isArchived(record: RawRecord) {
  return (
    record.deleted_at != null ||
    record.deletedAt != null ||
    record.archived_at != null ||
    record.active === false
  );
}

/**
 * Detalhe do K9 carregado sob demanda.
 *
 * Só abre listeners enquanto `dogId` estiver definido; ao trocar ou fechar a
 * seleção, o cleanup do efeito cancela as inscrições. Nenhum listener de
 * Health/Treino é aberto para o roster inteiro.
 */
export function useK9RosterDetail(dogId: string | null): K9RosterDetail {
  // Cada estado carrega o `dogId` a que pertence. Assim a troca de seleção
  // não precisa de um reset síncrono: o estado de outro cão simplesmente não
  // é considerado válido, e o drawer mostra carregamento até o novo snapshot.
  const [readinessState, setReadinessState] = useState<{
    dogId: string | null;
    unavailable: boolean;
    value: K9ReadinessSummary | null;
  }>({ dogId: null, unavailable: true, value: null });
  const [sessionsState, setSessionsState] = useState<{
    dogId: string | null;
    error: string | null;
    pending: boolean;
    records: RawRecord[];
  }>({ dogId: null, error: null, pending: false, records: [] });

  useEffect(() => {
    if (!dogId) return;

    // Fonte preferencial de prontidão. Se a coleção não existir nesta branch
    // ou a leitura for negada, o drawer informa "não disponível" — nunca
    // inventa um estado clínico nem converte a falha em `not_evaluated`.
    return onSnapshot(
      doc(db, "dogs", dogId, "health_summary", "current"),
      (snapshot) => {
        const data = snapshot.exists() ? snapshot.data() : null;
        const state = parseHealthReadiness(
          data?.readiness ?? data?.readiness_state ?? data?.state,
        );

        setReadinessState({
          dogId,
          unavailable: !state,
          value: state
            ? {
                evaluatedAt:
                  dateValue(
                    data?.evaluated_at ??
                      data?.evaluatedAt ??
                      data?.updated_at ??
                      data?.updatedAt,
                  ) ?? null,
                state,
              }
            : null,
        });
      },
      () => {
        // Prontidão indisponível não é erro do drawer: é ausência de fonte.
        setReadinessState({ dogId, unavailable: true, value: null });
      },
    );
  }, [dogId]);

  useEffect(() => {
    if (!dogId) return;

    const groups = new Map<string, RawRecord[]>();
    const definitions = [
      {
        key: "dog-training-sessions",
        source: query(collection(db, "dogs", dogId, "training_sessions")),
      },
      {
        key: "root-training-sessions",
        source: query(
          collection(db, "training_sessions"),
          where("dogId", "==", dogId),
        ),
      },
    ];
    const pending = new Set(definitions.map((definition) => definition.key));
    const errors = new Map<string, string>();

    function publish() {
      setSessionsState({
        dogId,
        error: errors.size ? Array.from(errors.values()).join(" | ") : null,
        pending: pending.size > 0,
        records: Array.from(groups.values()).flat(),
      });
    }

    const unsubscribes = definitions.map((definition) =>
      onSnapshot(
        definition.source,
        (snapshot) => {
          groups.set(
            definition.key,
            snapshot.docs.map((item) => ({ ...item.data(), _id: item.id })),
          );
          pending.delete(definition.key);
          errors.delete(definition.key);
          publish();
        },
        (error) => {
          pending.delete(definition.key);
          errors.set(definition.key, error.message);
          publish();
        },
      ),
    );

    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [dogId]);

  return useMemo(() => {
    if (!dogId) return emptyDetail;

    // Só consideramos estado que pertence ao cão atualmente selecionado.
    const readinessFresh = readinessState.dogId === dogId;
    const sessionsFresh = sessionsState.dogId === dogId;
    const loading = !readinessFresh || !sessionsFresh || sessionsState.pending;

    // Escopo inicial: apenas a última sessão de treinamento válida.
    // Ocorrência e turno não são fundidos em um conceito genérico de
    // "atividade" sem uma regra documentada.
    const sessions = (sessionsFresh ? sessionsState.records : [])
      .filter((record) => !isArchived(record))
      .map((record) => ({ date: recordDate(record), record }))
      .filter((entry) => entry.date)
      .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));

    const latest = sessions[0];

    return {
      error: sessionsFresh ? sessionsState.error : null,
      lastTrainingSession: latest
        ? {
            date: latest.date,
            modality: text(
              latest.record.modality,
              latest.record.modalidade,
              latest.record.type,
            ),
            title:
              text(
                latest.record.title,
                latest.record.name,
                latest.record.session_type,
              ) ?? "Sessão de treinamento",
          }
        : null,
      loading,
      readiness: readinessFresh ? readinessState.value : null,
      // Enquanto o snapshot do cão atual não chega, não afirmamos
      // indisponibilidade: o drawer mostra carregamento.
      readinessUnavailable: readinessFresh
        ? readinessState.unavailable
        : false,
    };
  }, [dogId, readinessState, sessionsState]);
}
