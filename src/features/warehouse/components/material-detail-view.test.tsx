import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { MaterialDetailView } from "./material-detail-view";
import { formatDateOnly } from "../presentation/warehouse-ui";
import { ConsumableMaterial, StockBatch, WarehouseLocation, StockPosition } from "../domain/contracts";

const mockLocations: WarehouseLocation[] = [
  { id: "loc-1", name: "Depósito A", type: "warehouse", active: true },
];

const mockMaterial: ConsumableMaterial = {
  id: "mat-1",
  name: "Ração Super Premium K9 15kg",
  category_id: "cat-nutricao",
  category_name: "Nutrição e Alimentos",
  unit: "kg",
  current_quantity: 50,
  minimum_quantity: 20,
  active: true,
  brand: "Royal Canin",
  description: "Alimento completo balanceado para cães de alta performance.",
  notes: "Armazenar em local seco e arejado.",
};

const mockBatches: StockBatch[] = [
  {
    id: "batch-1",
    material_id: "mat-1",
    material_name: "Ração Super Premium K9 15kg",
    lot_number: "LOT-2026-A",
    initial_quantity: 30,
    current_quantity: 30,
    expiration_date: "2026-11-28", // Target date for regression: 2026-11-28 -> 28/11/2026
    received_at: new Date("2026-01-10T10:00:00Z"),
    status: "active",
  },
  {
    id: "batch-2",
    material_id: "mat-1",
    material_name: "Ração Super Premium K9 15kg",
    lot_number: "LOT-2026-B",
    initial_quantity: 20,
    current_quantity: 20,
    expiration_date: "2026-12-15",
    received_at: new Date("2026-02-10T10:00:00Z"),
    status: "active",
  },
];

const mockPositions: StockPosition[] = [
  {
    id: "pos-1",
    material_id: "mat-1",
    batch_id: "batch-1",
    lot_number: "LOT-2026-A",
    location_id: "loc-1",
    location_name: "Depósito A",
    quantity: 30,
    unit: "kg",
    schema_version: 1,
    updated_at: new Date(),
  },
  {
    id: "pos-2",
    material_id: "mat-1",
    batch_id: "batch-2",
    lot_number: "LOT-2026-B",
    location_id: "loc-1",
    location_name: "Depósito A",
    quantity: 20,
    unit: "kg",
    schema_version: 1,
    updated_at: new Date(),
  },
];

let currentBatches: StockBatch[] = mockBatches;
let currentMaterials: ConsumableMaterial[] = [mockMaterial];

vi.mock("../hooks/use-warehouse-data", () => ({
  useWarehouseData: () => ({
    materials: currentMaterials,
    batches: currentBatches,
    positions: mockPositions,
    locations: mockLocations,
    movements: [],
    sessions: [],
    status: "ready",
    error: null,
  }),
}));

vi.mock("../data/warehouse-service", () => ({
  generateWarehouseIdempotencyKey: (action: string) => `test-key-${action}`,
  WarehouseService: {
    upsertMaterial: vi.fn().mockResolvedValue({ id: "mat-1" }),
    registerEntry: vi.fn().mockResolvedValue({ movement_id: "mov-1" }),
    registerConsumption: vi.fn().mockResolvedValue({ movement_id: "mov-2" }),
    registerTransfer: vi.fn().mockResolvedValue({ movement_id: "mov-3" }),
    registerLossOrDisposal: vi.fn().mockResolvedValue({ movement_id: "mov-4" }),
    archiveMaterial: vi.fn().mockResolvedValue({ success: true }),
  },
}));

describe("FIX A — Calendar Date Formatting & MaterialDetailView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentBatches = [...mockBatches];
    currentMaterials = [mockMaterial];
  });

  describe("formatDateOnly helper", () => {
    it("formats '2026-11-28' as '28/11/2026'", () => {
      expect(formatDateOnly("2026-11-28")).toBe("28/11/2026");
    });

    it("formats beginning of year date '2026-01-05' as '05/01/2026'", () => {
      expect(formatDateOnly("2026-01-05")).toBe("05/01/2026");
    });

    it("handles missing expiration values gracefully", () => {
      expect(formatDateOnly(null)).toBe("—");
      expect(formatDateOnly(undefined)).toBe("—");
      expect(formatDateOnly("")).toBe("—");
      expect(formatDateOnly("   ")).toBe("—");
      expect(formatDateOnly(null, "Não cadastrada")).toBe("Não cadastrada");
    });

    it("prevents UTC-to-local rollback across negative UTC timezones", () => {
      // In JavaScript, new Date('2026-11-28') is parsed as UTC midnight.
      // In negative timezones like Brazil (America/Sao_Paulo UTC-3 or UTC-4),
      // standard toLocaleDateString() rolls back to the previous day: '27/11/2026'.
      // formatDateOnly must NEVER roll back, regardless of environment timezone.
      const rawDateStr = "2026-11-28";
      const formatted = formatDateOnly(rawDateStr);
      expect(formatted).toBe("28/11/2026");
      expect(formatted).not.toBe("27/11/2026");
    });

    it("safely handles ISO timestamp strings if provided", () => {
      expect(formatDateOnly("2026-11-28T00:00:00.000Z")).toBe("28/11/2026");
    });
  });

  describe("MaterialDetailView visual date rendering & FEFO consistency", () => {
    it("displays canonical formatted date '28/11/2026' consistently in Próxima validade and first FEFO batch", () => {
      render(<MaterialDetailView materialId="mat-1" />);

      // Metric card "Próxima validade"
      expect(screen.getByText("Próxima validade")).toBeInTheDocument();
      expect(screen.getAllByText("28/11/2026").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Lote em 28/11/2026")).toBeInTheDocument();

      // First FEFO lot card
      expect(screen.getByText("LOT-2026-A")).toBeInTheDocument();
      expect(screen.getByText(/validade 28\/11\/2026/)).toBeInTheDocument();

      // Regression guard: ensure 27/11/2026 (the bug) is NOT present anywhere
      expect(screen.queryByText(/27\/11\/2026/)).not.toBeInTheDocument();
    });

    it("handles material with no active batches (missing expiration) gracefully", () => {
      currentBatches = [];
      render(<MaterialDetailView materialId="mat-1" />);

      // Metric card should indicate not registered and no active batches
      expect(screen.getByText("Próxima validade")).toBeInTheDocument();
      expect(screen.getByText("Não cadastrada")).toBeInTheDocument();
      expect(screen.getByText("Sem lotes ativos")).toBeInTheDocument();

      // FEFO list indicates no batches
      expect(screen.getByText("Nenhum lote F60 cadastrado.")).toBeInTheDocument();
    });

    it("skips depleted batches (current_quantity = 0) when computing Próxima validade", () => {
      // First batch is expired/depleted, next available is batch-2 (2026-12-15)
      currentBatches = [
        {
          ...mockBatches[0],
          current_quantity: 0,
        },
        mockBatches[1],
      ];

      render(<MaterialDetailView materialId="mat-1" />);

      // Próxima validade should pick batch-2 (15/12/2026)
      expect(screen.getAllByText("15/12/2026").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Lote em 15/12/2026")).toBeInTheDocument();
    });
  });
});
