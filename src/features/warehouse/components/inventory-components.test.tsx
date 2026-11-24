import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ActiveInventoryBanner } from "./active-inventory-banner";
import { CountItemDialog } from "./count-item-dialog";
import { HomologateConfirmDialog } from "./homologate-confirm-dialog";
import { CancelInventoryDialog } from "./cancel-inventory-dialog";
import { OpenInventoryDialog } from "./open-inventory-dialog";
import { UnexpectedItemDialog } from "./unexpected-item-dialog";
import { InventoryDetailView } from "./inventory-detail-view";
import { InventorySession, InventoryItemCount } from "../domain/contracts";
import { WarehouseService } from "../data/warehouse-service";

const mockSessionsList: InventorySession[] = [
  {
    id: "inv-in-prog",
    title: "Inventário Geral Ativo",
    scope_type: "full_warehouse",
    opened_by_ra: "123",
    opened_by_name: "Sgt Silva",
    opened_at: new Date("2026-10-06T10:00:00Z"),
    closed_at: new Date("2026-10-06T11:00:00Z"), // Residual closing timestamp on active session
    closed_by_name: "Capitão Santos", // Residual closing actor on active session
    status: "in_progress",
    total_items: 5,
    counted_items: 3,
  },
  {
    id: "inv-all-counted",
    title: "Inventário Totalmente Contado",
    scope_type: "full_warehouse",
    opened_by_ra: "123",
    opened_by_name: "Sgt Silva",
    opened_at: new Date("2026-10-06T10:00:00Z"),
    status: "in_progress",
    total_items: 5,
    counted_items: 5,
  },
  {
    id: "inv-cancelled",
    title: "Inventário Cancelado",
    scope_type: "by_category",
    scope_label: "Farmácia",
    opened_by_ra: "123",
    opened_by_name: "Sgt Silva",
    opened_at: new Date("2026-10-05T10:00:00Z"),
    closed_at: new Date("2026-10-05T12:00:00Z"),
    closed_by_name: "Tenente Lima",
    status: "cancelled",
    notes: "Cancelado por divergência de lote",
  },
];

// Case 1: Partial count fixture (5 positions: 3 counted, 2 pending, 1 divergence)
const mockPendingCountsList: InventoryItemCount[] = [
  {
    id: "cnt-1",
    session_id: "inv-in-prog",
    material_id: "mat-1",
    material_name: "Ração Operacional Super Premium",
    batch_id: "bat-1",
    lot_number: "LOT-2026-A",
    location_id: "loc-1",
    location_name: "Almoxarifado Central",
    stock_position_id: "pos-1",
    unit: "kg",
    expected_quantity: 20,
    counted_quantity: 20,
    discrepancy: 0,
    counted_by_ra: "123",
    counted_by_name: "Sgt Silva",
    counted_at: new Date(),
  },
  {
    id: "cnt-2",
    session_id: "inv-in-prog",
    material_id: "mat-2",
    material_name: "Shampoo Clorexidina",
    batch_id: "bat-2",
    lot_number: "LOT-2026-B",
    location_id: "loc-1",
    location_name: "Almoxarifado Central",
    stock_position_id: "pos-2",
    unit: "frasco",
    expected_quantity: 10,
    counted_quantity: 10,
    discrepancy: 0,
    counted_by_ra: "123",
    counted_by_name: "Sgt Silva",
    counted_at: new Date(),
  },
  {
    id: "cnt-3",
    session_id: "inv-in-prog",
    material_id: "mat-3",
    material_name: "Desinfetante Hospitalar Canil",
    batch_id: "bat-3",
    lot_number: "LOT-2026-C",
    location_id: "loc-1",
    location_name: "Almoxarifado Central",
    stock_position_id: "pos-3",
    unit: "litro",
    expected_quantity: 5,
    counted_quantity: 0, // Explicitly counted zero!
    discrepancy: -5,
    discrepancy_reason: "Lote recolhido e descartado",
    counted_by_ra: "123",
    counted_by_name: "Sgt Silva",
    counted_at: new Date(),
  },
  {
    id: "cnt-4",
    session_id: "inv-in-prog",
    material_id: "mat-4",
    material_name: "Mordedor Tug K9",
    batch_id: "bat-4",
    lot_number: "LOT-2026-D",
    location_id: "loc-1",
    location_name: "Almoxarifado Central",
    stock_position_id: "pos-4",
    unit: "unidade",
    expected_quantity: 8,
    counted_quantity: null as unknown as number, // Pending
    discrepancy: null as unknown as number,
    counted_by_ra: null as unknown as string,
    counted_by_name: null as unknown as string,
    counted_at: null as unknown as Date,
  },
  {
    id: "cnt-5",
    session_id: "inv-in-prog",
    material_id: "mat-5",
    material_name: "Coleira de Treinamento",
    batch_id: "bat-5",
    lot_number: "LOT-2026-E",
    location_id: "loc-1",
    location_name: "Almoxarifado Central",
    stock_position_id: "pos-5",
    unit: "unidade",
    expected_quantity: 12,
    counted_quantity: null as unknown as number, // Pending
    discrepancy: null as unknown as number,
    counted_by_ra: null as unknown as string,
    counted_by_name: null as unknown as string,
    counted_at: null as unknown as Date,
  },
];

// Case 2: Complete count fixture (5 positions: 5 counted, 0 pending, 1 divergence)
const mockAllCountedList: InventoryItemCount[] = [
  {
    id: "cnt-1",
    session_id: "inv-all-counted",
    material_id: "mat-1",
    material_name: "Ração Operacional Super Premium",
    batch_id: "bat-1",
    lot_number: "LOT-2026-A",
    location_id: "loc-1",
    location_name: "Almoxarifado Central",
    stock_position_id: "pos-1",
    unit: "kg",
    expected_quantity: 20,
    counted_quantity: 20,
    discrepancy: 0,
    counted_by_ra: "123",
    counted_by_name: "Sgt Silva",
    counted_at: new Date(),
  },
  {
    id: "cnt-2",
    session_id: "inv-all-counted",
    material_id: "mat-2",
    material_name: "Shampoo Clorexidina",
    batch_id: "bat-2",
    lot_number: "LOT-2026-B",
    location_id: "loc-1",
    location_name: "Almoxarifado Central",
    stock_position_id: "pos-2",
    unit: "frasco",
    expected_quantity: 10,
    counted_quantity: 10,
    discrepancy: 0,
    counted_by_ra: "123",
    counted_by_name: "Sgt Silva",
    counted_at: new Date(),
  },
  {
    id: "cnt-3",
    session_id: "inv-all-counted",
    material_id: "mat-3",
    material_name: "Desinfetante Hospitalar Canil",
    batch_id: "bat-3",
    lot_number: "LOT-2026-C",
    location_id: "loc-1",
    location_name: "Almoxarifado Central",
    stock_position_id: "pos-3",
    unit: "litro",
    expected_quantity: 5,
    counted_quantity: 0,
    discrepancy: -5,
    discrepancy_reason: "Lote recolhido e descartado",
    counted_by_ra: "123",
    counted_by_name: "Sgt Silva",
    counted_at: new Date(),
  },
  {
    id: "cnt-4",
    session_id: "inv-all-counted",
    material_id: "mat-4",
    material_name: "Mordedor Tug K9",
    batch_id: "bat-4",
    lot_number: "LOT-2026-D",
    location_id: "loc-1",
    location_name: "Almoxarifado Central",
    stock_position_id: "pos-4",
    unit: "unidade",
    expected_quantity: 8,
    counted_quantity: 8,
    discrepancy: 0,
    counted_by_ra: "123",
    counted_by_name: "Sgt Silva",
    counted_at: new Date(),
  },
  {
    id: "cnt-5",
    session_id: "inv-all-counted",
    material_id: "mat-5",
    material_name: "Coleira de Treinamento",
    batch_id: "bat-5",
    lot_number: "LOT-2026-E",
    location_id: "loc-1",
    location_name: "Almoxarifado Central",
    stock_position_id: "pos-5",
    unit: "unidade",
    expected_quantity: 12,
    counted_quantity: 12,
    discrepancy: 0,
    counted_by_ra: "123",
    counted_by_name: "Sgt Silva",
    counted_at: new Date(),
  },
];

vi.mock("../hooks/use-warehouse-data", () => ({
  useWarehouseData: () => ({
    materials: [],
    batches: [],
    positions: [],
    equipment: [],
    custodies: [],
    locations: [],
    movements: [],
    sessions: mockSessionsList,
    status: "ready",
    error: null,
  }),
  useInventoryCounts: (sessionId: string) => {
    if (sessionId === "inv-all-counted") {
      return { counts: mockAllCountedList, status: "ready", error: null };
    }
    if (sessionId === "inv-cancelled") {
      return { counts: [], status: "ready", error: null };
    }
    return { counts: mockPendingCountsList, status: "ready", error: null };
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/warehouse/inventory",
}));

vi.mock("../data/warehouse-service", () => ({
  generateWarehouseIdempotencyKey: vi.fn((action: string) => `idem-${action}-123`),
  WarehouseService: {
    openInventorySession: vi.fn(),
    recordInventoryCount: vi.fn(),
    addUnexpectedCount: vi.fn(),
    startReconciliation: vi.fn(),
    homologateInventorySession: vi.fn(),
    cancelInventorySession: vi.fn(),
  },
}));

describe("Physical Inventory UI Components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ActiveInventoryBanner", () => {
    it("renders nothing when there is no active session", () => {
      const { container } = render(<ActiveInventoryBanner sessions={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it("renders alert banner when an in_progress session exists", () => {
      const sessions: InventorySession[] = [
        {
          id: "inv-1",
          title: "Inventário Geral Q4",
          scope_type: "full_warehouse",
          opened_by_ra: "123",
          opened_by_name: "Sgt Silva",
          opened_at: new Date("2026-10-06T10:00:00Z"),
          status: "in_progress",
        },
      ];

      render(<ActiveInventoryBanner sessions={sessions} />);
      expect(screen.getByTestId("active-inventory-banner")).toBeDefined();
      expect(screen.getByText("Inventário Geral Q4")).toBeDefined();
      expect(screen.getByText(/Em Andamento/i)).toBeDefined();
      expect(screen.getByText(/Sgt Silva/i)).toBeDefined();
    });

    it("renders alert banner when a reconciling session exists", () => {
      const sessions: InventorySession[] = [
        {
          id: "inv-2",
          title: "Contagem Canil Norte",
          scope_type: "by_location",
          scope_label: "Canil Norte",
          opened_by_ra: "456",
          opened_by_name: "Ten Costa",
          opened_at: new Date("2026-10-06T10:00:00Z"),
          status: "reconciling",
        },
      ];

      render(<ActiveInventoryBanner sessions={sessions} />);
      expect(screen.getByText("Reconciliando")).toBeDefined();
      expect(screen.getAllByText(/Canil Norte/i).length).toBeGreaterThan(0);
    });
  });

  describe("CountItemDialog", () => {
    const mockCount: InventoryItemCount = {
      id: "cnt-1",
      session_id: "inv-1",
      material_id: "mat-1",
      material_name: "Ração Filhotes",
      batch_id: "bat-1",
      lot_number: "LOT-2026-A",
      location_id: "loc-1",
      location_name: "Almoxarifado Central",
      stock_position_id: "pos-1",
      unit: "kg",
      expected_quantity: 25,
      counted_quantity: 0,
      discrepancy: 0,
      counted_by_ra: "123",
      counted_by_name: "Sgt Silva",
      counted_at: new Date(),
    };

    it("renders expected quantity and shortcut button for zero count", async () => {
      render(
        <CountItemDialog
          isOpen={true}
          count={mockCount}
          onClose={vi.fn()}
        />,
      );

      expect(screen.getByText("Ração Filhotes · Lote:")).toBeDefined();
      expect(screen.getByText("25 kg")).toBeDefined();

      const zeroBtn = screen.getByText("Contado Zero (0)");
      fireEvent.click(zeroBtn);

      const input = screen.getByPlaceholderText(/Digite o total apurado/i) as HTMLInputElement;
      expect(input.value).toBe("0");

      // Discrepancy is -25 -> shortage text appears
      expect(screen.getByText(/Falta apurada: -25 kg/i)).toBeDefined();
      // Discrepancy reason is required
      expect(screen.getByPlaceholderText(/Explique o motivo da diferença física/i)).toBeDefined();
    });

    it("calls WarehouseService.recordInventoryCount on submit with discrepancy reason", async () => {
      const onSuccess = vi.fn();
      const onClose = vi.fn();
      vi.mocked(WarehouseService.recordInventoryCount).mockResolvedValueOnce({ success: true, discrepancy: -5 });

      render(
        <CountItemDialog
          isOpen={true}
          count={mockCount}
          onClose={onClose}
          onSuccess={onSuccess}
        />,
      );

      const input = screen.getByPlaceholderText(/Digite o total apurado/i);
      fireEvent.change(input, { target: { value: "20" } });

      const reasonInput = screen.getByPlaceholderText(/Explique o motivo da diferença física/i);
      fireEvent.change(reasonInput, { target: { value: "Saco danificado com descarte pontual" } });

      const submitBtn = screen.getByText("Confirmar Contagem");
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(WarehouseService.recordInventoryCount).toHaveBeenCalledWith({
          session_id: "inv-1",
          count_id: "cnt-1",
          counted_quantity: 20,
          discrepancy_reason: "Saco danificado com descarte pontual",
        });
        expect(onClose).toHaveBeenCalled();
        expect(onSuccess).toHaveBeenCalled();
      });
    });
  });

  describe("OpenInventoryDialog", () => {
    it("validates title and submits open session", async () => {
      const onSuccess = vi.fn();
      const onClose = vi.fn();
      vi.mocked(WarehouseService.openInventorySession).mockResolvedValueOnce({
        session_id: "inv-created-99",
        total_items: 5,
      });

      render(
        <OpenInventoryDialog
          isOpen={true}
          onClose={onClose}
          onSuccess={onSuccess}
          locations={[{ id: "loc-1", name: "Depósito A", type: "warehouse", active: true }]}
          categories={[]}
        />,
      );

      const titleInput = screen.getByPlaceholderText(/Ex: Inventário Geral Q4/i);
      fireEvent.change(titleInput, { target: { value: "Inventário Geral Outubro" } });

      const submitBtn = screen.getByText("Iniciar Sessão");
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(WarehouseService.openInventorySession).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Inventário Geral Outubro",
            scope_type: "full_warehouse",
          }),
        );
        expect(onSuccess).toHaveBeenCalledWith("inv-created-99");
      });
    });
  });

  describe("UnexpectedItemDialog", () => {
    it("submits unexpected count with reason", async () => {
      const onSuccess = vi.fn();
      const onClose = vi.fn();
      vi.mocked(WarehouseService.addUnexpectedCount).mockResolvedValueOnce({ count_id: "cnt-unexp-7" });

      const materials = [
        {
          id: "mat-1",
          name: "Vacina Raiva",
          category_id: "cat-vet",
          category_name: "Medicamentos",
          unit: "dose",
          current_quantity: 10,
          minimum_quantity: 5,
          active: true,
        },
      ];
      const batches = [
        {
          id: "bat-1",
          material_id: "mat-1",
          material_name: "Vacina Raiva",
          lot_number: "VAC-99",
          initial_quantity: 10,
          current_quantity: 10,
          expiration_date: "2027-01-01",
          received_at: new Date(),
          status: "active" as const,
        },
      ];
      const locations = [
        { id: "loc-1", name: "Geladeira Veterinária", type: "room" as const, active: true },
      ];

      render(
        <UnexpectedItemDialog
          isOpen={true}
          onClose={onClose}
          onSuccess={onSuccess}
          sessionId="inv-1"
          materials={materials}
          batches={batches}
          locations={locations}
        />,
      );

      const matSelect = screen.getByLabelText(/Material/i);
      fireEvent.change(matSelect, { target: { value: "mat-1" } });

      const batchSelect = screen.getByLabelText(/Lote Encontrado/i);
      fireEvent.change(batchSelect, { target: { value: "bat-1" } });

      const locSelect = screen.getByLabelText(/Local Físico Encontrado/i);
      fireEvent.change(locSelect, { target: { value: "loc-1" } });

      const qtyInput = screen.getByPlaceholderText("Ex: 5");
      fireEvent.change(qtyInput, { target: { value: "3" } });

      const reasonInput = screen.getByPlaceholderText(/Explique a origem provável/i);
      fireEvent.change(reasonInput, { target: { value: "Frascos encontrados na gaveta 2" } });

      const submitBtn = screen.getByText("Adicionar Item");
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(WarehouseService.addUnexpectedCount).toHaveBeenCalledWith({
          session_id: "inv-1",
          material_id: "mat-1",
          batch_id: "bat-1",
          location_id: "loc-1",
          counted_quantity: 3,
          discrepancy_reason: "Frascos encontrados na gaveta 2",
        });
        expect(onSuccess).toHaveBeenCalled();
      });
    });
  });

  describe("HomologateConfirmDialog", () => {
    it("submits homologation with idempotency key", async () => {
      const onSuccess = vi.fn();
      const onClose = vi.fn();
      vi.mocked(WarehouseService.homologateInventorySession).mockResolvedValueOnce({
        session_id: "inv-1",
        adjustments_applied: 2,
      });

      const session: InventorySession = {
        id: "inv-1",
        title: "Inventário Geral",
        scope_type: "full_warehouse",
        opened_by_ra: "123",
        opened_by_name: "Sgt Silva",
        opened_at: new Date(),
        status: "reconciling",
      };

      render(
        <HomologateConfirmDialog
          isOpen={true}
          onClose={onClose}
          onSuccess={onSuccess}
          session={session}
        />,
      );

      const submitBtn = screen.getByText("Confirmar e Homologar");
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(WarehouseService.homologateInventorySession).toHaveBeenCalledWith(
          expect.objectContaining({
            session_id: "inv-1",
          }),
        );
        expect(onSuccess).toHaveBeenCalled();
      });
    });
  });

  describe("CancelInventoryDialog", () => {
    it("requires reason to cancel session", async () => {
      const onSuccess = vi.fn();
      const onClose = vi.fn();
      vi.mocked(WarehouseService.cancelInventorySession).mockResolvedValueOnce({
        success: true,
      });

      const session: InventorySession = {
        id: "inv-1",
        title: "Inventário Geral",
        scope_type: "full_warehouse",
        opened_by_ra: "123",
        opened_by_name: "Sgt Silva",
        opened_at: new Date(),
        status: "in_progress",
      };

      render(
        <CancelInventoryDialog
          isOpen={true}
          onClose={onClose}
          onSuccess={onSuccess}
          session={session}
        />,
      );

      const reasonInput = screen.getByPlaceholderText(/Explique o motivo do cancelamento/i);
      fireEvent.change(reasonInput, { target: { value: "Erro de escopo operacional" } });

      const submitBtn = screen.getByText("Confirmar Cancelamento");
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(WarehouseService.cancelInventorySession).toHaveBeenCalledWith({
          session_id: "inv-1",
          reason: "Erro de escopo operacional",
        });
        expect(onSuccess).toHaveBeenCalled();
      });
    });
  });

  describe("InventoryDetailView", () => {
    it("Finding A: does NOT display 'Encerrado por' on in_progress session even if closed_at/closed_by_name exist", () => {
      render(<InventoryDetailView sessionId="inv-in-prog" />);

      expect(screen.getByText("Em Andamento")).toBeInTheDocument();
      expect(screen.queryByText(/Encerrado por/i)).toBeNull();
      expect(screen.queryByText(/Capitão Santos/i)).toBeNull();
    });

    it("Finding A: DOES display 'Encerrado por' on terminal cancelled session", () => {
      render(<InventoryDetailView sessionId="inv-cancelled" />);

      expect(screen.getByText("Cancelado")).toBeInTheDocument();
      expect(screen.getByText(/Encerrado por:/i)).toBeInTheDocument();
      expect(screen.getByText(/Tenente Lima/i)).toBeInTheDocument();
    });

    it("Finding B - Case 1: Partial count (5 positions: 3 counted, 2 pending, 1 divergence) derives consistent KPI cards, filter buttons, and disables reconciliation", () => {
      render(<InventoryDetailView sessionId="inv-in-prog" />);

      // Progress metrics
      expect(screen.getByText("Total de Posições").nextElementSibling).toHaveTextContent("5");
      expect(screen.getByText("Contadas").nextElementSibling).toHaveTextContent("3 / 5");
      expect(screen.getByText("Pendentes").nextElementSibling).toHaveTextContent("2");
      expect(screen.getByText("Com Divergência").nextElementSibling).toHaveTextContent("1");

      // Filter tabs in sync
      expect(screen.getByRole("button", { name: "Todas (5)" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Pendentes (2)" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Divergências (1)" })).toBeInTheDocument();

      // Reconciliation disabled with contextual explanation
      const advanceBtn = screen.getByRole("button", { name: /Avançar para Reconciliação/i });
      expect(advanceBtn).toBeDisabled();
      expect(screen.getByText(/Conclua as 2 posições pendentes para avançar/i)).toBeInTheDocument();
    });

    it("Finding B - Case 2: Complete count (5 positions: 5 counted, 0 pending, 1 divergence) enables reconciliation and derives consistent filters", () => {
      render(<InventoryDetailView sessionId="inv-all-counted" />);

      // Progress metrics
      expect(screen.getByText("Total de Posições").nextElementSibling).toHaveTextContent("5");
      expect(screen.getByText("Contadas").nextElementSibling).toHaveTextContent("5 / 5");
      expect(screen.getByText("Pendentes").nextElementSibling).toHaveTextContent("0");
      expect(screen.getByText("Com Divergência").nextElementSibling).toHaveTextContent("1");

      // Filter tabs in sync
      expect(screen.getByRole("button", { name: "Todas (5)" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Pendentes (0)" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Divergências (1)" })).toBeInTheDocument();

      // Reconciliation enabled, no pending notice
      const advanceBtn = screen.getByRole("button", { name: /Avançar para Reconciliação/i });
      expect(advanceBtn).not.toBeDisabled();
      expect(screen.queryByText(/posições pendentes para avançar/i)).toBeNull();
    });

    it("Finding B - Case 3: explicitly distinguishes counted zero from uncounted (pending)", () => {
      render(<InventoryDetailView sessionId="inv-in-prog" />);

      // Counted zero has distinct badge "Contado: 0 (Zero)"
      expect(screen.getByText(/Contado: 0 \(Zero\)/i)).toBeInTheDocument();

      // Pending items have distinct badge "Não Contado"
      const pendingBadges = screen.getAllByText(/Não Contado/i);
      expect(pendingBadges.length).toBe(2);
    });

    it("Finding B - Case 4: renders terminal state notice and read-only counts without count buttons for cancelled session", () => {
      render(<InventoryDetailView sessionId="inv-cancelled" />);

      expect(screen.getByText("Sessão de Inventário Cancelada")).toBeInTheDocument();
      expect(screen.getByText(/Motivo registrado: Cancelado por divergência de lote/i)).toBeInTheDocument();

      // No operational CTAs
      expect(screen.queryByRole("button", { name: "Contar" })).toBeNull();
      expect(screen.queryByRole("button", { name: /Avançar para Reconciliação/i })).toBeNull();
    });
  });
});
