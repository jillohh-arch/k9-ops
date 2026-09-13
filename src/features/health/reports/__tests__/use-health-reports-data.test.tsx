import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useHealthReportsData } from "../hooks/use-health-reports-data";
import { useAccessControl } from "@/features/access/providers/access-control-provider";
import { loadReadinessScope } from "../../presentation/hooks/load-readiness-scope";
import { loadClinicalScope } from "../../clinical/data/clinical-scope-loader";
import { loadScheduleScope } from "../../schedule/data/schedule-scope-loader";

vi.mock("@/features/access/providers/access-control-provider", () => ({
  useAccessControl: vi.fn(),
}));

vi.mock("../../presentation/hooks/load-readiness-scope", () => ({
  loadReadinessScope: vi.fn(),
}));

vi.mock("../../clinical/data/clinical-scope-loader", () => ({
  loadClinicalScope: vi.fn(),
}));

vi.mock("../../schedule/data/schedule-scope-loader", () => ({
  loadScheduleScope: vi.fn(),
}));

vi.mock("../../schedule/composition/schedule-composition", () => ({
  composeScheduleEntry: vi.fn((entry) => ({
    entry,
    temporal: {
      temporalStatus: "upcoming",
      temporalAvailability: "available",
      effectiveDueUntil: null,
    },
    displayWindow: {
      inDisplayWindow: true,
      offsetDays: 1,
      availability: "available",
    },
  })),
}));

describe("useHealthReportsData Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. Unresolved access profile (loading) triggers ZERO loader calls and yields loading state", () => {
    vi.mocked(useAccessControl).mockReturnValue({
      status: "loading",
      profile: { id: "test", name: "Test", status: "active", permissions: {} } as any,
      profileId: "test",
      error: null,
      can: vi.fn(),
    });

    const { result } = renderHook(() => useHealthReportsData());

    expect(result.current.authorityStatus).toBe("loading");
    expect(result.current.state.status).toBe("loading");
    expect(loadReadinessScope).not.toHaveBeenCalled();
    expect(loadClinicalScope).not.toHaveBeenCalled();
    expect(loadScheduleScope).not.toHaveBeenCalled();
  });

  it("2. Profile missing health.read triggers ZERO loader calls and yields forbidden state", () => {
    vi.mocked(useAccessControl).mockReturnValue({
      status: "ready",
      profile: {
        id: "operador",
        name: "Operador",
        status: "active",
        permissions: {
          health: { view: true }, // Legacy view only, NO canonical read!
        },
      } as any,
      profileId: "operador",
      error: null,
      can: vi.fn(),
    });

    const { result } = renderHook(() => useHealthReportsData());

    expect(result.current.authorityStatus).toBe("forbidden");
    expect(result.current.state.status).toBe("forbidden");
    expect(loadReadinessScope).not.toHaveBeenCalled();
    expect(loadClinicalScope).not.toHaveBeenCalled();
    expect(loadScheduleScope).not.toHaveBeenCalled();
  });

  it("3. Authorized profile (health.read=true) initiates all 3 loaders and computes aggregate", async () => {
    vi.mocked(useAccessControl).mockReturnValue({
      status: "ready",
      profile: {
        id: "vet",
        name: "Veterinário",
        status: "active",
        permissions: {
          health: { read: true },
          reports: { export: true },
        },
      } as any,
      profileId: "vet",
      error: null,
      can: vi.fn(),
    });

    vi.mocked(loadReadinessScope).mockResolvedValueOnce({
      items: [],
      activeRestrictions: [],
      isPartial: false,
      restrictionsCoverageComplete: true,
      scopeEmpty: false,
    });

    vi.mocked(loadClinicalScope).mockResolvedValueOnce({
      state: { status: "success", data: [], fetchedAt: new Date() },
      coverage: {
        dogsInScope: 2,
        authorizedDogIds: ["d1", "d2"],
        forbiddenDogIds: [],
        failedDogIds: [],
        partialEntryIds: [],
        complete: true,
      },
    });

    vi.mocked(loadScheduleScope).mockResolvedValueOnce({
      state: { status: "success", data: [], fetchedAt: new Date() },
      coverage: {
        dogsInScope: 2,
        authorizedDogIds: ["d1", "d2"],
        forbiddenDogIds: [],
        failedDogIds: [],
        partialEntryIds: [],
        complete: true,
      },
    });

    const { result } = renderHook(() => useHealthReportsData());

    await waitFor(() => {
      expect(result.current.state.status).toBe("success");
    });

    expect(loadReadinessScope).toHaveBeenCalledTimes(1);
    expect(loadClinicalScope).toHaveBeenCalledTimes(1);
    expect(loadScheduleScope).toHaveBeenCalledTimes(1);
    expect(result.current.exportAuthority.canExport).toBe(true);
  });

  it("4. When reports.export is false, exportAuthority.canExport is false with explanation", async () => {
    vi.mocked(useAccessControl).mockReturnValue({
      status: "ready",
      profile: {
        id: "vet-no-export",
        name: "Veterinário Sem Export",
        status: "active",
        permissions: {
          health: { read: true },
          // reports.export absent!
        },
      } as any,
      profileId: "vet-no-export",
      error: null,
      can: vi.fn(),
    });

    vi.mocked(loadReadinessScope).mockResolvedValueOnce({
      items: [],
      activeRestrictions: [],
      isPartial: false,
      restrictionsCoverageComplete: true,
      scopeEmpty: false,
    });

    vi.mocked(loadClinicalScope).mockResolvedValueOnce({
      state: { status: "success", data: [], fetchedAt: new Date() },
      coverage: {
        dogsInScope: 1,
        authorizedDogIds: ["d1"],
        forbiddenDogIds: [],
        failedDogIds: [],
        partialEntryIds: [],
        complete: true,
      },
    });

    vi.mocked(loadScheduleScope).mockResolvedValueOnce({
      state: { status: "success", data: [], fetchedAt: new Date() },
      coverage: {
        dogsInScope: 1,
        authorizedDogIds: ["d1"],
        forbiddenDogIds: [],
        failedDogIds: [],
        partialEntryIds: [],
        complete: true,
      },
    });

    const { result } = renderHook(() => useHealthReportsData());

    await waitFor(() => {
      expect(result.current.state.status).toBe("success");
    });

    expect(result.current.exportAuthority.canExport).toBe(false);
    expect(result.current.exportAuthority.reason).toContain("reports.export");
  });
});
