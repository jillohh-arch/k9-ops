"use client";

import { doc, getDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { db, storage } from "@/lib/firebase/client";
import {
  callAdminArchiveHuman,
  callAdminArchiveHumanCertification,
  callAdminArchiveHumanDocument,
  callAdminArchiveHumanMovement,
  callAdminSaveHumanCertification,
  callAdminSaveHumanDocument,
  callAdminSaveHumanMovement,
  callAdminUpsertHuman,
} from "@/lib/firebase/functions";
import {
  getDefaultAccessProfile,
  getProfileIdFromLegacyValue,
  type AccessProfile,
} from "@/lib/permissions/access-control";

export type HumanFormValues = {
  accessLevel: string;
  accessProfile: string;
  accessProfileId: string;
  active: boolean;
  admissionDate: string;
  birthDate: string;
  callsign: string;
  cpf: string;
  fullName: string;
  institutionalEmail: string;
  isK9Instructor: boolean;
  notes: string;
  phone: string;
  photoUrl: string;
  ra: string;
  rank: string;
  role: string;
  shiftGroupId: string;
  shiftLabel: string;
  specialties: string[];
  status: string;
  team: string;
  unit: string;
};

export type HumanCertificationInput = {
  category: string;
  documentUrl: string;
  expiresAt: string;
  fileName: string;
  issuedAt: string;
  issuer: string;
  name: string;
  notes: string;
  storagePath: string;
  type: string;
};

export type HumanMovementInput = {
  destinationUnit: string;
  endedAt: string;
  expectedEndAt: string;
  movementType: string;
  notes: string;
  operationalImpact: string;
  ra: string;
  reason: string;
  startAt: string;
  status: string;
};

export const humanSpecialtyOptions = [
  "Condutor K9",
  "Adestramento",
  "Figuração",
  "Apoio operacional",
  "Veterinário",
  "Administrativo",
] as const;

export const emptyHumanFormValues: HumanFormValues = {
  // W3: acesso ausente permanece genuinamente ausente. NUNCA sintetiza
  // "Operador" / "operador_k9" — isso acoplaria o cadastro de pessoal a um
  // perfil de acesso fabricado no primeiro save legado.
  accessLevel: "",
  accessProfile: "",
  accessProfileId: "",
  active: true,
  admissionDate: "",
  birthDate: "",
  callsign: "",
  cpf: "",
  fullName: "",
  institutionalEmail: "",
  isK9Instructor: false,
  notes: "",
  phone: "",
  photoUrl: "",
  ra: "",
  rank: "",
  role: "",
  shiftGroupId: "",
  shiftLabel: "",
  specialties: [],
  status: "Ativo",
  team: "",
  unit: "",
};

function text(data: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" || typeof value === "number") {
      const parsed = String(value).trim();
      if (parsed) return parsed;
    }
  }
  return "";
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export async function loadHumanForEdit(ra: string) {
  const snapshot = await getDoc(doc(db, "users", ra));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  const rawAccessProfileId = text(data, "access_profile_id", "accessProfileId");
  const legacyReference = text(
    data,
    "accessProfile",
    "access_profile",
    "accessLevel",
    "access_level",
  );
  const legacyInstructorProfile = rawAccessProfileId === "instrutor_k9";
  // W3: resolve SOMENTE acesso explícito/factual. Ausência total de qualquer
  // chave de acesso permanece "" — JAMAIS coage para "operador_k9"/"Operador".
  const resolvedAccessProfileId = legacyInstructorProfile
    ? "operador_k9"
    : rawAccessProfileId ||
      getProfileIdFromLegacyValue(legacyReference) ||
      "";
  const resolvedProfile = resolvedAccessProfileId
    ? getDefaultAccessProfile(resolvedAccessProfileId)
    : null;
  const resolvedAccessProfileName = legacyInstructorProfile
    ? "Operador"
    : text(data, "accessProfile", "access_profile") ||
      resolvedProfile?.name ||
      "";
  return {
    accessLevel:
      text(data, "accessLevel", "access_level") ||
      resolvedAccessProfileName,
    accessProfile: resolvedAccessProfileName,
    accessProfileId: resolvedAccessProfileId,
    active:
      data.active !== false &&
      data.deleted_at == null &&
      data.archived_at == null,
    admissionDate: text(data, "admission_date", "admissionDate"),
    birthDate: text(data, "birth_date", "birthDate"),
    callsign:
      text(data, "callsign", "callSign", "nome_guerra") ||
      text(data, "name", "nomeCompleto"),
    cpf: text(data, "cpf", "document"),
    fullName: text(data, "nomeCompleto", "name", "nome"),
    institutionalEmail: text(
      data,
      "institutional_email",
      "institutionalEmail",
    ),
    isK9Instructor:
      legacyInstructorProfile ||
      data.is_k9_instructor === true ||
      text(data, "training_role") === "instrutor_k9",
    notes: text(data, "notes", "observações"),
    phone: text(data, "telefone", "phone"),
    photoUrl: text(data, "photoUrl", "image_url", "profileImageUrl"),
    ra,
    rank: text(data, "rank", "posto", "graduacao"),
    role: text(data, "cargo", "role", "função"),
    shiftGroupId: text(data, "shift_group_id", "shiftGroupId") || "",
    shiftLabel: text(data, "shift_label", "shiftLabel"),
    specialties: stringArray(data.specialties),
    status: text(data, "status") || "Ativo",
    team: text(data, "team", "equipe"),
    unit: text(data, "unit", "unidade", "lotação"),
  } satisfies HumanFormValues;
}

/**
 * W3 — estado de acesso do registro carregado no Edit administrativo legado.
 *
 * `provisioned`   -> perfil de acesso explícito e resolvível. O save legado
 *                    (adminUpsertHuman) pode seguir com os valores factuais.
 * `unprovisioned` -> nenhuma chave de acesso. Pessoal existe e é válido, mas o
 *                    acesso ao sistema ainda não foi provisionado.
 * `incomplete`    -> existe referência de acesso, porém não resolve para
 *                    nenhum perfil conhecido.
 *
 * Somente `provisioned` habilita o caminho de gravação legado. Nos outros dois
 * casos o Edit legado é bloqueado — ele é acoplado a acesso/Auth e usá-lo sem
 * perfil factual provisionaria ou fabricaria acesso como efeito colateral.
 */
export type LegacyEditAccessStatus =
  | "provisioned"
  | "unprovisioned"
  | "incomplete";

export type LegacyEditAccessState = {
  canUseLegacySave: boolean;
  profileId: string | null;
  profileName: string | null;
  rawReference: string | null;
  status: LegacyEditAccessStatus;
};

export function resolveLegacyEditAccessState(
  values: Pick<
    HumanFormValues,
    "accessLevel" | "accessProfile" | "accessProfileId"
  >,
  availableProfiles: Array<Pick<AccessProfile, "id" | "name" | "slug">> = [],
): LegacyEditAccessState {
  const profileId = values.accessProfileId.trim();
  const rawReference =
    profileId ||
    values.accessProfile.trim() ||
    values.accessLevel.trim() ||
    "";

  if (!rawReference) {
    return {
      canUseLegacySave: false,
      profileId: null,
      profileName: null,
      rawReference: null,
      status: "unprovisioned",
    };
  }

  const resolvedId =
    profileId || getProfileIdFromLegacyValue(rawReference) || rawReference;
  const matched =
    availableProfiles.find(
      (profile) => profile.id === resolvedId || profile.slug === resolvedId,
    ) ?? getDefaultAccessProfile(resolvedId);

  if (!matched) {
    return {
      canUseLegacySave: false,
      profileId: null,
      profileName: null,
      rawReference,
      status: "incomplete",
    };
  }

  return {
    canUseLegacySave: true,
    profileId: matched.id,
    profileName: matched.name,
    rawReference,
    status: "provisioned",
  };
}

export const legacyHumanEditBlockedMessage =
  "Este integrante ainda não possui acesso ao sistema provisionado. A edição administrativa legada não pode ser usada sem um perfil de acesso.";

/** Erro de guarda local: nenhuma callable é invocada quando ele é lançado. */
export class LegacyHumanEditBlockedError extends Error {
  readonly status: LegacyEditAccessStatus;

  constructor(status: LegacyEditAccessStatus) {
    super(legacyHumanEditBlockedMessage);
    this.name = "LegacyHumanEditBlockedError";
    this.status = status;
  }
}

export async function uploadHumanPhoto(ra: string, file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const storageRef = ref(
    storage,
    `profile_photos/human-${ra}-${Date.now()}.${extension}`,
  );
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}

export async function uploadHumanDocument(ra: string, file: File) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const storagePath = `human_documents/${ra}/${Date.now()}-${safeName}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return {
    fileName: file.name,
    storagePath,
    url: await getDownloadURL(storageRef),
  };
}

export async function saveHuman(
  mode: "create" | "edit",
  values: HumanFormValues,
  photoFile: File | null,
) {
  // W3 backstop (defesa em profundidade): mesmo que a UI seja contornada, um
  // registro sem acesso provisionado NUNCA percorre o Edit legado acoplado a
  // acesso. Nada de upload de foto, nada de callAdminUpsertHuman.
  if (mode === "edit") {
    const accessState = resolveLegacyEditAccessState(values);
    if (!accessState.canUseLegacySave) {
      throw new LegacyHumanEditBlockedError(accessState.status);
    }
  }
  const photoUrl = photoFile
    ? await uploadHumanPhoto(values.ra, photoFile)
    : values.photoUrl;
  const isK9Instructor = values.isK9Instructor;
  const result = await callAdminUpsertHuman({
    mode,
    ra: values.ra,
    profile: {
      ...values,
      accessLevel: values.accessProfile || values.accessLevel,
      access_profile: values.accessProfile,
      access_profile_id: values.accessProfileId,
      isK9Instructor,
      photoUrl: photoUrl || null,
    },
  });
  return result.data;
}

export async function archiveHuman(ra: string, reason: string) {
  await callAdminArchiveHuman({ ra, reason });
}

export async function saveHumanCertification(
  ra: string,
  values: HumanCertificationInput,
  id?: string,
) {
  const result = await callAdminSaveHumanCertification({
    id,
    payload: values,
    ra,
  });
  return result.data.id ?? null;
}

export async function archiveHumanCertification(
  ra: string,
  id: string,
  reason: string,
) {
  await callAdminArchiveHumanCertification({ id, ra, reason });
}

export async function saveHumanDocument(
  ra: string,
  values: HumanCertificationInput,
  id?: string,
) {
  const result = await callAdminSaveHumanDocument({
    id,
    payload: values,
    ra,
  });
  return result.data.id ?? null;
}

export async function archiveHumanDocument(
  ra: string,
  id: string,
  reason: string,
) {
  await callAdminArchiveHumanDocument({ id, ra, reason });
}

export async function saveHumanMovement(
  values: HumanMovementInput,
  id?: string,
) {
  const result = await callAdminSaveHumanMovement({ id, payload: values });
  return result.data.id ?? null;
}

export async function archiveHumanMovement(id: string, reason: string) {
  await callAdminArchiveHumanMovement({ id, reason });
}
