import { httpsCallable } from "firebase/functions";

import { functions } from "@/lib/firebase/client";

export const callSetK9InstructorRole = httpsCallable<
  { ra: string; enabled: boolean },
  Record<string, unknown>
>(functions, "setK9InstructorRole");

/**
 * The hardened writer decides CREATE vs EDIT from the stored document, then
 * freezes the expectation: an existing profile is EDIT and REQUIRES
 * `expectedUpdatedAt` (epoch ms, compared against `access_profiles.updated_at`);
 * a missing profile is CREATE and FORBIDS it. `expectedUpdatedAt` is therefore
 * optional here — the general callable contract — while the EDIT-only
 * requirement is enforced by `saveAccessProfile`, the wrapper that knows it is
 * saving an existing profile.
 */
export const callAdminSaveAccessProfile = httpsCallable<
  { expectedUpdatedAt?: number; id?: string; profile: Record<string, unknown> },
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

/**
 * Create Human V1 — cadastro administrativo estrito de pessoal.
 *
 * Contrato homologado em staging (gate H4-C). Deliberadamente NÃO é o payload
 * largo `profile` de `callAdminUpsertHuman`: a request é PLANA e só aceita os
 * 13 campos de pessoal abaixo. O backend recusa (fail closed) qualquer chave
 * de acesso, Auth, treino, binômio, turno, foto, ciclo de vida ou metadado.
 *
 * Ausência de um opcional se expressa por OMISSÃO — `null` é recusado.
 */
export type AdminCreateHumanRequest = {
  admissionDate?: string;
  birthDate?: string;
  callsign: string;
  cargo?: string;
  cpf?: string;
  fullName: string;
  institutionalEmail?: string;
  notes?: string;
  phone?: string;
  ra: string;
  rank?: string;
  team?: string;
  unit?: string;
};

/**
 * O backend responde `{ra, created: true}`. As chaves ficam opcionais aqui por
 * convenção da camada de wrappers (a resposta é dado remoto, não garantia de
 * tipo); a normalização para a forma estrita acontece no serviço do Create V1.
 */
export type AdminCreateHumanResult = {
  created?: boolean;
  ra?: string;
};

export const callAdminCreateHuman = httpsCallable<
  AdminCreateHumanRequest,
  AdminCreateHumanResult
>(functions, "adminCreateHuman");

export const callAdminUpsertK9 = httpsCallable<
  {
    dogId?: string;
    mode: "create" | "edit";
    profile: Record<string, unknown>;
  },
  { id?: string }
>(functions, "adminUpsertK9");

/**
 * Edit K9 V1 — narrow administrative identity patch.
 *
 * Contract homologated in staging (gate E4). Deliberately NOT the wide
 * `profile` payload of `callAdminUpsertK9`: only the 10 identity wire fields
 * may appear in `patch`, and clearing is explicit through `clearFields`.
 * `expectedUpdatedAt` is mandatory (may be null only when the document has
 * neither timestamp mirror).
 */
export type AdminPatchK9IdentityField =
  | "name"
  | "registrationNumber"
  | "breed"
  | "sex"
  | "birthDate"
  | "color"
  | "microchip"
  | "size"
  | "notes"
  | "profileImageUrl";

export type AdminPatchK9IdentityClearableField =
  | "color"
  | "microchip"
  | "size"
  | "notes"
  | "profileImageUrl";

export const callAdminPatchK9Identity = httpsCallable<
  {
    clearFields?: AdminPatchK9IdentityClearableField[];
    dogId: string;
    expectedUpdatedAt: number | null;
    patch?: Partial<Record<AdminPatchK9IdentityField, string>>;
  },
  { clearedFields?: string[]; id?: string; updatedFields?: string[] }
>(functions, "adminPatchK9Identity");

/**
 * Human Edit V1 — patch administrativo estrito de PESSOAL.
 *
 * Contrato homologado em staging (gate 10H-HUMAN-EDIT-BACKEND.STAGING.
 * HOMOLOGATION). Deliberadamente NÃO é o payload largo `profile` de
 * `callAdminUpsertHuman`: só os 12 campos de pessoal podem aparecer em
 * `patch`, e a limpeza é explícita via `clearFields`.
 *
 * `ra` é ALVO imutável — nunca entra em `patch` nem em `clearFields`.
 * `fullName`/`callsign` são obrigatórios: patchaveis, jamais limpáveis.
 *
 * `expectedUpdatedAt` é MANDATÓRIO (pode ser `null` apenas quando o documento
 * não tem nenhum dos dois espelhos de timestamp). O backend compara contra
 * `max(updated_at, updatedAt)` e recusa com `failed-precondition` quando o
 * token está obsoleto.
 *
 * O backend recusa (fail closed) qualquer chave de acesso, Auth, claims,
 * treino, binômio, turno, foto, ciclo de vida ou metadado de servidor — por
 * isso essas chaves não existem nos tipos abaixo.
 */
export type AdminPatchHumanPersonnelField =
  | "fullName"
  | "callsign"
  | "cpf"
  | "birthDate"
  | "phone"
  | "institutionalEmail"
  | "rank"
  | "cargo"
  | "unit"
  | "team"
  | "admissionDate"
  | "notes";

export type AdminPatchHumanPersonnelClearableField =
  | "cpf"
  | "birthDate"
  | "phone"
  | "institutionalEmail"
  | "rank"
  | "cargo"
  | "unit"
  | "team"
  | "admissionDate"
  | "notes";

export type AdminPatchHumanPersonnelRequest = {
  clearFields?: AdminPatchHumanPersonnelClearableField[];
  expectedUpdatedAt: number | null;
  patch?: Partial<Record<AdminPatchHumanPersonnelField, string>>;
  ra: string;
};

export type AdminPatchHumanPersonnelResult = {
  clearedFields?: string[];
  ra?: string;
  updated?: boolean;
  updatedFields?: string[];
};

export const callAdminPatchHumanPersonnel = httpsCallable<
  AdminPatchHumanPersonnelRequest,
  AdminPatchHumanPersonnelResult
>(functions, "adminPatchHumanPersonnel");

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

export const callAdminResetHumanPassword = httpsCallable<
  { ra: string },
  { temporary_password: string }
>(functions, "adminResetHumanPassword");

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
