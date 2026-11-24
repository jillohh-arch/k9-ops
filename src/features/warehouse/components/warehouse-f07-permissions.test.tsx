import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/firebase/client", () => ({ db: {}, functions: {} }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/warehouse",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const mockCan = vi.fn();
vi.mock("@/features/access/providers/access-control-provider", () => ({
  useAccessControl: () => ({
    can: mockCan,
    status: "ready",
    profileId: "test",
    activeProfile: null,
    error: null,
  }),
}));

vi.mock("../hooks/use-warehouse-data", () => ({
  useWarehouseData: () => ({
    status: "ready",
    error: null,
    canAuditSessions: mockCan("inventory", "audit"),
    permissions: {
      canCreate: mockCan("inventory", "create"),
      canEdit: mockCan("inventory", "edit"),
      canArchive: mockCan("inventory", "archive"),
      canAudit: mockCan("inventory", "audit"),
      canExport: mockCan("inventory", "export"),
      canReturnCustody: mockCan("inventory", "create") || mockCan("inventory", "edit"),
    },
    materials: [
      {
        id: "mat-1",
        name: "Ração K9",
        category_id: "cat-racao",
        category_name: "Alimentação",
        unit: "kg",
        current_quantity: 20,
        minimum_quantity: 5,
        active: true,
      },
      {
        id: "mat-inativo",
        name: "Item Inativo",
        category_id: "cat-off",
        category_name: "Inativa",
        unit: "un",
        current_quantity: 0,
        minimum_quantity: 0,
        active: false,
      },
    ],
    batches: [
      {
        id: "bat-1",
        material_id: "mat-1",
        material_name: "Ração K9",
        lot_number: "L-1",
        initial_quantity: 20,
        current_quantity: 20,
        expiration_date: "2027-01-01",
        received_at: new Date(),
        status: "active",
      },
    ],
    positions: [
      {
        id: "pos-1",
        material_id: "mat-1",
        batch_id: "bat-1",
        lot_number: "L-1",
        location_id: "loc-1",
        location_name: "Depósito Central",
        quantity: 20,
        unit: "kg",
        schema_version: 1,
      },
    ],
    equipment: [
      {
        id: "eq-1",
        identifier_code: "EQ-001",
        name: "Guia Tática",
        category_id: "cat-eq",
        category_name: "Tático",
        status: "in_custody",
        condition: "good",
        current_location_id: "loc-1",
        current_location_name: "Depósito Central",
        active_custody_id: "cust-1",
        active: true,
      },
    ],
    custodies: [
      {
        id: "cust-1",
        equipment_id: "eq-1",
        equipment_name: "Guia Tática",
        equipment_code: "EQ-001",
        borrower_ra: "123",
        borrower_name: "Sd Silva",
        dispatched_by_ra: "999",
        dispatched_by_name: "Almox",
        dispatched_at: new Date(),
        condition_at_dispatch: "good",
        purpose: "daily_duty",
        status: "active",
      },
    ],
    locations: [{ id: "loc-1", name: "Depósito Central", type: "warehouse", active: true }],
    movements: [],
    sessions: [],
  }),
}));

vi.mock("../data/warehouse-service", () => ({
  generateWarehouseIdempotencyKey: (p: string) => `${p}-idem`,
  WarehouseService: {
    openInventorySession: vi.fn(),
  },
}));

import { deriveInventoryCategories } from "../domain/inventory-categories";
import { OpenInventoryDialog } from "./open-inventory-dialog";
import { WarehouseView } from "./warehouse-view";
import { WarehouseOverviewView } from "./warehouse-overview-view";
import { MaterialsCatalogView } from "./materials-catalog-view";
import { MaterialDetailView } from "./material-detail-view";
import { EquipmentDetailView } from "./equipment-detail-view";
import { CustodyListView } from "./custody-list-view";
import { WarehouseService } from "../data/warehouse-service";

function setRole(actions: string[]) {
  mockCan.mockImplementation((mod: string, action = "view") => mod === "inventory" && actions.includes(action));
}

describe("F07 — Web Permissions & Category Inventory Completeness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("derives active categories and allows initiating by_category inventory in OpenInventoryDialog", async () => {
    const categories = deriveInventoryCategories([
      { active: true, category_id: "cat-racao", category_name: "Alimentação" },
      { active: false, category_id: "cat-off", category_name: "Inativa" },
    ]);
    expect(categories).toEqual([{ id: "cat-racao", name: "Alimentação", target_type: "consumable", active: true }]);

    vi.mocked(WarehouseService.openInventorySession).mockResolvedValueOnce({ session_id: "sess-cat-1" });
    const onSuccess = vi.fn();
    render(
      <OpenInventoryDialog
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={onSuccess}
        locations={[{ id: "loc-1", name: "Depósito Central", type: "warehouse", active: true }]}
        categories={categories}
      />,
    );

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "by_category" } });
    const categorySelect = screen.getAllByRole("combobox")[1];
    fireEvent.change(categorySelect, { target: { value: "cat-racao" } });
    fireEvent.change(screen.getByPlaceholderText(/Inventário Geral Q4/i), { target: { value: "Auditoria Alimentação" } });
    fireEvent.click(screen.getByRole("button", { name: /Iniciar Sessão/i }));

    await waitFor(() => {
      expect(WarehouseService.openInventorySession).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Auditoria Alimentação",
          scope_type: "by_category",
          scope_ref_id: "cat-racao",
          scope_label: "Alimentação",
        }),
      );
      expect(onSuccess).toHaveBeenCalledWith("sess-cat-1");
    });
  });

  it("hides mutation, export, and audit actions for operador_k9 (view-only) across all 6 views", () => {
    setRole(["view"]);

    const { unmount: u1 } = render(<WarehouseView section="materials" />);
    expect(screen.queryByRole("button", { name: /Exportar relatório/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Registrar Entrada/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Novo Material/i })).toBeNull();
    u1();

    const { unmount: u2 } = render(<WarehouseOverviewView />);
    expect(screen.queryByText(/Iniciar nova conferência/i)).toBeNull();
    expect(screen.queryByText("15/09/2026")).toBeNull();
    expect(screen.queryByText("15/12/2026")).toBeNull();
    expect(screen.queryByText("33%")).toBeNull();
    expect(screen.queryByText(/Colete Tático K9/i)).toBeNull();
    expect(screen.getByText(/Restrito ao perfil de auditoria/i)).toBeDefined();
    u2();

    const { unmount: u3 } = render(<MaterialsCatalogView />);
    expect(screen.queryByRole("button", { name: /Nova Entrada/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Novo Material/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Entrada$/i })).toBeNull();
    u3();

    const { unmount: u4 } = render(<MaterialDetailView materialId="mat-1" />);
    for (const label of [/Registrar entrada/i, /Editar material/i, /Saída \/ consumo/i, /Transferir/i, /Perda \/ descarte/i, /Arquivar/i]) {
      expect(screen.queryByRole("button", { name: label })).toBeNull();
    }
    u4();

    const { unmount: u5 } = render(<EquipmentDetailView equipmentId="eq-1" />);
    for (const label of [/Editar cadastro/i, /Atualizar situação/i, /Abrir Cautela/i, /Receber devolução/i, /Cancelar cautela/i, /Baixar \/ Aposentar/i]) {
      expect(screen.queryByRole("button", { name: label })).toBeNull();
    }
    u5();

    const { unmount: u6 } = render(<CustodyListView />);
    expect(screen.queryByRole("button", { name: /^Devolver$/i })).toBeNull();
    u6();
  });

  it("allows export but hides mutations for gestor (view + export)", () => {
    setRole(["view", "export"]);
    render(<WarehouseView section="overview" />);
    expect(screen.getByRole("button", { name: /Exportar relatório/i })).toBeDefined();
    expect(screen.queryByRole("button", { name: /Registrar Entrada/i })).toBeNull();
  });

  it("shows full operational controls for almoxarifado", () => {
    setRole(["view", "create", "edit", "archive", "audit", "export"]);
    render(<MaterialDetailView materialId="mat-1" />);
    expect(screen.getByRole("button", { name: /Registrar entrada/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Editar material/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Arquivar/i })).toBeDefined();
  });
});
