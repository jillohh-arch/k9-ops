import { httpsCallable } from "firebase/functions";

import { functions } from "@/lib/firebase/client";

export const callSetK9InstructorRole = httpsCallable<
  { ra: string; enabled: boolean },
  Record<string, unknown>
>(functions, "setK9InstructorRole");

export const callAdminSaveAccessProfile = httpsCallable<
  { id?: string; profile: Record<string, unknown> },
  { created?: boolean; id?: string }
>(functions, "adminSaveAccessProfile");

export const callAdminDuplicateAccessProfile = httpsCallable<
  { id?: string; profile: Record<string, unknown> },
  { id?: string }
>(functions, "adminDuplicateAccessProfile");

export const callAdminSetAccessProfileStatus = httpsCallable<
  { id: string; status: "active" | "inactive" },
  { id?: string; status?: string }
>(functions, "adminSetAccessProfileStatus");

export const callAdminAssignAccessProfile = httpsCallable<
  { profileId: string; ra: string },
  { profileId?: string; profileName?: string; ra?: string }
>(functions, "adminAssignAccessProfile");

export const callAdminSeedAccessProfiles = httpsCallable<
  { profiles: Array<Record<string, unknown>>; reconcile?: boolean },
  { archived?: string[]; created?: string[]; updated?: string[] }
>(functions, "adminSeedAccessProfiles");

export const callAdminUpsertHuman = httpsCallable<
  {
    mode: "create" | "edit";
    profile: Record<string, unknown>;
    ra: string;
    temporaryPassword?: string;
  },
  {
    created?: boolean;
    ra?: string;
    temporary_password?: string | null;
    token_refresh_required?: boolean;
    uid?: string;
  }
>(functions, "adminUpsertHuman");

export const callAdminUpsertK9 = httpsCallable<
  {
    dogId?: string;
    mode: "create" | "edit";
    profile: Record<string, unknown>;
  },
  { id?: string }
>(functions, "adminUpsertK9");

export const callAdminArchiveK9 = httpsCallable<
  { id: string; reason: string },
  Record<string, unknown>
>(functions, "adminArchiveK9");

export const callAdminCreateHealthEvent = httpsCallable<
  { dogId: string; payload: Record<string, unknown> },
  { dogId?: string; id?: string; type?: string }
>(functions, "adminCreateHealthEvent");

export const callAdminCreateK9WeightRecord = httpsCallable<
  { dogId: string; payload: Record<string, unknown> },
  { dogId?: string; id?: string; weightKg?: number }
>(functions, "adminCreateK9WeightRecord");

export const callAdminCreateK9HealthDocument = httpsCallable<
  { dogId: string; payload: Record<string, unknown> },
  { dogId?: string; id?: string; url?: string }
>(functions, "adminCreateK9HealthDocument");

export const callAdminArchiveHuman = httpsCallable<
  { ra: string; reason: string },
  Record<string, unknown>
>(functions, "adminArchiveHuman");

export const callAdminSaveHumanCertification = httpsCallable<
  { id?: string; payload: Record<string, unknown>; ra: string },
  { id?: string; ra?: string }
>(functions, "adminSaveHumanCertification");

export const callAdminArchiveHumanCertification = httpsCallable<
  { id: string; ra: string; reason: string },
  Record<string, unknown>
>(functions, "adminArchiveHumanCertification");

export const callAdminSaveHumanDocument = httpsCallable<
  { id?: string; payload: Record<string, unknown>; ra: string },
  { id?: string; ra?: string }
>(functions, "adminSaveHumanDocument");

export const callAdminArchiveHumanDocument = httpsCallable<
  { id: string; ra: string; reason: string },
  Record<string, unknown>
>(functions, "adminArchiveHumanDocument");

export const callAdminSaveHumanMovement = httpsCallable<
  { id?: string; payload: Record<string, unknown> },
  { id?: string; ra?: string }
>(functions, "adminSaveHumanMovement");

export const callAdminArchiveHumanMovement = httpsCallable<
  { id: string; reason: string },
  Record<string, unknown>
>(functions, "adminArchiveHumanMovement");

export const callAdminUpsertVehicle = httpsCallable<
  {
    mode: "create" | "edit";
    profile: Record<string, unknown>;
    vehicleId?: string;
  },
  { id?: string; label?: string }
>(functions, "adminUpsertVehicle");

export const callAdminArchiveVehicle = httpsCallable<
  { id: string; reason: string },
  Record<string, unknown>
>(functions, "adminArchiveVehicle");

export const callAdminSaveVehicleEvent = httpsCallable<
  { id?: string; payload: Record<string, unknown>; vehicleId: string },
  { id?: string; vehicleId?: string }
>(functions, "adminSaveVehicleEvent");

export const callAdminArchiveVehicleEvent = httpsCallable<
  { id: string; reason: string; vehicleId: string },
  Record<string, unknown>
>(functions, "adminArchiveVehicleEvent");

export const callAdminUpsertBinomial = httpsCallable<
  {
    id?: string;
    mode: "create" | "edit";
    profile: Record<string, unknown>;
  },
  { dogId?: string; handlerRa?: string; id?: string }
>(functions, "adminUpsertBinomial");

export const callAdminArchiveBinomial = httpsCallable<
  { id: string; reason: string },
  Record<string, unknown>
>(functions, "adminArchiveBinomial");

export const callAdminSeedInventoryDefaults = httpsCallable<
  Record<string, never>,
  { seeded?: number }
>(functions, "adminSeedInventoryDefaults");

export const callAdminUpsertInventoryCategory = httpsCallable<
  { id?: string; mode: "create" | "edit"; payload: Record<string, unknown> },
  { id?: string }
>(functions, "adminUpsertInventoryCategory");

export const callAdminArchiveInventoryCategory = httpsCallable<
  { id: string; reason: string },
  Record<string, unknown>
>(functions, "adminArchiveInventoryCategory");

export const callAdminUpsertInventoryItem = httpsCallable<
  {
    id?: string;
    mode: "create" | "edit";
    profile: Record<string, unknown>;
  },
  { current_quantity?: number; id?: string; status?: string }
>(functions, "adminUpsertInventoryItem");

export const callAdminArchiveInventoryItem = httpsCallable<
  { id: string; reason: string },
  Record<string, unknown>
>(functions, "adminArchiveInventoryItem");

export const callAdminCreateInventoryMovement = httpsCallable<
  { payload: Record<string, unknown> },
  {
    balance_after?: number;
    balance_before?: number;
    id?: string;
    itemId?: string;
    status?: string;
  }
>(functions, "adminCreateInventoryMovement");

export const callInviteVehicleCrewMember = httpsCallable<
  { crewId: string; handlerId: string },
  Record<string, unknown>
>(functions, "inviteVehicleCrewMember");

export const callRespondVehicleCrewInvitation = httpsCallable<
  { crewId: string; accepted: boolean; reason?: string },
  Record<string, unknown>
>(functions, "respondVehicleCrewInvitation");

export const callDecidePromotionRequest = httpsCallable<
  {
    requestId: string;
    decision: "approved" | "rejected";
    reason?: string;
    note?: string;
  },
  { id?: string; status?: string }
>(functions, "decidePromotionRequest");
