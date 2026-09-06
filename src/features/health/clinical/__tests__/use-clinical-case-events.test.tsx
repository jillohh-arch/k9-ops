import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type MockAccess = {
  profile: { status?: string; permissions?: Record<string, unknown> };
  status: "fallback" | "loading" | "ready";
};

const accessState = vi.hoisted(() => ({ current: null as MockAccess | null }));

vi.mock("@/features/access/providers/access-control-provider", () => ({
  useAccessControl: () => accessState.current,
}));

vi.mock("@/lib/firebase/client", () => ({
  db: {},
  auth: {},
  storage: {},
  functions: {},
  firebaseApp: {},
}));

const readerMock = vi.hoisted(() => ({
  readEvents: vi.fn(),
  readAmendments: vi.fn(),
}));

vi.mock("../data/clinical-events-reader", () => ({
  CLINICAL_READ_CAPABILITY: "health.read",
  CLINICAL_EVENTS_COLLECTION: "clinical_events",
  CLINICAL_AMENDMENTS_COLLECTION: "clinical_amendments",
  readClinicalEventsForCase: (dogId: string, caseId: string) =>
    readerMock.readEvents(dogId, caseId),
  readClinicalAmendmentsForEvent: (
    dogId: string,
    caseId: string,
    eventId: string
  ) => readerMock.readAmendments(dogId, caseId, eventId),
}));

import type {
  ClinicalEventReadModel,
  ClinicalAmendmentReadModel,
} from "../types";
import { useClinicalCaseEvents } from "../hooks/use-clinical-case-events";

const allowedAccess: MockAccess = {
  status: "ready",
  profile: { status: "active", permissions: { health: { read: true } } },
};

const forbiddenAccess: MockAccess = {
  status: "ready",
  profile: { status: "active", permissions: { health: { view: true } } },
};

const inactiveAccess: MockAccess = {
  status: "ready",
  profile: { status: "inactive", permissions: { health: { read: true } } },
};

const loadingAccess: MockAccess = {
  status: "loading",
  profile: {},
};

function createMockEvent(id: string): ClinicalEventReadModel {
  return {
    id,
    dogId: "k9-apollo",
    caseId: "case-1",
    type: "consultation",
    rawType: "consultation",
    status: "final",
    rawStatus: "final",
    occurredAt: new Date("2026-09-01T10:00:00Z"),
    recordedAt: new Date("2026-09-01T10:05:00Z"),
    updatedAt: null,
    recordedBy: { uid: "u1", name: "Sgt. Silva", internalRole: "condutor_k9" },
    payloadType: "consultation",
    payloadVersion: 1,
    schemaVersion: 1,
    revision: 1,
    content: {},
    attachmentRefs: null,
    hasAmendments: false,
    amendmentCount: 0,
    lastAmendedAt: null,
    finalizedAt: null,
    cancelReason: null,
    cancelledAt: null,
    cancelledBy: null,
    professional: null,
    examId: null,
    dataQualityIssues: [],
    rawDoc: {},
  };
}

describe("useClinicalCaseEvents", () => {
  beforeEach(() => {
    readerMock.readEvents.mockReset();
    readerMock.readAmendments.mockReset();
    accessState.current = allowedAccess;
  });

  it("resolves to forbidden and NEVER reads events when permissions.health.read is missing", () => {
    accessState.current = forbiddenAccess;

    const { result } = renderHook(() =>
      useClinicalCaseEvents("k9-apollo", "case-1")
    );

    expect(result.current.authorityStatus).toBe("forbidden");
    expect(result.current.state.status).toBe("forbidden");
    expect(readerMock.readEvents).not.toHaveBeenCalled();
  });

  it("resolves to forbidden and NEVER reads events when profile is inactive, even if health.read is true", () => {
    accessState.current = inactiveAccess;

    const { result } = renderHook(() =>
      useClinicalCaseEvents("k9-apollo", "case-1")
    );

    expect(result.current.authorityStatus).toBe("forbidden");
    expect(result.current.state.status).toBe("forbidden");
    expect(readerMock.readEvents).not.toHaveBeenCalled();
  });

  it("resolves to loading and NEVER reads events while access control is loading", () => {
    accessState.current = loadingAccess;

    const { result } = renderHook(() =>
      useClinicalCaseEvents("k9-apollo", "case-1")
    );

    expect(result.current.authorityStatus).toBe("loading");
    expect(result.current.state.status).toBe("loading");
    expect(readerMock.readEvents).not.toHaveBeenCalled();
  });

  it("resolves to idle and does not query when dogId or caseId is missing", () => {
    const { result } = renderHook(() => useClinicalCaseEvents(null, null));

    expect(result.current.state.status).toBe("idle");
    expect(readerMock.readEvents).not.toHaveBeenCalled();
  });

  it("reads and publishes success state when authorized", async () => {
    const mockEvents = [createMockEvent("evt-1")];
    readerMock.readEvents.mockResolvedValue({
      status: "success",
      data: mockEvents,
      fetchedAt: new Date(),
    });

    const { result } = renderHook(() =>
      useClinicalCaseEvents("k9-apollo", "case-1")
    );

    expect(result.current.state.status).toBe("loading");

    await waitFor(() => {
      expect(result.current.state.status).toBe("success");
    });

    if (result.current.state.status === "success") {
      expect(result.current.state.data).toEqual(mockEvents);
    }
    expect(readerMock.readEvents).toHaveBeenCalledWith("k9-apollo", "case-1");
  });

  it("publishes empty state when query returns no events", async () => {
    readerMock.readEvents.mockResolvedValue({
      status: "empty",
      query: "dogs/k9-apollo/clinical_cases/case-1/clinical_events",
    });

    const { result } = renderHook(() =>
      useClinicalCaseEvents("k9-apollo", "case-1")
    );

    await waitFor(() => {
      expect(result.current.state.status).toBe("empty");
    });
  });

  it("publishes error state on failure", async () => {
    readerMock.readEvents.mockResolvedValue({
      status: "error",
      code: "FIRESTORE_READ_ERROR",
      message: "Falha de rede",
      retryable: true,
    });

    const { result } = renderHook(() =>
      useClinicalCaseEvents("k9-apollo", "case-1")
    );

    await waitFor(() => {
      expect(result.current.state.status).toBe("error");
    });
  });

  it("cleans state and cancels pending results when switching cases", async () => {
    let resolveFirst: (v: unknown) => void = () => {};
    const firstPromise = new Promise((res) => {
      resolveFirst = res;
    });

    readerMock.readEvents.mockImplementation((_dogId: string, caseId: string) => {
      if (caseId === "case-1") return firstPromise;
      return Promise.resolve({
        status: "success",
        data: [createMockEvent("evt-case-2")],
        fetchedAt: new Date(),
      });
    });

    const { result, rerender } = renderHook(
      ({ dogId, caseId }) => useClinicalCaseEvents(dogId, caseId),
      { initialProps: { dogId: "k9-apollo", caseId: "case-1" } }
    );

    expect(result.current.state.status).toBe("loading");

    // Switch case to case-2 before case-1 finishes
    rerender({ dogId: "k9-apollo", caseId: "case-2" });

    await waitFor(() => {
      expect(result.current.state.status).toBe("success");
    });

    if (result.current.state.status === "success") {
      expect(result.current.state.data[0].id).toBe("evt-case-2");
    }

    // Now resolve first promise: should NOT overwrite case-2!
    act(() => {
      resolveFirst({
        status: "success",
        data: [createMockEvent("evt-case-1-late")],
        fetchedAt: new Date(),
      });
    });

    // Still case-2 data!
    if (result.current.state.status === "success") {
      expect(result.current.state.data[0].id).toBe("evt-case-2");
    }
  });

  it("supports lazy on-demand amendment loading for an event", async () => {
    readerMock.readEvents.mockResolvedValue({
      status: "success",
      data: [createMockEvent("evt-1")],
      fetchedAt: new Date(),
    });

    const mockAmendments: ClinicalAmendmentReadModel[] = [
      {
        id: "amend-1",
        eventId: "evt-1",
        caseId: "case-1",
        dogId: "k9-apollo",
        type: "addendum",
        rawType: "addendum",
        reason: "Observação adicional",
        payloadType: null,
        payloadVersion: null,
        content: {},
        recordedBy: { uid: "u1", name: "Sgt. Silva", internalRole: "condutor_k9" },
        recordedAt: new Date("2026-09-01T12:00:00Z"),
        schemaVersion: 1,
        dataQualityIssues: [],
        rawDoc: {},
      },
    ];

    readerMock.readAmendments.mockResolvedValue({
      status: "success",
      data: mockAmendments,
      fetchedAt: new Date(),
    });

    const { result } = renderHook(() =>
      useClinicalCaseEvents("k9-apollo", "case-1")
    );

    await waitFor(() => {
      expect(result.current.state.status).toBe("success");
    });

    // Trigger lazy amendment load for evt-1
    await act(async () => {
      await result.current.loadAmendmentsForEvent("evt-1");
    });

    expect(readerMock.readAmendments).toHaveBeenCalledWith(
      "k9-apollo",
      "case-1",
      "evt-1"
    );

    const amendState = result.current.amendmentsState["evt-1"];
    expect(amendState?.status).toBe("success");
    if (amendState?.status === "success") {
      expect(amendState.data).toEqual(mockAmendments);
    }
  });
});
