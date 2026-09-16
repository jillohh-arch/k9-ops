import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useHumanProfileData } from "../use-human-profile-data";

type SnapshotCallback = (snapshot: unknown) => void;

const activeShiftsSnapshot: unknown = { docs: [] };
const shiftAssignmentsSnapshot: unknown = {
  docs: [
    {
      id: "assign-1",
      data: () => ({
        userId: "990099",
        shiftGroupId: "sg-charlie",
        active: true,
      }),
    },
  ],
};
const shiftGroupsSnapshot: unknown = {
  docs: [
    {
      id: "sg-charlie",
      data: () => ({
        id: "sg-charlie",
        name: "Plantão Charlie",
      }),
    },
  ],
};

vi.mock("@/lib/firebase/client", () => ({
  auth: {},
  db: {},
  functions: {},
  storage: {},
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db: unknown, ...pathSegments: string[]) => ({
    _path: pathSegments.join("/"),
  })),
  doc: vi.fn((_db: unknown, coll: string, id: string) => ({
    _docPath: `${coll}/${id}`,
    id,
  })),
  limit: vi.fn(),
  query: vi.fn((source: { _path?: string }) => source),
  onSnapshot: vi.fn((target: { _path?: string; _docPath?: string }, onNext: SnapshotCallback) => {
    if (target._docPath === "users/990099") {
      onNext({
        exists: () => true,
        id: "990099",
        data: () => ({
          ra: "990099",
          callsign: "CASTRO",
          fullName: "Castro Silva",
        }),
      });
    } else if (target._path === "active_shifts") {
      onNext(activeShiftsSnapshot);
    } else if (target._path === "user_shift_assignments") {
      onNext(shiftAssignmentsSnapshot);
    } else if (target._path === "shift_groups") {
      onNext(shiftGroupsSnapshot);
    } else {
      onNext({ docs: [] });
    }
    return () => {};
  }),
}));

describe("useHumanProfileData — Charlie Administrative Shift resolution (CHECK 7)", () => {
  it("resolves administrativeShiftLabel to 'Plantão Charlie' and activeShift to null simultaneously", () => {
    const { result } = renderHook(() => useHumanProfileData("990099"));

    expect(result.current.loading).toBe(false);
    expect(result.current.administrativeShiftLabel).toBe("Plantão Charlie");
    expect(result.current.activeShift).toBeNull();
  });
});
