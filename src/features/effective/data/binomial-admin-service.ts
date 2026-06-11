"use client";

import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import {
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";

import {
  canonicalK9Modalities,
  canonicalModalityLabel,
} from "@/features/effective/lib/k9-modalities";
import { db, storage } from "@/lib/firebase/client";
import {
  callAdminArchiveBinomial,
  callAdminUpsertBinomial,
} from "@/lib/firebase/functions";

export type BinomialFormValues = {
  active: boolean;
  dogId: string;
  endAt: string;
  handlerRa: string;
  notes: string;
  primary: boolean;
  primarySpecialty: string;
  readinessScore: string;
  startAt: string;
  status: string;
  synergyScore: string;
  team: string;
  type: string;
  unit: string;
};

export type BinomialFormOptions = {
  dogs: Array<{ label: string; value: string }>;
  handlers: Array<{ label: string; value: string }>;
  specialties: Array<{ label: string; value: string }>;
};

export const emptyBinomialFormValues: BinomialFormValues = {
  active: true,
  dogId: "",
  endAt: "",
  handlerRa: "",
  notes: "",
  primary: true,
  primarySpecialty: "busca_captura",
  readinessScore: "90",
  startAt: new Date().toISOString().slice(0, 10),
  status: "Ativo",
  synergyScore: "90",
  team: "",
  type: "Operacional",
  unit: "Canil K9",
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

function bool(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "ativo", "sim"].includes(normalized)) return true;
    if (["false", "0", "inativo", "nao"].includes(normalized)) return false;
  }
  return fallback;
}

function dateInput(value: unknown) {
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? value.slice(0, 10)
      : parsed.toISOString().slice(0, 10);
  }
  if (value && typeof value === "object" && "toDate" in value) {
    const method = (value as { toDate?: unknown }).toDate;
    if (typeof method === "function") {
      const parsed = method.call(value);
      return parsed instanceof Date && !Number.isNaN(parsed.getTime())
        ? parsed.toISOString().slice(0, 10)
        : "";
    }
  }
  return "";
}

export function binomialIdFor(dogId: string, handlerRa: string) {
  return `${dogId}__${handlerRa}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function parseBinomialId(id: string) {
  const parts = id.split("__");
  return parts.length >= 2
    ? { dogId: parts.slice(0, -1).join("__"), handlerRa: parts.at(-1) ?? "" }
    : null;
}

export async function loadBinomialFormOptions(): Promise<BinomialFormOptions> {
  const [dogsSnapshot, usersSnapshot] = await Promise.all([
    getDocs(collection(db, "dogs")),
    getDocs(collection(db, "users")),
  ]);

  const dogs = dogsSnapshot.docs
    .map((item) => {
      const data = item.data();
      const active = data.active !== false && data.deleted_at == null;
      const name = text(data, "name", "nome") || item.id;
      const rga = text(data, "registrationNumber", "matricula", "rga");
      return {
        active,
        label: `${name}${rga ? ` - RGA ${rga}` : ""}`,
        value: item.id,
      };
    })
    .filter((item) => item.active)
    .map(({ label, value }) => ({ label, value }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

  const handlers = usersSnapshot.docs
    .map((item) => {
      const data = item.data();
      const active =
        data.active !== false &&
        data.deleted_at == null &&
        data.archived_at == null;
      const label =
        text(data, "callsign", "callSign", "nome_guerra", "name") || item.id;
      return { active, label: `${label} - RA ${item.id}`, value: item.id };
    })
    .filter((item) => item.active)
    .map(({ label, value }) => ({ label, value }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

  return {
    dogs,
    handlers,
    specialties: canonicalK9Modalities.map((item) => ({
      label: item.label,
      value: item.value,
    })),
  };
}

export async function loadBinomialForEdit(id: string) {
  const snapshot = await getDoc(doc(db, "binomials", id));
  if (snapshot.exists()) {
    const data = snapshot.data();
    return {
      active: bool(data.active, true),
      dogId: text(data, "dog_id", "dogId"),
      endAt: dateInput(data.end_at ?? data.endAt),
      handlerRa: text(data, "handler_ra", "handlerRa"),
      notes: text(data, "notes", "observacoes"),
      primary: bool(data.primary, true),
      primarySpecialty: text(data, "primary_specialty", "primarySpecialty") || "busca_captura",
      readinessScore: text(data, "readiness_score", "readinessScore") || "90",
      startAt: dateInput(data.start_at ?? data.startAt) || new Date().toISOString().slice(0, 10),
      status: text(data, "status") || "Ativo",
      synergyScore: text(data, "synergy_score", "synergyScore") || "90",
      team: text(data, "team", "equipe"),
      type: text(data, "type") || "Operacional",
      unit: text(data, "unit", "unidade") || "Canil K9",
    } satisfies BinomialFormValues;
  }

  const legacy = parseBinomialId(id);
  if (!legacy) return null;
  const [dogSnapshot, handlerSnapshot] = await Promise.all([
    getDoc(doc(db, "dogs", legacy.dogId)),
    getDoc(doc(db, "users", legacy.handlerRa)),
  ]);
  if (!dogSnapshot.exists() || !handlerSnapshot.exists()) return null;
  return {
    ...emptyBinomialFormValues,
    dogId: legacy.dogId,
    handlerRa: legacy.handlerRa,
    primarySpecialty:
      Array.isArray(dogSnapshot.data().specialties) &&
      typeof dogSnapshot.data().specialties[0] === "string"
        ? dogSnapshot.data().specialties[0]
        : "busca_captura",
  } satisfies BinomialFormValues;
}

export async function uploadBinomialDocument(binomialId: string, file: File) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const path = `binomial_documents/${binomialId}/${Date.now()}-${safeName}`;
  const fileRef = storageRef(storage, path);
  await uploadBytes(fileRef, file, { contentType: file.type });
  return {
    fileName: file.name,
    storagePath: path,
    url: await getDownloadURL(fileRef),
  };
}

export async function saveBinomial(
  mode: "create" | "edit",
  values: BinomialFormValues,
  id?: string,
) {
  const result = await callAdminUpsertBinomial({
    id,
    mode,
    profile: values,
  });
  return result.data.id ?? id ?? binomialIdFor(values.dogId, values.handlerRa);
}

export async function archiveBinomial(id: string, reason: string) {
  await callAdminArchiveBinomial({ id, reason });
}

export function specialtyLabel(value: string) {
  return canonicalModalityLabel(value);
}
