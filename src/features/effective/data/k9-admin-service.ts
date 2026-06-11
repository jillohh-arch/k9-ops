"use client";

import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  type DocumentData,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import type { AuthProfile } from "@/features/auth/providers/auth-provider";
import {
  canonicalK9Modalities,
  canonicalModality,
  canonicalModalityLabel,
  canonicalizeModalities,
  isCanonicalK9Modality,
} from "@/features/effective/lib/k9-modalities";
import { db, storage } from "@/lib/firebase/client";
import { callAdminArchiveK9, callAdminUpsertK9 } from "@/lib/firebase/functions";

export type K9FormValues = {
  birthDate: string;
  breed: string;
  color: string;
  conductorRa: string;
  idealWeightMax: string;
  idealWeightMin: string;
  microchip: string;
  name: string;
  notes: string;
  operationalStatus: string;
  physicalCondition: string;
  profileImageUrl: string;
  registrationNumber: string;
  sex: string;
  size: string;
  specialties: string[];
  weight: string;
};

export type K9FormOptions = {
  modalities: Array<{ label: string; value: string }>;
  users: Array<{ label: string; value: string }>;
};

export const emptyK9FormValues: K9FormValues = {
  birthDate: "",
  breed: "",
  color: "",
  conductorRa: "",
  idealWeightMax: "",
  idealWeightMin: "",
  microchip: "",
  name: "",
  notes: "",
  operationalStatus: "Ativo",
  physicalCondition: "",
  profileImageUrl: "",
  registrationNumber: "",
  sex: "M",
  size: "",
  specialties: [],
  weight: "",
};

function text(data: DocumentData, ...keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" || typeof value === "number") {
      const parsed = String(value).trim();
      if (parsed) return parsed;
    }
  }
  return "";
}

function numberText(data: DocumentData, ...keys: string[]) {
  const value = text(data, ...keys);
  if (!value) return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : "";
}

function normalizeStatus(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function uploadProfilePhoto(dogId: string, file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const fileRef = ref(
    storage,
    `profile_photos/${dogId}-${Date.now()}.${extension}`,
  );
  await uploadBytes(fileRef, file, { contentType: file.type });
  return getDownloadURL(fileRef);
}

function specialtyModality(data: DocumentData, id: string) {
  return canonicalModality(text(data, "type", "modality", "name") || id);
}

function hasDetectionProgress(lines: Array<{ data(): DocumentData }>) {
  return lines.some((item) => {
    const data = item.data();
    if (data.deleted_at != null || data.archived_at != null) return false;
    const status = normalizeStatus(text(data, "status", "state"));
    return Boolean(
      status &&
        status !== "not_started" &&
        status !== "nao_iniciado",
    );
  });
}

function recordDate(data: DocumentData) {
  for (const key of [
    "measured_at",
    "measuredAt",
    "created_at",
    "createdAt",
  ]) {
    const value = data[key];
    if (value instanceof Timestamp) return value.toDate();
    if (value instanceof Date) return value;
    if (typeof value === "string" || typeof value === "number") {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }
  return new Date(0);
}

export async function loadK9FormOptions(): Promise<K9FormOptions> {
  const [usersSnapshot, programsSnapshot] = await Promise.all([
    getDocs(collection(db, "users")),
    getDocs(collection(db, "training_programs")),
  ]);

  const users = usersSnapshot.docs
    .map((item) => {
      const data = item.data();
      const label =
        text(data, "callsign", "callSign", "nome_guerra", "nome", "name") ||
        item.id;
      const active =
        data.deleted_at == null &&
        data.archived_at == null &&
        data.active !== false;
      return { active, label: `${label} - RA ${item.id}`, value: item.id };
    })
    .filter((item) => item.active)
    .map(({ label, value }) => ({ label, value }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

  const programModalities = programsSnapshot.docs
    .filter((item) => item.data().deleted_at == null)
    .map((item) => ({
      label:
        text(item.data(), "name", "label", "title") ||
        canonicalModalityLabel(item.id),
      value: canonicalModality(
        text(item.data(), "modality") || item.id,
      ),
    }))
    .filter((item) => isCanonicalK9Modality(item.value));
  const modalityMap = new Map<string, { label: string; value: string }>(
    canonicalK9Modalities.map((item) => [
      item.value,
      { label: item.label, value: item.value },
    ]),
  );
  for (const modality of programModalities) {
    modalityMap.set(modality.value, {
      label: canonicalModalityLabel(modality.value),
      value: modality.value,
    });
  }
  const modalities = Array.from(modalityMap.values()).sort((a, b) =>
    a.label.localeCompare(b.label, "pt-BR"),
  );

  return { modalities, users };
}

export async function loadK9ForEdit(dogId: string) {
  const [
    dogSnapshot,
    specialtySnapshot,
    trainingSnapshot,
    detectionLinesSnapshot,
    weightSnapshot,
  ] = await Promise.all([
    getDoc(doc(db, "dogs", dogId)),
    getDocs(collection(db, "dogs", dogId, "specialties")),
    getDocs(collection(db, "dogs", dogId, "training")),
    getDocs(collection(db, "dogs", dogId, "detection_lines")),
    getDocs(collection(db, "dogs", dogId, "weight_records")),
  ]);

  if (!dogSnapshot.exists()) return null;
  const data = dogSnapshot.data();
  const birthValue = text(data, "dateOfBirth", "date_of_birth");
  const parsedBirth = birthValue ? new Date(birthValue) : null;
  const specialtyValues = new Set(
    canonicalizeModalities(
      Array.isArray(data.specialties)
        ? data.specialties.filter(
            (item): item is string => typeof item === "string",
          )
        : [],
    ),
  );
  for (const item of specialtySnapshot.docs) {
    if (
      item.data().deleted_at == null &&
      item.data().archived_at == null
    ) {
      specialtyValues.add(specialtyModality(item.data(), item.id));
    }
  }
  const protectedSpecialtiesSet = new Set(
    canonicalizeModalities(
      trainingSnapshot.docs
        .filter(
          (item) =>
            item.data().deleted_at == null &&
            item.data().archived_at == null,
        )
        .map(
          (item) =>
            text(item.data(), "modality", "type", "name") || item.id,
        ),
    ),
  );
  if (hasDetectionProgress(detectionLinesSnapshot.docs)) {
    protectedSpecialtiesSet.add("deteccao");
  }
  const protectedSpecialties = Array.from(protectedSpecialtiesSet);
  for (const modality of protectedSpecialties) {
    specialtyValues.add(modality);
  }
  const latestWeightRecord = [...weightSnapshot.docs].sort(
    (a, b) =>
      recordDate(b.data()).getTime() - recordDate(a.data()).getTime(),
  )[0];
  const canonicalWeight = latestWeightRecord
    ? numberText(
        latestWeightRecord.data(),
        "weight_kg",
        "weightKg",
        "weight",
        "peso",
      )
    : "";

  return {
    protectedSpecialties,
    values: {
      birthDate:
        parsedBirth && !Number.isNaN(parsedBirth.getTime())
          ? parsedBirth.toISOString().slice(0, 10)
          : "",
      breed: text(data, "breed", "raca"),
      color: text(data, "cor", "color"),
      conductorRa: text(
        data,
        "conductorRa",
        "conductor_ra",
        "handlerId",
        "handler_id",
      ),
      idealWeightMax: numberText(data, "idealWeightMax", "ideal_weight_max"),
      idealWeightMin: numberText(data, "idealWeightMin", "ideal_weight_min"),
      microchip: text(data, "microchip"),
      name: text(data, "name", "nome"),
      notes: text(data, "observacoes", "notes"),
      operationalStatus: text(data, "status", "situacao") || "Ativo",
      physicalCondition: text(data, "condicaoCorporal", "physicalCondition"),
      profileImageUrl: text(
        data,
        "profileImageUrl",
        "profile_image_url",
        "photoUrl",
      ),
      registrationNumber: text(
        data,
        "matricula",
        "registrationNumber",
        "registration_number",
      ),
      sex: text(data, "sex", "sexo") || "M",
      size: text(data, "porte", "size"),
      specialties: Array.from(specialtyValues).filter(isCanonicalK9Modality),
      weight: canonicalWeight || numberText(data, "weight", "peso"),
    } satisfies K9FormValues,
  };
}

export async function saveK9({
  dogId,
  mode,
  photoFile,
  values,
}: {
  currentWeight?: number | null;
  dogId?: string;
  mode: "create" | "edit";
  photoFile: File | null;
  profile: AuthProfile;
  values: K9FormValues;
}) {
  const resolvedDogId =
    mode === "create" ? doc(collection(db, "dogs")).id : dogId!;
  const photoUrl = photoFile
    ? await uploadProfilePhoto(resolvedDogId, photoFile)
    : values.profileImageUrl;

  const result = await callAdminUpsertK9({
    dogId: resolvedDogId,
    mode,
    profile: {
      ...values,
      profileImageUrl: photoUrl || null,
      specialties: canonicalizeModalities(values.specialties),
    },
  });
  return result.data.id ?? resolvedDogId;
}

export async function archiveK9({
  dogId,
  reason,
}: {
  dogId: string;
  profile: AuthProfile;
  reason: string;
}) {
  const normalizedReason = reason.trim();
  if (!normalizedReason) {
    throw new Error("Informe o motivo do arquivamento.");
  }
  await callAdminArchiveK9({ id: dogId, reason: normalizedReason });
}
