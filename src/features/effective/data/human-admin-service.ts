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
  "Figuracao",
  "Apoio operacional",
  "Veterinario",
  "Administrativo",
] as const;

export const emptyHumanFormValues: HumanFormValues = {
  accessLevel: "Condutor",
  accessProfile: "Condutor",
  accessProfileId: "condutor",
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
  return {
    accessLevel: text(data, "accessLevel", "access_level") || "Condutor",
    accessProfile:
      text(data, "accessProfile", "access_profile") || "Operacional",
    accessProfileId:
      text(data, "access_profile_id", "accessProfileId") || "condutor",
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
      data.is_k9_instructor === true ||
      text(data, "training_role") === "instrutor_k9",
    notes: text(data, "notes", "observacoes"),
    phone: text(data, "telefone", "phone"),
    photoUrl: text(data, "photoUrl", "image_url", "profileImageUrl"),
    ra,
    rank: text(data, "rank", "posto", "graduacao"),
    role: text(data, "cargo", "role", "funcao"),
    shiftLabel: text(data, "shift_label", "shiftLabel"),
    specialties: stringArray(data.specialties),
    status: text(data, "status") || "Ativo",
    team: text(data, "team", "equipe"),
    unit: text(data, "unit", "unidade", "lotacao"),
  } satisfies HumanFormValues;
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
  const photoUrl = photoFile
    ? await uploadHumanPhoto(values.ra, photoFile)
    : values.photoUrl;
  const isK9Instructor = values.accessProfileId === "instrutor_k9";
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
