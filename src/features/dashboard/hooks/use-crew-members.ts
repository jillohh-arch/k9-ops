"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import { isActiveVehicleCrew } from "@/features/dashboard/components/dashboard-utils";
import type { DashboardRecord } from "@/features/dashboard/components/dashboard-types";

/**
 * Assina `vehicle_crews/{crewId}/members` para cada crew ativa.
 *
 * Retorna Record<crewId, membros[]> da sub-coleção.
 * Atualiza em tempo real quando membros aderem/saem da guarnição.
 *
 * Filtra "ended" no lado do cliente para incluir tanto "active" quanto
 * "titular" (o criador da guarnição cujo status no Firestore é "titular").
 *
 * A dependência do effect é estabilizada via string de IDs de crews ativas,
 * evitando re-subscription quando o doc pai atualiza campos como `updated_at`.
 *
 * Usa `isActiveVehicleCrew` — mesma lógica de `useCrewPayload` — para que
 * as crews subscritas correspondam exatamente às exibidas no card.
 */
export function useCrewMembers(
  vehicleCrews: DashboardRecord[],
): Record<string, DashboardRecord[]> {
  const [crewMembers, setCrewMembers] = useState<Record<string, DashboardRecord[]>>({});

  const unsubsRef = useRef<Map<string, Unsubscribe>>(new Map());

  // Derivar string estável de IDs de crews ativas — só muda quando o conjunto muda,
  // não a cada snapshot que atualiza `updated_at` no doc pai.
  const activeCrewIdsKey = useMemo(() => {
    return vehicleCrews
      .filter((crew) => isActiveVehicleCrew(crew))
      .map((crew) => crew._id)
      .sort()
      .join(",");
  }, [vehicleCrews]);

  useEffect(() => {
    const activeCrewIds = new Set(activeCrewIdsKey ? activeCrewIdsKey.split(",") : []);

    // Cancelar subscriptions de crews que não estão mais ativas
    for (const [crewId, unsub] of unsubsRef.current) {
      if (!activeCrewIds.has(crewId)) {
        unsub();
        unsubsRef.current.delete(crewId);
        setCrewMembers((prev) => {
          const { [crewId]: _removed, ...rest } = prev;
          return rest;
        });
      }
    }

    // Criar subscriptions para crews novas
    for (const crewId of activeCrewIds) {
      if (!crewId || unsubsRef.current.has(crewId)) continue;

      const membersRef = collection(db, "vehicle_crews", crewId, "members");

      // Sem filtro de status no Firestore — trazemos todos os docs e
      // excluímos "ended" no cliente. Isso captura tanto status "active"
      // quanto "titular" (e qualquer status futuro != ended).
      const unsub = onSnapshot(
        membersRef,
        (snapshot) => {
          const members = snapshot.docs
            .map((d) => ({ ...d.data(), _id: d.id } as DashboardRecord))
            .filter((m) => m.status !== "ended");
          setCrewMembers((prev) => ({
            ...prev,
            [crewId]: members,
          }));
        },
        (error) => {
          console.error(`[useCrewMembers] crew ${crewId} falhou:`, error);
          setCrewMembers((prev) => ({
            ...prev,
            [crewId]: [],
          }));
        },
      );

      unsubsRef.current.set(crewId, unsub);
    }
  }, [activeCrewIdsKey]);

  // Cleanup final quando o componente desmonta
  useEffect(() => {
    return () => {
      for (const unsub of unsubsRef.current.values()) {
        unsub();
      }
      unsubsRef.current.clear();
    };
  }, []);

  return crewMembers;
}
