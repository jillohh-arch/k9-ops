import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useHealthHistoryData } from "../hooks/use-health-history-data";
import { useAccessControl } from "@/features/access/providers/access-control-provider";
import type { AccessProfile } from "@/lib/permissions/access-control";
import { loadReadinessScope } from "../../presentation/hooks/load-readiness-scope";
import type { ReadinessListItem } from "../../domain/readiness-types";
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

describe("useHealthHistoryData Hook — Contract & State Machine", () => {
  const mockDog = {
    id: "dog-1",
    name: "Thor",
    registrationNumber: "RG-100",
    photoUrl: null,
    breed: "Pastor Belga Malinois",
    sex: "Macho",
    dateOfBirth: null,
    conductor: null,
    specialties: [],
  };

  const mockClinicalData = [
    {
      entryId: "dog-1:c1",
      dogId: "dog-1",
      caseId: "c1",
      dog: mockDog,
      case: {
        dogId: "dog-1",
        caseId: "c1",
        clinicalStatus: "under_treatment" as const,
        rawClinicalStatus: "under_treatment",
        title: "Dermatite",
        openedAt: new Date("2026-09-15T10:00:00.000Z"),
        openedBy: null,
        recordedBy: { uid: "u1", name: "Dra. Paula", internalRole: "veterinarian" },
        openingEventId: null,
        openingType: null,
        primaryProfessional: null,
        closedAt: null,
        closedBy: null,
        closureType: null,
        closureReason: null,
        hasActiveRestriction: false,
        hasPendingSchedule: false,
        activeTreatmentsCount: 1,
        lastEventAt: null,
        eventCount: 1,
        schemaVersion: 1,
        dataQuality: "complete" as const,
        issues: [],
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. LOADING TERMINATION: unresolved access profile yields loading, which terminates when ready", async () => {
    vi.mocked(useAccessControl).mockReturnValue({
      status: "loading",
      profile: { id: "test", name: "Test", status: "active", permissions: {} } as unknown as AccessProfile,
      profileId: "test",
      error: null,
      can: vi.fn(),
    });

    const { result, rerender } = renderHook(() => useHealthHistoryData());

    expect(result.current.authorityStatus).toBe("loading");
    expect(result.current.state.status).toBe("loading");
    expect(loadReadinessScope).not.toHaveBeenCalled();

    // Now resolve access control
    vi.mocked(loadReadinessScope).mockResolvedValueOnce({
      items: [],
      activeRestrictions: [],
      isPartial: false,
      restrictionsCoverageComplete: true,
      scopeEmpty: false,
    });
    vi.mocked(loadClinicalScope).mockResolvedValueOnce({
      state: { status: "success", data: [], fetchedAt: new Date() },
      coverage: { dogsInScope: 0, authorizedDogIds: [], forbiddenDogIds: [], failedDogIds: [], partialEntryIds: [], complete: true },
    });
    vi.mocked(loadScheduleScope).mockResolvedValueOnce({
      state: { status: "success", data: [], fetchedAt: new Date() },
      coverage: { dogsInScope: 0, authorizedDogIds: [], forbiddenDogIds: [], failedDogIds: [], partialEntryIds: [], complete: true },
    });

    vi.mocked(useAccessControl).mockReturnValue({
      status: "ready",
      profile: {
        id: "health-user",
        name: "Usuário Saúde",
        status: "active",
        permissions: { health: { view: true } },
      } as unknown as AccessProfile,
      profileId: "health-user",
      error: null,
      can: vi.fn(),
    });

    rerender();

    await waitFor(() => {
      // Loading terminates and transitions to empty
      expect(result.current.state.status).toBe("empty");
    });
    expect(result.current.authorityStatus).toBe("allowed");
  });

  it("2. UNAUTHORIZED READ: profile without health.view is forbidden with 0 loader queries", () => {
    vi.mocked(useAccessControl).mockReturnValue({
      status: "ready",
      profile: {
        id: "no-health-user",
        name: "Sem Saúde",
        status: "active",
        permissions: { health: { view: false } },
      } as unknown as AccessProfile,
      profileId: "no-health-user",
      error: null,
      can: vi.fn(),
    });

    const { result } = renderHook(() => useHealthHistoryData());

    expect(result.current.authorityStatus).toBe("forbidden");
    expect(result.current.state.status).toBe("forbidden");
    expect(loadReadinessScope).not.toHaveBeenCalled();
    expect(loadClinicalScope).not.toHaveBeenCalled();
    expect(loadScheduleScope).not.toHaveBeenCalled();
  });

  it("3. SUCCESSFUL RECORDS: authorized profile receives rendered timeline items", async () => {
    vi.mocked(useAccessControl).mockReturnValue({
      status: "ready",
      profile: {
        id: "health-user",
        name: "Usuário Saúde",
        status: "active",
        permissions: { health: { view: true } },
      } as unknown as AccessProfile,
      profileId: "health-user",
      error: null,
      can: vi.fn(),
    });

    vi.mocked(loadReadinessScope).mockResolvedValueOnce({
      items: [{ dog: mockDog } as unknown as ReadinessListItem],
      activeRestrictions: [],
      isPartial: false,
      restrictionsCoverageComplete: true,
      scopeEmpty: false,
    });
    vi.mocked(loadClinicalScope).mockResolvedValueOnce({
      state: { status: "success", data: mockClinicalData, fetchedAt: new Date() },
      coverage: { dogsInScope: 1, authorizedDogIds: ["dog-1"], forbiddenDogIds: [], failedDogIds: [], partialEntryIds: [], complete: true },
    });
    vi.mocked(loadScheduleScope).mockResolvedValueOnce({
      state: { status: "success", data: [], fetchedAt: new Date() },
      coverage: { dogsInScope: 1, authorizedDogIds: ["dog-1"], forbiddenDogIds: [], failedDogIds: [], partialEntryIds: [], complete: true },
    });

    const { result } = renderHook(() => useHealthHistoryData());

    await waitFor(() => {
      expect(result.current.state.status).toBe("success");
    });

    if (result.current.state.status === "success") {
      expect(result.current.state.data.totalCount).toBe(1);
      expect(result.current.state.data.filteredItems[0].title).toBe("Dermatite");
      expect(result.current.state.data.countsByCategory.clinical).toBe(1);
    }
  });

  it("4. ZERO RECORDS: scope genuinely empty transitions to truthful empty state", async () => {
    vi.mocked(useAccessControl).mockReturnValue({
      status: "ready",
      profile: {
        id: "health-user",
        name: "Usuário Saúde",
        status: "active",
        permissions: { health: { view: true } },
      } as unknown as AccessProfile,
      profileId: "health-user",
      error: null,
      can: vi.fn(),
    });

    vi.mocked(loadReadinessScope).mockResolvedValueOnce({
      items: [],
      activeRestrictions: [],
      isPartial: false,
      restrictionsCoverageComplete: true,
      scopeEmpty: true,
    });
    vi.mocked(loadClinicalScope).mockResolvedValueOnce({
      state: { status: "success", data: [], fetchedAt: new Date() },
      coverage: { dogsInScope: 0, authorizedDogIds: [], forbiddenDogIds: [], failedDogIds: [], partialEntryIds: [], complete: true },
    });
    vi.mocked(loadScheduleScope).mockResolvedValueOnce({
      state: { status: "success", data: [], fetchedAt: new Date() },
      coverage: { dogsInScope: 0, authorizedDogIds: [], forbiddenDogIds: [], failedDogIds: [], partialEntryIds: [], complete: true },
    });

    const { result } = renderHook(() => useHealthHistoryData());

    await waitFor(() => {
      expect(result.current.state.status).toBe("empty");
    });
  });

  it("5. REJECTED REQUEST: loader failure transitions to retryable error state", async () => {
    vi.mocked(useAccessControl).mockReturnValue({
      status: "ready",
      profile: {
        id: "health-user",
        name: "Usuário Saúde",
        status: "active",
        permissions: { health: { view: true } },
      } as unknown as AccessProfile,
      profileId: "health-user",
      error: null,
      can: vi.fn(),
    });

    vi.mocked(loadReadinessScope).mockRejectedValueOnce(new Error("Firestore connection lost"));
    vi.mocked(loadClinicalScope).mockResolvedValueOnce({
      state: { status: "success", data: [], fetchedAt: new Date() },
      coverage: { dogsInScope: 0, authorizedDogIds: [], forbiddenDogIds: [], failedDogIds: [], partialEntryIds: [], complete: true },
    });
    vi.mocked(loadScheduleScope).mockResolvedValueOnce({
      state: { status: "success", data: [], fetchedAt: new Date() },
      coverage: { dogsInScope: 0, authorizedDogIds: [], forbiddenDogIds: [], failedDogIds: [], partialEntryIds: [], complete: true },
    });

    const { result } = renderHook(() => useHealthHistoryData());

    await waitFor(() => {
      expect(result.current.state.status).toBe("error");
    });

    if (result.current.state.status === "error") {
      expect(result.current.state.code).toBe("HISTORY_LOAD_FAILED");
      expect(result.current.state.message).toContain("Firestore connection lost");
      expect(result.current.state.retryable).toBe(true);
    }
  });

  it("6. RETRY / RECOVERY: refresh() re-executes query and recovers from transient error", async () => {
    vi.mocked(useAccessControl).mockReturnValue({
      status: "ready",
      profile: {
        id: "health-user",
        name: "Usuário Saúde",
        status: "active",
        permissions: { health: { view: true } },
      } as unknown as AccessProfile,
      profileId: "health-user",
      error: null,
      can: vi.fn(),
    });

    // 1st attempt: fails
    vi.mocked(loadReadinessScope).mockRejectedValueOnce(new Error("Network timeout"));
    vi.mocked(loadClinicalScope).mockResolvedValueOnce({
      state: { status: "success", data: [], fetchedAt: new Date() },
      coverage: { dogsInScope: 0, authorizedDogIds: [], forbiddenDogIds: [], failedDogIds: [], partialEntryIds: [], complete: true },
    });
    vi.mocked(loadScheduleScope).mockResolvedValueOnce({
      state: { status: "success", data: [], fetchedAt: new Date() },
      coverage: { dogsInScope: 0, authorizedDogIds: [], forbiddenDogIds: [], failedDogIds: [], partialEntryIds: [], complete: true },
    });

    const { result } = renderHook(() => useHealthHistoryData());

    await waitFor(() => {
      expect(result.current.state.status).toBe("error");
    });

    // 2nd attempt: succeeds
    vi.mocked(loadReadinessScope).mockResolvedValueOnce({
      items: [{ dog: mockDog } as unknown as ReadinessListItem],
      activeRestrictions: [],
      isPartial: false,
      restrictionsCoverageComplete: true,
      scopeEmpty: false,
    });
    vi.mocked(loadClinicalScope).mockResolvedValueOnce({
      state: { status: "success", data: mockClinicalData, fetchedAt: new Date() },
      coverage: { dogsInScope: 1, authorizedDogIds: ["dog-1"], forbiddenDogIds: [], failedDogIds: [], partialEntryIds: [], complete: true },
    });
    vi.mocked(loadScheduleScope).mockResolvedValueOnce({
      state: { status: "success", data: [], fetchedAt: new Date() },
      coverage: { dogsInScope: 1, authorizedDogIds: ["dog-1"], forbiddenDogIds: [], failedDogIds: [], partialEntryIds: [], complete: true },
    });

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe("success");
    });

    if (result.current.state.status === "success") {
      expect(result.current.state.data.totalCount).toBe(1);
    }
  });
});
