"use client";

import { useEffect, useRef, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import type { DashboardRecord } from "@/features/dashboard/components/dashboard-types";

/**
 * Assina `vehicle_crews/{crewId}/members` para cada crew ativa.
 *
 * Retorna um Map: crewId → membros da sub-coleção.
 * Atualiza em tempo real quando membros aderem/saem da guarnição.
 */
export function useCrewMembers(
  vehicleCrews: DashboardRecord[],
): Record<string, DashboardRecord[]> {
  const [crewMembers, setCrewMembers] = useState<Record<string, DashboardRecord[]>>({});

  // useRef armazena as subscriptions entre renders.
  // Cada re-execução do useEffect reconcilia as subscriptions com o estado atual.
  const unsubsRef = useRef<Map<string, Unsubscribe>>(new Map());
  const prevCrewsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const activeCrewIds = new Set(
      vehicleCrews
        .filter((crew) => crew.active === true || crew["active"] === "true")
        .map((crew) => crew._id),
    );

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
      if (unsubsRef.current.has(crewId)) continue;

      const membersRef = collection(db, "vehicle_crews", crewId, "members");
      const q = query(membersRef, where("status", "==", "active"));

      const unsub = onSnapshot(
        q,
        (snapshot) => {
          const members = snapshot.docs.map((d) => ({
            ...d.data(),
            _id: d.id,
          }));
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

    prevCrewsRef.current = activeCrewIds;
  }, [vehicleCrews]);

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
