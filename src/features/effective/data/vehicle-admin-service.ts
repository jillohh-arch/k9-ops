"use client";

import { doc, getDoc } from "firebase/firestore";
import {
  getDownloadURL as getStorageDownloadURL,
  ref as storageRef,
  uploadBytes as uploadStorageBytes,
} from "firebase/storage";

import { db, storage } from "@/lib/firebase/client";
import {
  callAdminArchiveVehicle,
  callAdminArchiveVehicleEvent,
  callAdminSaveVehicleEvent,
  callAdminUpsertVehicle,
} from "@/lib/firebase/functions";

export type VehicleFormValues = {
  accessories: string;
  base: string;
  brand: string;
  capacity: string;
  chassis: string;
  color: string;
  crewSize: string;
  documentValidUntil: string;
  fuel: string;
  insurance: string;
  licensing: string;
  maintenanceStatus: string;
  mileageKm: string;
  model: string;
  name: string;
  nextReviewAt: string;
  nextReviewKm: string;
  notes: string;
  photoUrl: string;
  plate: string;
  prefix: string;
  renavam: string;
  status: string;
  type: string;
  unit: string;
  year: string;
};

export type VehicleEventInput = {
  cost: string;
  date: string;
  documentUrl: string;
  notes: string;
  odometerKm: string;
  provider: string;
  responsible: string;
  status: string;
  storagePath: string;
  title: string;
  type: string;
};

export const emptyVehicleFormValues: VehicleFormValues = {
  accessories: "",
  base: "",
  brand: "",
  capacity: "4 ocupantes",
  chassis: "",
  color: "",
  crewSize: "4",
  documentValidUntil: "",
  fuel: "Flex",
  insurance: "",
  licensing: "",
  maintenanceStatus: "Em dia",
  mileageKm: "",
  model: "",
  name: "Canil",
  nextReviewAt: "",
  nextReviewKm: "",
  notes: "",
  photoUrl: "",
  plate: "",
  prefix: "",
  renavam: "",
  status: "Ativa",
  type: "Operacional K9",
  unit: "Limeira/SP",
  year: "",
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

function numberText(data: Record<string, unknown>, ...keys: string[]) {
  const value = text(data, ...keys);
  return value ? String(Number(value.replace(",", ".")) || value) : "";
}

function dateInput(value: unknown) {
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value.slice(0, 10) : parsed.toISOString().slice(0, 10);
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

export async function loadVehicleForEdit(vehicleId: string) {
  const snapshot = await getDoc(doc(db, "vehicles", vehicleId));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return {
    accessories: text(data, "accessories"),
    base: text(data, "base", "lotacao"),
    brand: text(data, "brand", "marca"),
    capacity: text(data, "capacity") || `${numberText(data, "crew_size", "crewSize") || "4"} ocupantes`,
    chassis: text(data, "chassis"),
    color: text(data, "color", "cor"),
    crewSize: numberText(data, "crew_size", "crewSize") || "1",
    documentValidUntil: dateInput(data.document_valid_until ?? data.documentValidUntil),
    fuel: text(data, "fuel", "combustivel"),
    insurance: text(data, "insurance"),
    licensing: text(data, "licensing"),
    maintenanceStatus: text(data, "maintenance_status", "maintenanceStatus") || "Em dia",
    mileageKm: numberText(data, "mileage_km", "mileageKm"),
    model: text(data, "model", "modelo"),
    name: text(data, "name", "nome") || "Canil",
    nextReviewAt: dateInput(data.next_review_at ?? data.nextReviewAt),
    nextReviewKm: numberText(data, "next_review_km", "nextReviewKm"),
    notes: text(data, "notes", "observacoes"),
    photoUrl: text(data, "photoUrl", "photo_url"),
    plate: text(data, "plate", "placa"),
    prefix: text(data, "prefix", "vehicle_prefix") || snapshot.id,
    renavam: text(data, "renavam"),
    status: text(data, "status", "situacao") || "Ativa",
    type: text(data, "type", "tipo") || "Operacional K9",
    unit: text(data, "unit", "unidade") || "Limeira/SP",
    year: text(data, "year", "ano"),
  } satisfies VehicleFormValues;
}

export async function uploadVehiclePhoto(vehicleId: string, file: File) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const path = `vehicle_photos/${vehicleId}/${Date.now()}-${safeName}`;
  const fileRef = storageRef(storage, path);
  await uploadStorageBytes(fileRef, file, { contentType: file.type });
  return getStorageDownloadURL(fileRef);
}

export async function uploadVehicleDocument(vehicleId: string, file: File) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const path = `vehicle_documents/${vehicleId}/${Date.now()}-${safeName}`;
  const fileRef = storageRef(storage, path);
  await uploadStorageBytes(fileRef, file, { contentType: file.type });
  return {
    fileName: file.name,
    storagePath: path,
    url: await getStorageDownloadURL(fileRef),
  };
}

export async function saveVehicle(
  mode: "create" | "edit",
  values: VehicleFormValues,
  photoFile: File | null,
) {
  const vehicleId = values.prefix.trim();
  const photoUrl = photoFile
    ? await uploadVehiclePhoto(vehicleId, photoFile)
    : values.photoUrl;
  const result = await callAdminUpsertVehicle({
    mode,
    profile: { ...values, photoUrl: photoUrl || null },
    vehicleId,
  });
  return result.data.id ?? vehicleId;
}

export async function archiveVehicle(id: string, reason: string) {
  await callAdminArchiveVehicle({ id, reason });
}

export async function saveVehicleEvent(
  vehicleId: string,
  values: VehicleEventInput,
  id?: string,
) {
  const result = await callAdminSaveVehicleEvent({
    id,
    payload: values,
    vehicleId,
  });
  return result.data.id ?? null;
}

export async function archiveVehicleEvent(
  vehicleId: string,
  id: string,
  reason: string,
) {
  await callAdminArchiveVehicleEvent({ id, reason, vehicleId });
}
