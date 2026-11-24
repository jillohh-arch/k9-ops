import { describe, expect, it, vi } from "vitest";
import {
  generateWarehouseIdempotencyKey,
  translateWarehouseError,
  WarehouseService,
} from "./warehouse-service";

const mocks = vi.hoisted(() => ({
  callableFn: vi.fn(),
  httpsCallable: vi.fn(),
}));

vi.mock("@/lib/firebase/client", () => ({
  functions: {},
  db: {},
}));

vi.mock("firebase/functions", () => ({
  httpsCallable: (functions: unknown, name: string) => {
    return (data: unknown) => mocks.callableFn(name, data);
  },
}));

describe("WarehouseService & Error Translation", () => {
  it("translates canonical inventory locked error into user-friendly message", () => {
    const error = { code: "failed-precondition", message: "warehouse/inventory-scope-locked: Location under active count" };
    const translated = translateWarehouseError(error);
    expect(translated).toContain("bloqueado temporariamente para conferência de inventário ativa");
  });

  it("translates active on-hand archive error into helpful message", () => {
    const error = { code: "failed-precondition", message: "Cannot archive material with active on-hand" };
    const translated = translateWarehouseError(error);
    expect(translated).toContain("Não é possível arquivar um material que ainda possui saldo físico");
  });

  it("translates origin == destination transfer error", () => {
    const error = { code: "invalid-argument", message: "destination location matches origin" };
    const translated = translateWarehouseError(error);
    expect(translated).toContain("O local de destino não pode ser idêntico ao local de origem");
  });

  it("generates stable unique idempotency keys", () => {
    const key1 = generateWarehouseIdempotencyKey("entry", "mat-1");
    const key2 = generateWarehouseIdempotencyKey("entry", "mat-1");
    expect(key1).toContain("entry-mat-1");
    expect(key1).not.toBe(key2);
  });

  it("invokes httpsCallable with correct function name and payload", async () => {
    mocks.callableFn.mockResolvedValueOnce({ data: { id: "mat-created" } });

    const result = await WarehouseService.upsertMaterial({
      name: "Ração Filhotes",
      category_id: "cat-1",
      category_name: "Alimentos",
      unit: "kg",
      minimum_quantity: 20,
    });

    expect(mocks.callableFn).toHaveBeenCalledWith("adminWarehouseUpsertMaterial", expect.objectContaining({
      name: "Ração Filhotes",
      minimum_quantity: 20,
    }));
    expect(result.id).toBe("mat-created");
  });

  it("translates equipment and custody domain errors into user-friendly messages", () => {
    expect(
      translateWarehouseError({
        code: "failed-precondition",
        message: "Equipment is not available for custody",
      }),
    ).toBe("Equipamento não está disponível para cautela.");

    expect(
      translateWarehouseError({
        code: "already-exists",
        message: "Equipment identifier already exists",
      }),
    ).toBe("Já existe um equipamento com este identificador.");

    expect(
      translateWarehouseError({
        code: "failed-precondition",
        message: "Cannot retire equipment in custody",
      }),
    ).toBe("Não é permitido aposentar equipamento em cautela.");
  });

  it("invokes equipment and custody callable functions correctly", async () => {
    // upsertEquipment
    mocks.callableFn.mockResolvedValueOnce({ data: { id: "eq-1" } });
    const eqResult = await WarehouseService.upsertEquipment({
      name: "Coleira de Adestramento",
      category_id: "cat-eq",
      identifier_code: "EQ-001",
      condition: "new",
      current_location_id: "loc-1",
    });
    expect(mocks.callableFn).toHaveBeenCalledWith(
      "adminWarehouseUpsertEquipment",
      expect.objectContaining({
        name: "Coleira de Adestramento",
        identifier_code: "EQ-001",
        condition: "new",
      }),
    );
    expect(eqResult.id).toBe("eq-1");

    // updateEquipmentStatus
    mocks.callableFn.mockResolvedValueOnce({ data: { success: true } });
    const statusResult = await WarehouseService.updateEquipmentStatus({
      equipment_id: "eq-1",
      target_status: "maintenance",
      condition: "damaged",
      notes: "Costura rasgada",
    });
    expect(mocks.callableFn).toHaveBeenCalledWith(
      "adminWarehouseUpdateEquipmentStatus",
      expect.objectContaining({
        equipment_id: "eq-1",
        target_status: "maintenance",
      }),
    );
    expect(statusResult.success).toBe(true);

    // retireEquipment
    mocks.callableFn.mockResolvedValueOnce({ data: { success: true } });
    const retireResult = await WarehouseService.retireEquipment({
      equipment_id: "eq-1",
      reason: "Item desgastado sem conserto",
    });
    expect(mocks.callableFn).toHaveBeenCalledWith(
      "adminWarehouseRetireEquipment",
      expect.objectContaining({
        equipment_id: "eq-1",
        reason: "Item desgastado sem conserto",
      }),
    );
    expect(retireResult.success).toBe(true);

    // openCustody
    mocks.callableFn.mockResolvedValueOnce({ data: { custody_id: "cust-1" } });
    const openResult = await WarehouseService.openCustody({
      equipment_id: "eq-1",
      borrower_ra: "12345",
      borrower_name: "Sd Silva",
      purpose: "daily_duty",
      idempotency_key: "idem-open-1",
    });
    expect(mocks.callableFn).toHaveBeenCalledWith(
      "adminWarehouseOpenCustody",
      expect.objectContaining({
        equipment_id: "eq-1",
        borrower_ra: "12345",
        idempotency_key: "idem-open-1",
      }),
    );
    expect(openResult.custody_id).toBe("cust-1");

    // returnCustody
    mocks.callableFn.mockResolvedValueOnce({
      data: { custody_id: "cust-1", equipment_id: "eq-1", equipment_status: "maintenance" },
    });
    const returnResult = await WarehouseService.returnCustody({
      custody_id: "cust-1",
      condition_at_return: "good",
      target_equipment_status: "maintenance",
      return_location_id: "loc-2",
      return_location_name: "Viatura VTR-09",
      return_notes: "Vistoria preventiva",
      idempotency_key: "idem-return-1",
    });
    expect(mocks.callableFn).toHaveBeenCalledWith(
      "adminWarehouseReturnCustody",
      {
        custody_id: "cust-1",
        condition_at_return: "good",
        target_equipment_status: "maintenance",
        return_location_id: "loc-2",
        return_location_name: "Viatura VTR-09",
        return_notes: "Vistoria preventiva",
        idempotency_key: "idem-return-1",
      },
    );
    expect(returnResult.custody_id).toBe("cust-1");
    expect(returnResult.equipment_status).toBe("maintenance");
  });

  it("translates inventory error codes correctly", () => {
    expect(
      translateWarehouseError({
        code: "warehouse/inventory-session-already-active",
        message: "Session already active",
      }),
    ).toBe("Já existe uma sessão de inventário ativa no almoxarifado. Conclua ou cancele a sessão existente antes de iniciar uma nova.");

    expect(
      translateWarehouseError({
        code: "warehouse/inventory-scope-locked",
        message: "Locked scope",
      }),
    ).toBe("Este estoque está bloqueado temporariamente para conferência de inventário ativa.");
  });

  it("invokes physical inventory callable functions correctly", async () => {
    // openInventorySession
    mocks.callableFn.mockResolvedValueOnce({ data: { session_id: "inv-1", total_items: 12 } });
    const openResult = await WarehouseService.openInventorySession({
      title: "Inventário Geral Q4",
      scope_type: "full_warehouse",
    });
    expect(mocks.callableFn).toHaveBeenCalledWith(
      "adminWarehouseOpenInventorySession",
      expect.objectContaining({
        title: "Inventário Geral Q4",
        scope_type: "full_warehouse",
      }),
    );
    expect(openResult.session_id).toBe("inv-1");

    // recordInventoryCount
    mocks.callableFn.mockResolvedValueOnce({ data: { success: true, discrepancy: -1 } });
    const countResult = await WarehouseService.recordInventoryCount({
      session_id: "inv-1",
      count_id: "cnt-1",
      counted_quantity: 9,
      discrepancy_reason: "Falta de 1 unidade",
    });
    expect(mocks.callableFn).toHaveBeenCalledWith(
      "adminWarehouseRecordInventoryCount",
      expect.objectContaining({
        session_id: "inv-1",
        count_id: "cnt-1",
        counted_quantity: 9,
      }),
    );
    expect(countResult.success).toBe(true);

    // addUnexpectedCount
    mocks.callableFn.mockResolvedValueOnce({ data: { count_id: "cnt-unexp-1" } });
    const unexpResult = await WarehouseService.addUnexpectedCount({
      session_id: "inv-1",
      material_id: "mat-1",
      batch_id: "bat-1",
      location_id: "loc-1",
      counted_quantity: 3,
      discrepancy_reason: "Lote encontrado sem cadastro no local",
    });
    expect(mocks.callableFn).toHaveBeenCalledWith(
      "adminWarehouseAddUnexpectedCount",
      expect.objectContaining({
        session_id: "inv-1",
        material_id: "mat-1",
        counted_quantity: 3,
      }),
    );
    expect(unexpResult.count_id).toBe("cnt-unexp-1");

    // startReconciliation
    mocks.callableFn.mockResolvedValueOnce({ data: { success: true } });
    const startRecResult = await WarehouseService.startReconciliation({ session_id: "inv-1" });
    expect(mocks.callableFn).toHaveBeenCalledWith(
      "adminWarehouseStartReconciliation",
      expect.objectContaining({ session_id: "inv-1" }),
    );
    expect(startRecResult.success).toBe(true);

    // homologateInventorySession
    mocks.callableFn.mockResolvedValueOnce({ data: { session_id: "inv-1", adjustments_applied: 2 } });
    const homologResult = await WarehouseService.homologateInventorySession({
      session_id: "inv-1",
      idempotency_key: "idem-homolog-1",
      notes: "Parecer final validado",
    });
    expect(mocks.callableFn).toHaveBeenCalledWith(
      "adminWarehouseHomologateInventorySession",
      expect.objectContaining({
        session_id: "inv-1",
        idempotency_key: "idem-homolog-1",
        notes: "Parecer final validado",
      }),
    );
    expect(homologResult.session_id).toBe("inv-1");
    expect(homologResult.adjustments_applied).toBe(2);

    // cancelInventorySession
    mocks.callableFn.mockResolvedValueOnce({ data: { success: true } });
    const cancelInvResult = await WarehouseService.cancelInventorySession({
      session_id: "inv-1",
      reason: "Inventário suspenso pela coordenação",
    });
    expect(mocks.callableFn).toHaveBeenCalledWith(
      "adminWarehouseCancelInventorySession",
      expect.objectContaining({
        session_id: "inv-1",
        reason: "Inventário suspenso pela coordenação",
      }),
    );
    expect(cancelInvResult.success).toBe(true);
  });

  it("invokes adminWarehouseGetOverview correctly", async () => {
    const mockOverview = {
      generated_at: "2026-10-06T12:00:00.000Z",
      overall_status: "normal" as const,
      materials: {
        active_materials: 10,
        out_of_stock: 0,
        low_stock: 1,
        expired_batches_with_stock: 0,
        expiring_soon_batches_with_stock: 0,
      },
      equipment: {
        total_active: 5,
        available: 4,
        in_custody: 1,
        maintenance: 0,
        damaged: 0,
      },
      custody: {
        active: 1,
        overdue: 0,
      },
      inventory: {
        active_session: null,
        attention_required: false,
      },
      alerts: [],
      recent_movements: [],
    };

    mocks.callableFn.mockResolvedValueOnce({ data: mockOverview });
    const overviewResult = await WarehouseService.getOverview();
    expect(mocks.callableFn).toHaveBeenCalledWith("adminWarehouseGetOverview", undefined);
    expect(overviewResult.overall_status).toBe("normal");
    expect(overviewResult.materials.active_materials).toBe(10);
  });
});
