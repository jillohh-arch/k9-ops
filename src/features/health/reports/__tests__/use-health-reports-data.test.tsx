import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useHealthReportsData } from "../hooks/use-health-reports-data";
import { useAccessControl } from "@/features/access/providers/access-control-provider";
import type { AccessProfile } from "@/lib/permissions/access-control";
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

const mockScopeSuccess = () => {
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
};

describe("useHealthReportsData Hook — Authorization Matrix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Unresolved access profile (loading) triggers ZERO loader calls and yields loading state", () => {
    vi.mocked(useAccessControl).mockReturnValue({
      status: "loading",
      profile: { id: "test", name: "Test", status: "active", permissions: {} } as unknown as AccessProfile,
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

  it("CASE A: health.read=false, reports.view=true, reports.export=true -> inaccessible through Health boundary (forbidden, 0 loader calls)", () => {
    vi.mocked(useAccessControl).mockReturnValue({
      status: "ready",
      profile: {
        id: "generic-reports-user",
        name: "Usuário Relatórios",
        status: "active",
        permissions: {
          health: { read: false },
          reports: { view: true, export: true },
        },
      } as unknown as AccessProfile,
      profileId: "generic-reports-user",
      error: null,
      can: vi.fn(),
    });

    const { result } = renderHook(() => useHealthReportsData());

    expect(result.current.authorityStatus).toBe("forbidden");
    expect(result.current.state.status).toBe("forbidden");
    expect(result.current.exportAuthority.canExport).toBe(false);
    expect(result.current.exportAuthority.hasCanonicalRead).toBe(false);
    expect(loadReadinessScope).not.toHaveBeenCalled();
    expect(loadClinicalScope).not.toHaveBeenCalled();
    expect(loadScheduleScope).not.toHaveBeenCalled();
  });

  it("CASE B: health.read=true, reports.view=false, reports.export=false -> reads normally, export disabled", async () => {
    mockScopeSuccess();
    vi.mocked(useAccessControl).mockReturnValue({
      status: "ready",
      profile: {
        id: "health-operator-no-reports",
        name: "Operador Saúde",
        status: "active",
        permissions: {
          health: { read: true },
          reports: { view: false, export: false },
        },
      } as unknown as AccessProfile,
      profileId: "health-operator-no-reports",
      error: null,
      can: vi.fn(),
    });

    const { result } = renderHook(() => useHealthReportsData());

    await waitFor(() => {
      expect(result.current.state.status).toBe("success");
    });

    expect(result.current.authorityStatus).toBe("allowed");
    expect(loadReadinessScope).toHaveBeenCalledTimes(1);
    expect(loadClinicalScope).toHaveBeenCalledTimes(1);
    expect(loadScheduleScope).toHaveBeenCalledTimes(1);

    expect(result.current.exportAuthority.canExport).toBe(false);
    expect(result.current.exportAuthority.hasCanonicalRead).toBe(true);
    expect(result.current.exportAuthority.hasExportCapability).toBe(false);
    expect(result.current.exportAuthority.reason).toContain("reports.export");
  });

  it("CASE C: health.read=true, reports.view=true, reports.export=false -> reads normally, export disabled", async () => {
    mockScopeSuccess();
    vi.mocked(useAccessControl).mockReturnValue({
      status: "ready",
      profile: {
        id: "health-reader-reports-viewer",
        name: "Leitor Saúde e Relatórios",
        status: "active",
        permissions: {
          health: { read: true },
          reports: { view: true, export: false },
        },
      } as unknown as AccessProfile,
      profileId: "health-reader-reports-viewer",
      error: null,
      can: vi.fn(),
    });

    const { result } = renderHook(() => useHealthReportsData());

    await waitFor(() => {
      expect(result.current.state.status).toBe("success");
    });

    expect(result.current.authorityStatus).toBe("allowed");
    expect(loadReadinessScope).toHaveBeenCalledTimes(1);
    expect(loadClinicalScope).toHaveBeenCalledTimes(1);
    expect(loadScheduleScope).toHaveBeenCalledTimes(1);

    expect(result.current.exportAuthority.canExport).toBe(false);
    expect(result.current.exportAuthority.hasCanonicalRead).toBe(true);
    expect(result.current.exportAuthority.hasExportCapability).toBe(false);
    expect(result.current.exportAuthority.reason).toContain("reports.export");
  });

  it("CASE D: health.read=true, reports.view=false, reports.export=true -> reads normally, export remains disabled pending F10 ratification", async () => {
    mockScopeSuccess();
    vi.mocked(useAccessControl).mockReturnValue({
      status: "ready",
      profile: {
        id: "health-reader-exporter",
        name: "Leitor Saúde com Export",
        status: "active",
        permissions: {
          health: { read: true },
          reports: { view: false, export: true },
        },
      } as unknown as AccessProfile,
      profileId: "health-reader-exporter",
      error: null,
      can: vi.fn(),
    });

    const { result } = renderHook(() => useHealthReportsData());

    await waitFor(() => {
      expect(result.current.state.status).toBe("success");
    });

    expect(result.current.authorityStatus).toBe("allowed");
    expect(loadReadinessScope).toHaveBeenCalledTimes(1);
    expect(loadClinicalScope).toHaveBeenCalledTimes(1);
    expect(loadScheduleScope).toHaveBeenCalledTimes(1);

    // Fail-closed pending F10 ratification:
    expect(result.current.exportAuthority.canExport).toBe(false);
    expect(result.current.exportAuthority.hasCanonicalRead).toBe(true);
    expect(result.current.exportAuthority.hasExportCapability).toBe(true);
    expect(result.current.exportAuthority.isPolicyRatified).toBe(false);
    expect(result.current.exportAuthority.reason).toContain("ratificação de política institucional (F10)");
  });

  it("CASE E: health.read=true, reports.view=true, reports.export=true -> reads normally, export remains disabled pending F10 ratification", async () => {
    mockScopeSuccess();
    vi.mocked(useAccessControl).mockReturnValue({
      status: "ready",
      profile: {
        id: "full-health-reports-user",
        name: "Usuário Completo",
        status: "active",
        permissions: {
          health: { read: true },
          reports: { view: true, export: true },
        },
      } as unknown as AccessProfile,
      profileId: "full-health-reports-user",
      error: null,
      can: vi.fn(),
    });

    const { result } = renderHook(() => useHealthReportsData());

    await waitFor(() => {
      expect(result.current.state.status).toBe("success");
    });

    expect(result.current.authorityStatus).toBe("allowed");
    expect(loadReadinessScope).toHaveBeenCalledTimes(1);
    expect(loadClinicalScope).toHaveBeenCalledTimes(1);
    expect(loadScheduleScope).toHaveBeenCalledTimes(1);

    // Fail-closed pending F10 ratification:
    expect(result.current.exportAuthority.canExport).toBe(false);
    expect(result.current.exportAuthority.hasCanonicalRead).toBe(true);
    expect(result.current.exportAuthority.hasExportCapability).toBe(true);
    expect(result.current.exportAuthority.isPolicyRatified).toBe(false);
    expect(result.current.exportAuthority.reason).toContain("ratificação de política institucional (F10)");
  });
});
