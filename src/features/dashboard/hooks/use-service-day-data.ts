"use client";

import { useMemo } from "react";

import {
  isShiftWorkDay,
  type ShiftAssignment as ShiftAssignmentType,
  type ShiftGroup as ShiftGroupType,
} from "@/features/effective/data/shift-group-service";
import {
  hasValue,
  isActiveVehicleCrew,
  isK9Instructor,
  recordText,
  visibleRecords,
} from "@/features/dashboard/components/dashboard-utils";
import type {
  DashboardCollections,
  DashboardRecord,
  ServiceDayCrew,
  ServiceDayMember,
  ServiceDayShift,
  ServiceDogMember,
} from "@/features/dashboard/components/dashboard-types";

/* ─── Helpers ─── */

function findUser(
  users: ReturnType<typeof visibleRecords>,
  userId: string,
) {
  return users.find(
    (u) =>
      u._id === userId ||
      (u as Record<string, unknown>).ra === userId ||
      (u as Record<string, unknown>).uid === userId,
  );
}

function userMember(
  user: Record<string, unknown> | undefined,
  userId: string,
): ServiceDayMember {
  const callsign =
    recordText(user ?? {}, [
      "warName",
      "war_name",
      "callSign",
      "callsign",
    ]) ||
    recordText(user ?? {}, [
      "displayName",
      "display_name",
      "name",
      "nome",
    ]) ||
    userId;

  return {
    id: userId,
    callsign,
    ra: userId,
    photoUrl:
      recordText(user ?? {}, [
        "photoUrl",
        "photo_url",
        "image_url",
        "profileImageUrl",
        "profile_image_url",
      ]) || undefined,
    isK9Instructor: isK9Instructor(user ?? {}),
  };
}

function dogSpecializations(dog: Record<string, unknown>): string[] {
  const modalities = dog.modalities ?? dog.specializations ?? dog.modalidade;
  if (!modalities) return [];
  if (Array.isArray(modalities)) {
    return (modalities as string[]).map(String).filter(Boolean);
  }
  return String(modalities)
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/* ─── Hook — Plantão de serviço ─── */

export function useShiftPayload(params: {
  shiftGroups: ShiftGroupType[];
  shiftAssignments: ShiftAssignmentType[];
  users: DashboardCollections["users"];
}) {
  return useMemo(() => {
    const today = new Date();
    const activeGroups = params.shiftGroups.filter((g) =>
      isShiftWorkDay(g, today),
    );
    const users = visibleRecords(params.users.records);

    const shifts: ServiceDayShift[] = activeGroups
      .map((group) => {
        const memberIds = params.shiftAssignments
          .filter(
            (a) => a.shiftGroupId === group.id && a.active,
          )
          .map((a) => a.userId);

        const members = memberIds
          .map((uid) => {
            const user = findUser(users, uid);
            return userMember(user, uid);
          })
          .sort((a, b) => a.callsign.localeCompare(b.callsign));

        return { id: group.id, name: group.name, members };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return shifts;
  }, [
    params.shiftGroups,
    params.shiftAssignments,
    params.users.records,
  ]);
}

/* ─── Role mapping (Firestore → display) ─── */

const ROLE_DISPLAY_MAP: Record<string, string> = {
  motorista: "MOT",
  encarregado: "ENC",
  auxiliar_1: "AUX1",
  auxiliar_2: "AUX2",
  // "titular" é o status/role do criador da guarnição no mobile atual
  titular: "Titular",
};

function mapRoleToDisplay(role: string | undefined): string {
  if (!role) return "Função não informada";
  return ROLE_DISPLAY_MAP[role] ?? "Função não informada";
}

/* ─── Hook — Equipe de serviço ─── */

export function useCrewPayload(params: {
  vehicleCrews: DashboardCollections["vehicleCrews"];
  activeShifts: DashboardCollections["activeShifts"];
  dogs: DashboardCollections["dogs"];
  users: DashboardCollections["users"];
  /** Mapa de membros por crewId (da sub-coleção members). */
  crewMembers?: Record<string, DashboardRecord[]>;
}) {
  return useMemo(() => {
    const crews = visibleRecords(params.vehicleCrews.records);
    const activeCrewRecords = crews.filter(isActiveVehicleCrew);

    if (activeCrewRecords.length === 0) {
      return null;
    }

    // Take the first active crew
    const crew = activeCrewRecords[0];
    const crewId = crew._id;
    const users = visibleRecords(params.users.records);
    const dogRecords = visibleRecords(params.dogs.records);
    const shiftRecords = visibleRecords(params.activeShifts.records);

    // Vehicle info
    const vehicleLabel =
      recordText(crew, [
        "vehicle_label",
        "vehicleLabel",
        "label",
        "name",
      ]) ||
      recordText(crew, ["vehicle_prefix", "vehiclePrefix", "prefix"]) ||
      "Viatura K9";

    const vehiclePrefix = recordText(crew, [
      "vehicle_prefix",
      "vehiclePrefix",
      "prefix",
    ]) || vehicleLabel;

    const vehicleModel = recordText(crew, ["vehicle_model", "model"]) || "";
    const vehicleUnit = recordText(crew, ["vehicle_unit", "unit"]) || "";

    // Titular handler from crew doc
    const titularId = recordText(crew, [
      "titular_handler_id",
      "handler_id",
      "handlerId",
    ]);

    // Members: usar sub-coleção se disponível, senão reconstruir de active_shifts
    const membersFromSubcollection = params.crewMembers?.[crewId] ?? [];
    // Incluir "active" e "titular" (criador da guarnição) — excluir apenas "ended" (histórico)
    const activeMembersFromSubcollection = membersFromSubcollection.filter(
      (m) => m.status !== "ended",
    );

    // Se temos membros da sub-coleção, usar como source-of-truth
    let members: Array<ServiceDayMember & { role: string }> = [];

    if (activeMembersFromSubcollection.length > 0) {
      // Mapear membros da sub-coleção
      members = activeMembersFromSubcollection.map((member) => {
        const handlerId = String(member.handler_id ?? "");
        const user = findUser(users, handlerId);

        // User data para callsign e photoUrl
        const callsign: string =
          (
            user
              ? recordText(user, [
                  "warName",
                  "war_name",
                  "callSign",
                  "callsign",
                ]) ||
                recordText(user, [
                  "displayName",
                  "display_name",
                  "name",
                  "nome",
                ])
              : null
          ) ||
          String(member.name ?? "") ||
          handlerId;

        const photoUrl = user
          ? recordText(user, [
              "photoUrl",
              "photo_url",
              "image_url",
              "profileImageUrl",
              "profile_image_url",
            ]) || undefined
          : undefined;

        const role = mapRoleToDisplay(member.role as string);

        return {
          id: handlerId,
          callsign,
          ra: handlerId,
          photoUrl,
          isK9Instructor: isK9Instructor(user ?? {}),
          role,
        };
      });
    } else {
      // Fallback: reconstruir de active_shifts (para dados legados sem sub-coleção)
      const crewVehicleId = recordText(crew, ["vehicle_id", "vehicleId", "_id"]);
      const relevantShifts = shiftRecords.filter((shift) => {
        const shiftVehicleId = recordText(shift, [
          "vehicle_id",
          "vehicleId",
        ]);
        const status = recordText(shift, ["status", "state"]);
        return shiftVehicleId === crewVehicleId && status !== "ended";
      });

      for (const shift of relevantShifts) {
        const handlerId =
          recordText(shift, [
            "handler_id",
            "handlerId",
            "handler_ra",
            "ra",
            "_id",
          ]) ||
          recordText(shift, ["auth_uid"]) ||
          "";
        if (!handlerId) continue;

        const user = findUser(users, handlerId);
        const member = userMember(user, handlerId);
        const role = mapRoleToDisplay(
          recordText(shift, ["crew_role", "role"]) as string,
        );
        members.push({ ...member, role });
      }
    }

    // Sort: titular first, then alphabetically
    members.sort((a, b) => {
      if (a.id === titularId) return -1;
      if (b.id === titularId) return 1;
      return a.callsign.localeCompare(b.callsign);
    });

    // K9 from crew doc (service_dog_id no documento pai)
    let dog: ServiceDogMember | undefined;
    const crewDogId = recordText(crew, ["service_dog_id", "dogId", "dog_id"]);
    if (crewDogId) {
      const dogRecord = dogRecords.find(
        (d) =>
          d._id === crewDogId ||
          (d as Record<string, unknown>).dog_id === crewDogId,
      );
      if (dogRecord) {
        const dogNameRaw =
          recordText(dogRecord, ["name", "dogName", "dog_name"]) || "K9";

        dog = {
          id: crewDogId,
          name: dogNameRaw,
          photoUrl:
            recordText(dogRecord, [
              "photoUrl",
              "photo_url",
              "profileImageUrl",
            ]) || undefined,
          specializations: dogSpecializations(dogRecord),
          breed:
            recordText(dogRecord, ["breed", "raca", "race"]) || undefined,
          status:
            recordText(dogRecord, [
              "operational_status",
              "status",
              "readiness",
            ]) || "Pronto para emprego",
        };
      }
    }

    // Shift times from crew doc
    const shiftStart =
      recordText(crew, ["shift_start", "shiftStart", "start_time"]) ||
      undefined;
    const shiftEnd =
      recordText(crew, ["shift_end", "shiftEnd", "end_time"]) || undefined;

    // Crew creation time — used by the header "desde HH:MM"
    const createdAt =
      recordText(crew, ["created_at", "createdAt"]) || undefined;

    const crewPayload: ServiceDayCrew = {
      vehicleLabel,
      vehiclePrefix,
      vehicleModel,
      vehicleUnit,
      members,
      dog,
      shiftStart,
      shiftEnd,
      createdAt,
    };

    return crewPayload;
  }, [
    params.vehicleCrews.records,
    params.activeShifts.records,
    params.dogs.records,
    params.users.records,
    params.crewMembers,
  ]);
}
