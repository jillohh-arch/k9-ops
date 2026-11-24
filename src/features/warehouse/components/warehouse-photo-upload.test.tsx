import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import {
  validateWarehousePhotoFile,
  inferWarehouseImageContentType,
  uploadWarehousePhoto,
  WarehouseService,
} from "../data/warehouse-service";
import { WarehousePhotoField } from "./warehouse-photo-field";
import { MaterialFormDialog } from "./material-form-dialog";
import { EquipmentFormDialog } from "./equipment-form-dialog";
import { ConsumableMaterial, Equipment, WarehouseLocation } from "../domain/contracts";

// Mock Firebase Storage and Client
const storageMocks = vi.hoisted(() => ({
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
  ref: vi.fn((_storage, path) => ({ path })),
}));

vi.mock("firebase/storage", () => ({
  uploadBytes: (ref: unknown, file: unknown, meta?: unknown) =>
    storageMocks.uploadBytes(ref, file, meta),
  getDownloadURL: (ref: unknown) => storageMocks.getDownloadURL(ref),
  ref: (storage: unknown, path: string) => storageMocks.ref(storage, path),
}));

vi.mock("@/lib/firebase/client", () => ({
  functions: {},
  storage: {},
  db: {},
}));

vi.mock("firebase/functions", () => ({
  httpsCallable: () => vi.fn().mockResolvedValue({ data: { id: "mock-id" } }),
}));

describe("Warehouse Photo Upload & Lifecycle (F60)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof window !== "undefined") {
      window.URL.createObjectURL = vi.fn().mockReturnValue("blob:http://localhost/test-blob");
      window.URL.revokeObjectURL = vi.fn();
    }
    storageMocks.uploadBytes.mockResolvedValue({});
    storageMocks.getDownloadURL.mockResolvedValue("https://storage.googleapis.com/test-bucket/inventory_items/item.jpg");
  });

  describe("File Validation & Content Type Inference", () => {
    it("accepts allowed MIME types under 5MB", () => {
      const validJpg = new File(["dummy content"], "photo.jpg", { type: "image/jpeg" });
      const validPng = new File(["dummy content"], "photo.png", { type: "image/png" });
      const validWebp = new File(["dummy content"], "photo.webp", { type: "image/webp" });
      const validGif = new File(["dummy content"], "photo.gif", { type: "image/gif" });

      expect(validateWarehousePhotoFile(validJpg)).toBeNull();
      expect(validateWarehousePhotoFile(validPng)).toBeNull();
      expect(validateWarehousePhotoFile(validWebp)).toBeNull();
      expect(validateWarehousePhotoFile(validGif)).toBeNull();
    });

    it("rejects unsupported MIME types", () => {
      const pdf = new File(["dummy"], "doc.pdf", { type: "application/pdf" });
      const bmp = new File(["dummy"], "doc.bmp", { type: "image/bmp" });
      const exe = new File(["dummy"], "doc.exe", { type: "application/octet-stream" });

      expect(validateWarehousePhotoFile(pdf)).toBe("Formato não suportado. Use JPG, PNG, WEBP ou GIF.");
      expect(validateWarehousePhotoFile(bmp)).toBe("Formato não suportado. Use JPG, PNG, WEBP ou GIF.");
      expect(validateWarehousePhotoFile(exe)).toBe("Formato não suportado. Use JPG, PNG, WEBP ou GIF.");
    });

    it("rejects files larger than 5MB", () => {
      const oversizedBlob = new Uint8Array(5 * 1024 * 1024 + 10);
      const largeFile = new File([oversizedBlob], "large.jpg", { type: "image/jpeg" });

      expect(validateWarehousePhotoFile(largeFile)).toBe("Arquivo muito grande. Tamanho máximo: 5 MB.");
    });

    it("infers content type correctly by MIME or extension fallback", () => {
      const fileWithMime = new File([""], "test.png", { type: "image/png" });
      expect(inferWarehouseImageContentType(fileWithMime)).toBe("image/png");

      const fileWithoutMime = new File([""], "test.webp", { type: "" });
      expect(inferWarehouseImageContentType(fileWithoutMime)).toBe("image/webp");
    });
  });

  describe("uploadWarehousePhoto Storage helper", () => {
    it("uploads to inventory_items/{itemId}/{fileName} conforming to storage.rules", async () => {
      const file = new File(["photo data"], "collar.jpg", { type: "image/jpeg" });
      const url = await uploadWarehousePhoto("equipment", "EQP-001", file);

      expect(storageMocks.ref).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringMatching(/^inventory_items\/equipment-EQP-001\/\d+\.jpg$/),
      );
      expect(storageMocks.uploadBytes).toHaveBeenCalledWith(
        expect.anything(),
        file,
        { contentType: "image/jpeg" },
      );
      expect(storageMocks.getDownloadURL).toHaveBeenCalled();
      expect(url).toBe("https://storage.googleapis.com/test-bucket/inventory_items/item.jpg");
    });

    it("throws when file validation fails before calling Storage", async () => {
      const invalidFile = new File([""], "doc.pdf", { type: "application/pdf" });
      await expect(uploadWarehousePhoto("material", "mat-1", invalidFile)).rejects.toThrow(
        "Formato não suportado",
      );
      expect(storageMocks.uploadBytes).not.toHaveBeenCalled();
    });
  });

  describe("WarehousePhotoField Component", () => {
    it("renders empty state with add photo label and fallback illustration", () => {
      const onSelect = vi.fn();
      const onRemove = vi.fn();

      render(
        <WarehousePhotoField
          label="Foto do Material"
          categoryName="Nutrição"
          currentPhotoUrl={null}
          selectedFile={null}
          isRemoved={false}
          onFileSelect={onSelect}
          onRemove={onRemove}
        />,
      );

      expect(screen.getByText("Foto do Material")).toBeInTheDocument();
      expect(screen.getByText("Adicionar foto")).toBeInTheDocument();
      expect(screen.queryByText("Remover foto")).not.toBeInTheDocument();
      expect(screen.getByText(/JPG, PNG, WEBP · até 5 MB/i)).toBeInTheDocument();
    });

    it("renders photo preview, change button and remove button when currentPhotoUrl is provided", () => {
      render(
        <WarehousePhotoField
          label="Foto do Material"
          categoryName="Nutrição"
          currentPhotoUrl="https://example.com/racao.jpg"
          selectedFile={null}
          isRemoved={false}
          onFileSelect={vi.fn()}
          onRemove={vi.fn()}
        />,
      );

      expect(screen.getByText("Trocar foto")).toBeInTheDocument();
      expect(screen.getByText("Remover foto")).toBeInTheDocument();
    });

    it("calls onRemove when remove button is clicked", () => {
      const onRemove = vi.fn();
      render(
        <WarehousePhotoField
          label="Foto do Material"
          currentPhotoUrl="https://example.com/racao.jpg"
          selectedFile={null}
          isRemoved={false}
          onFileSelect={vi.fn()}
          onRemove={onRemove}
        />,
      );

      fireEvent.click(screen.getByText("Remover foto"));
      expect(onRemove).toHaveBeenCalledTimes(1);
    });

    it("validates file on input change and triggers onErrorChange on invalid file", () => {
      const onErrorChange = vi.fn();
      const onSelect = vi.fn();

      const { container } = render(
        <WarehousePhotoField
          label="Foto do Material"
          currentPhotoUrl={null}
          selectedFile={null}
          isRemoved={false}
          onFileSelect={onSelect}
          onRemove={vi.fn()}
          onErrorChange={onErrorChange}
        />,
      );

      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(input).toBeInTheDocument();

      const invalidFile = new File(["test"], "doc.txt", { type: "text/plain" });
      fireEvent.change(input, { target: { files: [invalidFile] } });

      expect(onErrorChange).toHaveBeenCalledWith(expect.stringContaining("Formato não suportado"));
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe("MaterialFormDialog Photo Integration", () => {
    const mockCategories = [{ id: "cat-nutri", name: "Nutrição Canina" }];

    it("creates new material with uploaded photo_url", async () => {
      const upsertSpy = vi.spyOn(WarehouseService, "upsertMaterial").mockResolvedValue({ id: "new-mat-1" });
      const onSuccess = vi.fn();
      const onClose = vi.fn();

      const { container } = render(
        <MaterialFormDialog
          isOpen={true}
          onClose={onClose}
          onSuccess={onSuccess}
          categories={mockCategories}
        />,
      );

      fireEvent.change(screen.getByLabelText(/Nome do Material/i), {
        target: { value: "Ração Filhotes 15kg" },
      });
      fireEvent.change(screen.getByLabelText(/Estoque Mínimo/i), {
        target: { value: "10" },
      });

      // Select photo file
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(["image-bytes"], "racao.png", { type: "image/png" });
      fireEvent.change(fileInput, { target: { files: [file] } });

      // Submit form
      fireEvent.click(screen.getByRole("button", { name: "Criar Material" }));

      await waitFor(() => {
        expect(storageMocks.uploadBytes).toHaveBeenCalledTimes(1);
        expect(upsertSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "Ração Filhotes 15kg",
            photo_url: "https://storage.googleapis.com/test-bucket/inventory_items/item.jpg",
            photo_remove: false,
          }),
        );
        expect(onSuccess).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });
    });

    it("allows removing photo on edit and sends photo_remove: true", async () => {
      const upsertSpy = vi.spyOn(WarehouseService, "upsertMaterial").mockResolvedValue({ id: "mat-1" });
      const onClose = vi.fn();

      const materialToEdit: ConsumableMaterial = {
        id: "mat-1",
        name: "Coleira de Lona",
        category_id: "cat-nutri",
        category_name: "Nutrição Canina",
        unit: "unidade",
        minimum_quantity: 5,
        current_quantity: 12,
        active: true,
        photo_url: "https://storage.googleapis.com/test/existing-photo.jpg",
      };

      render(
        <MaterialFormDialog
          isOpen={true}
          onClose={onClose}
          materialToEdit={materialToEdit}
          categories={mockCategories}
        />,
      );

      // Verify existing photo is shown with removal button
      expect(screen.getByText("Remover foto")).toBeInTheDocument();
      fireEvent.click(screen.getByText("Remover foto"));

      // Removal button disappears and placeholder returns
      expect(screen.queryByText("Remover foto")).not.toBeInTheDocument();
      expect(screen.getByText("Adicionar foto")).toBeInTheDocument();

      // Submit edit
      fireEvent.click(screen.getByRole("button", { name: "Salvar Alterações" }));

      await waitFor(() => {
        expect(upsertSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "mat-1",
            photo_url: null,
            photo_remove: true,
          }),
        );
      });
    });

    it("preserves form data and does not close if save fails", async () => {
      vi.spyOn(WarehouseService, "upsertMaterial").mockRejectedValue(new Error("Erro de rede ao salvar"));
      const onClose = vi.fn();

      render(
        <MaterialFormDialog
          isOpen={true}
          onClose={onClose}
          categories={mockCategories}
        />,
      );

      fireEvent.change(screen.getByLabelText(/Nome do Material/i), {
        target: { value: "Item Teste" },
      });
      fireEvent.change(screen.getByLabelText(/Estoque Mínimo/i), {
        target: { value: "3" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Criar Material" }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("Erro de rede ao salvar");
        expect(onClose).not.toHaveBeenCalled();
        expect((screen.getByLabelText(/Nome do Material/i) as HTMLInputElement).value).toBe("Item Teste");
      });
    });
  });

  describe("EquipmentFormDialog Photo Integration", () => {
    const mockCategories = [{ id: "cat-eq", name: "Tático" }];
    const mockLocations: WarehouseLocation[] = [
      { id: "loc-1", name: "Almoxarifado Central", type: "warehouse", active: true },
    ];

    it("creates equipment with uploaded photo_url", async () => {
      const upsertSpy = vi.spyOn(WarehouseService, "upsertEquipment").mockResolvedValue({ id: "eq-new-1" });
      const onSuccess = vi.fn();
      const onClose = vi.fn();

      const { container } = render(
        <EquipmentFormDialog
          isOpen={true}
          onClose={onClose}
          onSuccess={onSuccess}
          categories={mockCategories}
          locations={mockLocations}
        />,
      );

      fireEvent.change(screen.getByLabelText(/Nome do Equipamento/i), {
        target: { value: "Coleira K9 VIP" },
      });
      fireEvent.change(screen.getByLabelText(/Código Patrimonial/i), {
        target: { value: "EQP-VIP-001" },
      });

      // Select photo
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(["bytes"], "collar.jpg", { type: "image/jpeg" });
      fireEvent.change(fileInput, { target: { files: [file] } });

      fireEvent.click(screen.getByRole("button", { name: "Cadastrar Equipamento" }));

      await waitFor(() => {
        expect(storageMocks.uploadBytes).toHaveBeenCalledTimes(1);
        expect(upsertSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "Coleira K9 VIP",
            identifier_code: "EQP-VIP-001",
            photo_url: "https://storage.googleapis.com/test-bucket/inventory_items/item.jpg",
            photo_remove: false,
          }),
        );
        expect(onSuccess).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });
    });

    it("allows replacing existing photo on equipment edit", async () => {
      const upsertSpy = vi.spyOn(WarehouseService, "upsertEquipment").mockResolvedValue({ id: "eq-1" });
      const onClose = vi.fn();

      const equipmentToEdit: Equipment = {
        id: "eq-1",
        name: "Peitoral Julius",
        identifier_code: "EQP-001",
        category_id: "cat-eq",
        category_name: "Tático",
        condition: "good",
        status: "available",
        current_location_id: "loc-1",
        current_location_name: "Almoxarifado Central",
        active: true,
        photo_url: "https://example.com/old-photo.jpg",
      };

      const { container } = render(
        <EquipmentFormDialog
          isOpen={true}
          onClose={onClose}
          equipmentToEdit={equipmentToEdit}
          categories={mockCategories}
          locations={mockLocations}
        />,
      );

      // Select replacement photo
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const newFile = new File(["new-bytes"], "new-collar.webp", { type: "image/webp" });
      fireEvent.change(fileInput, { target: { files: [newFile] } });

      fireEvent.click(screen.getByRole("button", { name: "Salvar Alterações" }));

      await waitFor(() => {
        expect(storageMocks.uploadBytes).toHaveBeenCalledTimes(1);
        expect(upsertSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "eq-1",
            photo_url: "https://storage.googleapis.com/test-bucket/inventory_items/item.jpg",
            photo_remove: false,
          }),
        );
      });
    });

    it("allows removing photo on equipment edit and sends photo_remove: true", async () => {
      const upsertSpy = vi.spyOn(WarehouseService, "upsertEquipment").mockResolvedValue({ id: "eq-1" });

      const equipmentToEdit: Equipment = {
        id: "eq-1",
        name: "Peitoral Julius",
        identifier_code: "EQP-001",
        category_id: "cat-eq",
        category_name: "Tático",
        condition: "good",
        status: "available",
        current_location_id: "loc-1",
        current_location_name: "Almoxarifado Central",
        active: true,
        photo_url: "https://example.com/old-photo.jpg",
      };

      render(
        <EquipmentFormDialog
          isOpen={true}
          onClose={vi.fn()}
          equipmentToEdit={equipmentToEdit}
          categories={mockCategories}
          locations={mockLocations}
        />,
      );

      fireEvent.click(screen.getByText("Remover foto"));
      fireEvent.click(screen.getByRole("button", { name: "Salvar Alterações" }));

      await waitFor(() => {
        expect(upsertSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "eq-1",
            photo_url: null,
            photo_remove: true,
          }),
        );
      });
    });
  });
});
