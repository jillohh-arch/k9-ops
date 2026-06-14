"use client";

import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { storage } from "@/lib/firebase/client";
import {
  callAdminCreateHealthEvent,
  callAdminCreateK9HealthDocument,
  callAdminCreateK9WeightRecord,
} from "@/lib/firebase/functions";

export type HealthEventInput = {
  attachmentFile: File | null;
  costBrl: string;
  date: string;
  dogId: string;
  healthObservations: string;
  nextDueDate: string;
  professionalClinic: string;
  professionalCrmv: string;
  subtype: string;
  type:
    | "antiparasitic"
    | "consultation"
    | "exam"
    | "medication"
    | "other"
    | "surgery"
    | "symptom"
    | "vaccination";
  vetName: string;
};

export type HealthWeightInput = {
  context: string;
  dogId: string;
  measuredAt: string;
  notes: string;
  weightKg: string;
};

export type HealthDocumentInput = {
  description: string;
  dogId: string;
  file: File;
  issuer: string;
  name: string;
  type: string;
};

const maximumAttachmentSize = 20 * 1024 * 1024;

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function contentTypeFor(file: File) {
  if (file.type) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return "application/pdf";
  if (extension === "doc") return "application/msword";
  if (extension === "docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return "image/jpeg";
}

function validateAttachment(file: File) {
  const contentType = contentTypeFor(file);
  const allowed =
    contentType.startsWith("image/") ||
    contentType === "application/pdf" ||
    contentType === "application/msword" ||
    contentType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (!allowed) {
    throw new Error("Use imagem, PDF, DOC ou DOCX.");
  }
  if (file.size > maximumAttachmentSize) {
    throw new Error("O arquivo deve ter no máximo 20 MB.");
  }
  return contentType;
}

async function uploadHealthFile(
  dogId: string,
  file: File,
  kind: "attachment" | "document",
) {
  const contentType = validateAttachment(file);
  const folder =
    kind === "document"
      ? `documentos/${dogId}`
      : `health_attachments/${dogId}`;
  const storagePath = `${folder}/${Date.now()}-${safeFileName(file.name)}`;
  const fileRef = ref(storage, storagePath);
  await uploadBytes(fileRef, file, { contentType });
  return {
    fileName: file.name,
    storagePath,
    url: await getDownloadURL(fileRef),
  };
}

export async function createHealthEvent(input: HealthEventInput) {
  const attachment = input.attachmentFile
    ? await uploadHealthFile(input.dogId, input.attachmentFile, "attachment")
    : null;
  const result = await callAdminCreateHealthEvent({
    dogId: input.dogId,
    payload: {
      attachmentName: attachment?.fileName ?? null,
      attachmentStoragePath: attachment?.storagePath ?? null,
      attachmentUrl: attachment?.url ?? null,
      costBrl: input.costBrl || null,
      date: new Date(`${input.date}T12:00:00`).toISOString(),
      healthObservations: input.healthObservations,
      nextDueDate: input.nextDueDate
        ? new Date(`${input.nextDueDate}T12:00:00`).toISOString()
        : null,
      professionalClinic: input.professionalClinic || null,
      professionalCrmv: input.professionalCrmv || null,
      subtype: input.subtype || null,
      type: input.type,
      vetName: input.vetName || null,
    },
  });
  return result.data;
}

export async function createHealthWeight(input: HealthWeightInput) {
  const result = await callAdminCreateK9WeightRecord({
    dogId: input.dogId,
    payload: {
      context: input.context,
      measuredAt: new Date(`${input.measuredAt}T12:00:00`).toISOString(),
      notes: input.notes || null,
      weightKg: input.weightKg,
    },
  });
  return result.data;
}

export async function createHealthDocument(input: HealthDocumentInput) {
  const uploaded = await uploadHealthFile(input.dogId, input.file, "document");
  const result = await callAdminCreateK9HealthDocument({
    dogId: input.dogId,
    payload: {
      description: input.description,
      issuer: input.issuer || null,
      name: input.name,
      type: input.type,
      url: uploaded.url,
    },
  });
  return result.data;
}
