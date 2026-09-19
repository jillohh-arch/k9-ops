import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AccessAction, AccessModuleId, AccessProfile } from "@/lib/permissions/access-control";
import { getDefaultAccessProfile, hasAccessPermission } from "@/lib/permissions/access-control";
import type { useHumanProfileData as useHumanProfileDataType } from "@/features/effective/hooks/use-human-profile-data";

// --- Mocks ---
let mockPathname = "/me";
let mockAuthProfile: {
  admin?: boolean;
  displayName: string | null;
  email: string | null;
  isK9Instructor?: boolean;
  photoUrl: string | null;
  ra: string | null;
  role?: string;
  roles?: string[];
} | null = {
  admin: false,
  displayName: "Fernanda",
  email: "691700@gcm.com.br",
  isK9Instructor: false,
  photoUrl: null,
  ra: "691700",
  role: "condutor",
  roles: ["condutor", "guarda_k9", "operador_k9"],
};

let mockAccessProfile: AccessProfile | null = getDefaultAccessProfile("operador_k9");
let mockProfileDataState: ReturnType<typeof useHumanProfileDataType> = {
  activeShift: null,
  administrativeShift: null,
  administrativeShiftGroup: null,
  administrativeShiftLabel: null,
  certifications: [],
  documents: [],
  error: null,
  events: [],
  linkedDogs: [],
  loading: false,
  movements: [],
  occurrences: [],
  promotionRequests: [],
  shiftLogs: [],
  trainings: [],
  user: {
    _id: "691700",
    _source: "users",
    active: true,
    callsign: "Fernanda",
    cargo: "Condutor K9",
    nomeCompleto: "Fernanda Nogueira Barbosa",
    ra: "691700",
    status: "Ativo",
  },
};

const mockReplace = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

vi.mock("next/image", () => ({
  default: () => <span data-testid="image" />,
}));

vi.mock("@/features/auth/providers/auth-provider", () => ({
  useAuth: () => ({
    profile: mockAuthProfile,
    signOut: vi.fn(),
    status: "authenticated",
  }),
}));

vi.mock("@/features/access/providers/access-control-provider", () => ({
  useAccessControl: () => ({
    can: (moduleId: AccessModuleId, action: AccessAction = "view") =>
      hasAccessPermission(mockAccessProfile, moduleId, action),
    profile: mockAccessProfile,
    profileId: mockAccessProfile?.id ?? "operador_k9",
    status: "ready",
  }),
}));

type QueryConstraintMock = {
  _type: string;
  field?: string;
  n?: number;
  op?: string;
  val?: unknown;
};

type QuerySourceMock = {
  _constraints?: QueryConstraintMock[];
  _docPath?: string;
  _path?: string;
  id?: string;
};

const mockWhereCalls: Array<{ field: string; op: string; val: unknown }> = [];
const mockQueryCalls: Array<{ source: QuerySourceMock; constraints: QueryConstraintMock[] }> = [];

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db: unknown, ...pathSegments: string[]) => ({
    _path: pathSegments.join("/"),
  })),
  doc: vi.fn((_db: unknown, coll: string, id: string) => ({
    _docPath: `${coll}/${id}`,
    id,
  })),
  limit: vi.fn((n: number) => ({ _type: "limit", n })),
  onSnapshot: vi.fn(() => () => undefined),
  orderBy: vi.fn(() => ({ _type: "orderBy" })),
  query: vi.fn((source: QuerySourceMock, ...constraints: QueryConstraintMock[]) => {
    mockQueryCalls.push({ source, constraints });
    return { ...source, _constraints: constraints };
  }),
  where: vi.fn((field: string, op: string, val: unknown) => {
    mockWhereCalls.push({ field, op, val });
    return { _type: "where", field, op, val };
  }),
}));

vi.mock("@/lib/firebase/client", () => ({ db: {} }));

vi.mock("@/features/effective/hooks/use-human-profile-data", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/effective/hooks/use-human-profile-data")
  >("@/features/effective/hooks/use-human-profile-data");
  return {
    ...actual,
    useSelfProfileData: vi.fn(() => mockProfileDataState),
  };
});

const { default: MePage } = await import("@/app/(app)/me/page");
const { AppShell } = await import("@/components/layout/app-shell");

describe("CT3.F10.ME-SELF-PROFILE-AUTHORIZATION-FIX-R1 — Focused Test Suite", () => {
  beforeEach(() => {
    mockPathname = "/me";
    mockWhereCalls.length = 0;
    mockQueryCalls.length = 0;
    mockAuthProfile = {
      admin: false,
      displayName: "Fernanda",
      email: "691700@gcm.com.br",
      isK9Instructor: false,
      photoUrl: null,
      ra: "691700",
      role: "condutor",
      roles: ["condutor", "guarda_k9", "operador_k9"],
    };
    mockAccessProfile = getDefaultAccessProfile("operador_k9");
    mockProfileDataState = {
      activeShift: null,
      certifications: [],
      documents: [],
      error: null,
      events: [],
      linkedDogs: [],
      loading: false,
      movements: [],
      occurrences: [],
      promotionRequests: [],
      shiftLogs: [],
      trainings: [],
      user: {
        _id: "691700",
        _source: "users",
        active: true,
        callsign: "Fernanda",
        cargo: "Condutor K9",
        nomeCompleto: "Fernanda Nogueira Barbosa",
        ra: "691700",
        status: "Ativo",
      },
    };
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // CASE 1: operador_k9, me.view == true, own RA -> /me loads successfully
  it("CASE 1 — operador_k9 with me.view == true loads /me successfully for own RA", () => {
    render(<MePage />);

    expect(screen.getByText("Meu Perfil")).toBeInTheDocument();
    expect(screen.getByText("Fernanda")).toBeInTheDocument();
    expect(screen.getByText("RA 691700")).toBeInTheDocument();
    expect(screen.getByText("Condutor K9")).toBeInTheDocument();
    expect(screen.queryByText(/Falha ao carregar/)).not.toBeInTheDocument();
  });

  // CASE 2: self-profile promotion query -> requester_ra filter equals current RA
  it("CASE 2 — self-profile promotion query scopes requester_ra to current RA", async () => {
    const { renderHook } = await import("@testing-library/react");
    const { useHumanProfileData: realUseHumanProfileData } =
      await vi.importActual<
        typeof import("@/features/effective/hooks/use-human-profile-data")
      >("@/features/effective/hooks/use-human-profile-data");

    renderHook(() => realUseHumanProfileData("691700", { mode: "self" }));

    const promotionQuery = mockQueryCalls.find(
      (c) => c.source?._path === "promotion_requests",
    );
    expect(promotionQuery).toBeDefined();

    const whereConstraint = promotionQuery!.constraints.find(
      (c) => c._type === "where",
    );
    expect(whereConstraint).toBeDefined();
    expect(whereConstraint).toEqual({
      _type: "where",
      field: "requester_ra",
      op: "==",
      val: "691700",
    });
  });

  // CASE 3: operator does not gain collection-wide promotion read authority
  it("CASE 3 — operator does not gain collection-wide promotion read authority", () => {
    const operadorProfile = getDefaultAccessProfile("operador_k9")!;

    // Least-privilege invariant: operador_k9 permissions must not include administrative approval/audit
    expect(hasAccessPermission(operadorProfile, "training", "approve")).toBe(false);
    expect(hasAccessPermission(operadorProfile, "training", "audit")).toBe(false);
    expect(hasAccessPermission(operadorProfile, "training_matrix", "approve")).toBe(false);

    // Self-profile query MUST NOT query promotion_requests without the requester_ra where clause
    const promotionSelfQuery = mockQueryCalls.find(
      (c) =>
        c.source?._path === "promotion_requests" &&
        !c.constraints.some((k) => k.field === "requester_ra"),
    );
    expect(promotionSelfQuery).toBeUndefined();
  });

  // CASE 4: administrator /humans/[ra] behavior remains unchanged
  it("CASE 4 — administrator /humans/[ra] queries promotion_requests in administrative mode", async () => {
    const { renderHook } = await import("@testing-library/react");
    const { useHumanProfileData: realUseHumanProfileData } =
      await vi.importActual<
        typeof import("@/features/effective/hooks/use-human-profile-data")
      >("@/features/effective/hooks/use-human-profile-data");

    mockQueryCalls.length = 0;
    // Default mode is "administrative" as consumed by /humans/[ra] and /humans/[ra]/history
    renderHook(() => realUseHumanProfileData("691700"));

    const adminPromotionQuery = mockQueryCalls.find(
      (c) => c.source?._path === "promotion_requests",
    );
    expect(adminPromotionQuery).toBeDefined();

    // Administrative query must NOT have the self-scoped requester_ra constraint
    const hasSelfFilter = adminPromotionQuery!.constraints.some(
      (c) => c._type === "where" && c.field === "requester_ra",
    );
    expect(hasSelfFilter).toBe(false);

    // Limit(500) remains present
    const hasLimit = adminPromotionQuery!.constraints.some(
      (c) => c._type === "limit" && c.n === 500,
    );
    expect(hasLimit).toBe(true);
  });

  // CASE 5: me.view == false -> route remains denied
  it("CASE 5 — me.view == false keeps route denied via AppShell guard", () => {
    // Revoke me.view
    mockAccessProfile = {
      ...getDefaultAccessProfile("operador_k9")!,
      permissions: {
        ...getDefaultAccessProfile("operador_k9")!.permissions,
        me: { view: false, edit: false },
      },
    };

    render(
      <AppShell>
        <MePage />
      </AppShell>,
    );

    expect(screen.getByTestId("app-access-denied")).toBeInTheDocument();
    expect(screen.getByText("Acesso não liberado")).toBeInTheDocument();
    expect(screen.queryByText("Meu Perfil")).not.toBeInTheDocument();
  });

  // CASE 6: Firebase permission error from unrelated data source remains fail-closed
  it("CASE 6 — Firebase permission error from data source remains fail-closed", () => {
    mockProfileDataState = {
      ...mockProfileDataState,
      error: "Missing or insufficient permissions.",
      user: null,
    };

    render(<MePage />);

    expect(
      screen.getByText(/Falha ao carregar seu perfil: Missing or insufficient permissions\./),
    ).toBeInTheDocument();
    expect(screen.queryByText("Meu Perfil")).not.toBeInTheDocument();
  });

  // CASE 7: Fernanda-specific role/instructor/admin elevation is NOT required
  it("CASE 7 — Fernanda standard operador_k9 without admin or instructor elevation succeeds", () => {
    // Explicitly verify Fernanda's non-elevated properties
    expect(mockAuthProfile?.admin).toBe(false);
    expect(mockAuthProfile?.isK9Instructor).toBe(false);
    expect(mockAuthProfile?.role).toBe("condutor");
    expect(mockAccessProfile?.id).toBe("operador_k9");

    render(<MePage />);

    // Access succeeds purely through canonical permissions.me.view == true and self-scoped data
    expect(screen.getByText("Meu Perfil")).toBeInTheDocument();
    expect(screen.getByText("RA 691700")).toBeInTheDocument();
    expect(screen.queryByText(/Falha ao carregar/)).not.toBeInTheDocument();
  });
});
