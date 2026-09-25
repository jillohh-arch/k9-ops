import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  createAndUploadDischargeDocument,
  fetchEligibleDischargeDocuments,
  finalizeHealthDocumentUpload,
  prepareHealthDocumentUpload,
  uploadHealthDocumentToStaging,
  validateHealthDocumentFile,
  MAX_HEALTH_DOCUMENT_BYTES,
} from "@/features/health/data/health-document-service";

const mockPrepare = vi.fn();
const mockFinalize = vi.fn();
const mockUploadBytes = vi.fn();
const mockRef = vi.fn((_storage, path) => ({ fullPath: path }));

vi.mock("@/lib/firebase/functions", () => ({
  callHealthDocumentFinalizeUpload: (input: unknown) => mockFinalize(input),
  callHealthDocumentPrepareUpload: (input: unknown) => mockPrepare(input),
}));

vi.mock("firebase/storage", () => ({
  ref: (storageInstance: unknown, path: string) => mockRef(storageInstance, path),
  uploadBytes: (storageRef: unknown, file: unknown, metadata?: unknown) =>
    mockUploadBytes(storageRef, file, metadata),
}));

let mockFirestoreDocs: Array<{ id: string; data: () => Record<string, unknown> }> = [];

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  getDocs: vi.fn(() => Promise.resolve({ docs: mockFirestoreDocs })),
}));

vi.mock("@/lib/firebase/client", () => ({
  db: {},
  storage: {},
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockFirestoreDocs = [];
});

describe("Health Document Service — Validation", () => {
  it("aceita arquivos válidos (PDF, PNG, JPG, DOCX) com tamanho <= 20 MB", () => {
    const pdf = new File(["pdf"], "laudo.pdf", { type: "application/pdf" });
    expect(validateHealthDocumentFile(pdf).valid).toBe(true);

    const png = new File(["png"], "exame.png", { type: "image/png" });
    expect(validateHealthDocumentFile(png).valid).toBe(true);

    const docx = new File(["docx"], "termo.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    expect(validateHealthDocumentFile(docx).valid).toBe(true);
  });

  it("rejeita arquivo com tamanho superior a 20 MB", () => {
    const huge = new File(["content"], "laudo-enorme.pdf", {
      type: "application/pdf",
    });
    Object.defineProperty(huge, "size", { value: MAX_HEALTH_DOCUMENT_BYTES + 1024 });

    const result = validateHealthDocumentFile(huge);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/excede o tamanho máximo permitido de 20 MB/i);
  });

  it("rejeita formatos não suportados", () => {
    const bin = new File(["data"], "backup.zip", { type: "application/zip" });
    const result = validateHealthDocumentFile(bin);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Formato de arquivo não suportado/i);
  });
});

describe("Health Document Service — Canonical Upload Flow", () => {
  it("prepareHealthDocumentUpload invoca callable com dogId e operationId determinístico", async () => {
    mockPrepare.mockResolvedValueOnce({
      data: {
        dogId: "dog-1",
        documentId: "hd_test_123",
        max_bytes: 20971520,
        uploadPath: "health_document_uploads/dog-1/hd_test_123",
      },
    });

    const result = await prepareHealthDocumentUpload("dog-1", "op-fixed-456");
    expect(mockPrepare).toHaveBeenCalledWith({
      dogId: "dog-1",
      operationId: "op-fixed-456",
    });
    expect(result.documentId).toBe("hd_test_123");
    expect(result.uploadPath).toBe("health_document_uploads/dog-1/hd_test_123");
  });

  it("uploadHealthDocumentToStaging grava bytes no Storage no target retornado", async () => {
    mockUploadBytes.mockResolvedValueOnce({});
    const file = new File(["dados"], "laudo.pdf", { type: "application/pdf" });

    await uploadHealthDocumentToStaging(
      "health_document_uploads/dog-1/hd_test_123",
      file,
    );

    expect(mockRef).toHaveBeenCalledWith(
      expect.anything(),
      "health_document_uploads/dog-1/hd_test_123",
    );
    expect(mockUploadBytes).toHaveBeenCalledWith(
      expect.objectContaining({
        fullPath: "health_document_uploads/dog-1/hd_test_123",
      }),
      file,
      { contentType: "application/pdf" },
    );
  });

  it("finalizeHealthDocumentUpload envia metadata canônica e recebe referência selada", async () => {
    mockFinalize.mockResolvedValueOnce({
      data: {
        documentId: "hd_test_123",
        dogId: "dog-1",
        reference: "dogs/dog-1/health_documents/hd_test_123",
        storagePath: "health_documents/dog-1/hd_test_123",
      },
    });

    const result = await finalizeHealthDocumentUpload({
      dogId: "dog-1",
      documentType: "report",
      issuer: "Dra. Maria",
      operationId: "op-fixed-456",
      title: "Laudo de Alta Médica",
    });

    expect(mockFinalize).toHaveBeenCalledWith({
      dogId: "dog-1",
      documentType: "report",
      issuer: "Dra. Maria",
      operationId: "op-fixed-456",
      title: "Laudo de Alta Médica",
    });
    expect(result.documentId).toBe("hd_test_123");
    expect(result.storagePath).toBe("health_documents/dog-1/hd_test_123");
  });

  it("createAndUploadDischargeDocument orquestra prepare -> upload -> finalize perfeitamente", async () => {
    mockPrepare.mockResolvedValueOnce({
      data: {
        dogId: "dog-1",
        documentId: "hd_orch_789",
        max_bytes: 20971520,
        uploadPath: "health_document_uploads/dog-1/hd_orch_789",
      },
    });
    mockUploadBytes.mockResolvedValueOnce({});
    mockFinalize.mockResolvedValueOnce({
      data: {
        documentId: "hd_orch_789",
        dogId: "dog-1",
        reference: "dogs/dog-1/health_documents/hd_orch_789",
        storagePath: "health_documents/dog-1/hd_orch_789",
      },
    });

    const file = new File(["laudo"], "laudo-final.pdf", { type: "application/pdf" });
    const result = await createAndUploadDischargeDocument("dog-1", file, {
      description: "Paciente sem claudicação",
      documentType: "report",
      issuer: "Dr. Veterinário",
      operationId: "op-orch-999",
      title: "Laudo de Alta Definitiva",
    });

    expect(result.documentId).toBe("hd_orch_789");
    expect(result.storagePath).toBe("health_documents/dog-1/hd_orch_789");
    expect(result.title).toBe("Laudo de Alta Definitiva");

    expect(mockPrepare).toHaveBeenCalledTimes(1);
    expect(mockUploadBytes).toHaveBeenCalledTimes(1);
    expect(mockFinalize).toHaveBeenCalledTimes(1);
  });
});

describe("Health Document Service — Fetch Eligible Documents", () => {
  it("lista documentos canônicos excluindo excluídos e excluindo o documento de emissão", async () => {
    mockFirestoreDocs = [
      {
        id: "doc-emissao-restricao", // Deve ser excluído via excludeDocumentId
        data: () => ({
          document_type: "report",
          title: "Laudo que abriu a restrição",
          uploaded_at: new Date(2026, 7, 10),
        }),
      },
      {
        id: "doc-excluido", // Deve ser excluído porque deleted_at != null
        data: () => ({
          deleted_at: new Date(2026, 7, 12),
          document_type: "certificate",
          title: "Documento cancelado",
        }),
      },
      {
        id: "doc-alta-legitimo",
        data: () => ({
          document_type: "certificate",
          issuer: "Hospital Canil",
          title: "Atestado de Alta Ortopédica",
          uploaded_at: new Date(2026, 8, 20),
        }),
      },
    ];

    const docs = await fetchEligibleDischargeDocuments(
      "dog-1",
      "doc-emissao-restricao",
    );

    expect(docs).toHaveLength(1);
    expect(docs[0].id).toBe("doc-alta-legitimo");
    expect(docs[0].title).toBe("Atestado de Alta Ortopédica");
  });
});
