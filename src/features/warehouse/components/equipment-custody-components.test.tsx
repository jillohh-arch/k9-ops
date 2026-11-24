import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { EquipmentCatalogView } from "./equipment-catalog-view";
import { EquipmentDetailView } from "./equipment-detail-view";
import { CustodyListView } from "./custody-list-view";
import { OpenCustodyDialog } from "./open-custody-dialog";
import { ReturnCustodyDialog } from "./return-custody-dialog";
import { RetireEquipmentDialog } from "./retire-equipment-dialog";
import { Equipment, EquipmentCustody, WarehouseLocation } from "../domain/contracts";
import { WarehouseService } from "../data/warehouse-service";

const mockLocations: WarehouseLocation[] = [
  { id: "loc-1", name: "Almoxarifado Canil Central", type: "warehouse", active: true },
  { id: "loc-2", name: "Viatura VTR-09", type: "vehicle", active: true },
];

const mockEquipmentList: Equipment[] = [
  {
    id: "eq-1",
    name: "Peitoral Tático K9",
    category_id: "cat-equip",
    category_name: "Acessórios Táticos",
    identifier_code: "EQP-PT-001",
    condition: "good",
    status: "available",
    current_location_id: "loc-1",
    current_location_name: "Almoxarifado Canil Central",
    active: true,
    brand: "Julius-K9",
    model: "IDC Power",
    serial_number: "SN-9981",
  },
  {
    id: "eq-2",
    name: "Guia Longa de Rastreio 15m",
    category_id: "cat-equip",
    category_name: "Acessórios Táticos",
    identifier_code: "EQP-GL-002",
    condition: "fair",
    status: "in_custody",
    current_location_id: "loc-1",
    current_location_name: "Almoxarifado Canil Central",
    active: true,
    assigned_dog_name: "Thor",
  },
  {
    id: "eq-3",
    name: "Coleira Eletrônica de Treinamento",
    category_id: "cat-equip",
    category_name: "Acessórios Táticos",
    identifier_code: "EQP-CE-003",
    condition: "damaged",
    status: "maintenance",
    current_location_id: "loc-1",
    current_location_name: "Almoxarifado Canil Central",
    active: true,
  },
];

const mockCustodies: EquipmentCustody[] = [
  {
    id: "cust-active-overdue",
    equipment_id: "eq-2",
    equipment_name: "Guia Longa de Rastreio 15m",
    equipment_code: "EQP-GL-002",
    borrower_ra: "12345",
    borrower_name: "Cb PM Souza",
    dispatched_by_ra: "99999",
    dispatched_by_name: "Sgt Almoxarife",
    dispatched_at: new Date("2026-10-01T10:00:00Z"),
    condition_at_dispatch: "fair",
    purpose: "daily_duty",
    status: "active",
    expected_return_at: new Date("2026-10-05T18:00:00Z"), // Past relative to current 2026-10-06
    linked_dog_name: "Thor",
  },
  {
    id: "cust-returned-history",
    equipment_id: "eq-1",
    equipment_name: "Peitoral Tático K9",
    equipment_code: "EQP-PT-001",
    borrower_ra: "54321",
    borrower_name: "Sd PM Silva",
    dispatched_by_ra: "99999",
    dispatched_by_name: "Sgt Almoxarife",
    dispatched_at: new Date("2026-09-20T08:00:00Z"),
    condition_at_dispatch: "new",
    purpose: "operation",
    status: "returned",
    returned_at: new Date("2026-09-21T18:00:00Z"),
    condition_at_return: "good",
    return_notes: "Devolvido limpo após operação",
  },
];

vi.mock("../hooks/use-warehouse-data", () => ({
  useWarehouseData: () => ({
    materials: [],
    batches: [],
    positions: [],
    equipment: mockEquipmentList,
    custodies: mockCustodies,
    locations: mockLocations,
    movements: [],
    status: "ready",
    error: null,
    permissions: {
      canCreate: true,
      canEdit: true,
      canArchive: true,
      canAudit: true,
      canExport: true,
      canReturnCustody: true,
    },
  }),
}));

vi.mock("../data/warehouse-service", () => ({
  generateWarehouseIdempotencyKey: (action: string) => `test-key-${action}`,
  WarehouseService: {
    upsertEquipment: vi.fn().mockResolvedValue({ id: "eq-created" }),
    updateEquipmentStatus: vi.fn().mockResolvedValue({ success: true }),
    retireEquipment: vi.fn().mockResolvedValue({ success: true }),
    openCustody: vi.fn().mockResolvedValue({ custody_id: "cust-new" }),
    returnCustody: vi.fn().mockResolvedValue({ success: true }),
    cancelCustody: vi.fn().mockResolvedValue({ success: true }),
  },
}));

describe("Equipment & Custody Web Components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("EquipmentCatalogView", () => {
    it("renders equipment catalog analytical table with badges and borrower info", () => {
      render(<EquipmentCatalogView />);

      expect(screen.getByText("Peitoral Tático K9")).toBeInTheDocument();
      expect(screen.getByText("EQP-PT-001")).toBeInTheDocument();
      expect(screen.getByText("Guia Longa de Rastreio 15m")).toBeInTheDocument();
      expect(screen.getByText("EQP-GL-002")).toBeInTheDocument();

      // Badges
      expect(screen.getAllByText("Disponível").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Em Cautela").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Manutenção").length).toBeGreaterThan(0);

      // Borrower info for in_custody item
      expect(screen.getByText("Cb PM Souza")).toBeInTheDocument();
      expect(screen.getByText("RA: 12345")).toBeInTheDocument();
    });

    it("filters list when using textual search", () => {
      render(<EquipmentCatalogView />);

      const searchInput = screen.getByPlaceholderText(/Nome, código patrimonial/);
      fireEvent.change(searchInput, { target: { value: "Peitoral" } });

      expect(screen.getByText("Peitoral Tático K9")).toBeInTheDocument();
      expect(screen.queryByText("Guia Longa de Rastreio 15m")).not.toBeInTheDocument();
    });

    it("filters to only in_custody items when checkbox is checked", () => {
      render(<EquipmentCatalogView />);

      const checkbox = screen.getByLabelText(/Apenas itens em cautela ativa/);
      fireEvent.click(checkbox);

      expect(screen.queryByText("Peitoral Tático K9")).not.toBeInTheDocument();
      expect(screen.getByText("Guia Longa de Rastreio 15m")).toBeInTheDocument();
    });
  });

  describe("EquipmentDetailView", () => {
    it("renders active custody card with overdue alert for in-custody item", () => {
      render(<EquipmentDetailView equipmentId="eq-2" />);

      expect(screen.getAllByText("Guia Longa de Rastreio 15m").length).toBeGreaterThan(0);
      expect(screen.getByText("EQP-GL-002")).toBeInTheDocument();

      // Active custody banner
      expect(screen.getByText(/Cautela Ativa em Andamento/)).toBeInTheDocument();
      expect(screen.getAllByText(/Cb PM Souza/).length).toBeGreaterThan(0);
      expect(screen.getByText("Atrasada")).toBeInTheDocument();

      // Operational buttons: "Abrir Cautela" should be disabled for in_custody with disabled styling
      const openBtn = screen.getByRole("button", { name: "Abrir Cautela" });
      expect(openBtn).toBeDisabled();
      expect(openBtn).toHaveClass("disabled:opacity-40", "disabled:cursor-not-allowed");

      // "Baixar / Aposentar" should be disabled for in_custody
      const retireBtn = screen.getByRole("button", { name: "Baixar / Aposentar" });
      expect(retireBtn).toBeDisabled();
    });

    it("enables 'Abrir Cautela' for available item and displays custody history", () => {
      render(<EquipmentDetailView equipmentId="eq-1" />);

      const openBtn = screen.getByRole("button", { name: "Abrir Cautela" });
      expect(openBtn).not.toBeDisabled();

      // Custody history table
      expect(screen.getByText("Sd PM Silva")).toBeInTheDocument();
      expect(screen.getByText("Devolvida")).toBeInTheDocument();
      expect(screen.getByText("Devolvido limpo após operação")).toBeInTheDocument();
    });

    it("disables 'Abrir Cautela' for damaged / maintenance equipment with disabled styling", () => {
      render(<EquipmentDetailView equipmentId="eq-3" />);

      expect(screen.getAllByText("Coleira Eletrônica de Treinamento").length).toBeGreaterThan(0);
      const openBtn = screen.getByRole("button", { name: "Abrir Cautela" });
      expect(openBtn).toBeDisabled();
      expect(openBtn).toHaveClass("disabled:opacity-40", "disabled:cursor-not-allowed");
    });
  });

  describe("CustodyListView", () => {
    it("renders custodies list and highlights overdue entries", () => {
      render(<CustodyListView />);

      expect(screen.getByText("Cb PM Souza")).toBeInTheDocument();
      expect(screen.getByText("Guia Longa de Rastreio 15m")).toBeInTheDocument();
      expect(screen.getByText("Atrasada")).toBeInTheDocument();

      // Action button "Devolver" present for active custody
      expect(screen.getByRole("button", { name: "Devolver" })).toBeInTheDocument();
    });

    it("filters to only overdue when clicking the overdue quick filter", () => {
      render(<CustodyListView />);

      const overdueBtn = screen.getByRole("button", { name: /Apenas Atrasadas/ });
      fireEvent.click(overdueBtn);

      // Overdue item is present
      expect(screen.getByText("Guia Longa de Rastreio 15m")).toBeInTheDocument();
      // Returned item is filtered out
      expect(screen.queryByText("Peitoral Tático K9")).not.toBeInTheDocument();
    });
  });

  describe("Dialogs and Workflows", () => {
    it("validates and submits OpenCustodyDialog", async () => {
      const onClose = vi.fn();
      render(
        <OpenCustodyDialog
          isOpen={true}
          onClose={onClose}
          equipment={mockEquipmentList[0]}
        />,
      );

      const form = screen.getByRole("dialog").querySelector("form")!;
      fireEvent.submit(form);

      // Borrower RA is required
      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("RA do integrante responsável é obrigatório");
      });

      // Fill valid fields
      fireEvent.change(screen.getByLabelText(/RA do Policial/), { target: { value: "98765" } });
      fireEvent.change(screen.getByLabelText(/Nome do Policial/), { target: { value: "Cb PM Rocha" } });

      fireEvent.submit(form);

      await waitFor(() => {
        expect(WarehouseService.openCustody).toHaveBeenCalledWith(
          expect.objectContaining({
            equipment_id: "eq-1",
            borrower_ra: "98765",
            borrower_name: "Cb PM Rocha",
          }),
        );
      });
      expect(onClose).toHaveBeenCalled();
    });

    it("enforces inspection notes in ReturnCustodyDialog when item is damaged", async () => {
      const onClose = vi.fn();
      render(
        <ReturnCustodyDialog
          isOpen={true}
          onClose={onClose}
          custody={mockCustodies[0]}
          equipment={mockEquipmentList[1]}
        />,
      );

      const form = screen.getByRole("dialog").querySelector("form")!;

      // Change condition to damaged
      const conditionSelect = screen.getByLabelText(/Condição Física na Devolução/);
      fireEvent.change(conditionSelect, { target: { value: "damaged" } });

      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("Descrição do dano/avaria é obrigatória");
      });

      // Fill notes
      const notesArea = screen.getByPlaceholderText(/Descreva detalhadamente/);
      fireEvent.change(notesArea, { target: { value: "Mosquetão danificado em serviço" } });

      fireEvent.submit(form);

      await waitFor(() => {
        expect(WarehouseService.returnCustody).toHaveBeenCalledWith(
          expect.objectContaining({
            custody_id: "cust-active-overdue",
            condition_at_return: "damaged",
            target_equipment_status: "maintenance",
            return_location_id: "loc-1",
            return_location_name: "Almoxarifado Canil Central",
            return_notes: "Mosquetão danificado em serviço",
          }),
        );
      });
    });

    it("excludes retired option and sends canonical target_equipment_status and return_location_* in ReturnCustodyDialog", async () => {
      const onClose = vi.fn();
      render(
        <ReturnCustodyDialog
          isOpen={true}
          onClose={onClose}
          custody={mockCustodies[0]}
          equipment={mockEquipmentList[1]}
          locations={mockLocations}
        />,
      );

      // Retired must not be offered on custody return (handled by adminWarehouseRetireEquipment)
      expect(screen.queryByRole("option", { name: /Baixado/i })).not.toBeInTheDocument();

      const statusSelect = screen.getByLabelText(/Status Resultante/);
      fireEvent.change(statusSelect, { target: { value: "maintenance" } });

      const locationSelect = screen.getByLabelText(/Local de Armazenamento/);
      fireEvent.change(locationSelect, { target: { value: "loc-2" } });

      const form = screen.getByRole("dialog").querySelector("form")!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(WarehouseService.returnCustody).toHaveBeenCalledWith({
          custody_id: "cust-active-overdue",
          condition_at_return: "fair",
          target_equipment_status: "maintenance",
          return_location_id: "loc-2",
          return_location_name: "Viatura VTR-09",
          return_notes: null,
          idempotency_key: "test-key-return-custody",
        });
      });
      const sentPayload = (WarehouseService.returnCustody as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(sentPayload).not.toHaveProperty("target_status");
      expect(sentPayload).not.toHaveProperty("target_location_id");
    });

    it("blocks retirement in RetireEquipmentDialog when item is in custody", async () => {
      const onClose = vi.fn();
      render(
        <RetireEquipmentDialog
          isOpen={true}
          onClose={onClose}
          equipment={mockEquipmentList[1]} // in_custody
        />,
      );

      // Check alert warning
      expect(screen.getByText(/Ação bloqueada/)).toBeInTheDocument();
      const submitBtn = screen.getByRole("button", { name: "Confirmar Baixa" });
      expect(submitBtn).toBeDisabled();

      expect(WarehouseService.retireEquipment).not.toHaveBeenCalled();
    });
  });
});
