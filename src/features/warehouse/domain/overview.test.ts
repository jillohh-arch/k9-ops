import { describe, expect, it } from "vitest";
import { deriveWarehouseOverview, WarehouseOverviewSourceData } from "./overview";
import { createFixedBusinessClock } from "./business-clock";
import {
  ConsumableMaterial,
  Equipment,
  EquipmentCustody,
  InventorySession,
  StockBatch,
  StockMovement,
} from "./contracts";

const fixedInstant = new Date("2026-10-06T12:00:00-03:00");
const fixedClock = createFixedBusinessClock(fixedInstant);

function createEmptySourceData(): WarehouseOverviewSourceData {
  return {
    materials: [],
    batches: [],
    equipment: [],
    custodies: [],
    movements: [],
    sessions: [],
  };
}

describe("deriveWarehouseOverview", () => {
  it("derives healthy empty state with calm operational indicators", () => {
    const data = createEmptySourceData();
    const overview = deriveWarehouseOverview(data, { clock: fixedClock, now: fixedInstant });

    expect(overview.overall_status).toBe("normal");
    expect(overview.alerts).toHaveLength(0);
    expect(overview.materials.active_materials).toBe(0);
    expect(overview.materials.out_of_stock).toBe(0);
    expect(overview.materials.low_stock).toBe(0);
    expect(overview.equipment.total_active).toBe(0);
    expect(overview.custody.active).toBe(0);
    expect(overview.custody.overdue).toBe(0);
    expect(overview.inventory.active_session).toBeNull();
    expect(overview.inventory.attention_required).toBe(false);
  });

  describe("Materials & Batches Alerts", () => {
    it("flags out_of_stock as critical when available is 0, even if on-hand > 0 due to blocked/expired batches", () => {
      const material: ConsumableMaterial = {
        id: "mat-1",
        name: "Ração Filhotes",
        category_id: "nutricao",
        category_name: "Nutrição",
        unit: "kg",
        current_quantity: 10, // ON-HAND 10 kg
        minimum_quantity: 5,
        active: true,
      };
      // All batches are blocked or expired -> AVAILABLE is 0!
      const batch: StockBatch = {
        id: "b-1",
        material_id: "mat-1",
        material_name: "Ração Filhotes",
        lot_number: "LOT-EXP",
        initial_quantity: 10,
        current_quantity: 10,
        expiration_date: "2026-09-01", // Expired
        received_at: new Date("2026-08-01"),
        status: "active",
      };

      const data: WarehouseOverviewSourceData = {
        ...createEmptySourceData(),
        materials: [material],
        batches: [batch],
      };

      const overview = deriveWarehouseOverview(data, { clock: fixedClock, now: fixedInstant });

      expect(overview.materials.out_of_stock).toBe(1);
      expect(overview.materials.low_stock).toBe(0);
      expect(overview.materials.expired_batches_with_stock).toBe(1);
      expect(overview.overall_status).toBe("attention");

      const outOfStockAlert = overview.alerts.find((a) => a.kind === "out_of_stock");
      expect(outOfStockAlert).toBeDefined();
      expect(outOfStockAlert?.severity).toBe("critical");
      expect(outOfStockAlert?.title).toContain("Ração Filhotes");

      const expiredBatchAlert = overview.alerts.find((a) => a.kind === "expired_batch_with_on_hand");
      expect(expiredBatchAlert).toBeDefined();
      expect(expiredBatchAlert?.severity).toBe("critical");
    });

    it("flags low_stock as warning when available is positive but <= minimum_quantity", () => {
      const material: ConsumableMaterial = {
        id: "mat-2",
        name: "Shampoo Canino",
        category_id: "higiene",
        category_name: "Higiene",
        unit: "frasco",
        current_quantity: 3,
        minimum_quantity: 5,
        active: true,
      };
      const batch: StockBatch = {
        id: "b-2",
        material_id: "mat-2",
        material_name: "Shampoo Canino",
        lot_number: "LOT-VALID",
        initial_quantity: 5,
        current_quantity: 3,
        expiration_date: "2027-12-31", // Valid
        received_at: new Date("2026-01-01"),
        status: "active",
      };

      const data: WarehouseOverviewSourceData = {
        ...createEmptySourceData(),
        materials: [material],
        batches: [batch],
      };

      const overview = deriveWarehouseOverview(data, { clock: fixedClock, now: fixedInstant });

      expect(overview.materials.low_stock).toBe(1);
      expect(overview.materials.out_of_stock).toBe(0);
      expect(overview.overall_status).toBe("warning");

      const lowAlert = overview.alerts.find((a) => a.kind === "low_stock");
      expect(lowAlert).toBeDefined();
      expect(lowAlert?.severity).toBe("warning");
    });

    it("out_of_stock takes precedence over low_stock (no noisy duplicate alerts for same material)", () => {
      const material: ConsumableMaterial = {
        id: "mat-3",
        name: "Vermífugo",
        category_id: "saude",
        category_name: "Saúde",
        unit: "dose",
        current_quantity: 0,
        minimum_quantity: 10,
        active: true,
      };

      const data: WarehouseOverviewSourceData = {
        ...createEmptySourceData(),
        materials: [material],
      };

      const overview = deriveWarehouseOverview(data, { clock: fixedClock, now: fixedInstant });
      expect(overview.materials.out_of_stock).toBe(1);
      expect(overview.materials.low_stock).toBe(0);

      const materialAlerts = overview.alerts.filter((a) => a.entity_id === "mat-3");
      expect(materialAlerts).toHaveLength(1);
      expect(materialAlerts[0].kind).toBe("out_of_stock");
    });

    it("depleted expired batch (current_quantity = 0) does NOT generate an expired alert", () => {
      const batch: StockBatch = {
        id: "b-depleted",
        material_id: "mat-x",
        material_name: "Material X",
        lot_number: "LOT-ZERO",
        initial_quantity: 10,
        current_quantity: 0, // Depleted!
        expiration_date: "2026-08-01", // Expired
        received_at: new Date("2026-01-01"),
        status: "depleted",
      };

      const data: WarehouseOverviewSourceData = {
        ...createEmptySourceData(),
        batches: [batch],
      };

      const overview = deriveWarehouseOverview(data, { clock: fixedClock, now: fixedInstant });
      expect(overview.materials.expired_batches_with_stock).toBe(0);
      expect(overview.alerts.filter((a) => a.kind === "expired_batch_with_on_hand")).toHaveLength(0);
    });

    it("flags expiring_soon batch as warning when expiration is within warning threshold (<= 30 days)", () => {
      // today is 2026-10-06. 2026-10-25 is in 19 days -> expiring_soon!
      const batch: StockBatch = {
        id: "b-soon",
        material_id: "mat-y",
        material_name: "Ração Especial",
        lot_number: "LOT-SOON",
        initial_quantity: 20,
        current_quantity: 15,
        expiration_date: "2026-10-25",
        received_at: new Date("2026-01-01"),
        status: "active",
      };

      const data: WarehouseOverviewSourceData = {
        ...createEmptySourceData(),
        batches: [batch],
      };

      const overview = deriveWarehouseOverview(data, { clock: fixedClock, now: fixedInstant });
      expect(overview.materials.expiring_soon_batches_with_stock).toBe(1);
      const soonAlert = overview.alerts.find((a) => a.kind === "expiring_soon");
      expect(soonAlert).toBeDefined();
      expect(soonAlert?.severity).toBe("warning");
    });
  });

  describe("Equipment & Custody Alerts", () => {
    it("surfaces damaged and maintenance equipment as warnings, and strictly excludes retired equipment", () => {
      const eqAvailable: Equipment = {
        id: "eq-1", name: "Guia K9", category_id: "c-1", category_name: "Equipamentos",
        identifier_code: "PAT-001", condition: "good", status: "available",
        current_location_id: "loc-1", current_location_name: "Central", active: true,
      };
      const eqDamaged: Equipment = {
        id: "eq-2", name: "Colete Tático", category_id: "c-1", category_name: "Equipamentos",
        identifier_code: "PAT-002", condition: "damaged", status: "damaged",
        current_location_id: "loc-1", current_location_name: "Central", active: true,
      };
      const eqMaint: Equipment = {
        id: "eq-3", name: "Focinheira", category_id: "c-1", category_name: "Equipamentos",
        identifier_code: "PAT-003", condition: "fair", status: "maintenance",
        current_location_id: "loc-1", current_location_name: "Central", active: true,
      };
      const eqRetired: Equipment = {
        id: "eq-4", name: "Caixa de Transporte Antiga", category_id: "c-1", category_name: "Equipamentos",
        identifier_code: "PAT-004", condition: "damaged", status: "retired",
        current_location_id: "loc-1", current_location_name: "Central", active: false,
      };

      const data: WarehouseOverviewSourceData = {
        ...createEmptySourceData(),
        equipment: [eqAvailable, eqDamaged, eqMaint, eqRetired],
      };

      const overview = deriveWarehouseOverview(data, { clock: fixedClock, now: fixedInstant });

      // Retired is strictly excluded from total_active
      expect(overview.equipment.total_active).toBe(3);
      expect(overview.equipment.available).toBe(1);
      expect(overview.equipment.damaged).toBe(1);
      expect(overview.equipment.maintenance).toBe(1);

      expect(overview.alerts.find((a) => a.kind === "damaged_equipment")).toBeDefined();
      expect(overview.alerts.find((a) => a.kind === "maintenance_equipment")).toBeDefined();
      expect(overview.alerts.find((a) => a.entity_id === "eq-4")).toBeUndefined(); // Retired does NOT alert
    });

    it("flags active overdue custody as critical, but does NOT alert for historical returned custodies", () => {
      const activeOverdueCustody: EquipmentCustody = {
        id: "cust-1", equipment_id: "eq-1", equipment_name: "Colete", equipment_code: "PAT-001",
        borrower_ra: "12345", borrower_name: "GCM Silva", dispatched_by_ra: "999",
        dispatched_by_name: "Admin", dispatched_at: new Date("2026-10-01"),
        condition_at_dispatch: "good", purpose: "daily_duty", status: "active",
        expected_return_at: new Date("2026-10-05T18:00:00-03:00"), // Yesterday!
      };
      const returnedHistoricalCustody: EquipmentCustody = {
        id: "cust-2", equipment_id: "eq-2", equipment_name: "Guia", equipment_code: "PAT-002",
        borrower_ra: "67890", borrower_name: "GCM Santos", dispatched_by_ra: "999",
        dispatched_by_name: "Admin", dispatched_at: new Date("2026-09-01"),
        condition_at_dispatch: "good", purpose: "daily_duty", status: "returned",
        expected_return_at: new Date("2026-09-05T18:00:00-03:00"),
        returned_at: new Date("2026-09-06T10:00:00-03:00"),
      };

      const data: WarehouseOverviewSourceData = {
        ...createEmptySourceData(),
        custodies: [activeOverdueCustody, returnedHistoricalCustody],
      };

      const overview = deriveWarehouseOverview(data, { clock: fixedClock, now: fixedInstant });

      expect(overview.custody.active).toBe(1);
      expect(overview.custody.overdue).toBe(1);
      expect(overview.overall_status).toBe("attention");

      const overdueAlert = overview.alerts.find((a) => a.kind === "overdue_custody");
      expect(overdueAlert).toBeDefined();
      expect(overdueAlert?.severity).toBe("critical");
      expect(overdueAlert?.entity_id).toBe("cust-1");

      expect(overview.alerts.find((a) => a.entity_id === "cust-2")).toBeUndefined();
    });
  });

  describe("Physical Inventory Alerts", () => {
    it("flags inventory_snapshot_failed as critical and sets attention_required = true", () => {
      const failedSession = {
        id: "inv-1",
        title: "Inventário Geral 2026",
        scope_type: "full_warehouse",
        status: "in_progress",
        snapshot_status: "failed",
        opened_by_ra: "999",
        opened_by_name: "Auditor",
        opened_at: new Date("2026-10-06T08:00:00-03:00"),
        total_items: 0,
      };

      const data: WarehouseOverviewSourceData = {
        ...createEmptySourceData(),
        sessions: [failedSession as unknown as InventorySession],
      };

      const overview = deriveWarehouseOverview(data, { clock: fixedClock, now: fixedInstant });

      expect(overview.inventory.active_session).not.toBeNull();
      expect(overview.inventory.attention_required).toBe(true);
      expect(overview.overall_status).toBe("attention");

      const failedAlert = overview.alerts.find((a) => a.kind === "inventory_snapshot_failed");
      expect(failedAlert).toBeDefined();
      expect(failedAlert?.severity).toBe("critical");
    });

    it("surfaces normal active inventory as info alert and does NOT trigger warning/attention", () => {
      const activeSession = {
        id: "inv-2",
        title: "Inventário Setor A",
        scope_type: "by_location",
        status: "in_progress",
        snapshot_status: "complete",
        opened_by_ra: "999",
        opened_by_name: "Auditor",
        opened_at: new Date("2026-10-06T08:00:00-03:00"),
        total_items: 20,
        counted_items: 10,
      };

      const data: WarehouseOverviewSourceData = {
        ...createEmptySourceData(),
        sessions: [activeSession as unknown as InventorySession],
      };

      const overview = deriveWarehouseOverview(data, { clock: fixedClock, now: fixedInstant });

      expect(overview.inventory.active_session).not.toBeNull();
      expect(overview.inventory.attention_required).toBe(false);
      expect(overview.overall_status).toBe("normal"); // Only info alerts exist!

      const activeAlert = overview.alerts.find((a) => a.kind === "active_inventory");
      expect(activeAlert).toBeDefined();
      expect(activeAlert?.severity).toBe("info");
    });

    it("ignores completed homologated or cancelled sessions", () => {
      const homologatedSession = {
        id: "inv-3",
        title: "Inventário Passado",
        scope_type: "full_warehouse",
        status: "homologated",
        opened_by_ra: "999",
        opened_by_name: "Auditor",
      };

      const data: WarehouseOverviewSourceData = {
        ...createEmptySourceData(),
        sessions: [homologatedSession as unknown as InventorySession],
      };

      const overview = deriveWarehouseOverview(data, { clock: fixedClock, now: fixedInstant });
      expect(overview.inventory.active_session).toBeNull();
      expect(overview.alerts.filter((a) => a.entity_type === "inventory_session")).toHaveLength(0);
    });
  });

  describe("Alert Ordering & Bounding", () => {
    it("orders alerts strictly by severity: critical first, then warning, then info", () => {
      const materialOOS: ConsumableMaterial = {
        id: "mat-oos", name: "Ração OOS", category_id: "c1", category_name: "N", unit: "kg",
        current_quantity: 0, minimum_quantity: 10, active: true,
      };
      const materialLow: ConsumableMaterial = {
        id: "mat-low", name: "Ração Baixa", category_id: "c1", category_name: "N", unit: "kg",
        current_quantity: 3, minimum_quantity: 10, active: true,
      };
      const batchLow: StockBatch = {
        id: "b-low", material_id: "mat-low", material_name: "Ração Baixa", lot_number: "L1",
        initial_quantity: 3, current_quantity: 3, expiration_date: "2029-01-01",
        received_at: new Date(), status: "active",
      };
      const activeSession = {
        id: "inv-active", title: "Inventário Ativo", scope_type: "full_warehouse",
        status: "in_progress", snapshot_status: "complete", opened_by_name: "Auditor",
      };

      const data: WarehouseOverviewSourceData = {
        ...createEmptySourceData(),
        materials: [materialOOS, materialLow],
        batches: [batchLow],
        sessions: [activeSession as unknown as InventorySession],
      };

      const overview = deriveWarehouseOverview(data, { clock: fixedClock, now: fixedInstant });
      expect(overview.alerts).toHaveLength(3);
      expect(overview.alerts[0].severity).toBe("critical");
      expect(overview.alerts[1].severity).toBe("warning");
      expect(overview.alerts[2].severity).toBe("info");
    });
  });

  describe("Recent Movements Bounding", () => {
    it("bounds recent movements to 10 latest sorted by performed_at descending", () => {
      const movements: StockMovement[] = [];
      for (let i = 1; i <= 15; i++) {
        movements.push({
          id: `mov-${i}`,
          material_id: "mat-1",
          material_name: "Ração",
          batch_id: "b-1",
          lot_number: "L1",
          type: "entry",
          quantity: i,
          delta: i,
          unit: "kg",
          reason: `Movimento ${i}`,
          balance_before: 0,
          balance_after: i,
          performed_by_ra: "123",
          performed_by_name: "Operador",
          performed_by_uid: "uid-123",
          performed_at: new Date(`2026-10-0${Math.min(i, 9)}T10:00:00-03:00`),
        });
      }

      const data: WarehouseOverviewSourceData = {
        ...createEmptySourceData(),
        movements,
      };

      const overview = deriveWarehouseOverview(data, { clock: fixedClock, now: fixedInstant });
      expect(overview.recent_movements).toHaveLength(10);
    });
  });

  describe("Integration Fixture", () => {
    it("correctly derives all metrics and alerts for the representative integration scenario", () => {
      // Material A -> out of stock
      const matA: ConsumableMaterial = {
        id: "mat-a", name: "Material A", category_id: "c1", category_name: "Geral", unit: "un",
        current_quantity: 0, minimum_quantity: 5, active: true,
      };
      // Material B -> low stock (available 2 <= min 5)
      const matB: ConsumableMaterial = {
        id: "mat-b", name: "Material B", category_id: "c1", category_name: "Geral", unit: "un",
        current_quantity: 2, minimum_quantity: 5, active: true,
      };
      const batchB: StockBatch = {
        id: "b-b", material_id: "mat-b", material_name: "Material B", lot_number: "LOT-B",
        initial_quantity: 2, current_quantity: 2, expiration_date: "2028-01-01",
        received_at: new Date(), status: "active",
      };
      // Batch C -> expired with ON-HAND (qty 4, expired 2026-09-01)
      const batchC: StockBatch = {
        id: "b-c", material_id: "mat-c", material_name: "Material C", lot_number: "LOT-C",
        initial_quantity: 4, current_quantity: 4, expiration_date: "2026-09-01",
        received_at: new Date(), status: "active",
      };
      // Batch D -> expiring soon (qty 10, expires in 14 days)
      const batchD: StockBatch = {
        id: "b-d", material_id: "mat-d", material_name: "Material D", lot_number: "LOT-D",
        initial_quantity: 10, current_quantity: 10, expiration_date: "2026-10-20",
        received_at: new Date(), status: "active",
      };
      // Equipment E -> damaged
      const eqE: Equipment = {
        id: "eq-e", name: "Equipamento E", category_id: "cat-eq", category_name: "Eq",
        identifier_code: "PAT-E", condition: "damaged", status: "damaged",
        current_location_id: "loc-1", current_location_name: "Base", active: true,
      };
      // Equipment F -> maintenance
      const eqF: Equipment = {
        id: "eq-f", name: "Equipamento F", category_id: "cat-eq", category_name: "Eq",
        identifier_code: "PAT-F", condition: "fair", status: "maintenance",
        current_location_id: "loc-1", current_location_name: "Base", active: true,
      };
      // Custody G -> overdue
      const custG: EquipmentCustody = {
        id: "cust-g", equipment_id: "eq-g", equipment_name: "Equip G", equipment_code: "PAT-G",
        borrower_ra: "111", borrower_name: "Condutor G", dispatched_by_ra: "999",
        dispatched_by_name: "Admin", dispatched_at: new Date("2026-10-01"),
        condition_at_dispatch: "good", purpose: "daily_duty", status: "active",
        expected_return_at: new Date("2026-10-05T12:00:00-03:00"),
      };
      // Inventory H -> in_progress / complete
      const invH = {
        id: "inv-h", title: "Inventário H", scope_type: "full_warehouse",
        status: "in_progress", snapshot_status: "complete", opened_by_name: "Auditor H",
        opened_at: new Date("2026-10-06T07:00:00-03:00"), total_items: 50, counted_items: 20,
      };

      const data: WarehouseOverviewSourceData = {
        materials: [matA, matB],
        batches: [batchB, batchC, batchD],
        equipment: [eqE, eqF],
        custodies: [custG],
        movements: [],
        sessions: [invH as unknown as InventorySession],
      };

      const overview = deriveWarehouseOverview(data, { clock: fixedClock, now: fixedInstant });

      expect(overview.overall_status).toBe("attention");
      expect(overview.materials.out_of_stock).toBe(1); // Material A
      expect(overview.materials.low_stock).toBe(1); // Material B
      expect(overview.materials.expired_batches_with_stock).toBe(1); // Batch C
      expect(overview.materials.expiring_soon_batches_with_stock).toBe(1); // Batch D

      expect(overview.equipment.total_active).toBe(2);
      expect(overview.equipment.damaged).toBe(1); // Equipment E
      expect(overview.equipment.maintenance).toBe(1); // Equipment F

      expect(overview.custody.active).toBe(1);
      expect(overview.custody.overdue).toBe(1); // Custody G

      expect(overview.inventory.active_session).not.toBeNull();
      expect(overview.inventory.active_session?.title).toBe("Inventário H");
      expect(overview.inventory.attention_required).toBe(false);

      // Verify all alerts are surfaced
      const kinds = overview.alerts.map((a) => a.kind);
      expect(kinds).toContain("out_of_stock");
      expect(kinds).toContain("low_stock");
      expect(kinds).toContain("expired_batch_with_on_hand");
      expect(kinds).toContain("expiring_soon");
      expect(kinds).toContain("damaged_equipment");
      expect(kinds).toContain("maintenance_equipment");
      expect(kinds).toContain("overdue_custody");
      expect(kinds).toContain("active_inventory");
    });
  });
});
