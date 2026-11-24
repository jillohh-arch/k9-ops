import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { Timestamp } from "firebase/firestore";
import {
  normalizeWarehouseRecord,
  useWarehouseData,
  useInventoryCounts,
  warehouseCollections,
} from "./use-warehouse-data";

interface MockDocSnapshot {
  id: string;
  data: () => Record<string, unknown>;
}

interface MockQuerySnapshot {
  docs: MockDocSnapshot[];
}

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  collection: vi.fn(),
  onSnapshot: vi.fn(),
}));

vi.mock("@/lib/firebase/client", () => ({ db: {}, functions: {} }));
vi.mock("@/features/access/providers/access-control-provider", () => ({
  useAccessControl: () => ({ can: mocks.can, status: "ready" }),
}));
vi.mock("firebase/firestore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("firebase/firestore")>()),
  collection: mocks.collection,
  onSnapshot: mocks.onSnapshot,
}));

describe("F60 Web Firestore adapter (Option B Runtime Segregation)", () => {
  let snapshotCallbacks: Map<string, (snapshot: MockQuerySnapshot) => void>;
  let unsubscribeMocks: Map<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.clearAllMocks();
    snapshotCallbacks = new Map();
    unsubscribeMocks = new Map();

    mocks.collection.mockImplementation((_db: unknown, ...segments: string[]) => segments.join("/"));
    mocks.onSnapshot.mockImplementation((path: string, onNext: (snap: MockQuerySnapshot) => void) => {
      snapshotCallbacks.set(path, onNext);
      const unsub = vi.fn();
      unsubscribeMocks.set(path, unsub);
      return unsub;
    });
  });

  it("does not subscribe to any collection without inventory.view", () => {
    mocks.can.mockReturnValue(false);
    const { result } = renderHook(() => useWarehouseData());
    expect(result.current.status).toBe("forbidden");
    expect(result.current.canAuditSessions).toBe(false);
    expect(mocks.collection).not.toHaveBeenCalled();
    expect(mocks.onSnapshot).not.toHaveBeenCalled();
  });

  it("subscribes only to 7 authorized collections and omits inventory_sessions when caller has inventory.view but lacks inventory.audit", () => {
    // Simulates operador_k9: inventory.view granted, inventory.audit denied
    mocks.can.mockImplementation((module: string, action: string) => {
      if (module === "inventory" && action === "view") return true;
      if (module === "inventory" && action === "audit") return false;
      return false;
    });

    const { result } = renderHook(() => useWarehouseData());

    const subscribedPaths = mocks.collection.mock.calls.map((call) => call[1]);
    expect(subscribedPaths).not.toContain("inventory_sessions");
    expect(subscribedPaths).toEqual([
      "inventory_items",
      "warehouse_batches",
      "warehouse_positions",
      "warehouse_equipment",
      "warehouse_custodies",
      "warehouse_locations",
      "inventory_movements",
    ]);
    expect(mocks.onSnapshot).toHaveBeenCalledTimes(7);
    expect(result.current.sessions).toEqual([]);
    expect(result.current.canAuditSessions).toBe(false);

    // Simulate initial snapshots for the 7 subscribed collections
    act(() => {
      subscribedPaths.forEach((path) => {
        const cb = snapshotCallbacks.get(path as string);
        if (cb) cb({ docs: [] });
      });
    });

    // Should transition cleanly to ready without waiting for or querying inventory_sessions
    expect(result.current.status).toBe("ready");
    expect(result.current.sessions).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("subscribes to all 8 collections including inventory_sessions when caller has both inventory.view and inventory.audit", () => {
    // Simulates almoxarifado / administrador / authorized gestor
    mocks.can.mockImplementation((module: string, action: string) => {
      if (module === "inventory" && (action === "view" || action === "audit")) return true;
      return false;
    });

    const { result } = renderHook(() => useWarehouseData());

    const subscribedPaths = mocks.collection.mock.calls.map((call) => call[1]);
    expect(subscribedPaths).toContain("inventory_sessions");
    expect(subscribedPaths).toEqual(Object.values(warehouseCollections));
    expect(mocks.onSnapshot).toHaveBeenCalledTimes(8);
    expect(result.current.canAuditSessions).toBe(true);

    // Simulate snapshots
    act(() => {
      subscribedPaths.forEach((path) => {
        const cb = snapshotCallbacks.get(path as string);
        if (cb) {
          if (path === "inventory_sessions") {
            cb({
              docs: [
                {
                  id: "sess-1",
                  data: () => ({ title: "Auditoria 2026", status: "in_progress" }),
                },
              ],
            });
          } else {
            cb({ docs: [] });
          }
        }
      });
    });

    expect(result.current.status).toBe("ready");
    expect(result.current.sessions).toHaveLength(1);
    expect(result.current.sessions[0].title).toBe("Auditoria 2026");
  });

  it("cleans up inventory_sessions listener and resets sessions when inventory.audit is revoked (dynamic downgrade)", () => {
    let hasAudit = true;
    mocks.can.mockImplementation((module: string, action: string) => {
      if (module === "inventory" && action === "view") return true;
      if (module === "inventory" && action === "audit") return hasAudit;
      return false;
    });

    const { result, rerender } = renderHook(() => useWarehouseData());

    // Initially has 8 collections subscribed
    expect(mocks.onSnapshot).toHaveBeenCalledTimes(8);
    act(() => {
      const cb = snapshotCallbacks.get("inventory_sessions");
      if (cb) cb({ docs: [{ id: "sess-1", data: () => ({ title: "Sessão Aberta" }) }] });
    });
    expect(result.current.sessions).toHaveLength(1);

    // Dynamic profile downgrade: audit permission revoked
    hasAudit = false;
    rerender();

    // Verify inventory_sessions unsubscribe was called
    const sessionsUnsub = unsubscribeMocks.get("inventory_sessions");
    expect(sessionsUnsub).toHaveBeenCalled();

    // Verify sessions state is immediately reset to empty array and canAuditSessions is false
    expect(result.current.sessions).toEqual([]);
    expect(result.current.canAuditSessions).toBe(false);
  });

  describe("useInventoryCounts (Option B Segregation)", () => {
    it("returns forbidden without inventory.audit", () => {
      mocks.can.mockImplementation((module: string, action: string) => {
        if (module === "inventory" && action === "view") return true;
        return false; // audit is denied
      });

      const { result } = renderHook(() => useInventoryCounts("sess-123"));
      expect(result.current.status).toBe("forbidden");
      expect(result.current.counts).toEqual([]);
      expect(mocks.onSnapshot).not.toHaveBeenCalled();
    });

    it("returns forbidden without inventory.view", () => {
      mocks.can.mockReturnValue(false);
      const { result } = renderHook(() => useInventoryCounts("sess-123"));
      expect(result.current.status).toBe("forbidden");
      expect(result.current.counts).toEqual([]);
      expect(mocks.onSnapshot).not.toHaveBeenCalled();
    });

    it("returns ready with empty counts when sessionId is not provided", () => {
      mocks.can.mockReturnValue(true);
      const { result } = renderHook(() => useInventoryCounts(null));
      expect(result.current.status).toBe("ready");
      expect(result.current.counts).toEqual([]);
      expect(mocks.onSnapshot).not.toHaveBeenCalled();
    });

    it("subscribes to counts when caller has both inventory.view and inventory.audit", () => {
      mocks.can.mockImplementation((module: string, action: string) => {
        return module === "inventory" && (action === "view" || action === "audit");
      });

      const { result } = renderHook(() => useInventoryCounts("sess-123"));
      expect(result.current.status).toBe("loading");
      expect(mocks.collection).toHaveBeenCalledWith(expect.anything(), "inventory_sessions", "sess-123", "counts");

      act(() => {
        const cb = snapshotCallbacks.get("inventory_sessions/sess-123/counts");
        if (cb) {
          cb({
            docs: [
              {
                id: "count-1",
                data: () => ({ item_id: "mat-1", counted_quantity: 10 }),
              },
            ],
          });
        }
      });

      expect(result.current.status).toBe("ready");
      expect(result.current.counts).toHaveLength(1);
    });
  });

  it("reads the reconciled collections without replacing legacy inventory routes", () => {
    expect(warehouseCollections).toEqual({
      materials: "inventory_items",
      batches: "warehouse_batches",
      positions: "warehouse_positions",
      equipment: "warehouse_equipment",
      custodies: "warehouse_custodies",
      locations: "warehouse_locations",
      movements: "inventory_movements",
      sessions: "inventory_sessions",
    });
  });

  it("converts Firestore Timestamps recursively but preserves business-date strings", () => {
    const instant = Timestamp.fromDate(new Date("2026-10-05T12:00:00Z"));
    expect(
      normalizeWarehouseRecord({
        received_at: instant,
        expiration_date: "2026-10-05",
        nested: [instant],
      }),
    ).toEqual({
      received_at: new Date("2026-10-05T12:00:00Z"),
      expiration_date: "2026-10-05",
      nested: [new Date("2026-10-05T12:00:00Z")],
    });
  });
});
