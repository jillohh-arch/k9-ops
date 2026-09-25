import { collection, getDocs } from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";

import { db, storage } from "@/lib/firebase/client";
import {
  callHealthDocumentFinalizeUpload,
  callHealthDocumentPrepareUpload,
  type HealthDocumentFinalizeUploadRequest,
  type HealthDocumentFinalizeUploadResult,
  type HealthDocumentPrepareUploadResult,
  type HealthDocumentType,
} from "@/lib/firebase/functions";
import { generateIdempotencyKey } from "@/features/health/data/health-restriction-service";

export { type HealthDocumentType };

export const MAX_HEALTH_DOCUMENT_BYTES = 20 * 1024 * 1024; // 20 MB

export const ALLOWED_EXACT_DOCUMENT_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const HEALTH_DOCUMENT_TYPE_LABELS: Record<HealthDocumentType, string> = {
  certificate: "Atestado / Certificado",
  exam_image: "Imagem de Exame",
  exam_pdf: "Laudo de Exame (PDF)",
  other: "Outro Documento",
  photo: "Foto Clínica",
  prescription: "Receita Médica",
  report: "Laudo Clínico / Relatório",
  surgical_report: "Relatório Cirúrgico",
  vaccination_card: "Carteira de Vacinação",
};

export type CanonicalHealthDocument = {
  deleted_at?: Date | null;
  description?: string | null;
  document_type: HealthDocumentType;
  id: string;
  issue_date?: Date | null;
  issuer?: string | null;
  mime_type?: string | null;
  storage_path: string;
  title: string;
  uploaded_at: Date | null;
};

export function validateHealthDocumentFile(file: File): {
  error?: string;
  valid: boolean;
} {
  if (!file) {
    return { error: "Nenhum arquivo fornecido.", valid: false };
  }

  if (file.size > MAX_HEALTH_DOCUMENT_BYTES) {
    return {
      error: `O arquivo excede o tamanho máximo permitido de 20 MB (tamanho atual: ${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
      valid: false,
    };
  }

  const type = file.type.toLowerCase();
  const isImage = type.startsWith("image/");
  const isAllowedExact = ALLOWED_EXACT_DOCUMENT_MIMES.has(type);

  // Fallback para extensões conhecidas caso o navegador omita o MIME type
  const name = file.name.toLowerCase();
  const isKnownExtension =
    name.endsWith(".pdf") ||
    name.endsWith(".doc") ||
    name.endsWith(".docx") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png") ||
    name.endsWith(".webp");

  if (!isImage && !isAllowedExact && !isKnownExtension) {
    return {
      error:
        "Formato de arquivo não suportado. Utilize PDF, imagem (PNG, JPG, WebP) ou documento Word (DOC, DOCX).",
      valid: false,
    };
  }

  return { valid: true };
}

export async function prepareHealthDocumentUpload(
  dogId: string,
  operationId?: string,
): Promise<HealthDocumentPrepareUploadResult> {
  const opId = operationId ?? generateIdempotencyKey();
  const response = await callHealthDocumentPrepareUpload({
    dogId,
    operationId: opId,
  });
  return response.data;
}

export async function uploadHealthDocumentToStaging(
  uploadPath: string,
  file: File,
): Promise<void> {
  const storageRef = ref(storage, uploadPath);
  await uploadBytes(storageRef, file, {
    contentType: file.type || "application/octet-stream",
  });
}

export async function finalizeHealthDocumentUpload(
  input: HealthDocumentFinalizeUploadRequest,
): Promise<HealthDocumentFinalizeUploadResult> {
  const response = await callHealthDocumentFinalizeUpload(input);
  return response.data;
}

export type CreateDischargeDocumentOptions = {
  description?: string;
  documentType?: HealthDocumentType;
  issueDate?: Date;
  issuer?: string;
  operationId?: string;
  title: string;
};

/**
 * Orquestra o fluxo canônico de evidência documental:
 * 1. Valida restrições canônicas de arquivo (MIME + tamanho <= 20MB);
 * 2. Invoca `healthDocumentPrepareUpload` para obter o staging path e documentId;
 * 3. Envia os bytes para o Storage no staging path autorizado;
 * 4. Invoca `healthDocumentFinalizeUpload` para verificação, selo atômico e commit Firestore;
 * 5. Retorna a identidade documental canônica final (`documentId`).
 */
export async function createAndUploadDischargeDocument(
  dogId: string,
  file: File,
  options: CreateDischargeDocumentOptions,
): Promise<{
  documentId: string;
  storagePath: string;
  title: string;
}> {
  const validation = validateHealthDocumentFile(file);
  if (!validation.valid) {
    throw new Error(validation.error ?? "Arquivo inválido.");
  }

  const operationId = options.operationId ?? generateIdempotencyKey();

  // 1. Prepare
  const prep = await prepareHealthDocumentUpload(dogId, operationId);

  // 2. Upload to Staging Target
  await uploadHealthDocumentToStaging(prep.uploadPath, file);

  // 3. Finalize
  const finalized = await finalizeHealthDocumentUpload({
    description: options.description?.trim() || undefined,
    dogId,
    documentType: options.documentType ?? "report",
    issueDate: options.issueDate ? options.issueDate.toISOString() : undefined,
    issuer: options.issuer?.trim() || undefined,
    operationId,
    title: options.title.trim(),
  });

  return {
    documentId: finalized.documentId,
    storagePath: finalized.storagePath,
    title: options.title.trim(),
  };
}

function parseFirestoreDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === "object" && "toDate" in val && typeof (val as { toDate: () => unknown }).toDate === "function") {
    const d = (val as { toDate: () => unknown }).toDate();
    if (d instanceof Date && !Number.isNaN(d.getTime())) return d;
  }
  if (typeof val === "string" || typeof val === "number") {
    const d = new Date(val);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

/**
 * Consulta documentos canônicos de saúde do K9.
 * Exclui documentos deletados e opcionalmente exclui o documento de emissão da restrição,
 * garantindo que a evidência de abertura não seja reutilizada silenciosamente como alta.
 */
export async function fetchEligibleDischargeDocuments(
  dogId: string,
  excludeDocumentId?: string | null,
): Promise<CanonicalHealthDocument[]> {
  try {
    const docsColl = collection(db, "dogs", dogId, "health_documents");
    const snapshot = await getDocs(docsColl);

    const results: CanonicalHealthDocument[] = [];

    for (const d of snapshot.docs) {
      if (excludeDocumentId && d.id === excludeDocumentId) {
        continue;
      }
      const data = d.data();
      if (data.deleted_at != null) {
        continue;
      }

      const uploadedAt = parseFirestoreDate(data.uploaded_at ?? data.uploadedAt);
      const issueDate = parseFirestoreDate(data.issue_date ?? data.issueDate);

      results.push({
        deleted_at: null,
        description: typeof data.description === "string" ? data.description : null,
        document_type: (data.document_type ?? data.documentType ?? "other") as HealthDocumentType,
        id: d.id,
        issue_date: issueDate,
        issuer: typeof data.issuer === "string" ? data.issuer : null,
        mime_type: typeof data.mime_type === "string" ? data.mime_type : null,
        storage_path: typeof data.storage_path === "string" ? data.storage_path : "",
        title: typeof data.title === "string" && data.title ? data.title : "Documento de Saúde",
        uploaded_at: uploadedAt,
      });
    }

    return results.sort((a, b) => {
      const timeA = (a.uploaded_at ?? a.issue_date)?.getTime() ?? 0;
      const timeB = (b.uploaded_at ?? b.issue_date)?.getTime() ?? 0;
      return timeB - timeA;
    });
  } catch (err) {
    console.error("Falha ao buscar documentos de saúde do K9:", err);
    return [];
  }
}
