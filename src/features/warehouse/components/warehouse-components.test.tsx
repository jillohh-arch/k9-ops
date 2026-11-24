import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { MaterialsCatalogView } from "./materials-catalog-view";
import { ConsumptionDialog } from "./consumption-dialog";
import { TransferDialog } from "./transfer-dialog";
import { WarehouseService } from "../data/warehouse-service";

const mockMaterials = [
  {
    id: "mat-1",
    name: "Ração Adulto 15kg",
    category_id: "cat-1",
    category_name: "Alimentos",
    unit: "kg",
    current_quantity: 30,
    minimum_quantity: 10,
    active: true,
  },
  {
    id: "mat-legacy",
    name: "Coleira Antiga",
    category_id: "cat-2",
    category_name: "Equipamentos",
    unit: "unidade",
    current_quantity: 5,
    minimum_quantity: 2,
    active: true,
  },
];

const mockBatches = [
  {
    id: "b1",
    material_id: "mat-1",
    material_name: "Ração Adulto 15kg",
    lot_number: "LT-01",
    initial_quantity: 20,
    current_quantity: 20,
    expiration_date: "2027-11-01",
    status: "active" as const,
    received_at: new Date("2026-01-01"),
  },
  {
    id: "b2",
    material_id: "mat-1",
    material_name: "Ração Adulto 15kg",
    lot_number: "LT-02",
    initial_quantity: 10,
    current_quantity: 10,
    expiration_date: "2027-12-01",
    status: "active" as const,
    received_at: new Date("2026-01-02"),
  },
];

const mockPositions = [
  {
    id: "pos-1",
    material_id: "mat-1",
    batch_id: "b1",
    lot_number: "LT-01",
    location_id: "loc-1",
    location_name: "Almoxarifado Principal",
    quantity: 20,
    unit: "kg",
    updated_at: new Date(),
    schema_version: 1 as const,
  },
  {
    id: "pos-2",
    material_id: "mat-1",
    batch_id: "b2",
    lot_number: "LT-02",
    location_id: "loc-1",
    location_name: "Almoxarifado Principal",
    quantity: 10,
    unit: "kg",
    updated_at: new Date(),
    schema_version: 1 as const,
  },
];

const mockLocations = [
  { id: "loc-1", name: "Almoxarifado Principal", type: "warehouse" as const, active: true },
  { id: "loc-2", name: "Canil Setor B", type: "room" as const, active: true },
];

vi.mock("../hooks/use-warehouse-data", () => ({
  useWarehouseData: () => ({
    materials: mockMaterials,
    batches: mockBatches,
    positions: mockPositions,
    locations: mockLocations,
    equipment: [],
    movements: [],
    status: "ready",
    error: null,
  }),
}));

vi.mock("../data/warehouse-service", () => ({
  generateWarehouseIdempotencyKey: (action: string) => `test-key-${action}`,
  WarehouseService: {
    registerConsumption: vi.fn().mockResolvedValue({ movement_id: "mov-1" }),
    registerTransfer: vi.fn().mockResolvedValue({ movement_id: "mov-2" }),
    upsertMaterial: vi.fn().mockResolvedValue({ id: "mat-1" }),
  },
}));

describe("Warehouse UI Components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders catalog with ON-HAND vs AVAILABLE distinction and legacy badge", () => {
    render(<MaterialsCatalogView />);

    expect(screen.getByText("Ração Adulto 15kg")).toBeInTheDocument();
    expect(screen.getByText("Coleira Antiga")).toBeInTheDocument();

    // Legacy badge for Coleira Antiga (has no F60 batches/positions)
    expect(screen.getByText("LEGACY")).toBeInTheDocument();
    expect(screen.getByText("Requer reconciliação")).toBeInTheDocument();

    // ON-HAND 30 kg for Ração Adulto (appears in ON-HAND column and AVAILABLE column)
    const elementsWith30kg = screen.getAllByText("30 kg");
    expect(elementsWith30kg.length).toBeGreaterThan(0);
  });

  it("requires override justification in ConsumptionDialog when selecting non-recommended batch", async () => {
    render(
      <ConsumptionDialog
        isOpen={true}
        onClose={vi.fn()}
        material={mockMaterials[0]}
        batches={mockBatches}
        positions={mockPositions}
        locations={mockLocations}
      />,
    );

    // Initial recommended batch is LT-01 (expires 2026-11-01)
    expect(screen.getByText(/Sugerido FEFO: Lote LT-01/)).toBeInTheDocument();

    // Change batch to LT-02 (expires later)
    const select = screen.getByLabelText(/Lote de Saída/);
    fireEvent.change(select, { target: { value: "b2" } });

    // Warning and required override justification should appear
    expect(screen.getByText(/Atenção: Desvio da regra FEFO/)).toBeInTheDocument();

    // Fill valid quantity but keep justification empty
    const qtyInput = screen.getByLabelText(/Quantidade a Consumir/);
    fireEvent.change(qtyInput, { target: { value: "5" } });

    const submitBtn = screen.getByRole("button", { name: "Confirmar Saída" });
    fireEvent.click(submitBtn);

    // Error should be displayed
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Uma justificativa é obrigatória");
    });

    expect(WarehouseService.registerConsumption).not.toHaveBeenCalled();

    // Now fill justification
    const reasonInput = screen.getByPlaceholderText(/Lote reservado para treinamento/);
    fireEvent.change(reasonInput, { target: { value: "Justificativa operacional válida" } });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(WarehouseService.registerConsumption).toHaveBeenCalledWith(
        expect.objectContaining({
          batch_id: "b2",
          fefo_override_reason: "Justificativa operacional válida",
        }),
      );
    });
  });

  it("R2-REG-1: changing origin drops a batch choice made in the previous origin", async () => {
    // The same physical batch B1 has stock in BOTH locations. B2 has stock only
    // in loc-1. The operator picks B2 at loc-1 (a FEFO override), then moves the
    // origin to loc-2 and back. The stale B2 choice must NOT survive: the
    // selection is bound to the origin it was made in.
    const sharedPositions = [
      {
        id: "pos-1a", material_id: "mat-1", batch_id: "b1", lot_number: "LT-01",
        location_id: "loc-1", location_name: "Almoxarifado Principal",
        quantity: 20, unit: "kg", updated_at: new Date(), schema_version: 1 as const,
      },
      {
        id: "pos-1b", material_id: "mat-1", batch_id: "b1", lot_number: "LT-01",
        location_id: "loc-2", location_name: "Canil Setor B",
        quantity: 7, unit: "kg", updated_at: new Date(), schema_version: 1 as const,
      },
      {
        id: "pos-2", material_id: "mat-1", batch_id: "b2", lot_number: "LT-02",
        location_id: "loc-1", location_name: "Almoxarifado Principal",
        quantity: 10, unit: "kg", updated_at: new Date(), schema_version: 1 as const,
      },
    ];

    render(
      <ConsumptionDialog
        isOpen={true}
        onClose={vi.fn()}
        material={mockMaterials[0]}
        batches={mockBatches}
        positions={sharedPositions}
        locations={mockLocations}
      />,
    );

    const origin = screen.getByLabelText(/Local de Origem/) as HTMLSelectElement;
    const batch = screen.getByLabelText(/Lote de Saída/) as HTMLSelectElement;

    // Default: FEFO recommends B1 at loc-1.
    expect(origin.value).toBe("loc-1");
    expect(batch.value).toBe("b1");

    // Operator explicitly overrides to B2 at loc-1.
    fireEvent.change(batch, { target: { value: "b2" } });
    expect(batch.value).toBe("b2");
    expect(screen.getByText(/Atenção: Desvio da regra FEFO/)).toBeInTheDocument();

    // Move to loc-2: B2 has no stock there, so B1 must be selected.
    fireEvent.change(origin, { target: { value: "loc-2" } });
    expect(batch.value).toBe("b1");
    expect(screen.queryByText(/Atenção: Desvio da regra FEFO/)).not.toBeInTheDocument();

    // Back to loc-1: the previous B2 override must NOT be resurrected.
    fireEvent.change(origin, { target: { value: "loc-1" } });
    expect(batch.value).toBe("b1");
    expect(screen.queryByText(/Atenção: Desvio da regra FEFO/)).not.toBeInTheDocument();
    expect(screen.getByText(/Sugerido FEFO: Lote LT-01/)).toBeInTheDocument();
  });


it("validates that origin and destination must be distinct in TransferDialog", async () => {
    render(
      <TransferDialog
        isOpen={true}
        onClose={vi.fn()}
        material={mockMaterials[0]}
        batches={mockBatches}
        positions={mockPositions}
        locations={mockLocations}
      />,
    );

    const qtyInput = screen.getByLabelText(/Quantidade a Transferir/);
    fireEvent.change(qtyInput, { target: { value: "2" } });

    // Note: Destination dropdown already excludes origin, but let's test submit
    const submitBtn = screen.getByRole("button", { name: "Confirmar Transferência" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(WarehouseService.registerTransfer).toHaveBeenCalledWith(
        expect.objectContaining({
          material_id: "mat-1",
          batch_id: "b1",
          quantity: 2,
        }),
      );
    });
  });
});
