/**
 * K9 Ops Web — Health Web v1 / NUT-WEB-5B.F
 * Invalid dogId hardening for the individual Nutrition route.
 *
 * A route param is user-controlled. `/health/nutrition/dogs/dog%2F42` decodes to
 * `dog/42`, which cannot be a single Firestore document-id segment: `doc(db,
 * "dogs", "dog/42")` resolves to the 3-segment path `dogs/dog/42` and throws
 * SYNCHRONOUSLY. Before this hardening that exception escaped the hook and took
 * the whole module down before the Health shell could respond — a real E2E
 * deep-link failure, not a theoretical one.
 *
 * The contract locked here:
 *   - an unusable dogId resolves to the controlled `not_found` state;
 *   - `doc()` is NEVER called with an invalid id (no request, no throw);
 *   - a valid dogId keeps the pre-existing behaviour untouched.
 *
 * `not_found` (not `error`) is deliberate: it matches how a nonexistent or
 * out-of-scope K9 is presented, so a malformed URL reveals nothing extra.
 */

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase/app", () => ({ initializeApp: vi.fn(), getApps: () => [], getApp: vi.fn() }));
vi.mock("firebase/auth", () => ({ getAuth: vi.fn() }));

/*
 * `doc` is faithful to the real SDK on the one behaviour under test: it THROWS
 * for a path with an odd number of segments. A permissive stub would make this
 * suite pass even if the guard were removed, so the fake must be able to fail.
 */
const mockDoc = vi.fn((_db: unknown, ...segments: string[]) => {
  const path = segments.join("/");
  if (segments.length % 2 !== 0) {
    throw new Error(
      `Invalid document reference. Document references must have an even number of segments, but ${path} has ${segments.length}.`,
    );
  }
  return { path };
});
const mockGetDoc = vi.fn();

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(),
  collection: vi.fn(),
  onSnapshot: vi.fn(() => () => {}),
  doc: (db: unknown, ...segments: string[]) => mockDoc(db, ...segments),
  getDoc: (ref: unknown) => mockGetDoc(ref),
}));
vi.mock("firebase/storage", () => ({ getStorage: vi.fn() }));
vi.mock("@/lib/firebase/client", () => ({ db: {}, auth: {}, storage: {}, functions: {} }));

vi.mock("@/features/access/providers/access-control-provider", () => ({
  useAccessControl: () => ({ can: () => false }),
}));

// The plan reader is irrelevant here: the K9 context must be decided before any
// plan is read, so it stays inert.
vi.mock("../hooks/use-nutrition-plans", () => ({
  useNutritionPlans: (dogId: string) => ({
    status: "empty",
    dogId,
    activePlan: null,
    plans: [],
    legacyPlan: null,
    error: null,
    integrityConflict: null,
    reason: null,
  }),
}));

const { NutritionDogView } = await import("../presentation/nutrition-dog-view");

/** Every dogId that cannot stand as one Firestore document-id segment. */
const INVALID_IDS = ["dog/42", "a/b/c", "/", "dogs/test-dog", "", "   "];

beforeEach(() => {
  mockDoc.mockClear();
  mockGetDoc.mockReset();
});

describe("NUT-WEB-5B.F — invalid dogId is contained, never a crash", () => {
  it("B. renders the controlled not_found state for dog/42", () => {
    // The decoded form of /health/nutrition/dogs/dog%2F42.
    render(<NutritionDogView dogId="dog/42" />);

    expect(screen.getByTestId("nutrition-dog-not-found")).toBeInTheDocument();
    expect(screen.getByText("K9 não encontrado")).toBeInTheDocument();
  });

  it("C. never calls doc() with an invalid dogId", () => {
    render(<NutritionDogView dogId="dog/42" />);

    // The guard must run BEFORE the SDK is touched: no reference is built at all.
    expect(mockDoc).not.toHaveBeenCalled();
    expect(mockGetDoc).not.toHaveBeenCalled();
  });

  it("D. throws no FirebaseError while rendering an invalid deep link", () => {
    // The regression was a synchronous throw during render/effect.
    expect(() => render(<NutritionDogView dogId="dog/42" />)).not.toThrow();
    expect(screen.getByTestId("nutrition-dog-not-found")).toBeInTheDocument();
  });

  it("E. keeps the Health shell rendered around the not_found state", () => {
    render(<NutritionDogView dogId="dog/42" />);

    // Shell + secondary navigation survive: the module is not taken down.
    expect(screen.getByTestId("health-module-shell")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: /navegação secundária de saúde/i }),
    ).toBeInTheDocument();
    // And no cross-navigation is offered for a K9 that does not resolve.
    expect(screen.queryByTestId("nutrition-to-cockpit-link")).not.toBeInTheDocument();
  });

  it("F. treats the decoded form of an encoded URL segment as invalid", () => {
    // The route decodes before handing the param to the view; the hook must
    // judge the DECODED value, which is what would reach Firestore.
    const decoded = decodeURIComponent("dog%2F42");
    expect(decoded).toBe("dog/42");

    render(<NutritionDogView dogId={decoded} />);
    expect(screen.getByTestId("nutrition-dog-not-found")).toBeInTheDocument();
    expect(mockDoc).not.toHaveBeenCalled();
  });

  it("contains every unusable id shape without a single SDK call", () => {
    for (const dogId of INVALID_IDS) {
      mockDoc.mockClear();
      mockGetDoc.mockReset();

      const { unmount } = render(<NutritionDogView dogId={dogId} />);
      expect(screen.getByTestId("nutrition-dog-not-found")).toBeInTheDocument();
      expect(mockDoc).not.toHaveBeenCalled();
      expect(mockGetDoc).not.toHaveBeenCalled();
      unmount();
    }
  });

  it("does not present an invalid id as a technical error", () => {
    render(<NutritionDogView dogId="dog/42" />);

    // `error` would leak "something broke"; `not_found` is the controlled truth.
    expect(screen.queryByText(/não foi possível resolver o contexto/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/invalid document reference/i)).not.toBeInTheDocument();
  });
});

describe("NUT-WEB-5B.F — valid dogId behaviour is preserved", () => {
  it("A. still resolves a valid K9 through the institutional read", async () => {
    mockGetDoc.mockResolvedValue({
      id: "test-dog",
      exists: () => true,
      data: () => ({ name: "Bono E2E", rg: "111222" }),
    });

    render(<NutritionDogView dogId="test-dog" />);

    await waitFor(() => {
      expect(screen.getByText("Bono E2E")).toBeInTheDocument();
    });

    // The canonical single-document path, unchanged by the guard.
    expect(mockDoc).toHaveBeenCalledWith({}, "dogs", "test-dog");
    expect(screen.queryByTestId("nutrition-dog-not-found")).not.toBeInTheDocument();
    // Cross-navigation returns once the context resolves.
    expect(screen.getByTestId("nutrition-to-cockpit-link")).toHaveAttribute(
      "href",
      "/health/readiness/test-dog",
    );
  });

  it("still reports not_found for a valid id that does not exist", async () => {
    mockGetDoc.mockResolvedValue({ id: "ghost", exists: () => false, data: () => ({}) });

    render(<NutritionDogView dogId="ghost" />);

    await waitFor(() => {
      expect(screen.getByTestId("nutrition-dog-not-found")).toBeInTheDocument();
    });
    // A valid id IS looked up: the guard must not over-reject.
    expect(mockDoc).toHaveBeenCalledWith({}, "dogs", "ghost");
  });

  it("still surfaces a genuine read failure as a technical error", async () => {
    mockGetDoc.mockRejectedValue(new Error("permission-denied"));

    render(<NutritionDogView dogId="test-dog" />);

    await waitFor(() => {
      expect(screen.getByText(/não foi possível resolver o contexto/i)).toBeInTheDocument();
    });
    // Real failures must stay distinguishable from an invalid id.
    expect(screen.queryByTestId("nutrition-dog-not-found")).not.toBeInTheDocument();
  });

  it("accepts ids with characters that are legal in one segment", async () => {
    mockGetDoc.mockResolvedValue({
      id: "cão-ç_7.b",
      exists: () => true,
      data: () => ({ name: "Ferro" }),
    });

    render(<NutritionDogView dogId="cão-ç_7.b" />);

    await waitFor(() => {
      expect(screen.getByText("Ferro")).toBeInTheDocument();
    });
    // Only "/" is rejected — the guard is not an arbitrary business validator.
    expect(mockDoc).toHaveBeenCalledWith({}, "dogs", "cão-ç_7.b");
  });
});
