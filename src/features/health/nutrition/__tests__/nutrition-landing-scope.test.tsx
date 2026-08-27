/**
 * K9 Ops Web — Health Web v1 / HW-6A.H1.FIX1
 * Nutrition landing scope alignment.
 *
 * An `own_records` persona loads the whole institutional roster (`dogs` is
 * readable by any signed in user) but may only inspect the K9s that
 * `canAccessDogRecord` authorizes. These tests pin the landing to the server's
 * own per-dog verdict.
 *
 * DELIBERATELY NOT OVERMOCKED: `loadReadinessScope` is the REAL loader and
 * `NutritionLandingView` the REAL component. Only the Firestore transport is
 * faked, so the authorization outcome travels the genuine path
 * (reader -> dataQuality -> visibility -> render). A test that stubbed the
 * loader would assert nothing about the actual presentation contract.
 */

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const AUTHORIZED_DOG = "stg-fixture-dog-linked";
const FOREIGN_DOG = "stg-k9-edit-fixture";

/** Dog ids whose per-dog projection reads are denied, as Rules would. */
let deniedDogIds: Set<string>;
/** Dog ids whose per-dog reads fail technically (NOT a denial). */
let failingDogIds: Set<string>;
/** Institutional roster returned by the `dogs` collection read. */
let rosterDogs: Array<{ id: string; data: Record<string, unknown> }>;

function permissionDenied(): Error {
  const err = new Error(
    "FirebaseError: Missing or insufficient permissions.",
  ) as Error & { code: string };
  err.code = "permission-denied";
  return err;
}

vi.mock("firebase/app", () => ({
  initializeApp: vi.fn(),
  getApps: () => [],
  getApp: vi.fn(),
}));
vi.mock("firebase/auth", () => ({ getAuth: vi.fn() }));
vi.mock("firebase/storage", () => ({ getStorage: vi.fn() }));
vi.mock("@/lib/firebase/client", () => ({ db: {}, auth: {}, storage: {} }));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

/**
 * Minimal Firestore transport.
 *
 * `collection("dogs")` -> roster. Any per-dog `doc(...)` path resolves against
 * the denied/failing sets so a denial reaches the real reader as a real throw.
 */
vi.mock("firebase/firestore", () => {
  return {
    getFirestore: vi.fn(),
    collection: (_db: unknown, path: string) => ({ __collection: path }),
    doc: (_db: unknown, ...segments: string[]) => ({
      __doc: segments.join("/"),
      __dogId: segments[1],
    }),
    getDocs: async (ref: { __collection?: string }) => {
      if (ref?.__collection === "dogs") {
        return {
          empty: rosterDogs.length === 0,
          docs: rosterDogs.map((dog) => ({
            id: dog.id,
            data: () => dog.data,
          })),
        };
      }
      // Subcollection reads (operational_restrictions) follow the same authority.
      return { empty: true, docs: [] };
    },
    getDoc: async (ref: { __dogId?: string }) => {
      const dogId = ref?.__dogId ?? "";
      if (deniedDogIds.has(dogId)) throw permissionDenied();
      if (failingDogIds.has(dogId)) throw new Error("network transport failure");
      return { exists: () => false };
    },
    query: (...args: unknown[]) => ({ __query: args }),
    where: (...args: unknown[]) => ({ __where: args }),
    orderBy: (...args: unknown[]) => ({ __orderBy: args }),
    limit: (...args: unknown[]) => ({ __limit: args }),
    onSnapshot: vi.fn(() => () => {}),
    Timestamp: { fromDate: (d: Date) => d, now: () => new Date() },
  };
});

const { NutritionLandingView } = await import(
  "../presentation/nutrition-landing-view"
);
const { selectVisibleNutritionDogs, describeNutritionExclusions } = await import(
  "../presentation/nutrition-scope-visibility"
);

beforeEach(() => {
  deniedDogIds = new Set();
  failingDogIds = new Set();
  rosterDogs = [
    {
      id: AUTHORIZED_DOG,
      data: { name: "STG Fixture Dog Linked", rg: "K9-0001", conductorRa: "990001" },
    },
    {
      id: FOREIGN_DOG,
      data: { name: "STG K9 Edit Fixture", rg: "K9-0002", conductorRa: "990999" },
    },
  ];
});

describe("FIX1 §F1 — global scope", () => {
  it("renders every dog returned by the loader when nothing is denied", async () => {
    render(<NutritionLandingView />);

    await waitFor(() => {
      expect(screen.getByTestId("nutrition-dog-list")).toBeInTheDocument();
    });

    expect(screen.getByText("STG Fixture Dog Linked")).toBeInTheDocument();
    expect(screen.getByText("STG K9 Edit Fixture")).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("shows no partial-coverage notice under full coverage (§F5 no regression)", async () => {
    render(<NutritionLandingView />);

    await waitFor(() => {
      expect(screen.getByTestId("nutrition-dog-list")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("nutrition-partial-notice")).not.toBeInTheDocument();
  });
});

describe("FIX1 §F2 — own_records with one authorized + one foreign", () => {
  beforeEach(() => {
    deniedDogIds.add(FOREIGN_DOG);
  });

  it("renders the authorized dog and withholds the foreign one", async () => {
    render(<NutritionLandingView />);

    await waitFor(() => {
      expect(screen.getByTestId("nutrition-dog-list")).toBeInTheDocument();
    });

    expect(screen.getByText("STG Fixture Dog Linked")).toBeInTheDocument();
    expect(screen.queryByText("STG K9 Edit Fixture")).not.toBeInTheDocument();
  });

  it("states a truthful exclusion count in a non-error notice", async () => {
    render(<NutritionLandingView />);

    const notice = await screen.findByTestId("nutrition-partial-notice");
    expect(notice).toHaveTextContent("Cobertura parcial");
    expect(notice).toHaveTextContent("Não incluído: 1 K9 não autorizado.");
    // Informational, not an error surface.
    expect(notice).toHaveAttribute("role", "status");
  });

  it("§F4 — the excluded dog produces no navigation target", async () => {
    render(<NutritionLandingView />);

    await waitFor(() => {
      expect(screen.getByTestId("nutrition-dog-list")).toBeInTheDocument();
    });

    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toHaveLength(1);
    expect(hrefs[0]).toContain(encodeURIComponent(AUTHORIZED_DOG));
    expect(hrefs.join(" ")).not.toContain(FOREIGN_DOG);
  });

  it("§F6 — leaks no metadata of the excluded dog anywhere in the DOM", async () => {
    const { container } = render(<NutritionLandingView />);

    await screen.findByTestId("nutrition-partial-notice");

    const html = container.innerHTML;
    expect(html).not.toContain("STG K9 Edit Fixture");
    expect(html).not.toContain(FOREIGN_DOG);
    // Matrícula of the excluded K9 must not appear either.
    expect(html).not.toContain("K9-0002");
  });
});

describe("FIX1 §F3 — own_records with zero authorized dogs", () => {
  beforeEach(() => {
    deniedDogIds.add(AUTHORIZED_DOG);
    deniedDogIds.add(FOREIGN_DOG);
  });

  it("shows an honest empty state with no foreign cards", async () => {
    render(<NutritionLandingView />);

    expect(
      await screen.findByText(
        "Nenhum K9 no escopo autorizado para consulta de nutrição.",
      ),
    ).toBeInTheDocument();

    expect(screen.queryByTestId("nutrition-dog-list")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.queryByText("STG K9 Edit Fixture")).not.toBeInTheDocument();
  });

  it("does not present a firestore-read-error merely because foreign dogs exist", async () => {
    const { container } = render(<NutritionLandingView />);

    await screen.findByText(
      "Nenhum K9 no escopo autorizado para consulta de nutrição.",
    );

    const html = container.innerHTML.toLowerCase();
    expect(html).not.toContain("firestore-read-error");
    expect(html).not.toContain("firestore_read_error");
    expect(html).not.toContain("não foi possível carregar o efetivo");
  });

  it("still counts the exclusions truthfully", async () => {
    render(<NutritionLandingView />);

    const notice = await screen.findByTestId("nutrition-partial-notice");
    expect(notice).toHaveTextContent("Não incluído: 2 K9 não autorizados.");
  });
});

describe("FIX1 — a technical failure is never a denial", () => {
  it("keeps an undetermined dog visible and reports it separately", async () => {
    failingDogIds.add(FOREIGN_DOG);

    render(<NutritionLandingView />);

    await waitFor(() => {
      expect(screen.getByTestId("nutrition-dog-list")).toBeInTheDocument();
    });

    // Coverage is UNKNOWN, not forbidden: the dog is not silently withheld.
    expect(screen.getByText("STG K9 Edit Fixture")).toBeInTheDocument();
    const notice = screen.getByTestId("nutrition-partial-notice");
    expect(notice).toHaveTextContent("1 K9 com falha de leitura");
    expect(notice).not.toHaveTextContent("não autorizado");
  });
});

describe("FIX1 — pure visibility helper", () => {
  const item = (id: string, dataQuality: unknown) =>
    ({
      dog: { id, name: id, registrationNumber: null },
      dataQuality,
    }) as never;

  it("treats an authorized proven zero as visible", () => {
    const result = selectVisibleNutritionDogs([
      item("a", { status: "empty", query: "x" }),
    ]);
    expect(result.authorizedCount).toBe(1);
    expect(result.excludedCount).toBe(0);
  });

  it("classifies a wrapped permission denial as unauthorized", () => {
    const result = selectVisibleNutritionDogs([
      item("a", {
        status: "error",
        code: "FIRESTORE_READ_ERROR",
        message: "Falha ao ler prontidão: Missing or insufficient permissions.",
        technicalDetails: "FirebaseError: permission-denied",
        retryable: true,
      }),
    ]);
    expect(result.authorizedCount).toBe(0);
    expect(result.excludedCount).toBe(1);
    expect(result.undeterminedCount).toBe(0);
  });

  it("does not turn a transport error into a denial", () => {
    const result = selectVisibleNutritionDogs([
      item("a", {
        status: "error",
        code: "FIRESTORE_READ_ERROR",
        message: "network transport failure",
        retryable: true,
      }),
    ]);
    expect(result.excludedCount).toBe(0);
    expect(result.undeterminedCount).toBe(1);
    expect(result.authorizedCount).toBe(1);
  });

  it("preserves totalLoaded and input order", () => {
    const result = selectVisibleNutritionDogs([
      item("first", { status: "success", data: {}, fetchedAt: new Date() }),
      item("second", { status: "empty", query: "x" }),
    ]);
    expect(result.totalLoaded).toBe(2);
    expect(result.visibleDogs.map((d) => d.id)).toEqual(["first", "second"]);
  });

  it("emits no notice when coverage is complete", () => {
    expect(
      describeNutritionExclusions({ excludedCount: 0, undeterminedCount: 0 }),
    ).toBeNull();
  });

  it("pluralizes and never includes dog identifiers", () => {
    const text = describeNutritionExclusions({
      excludedCount: 3,
      undeterminedCount: 1,
    });
    expect(text).toBe(
      "Não incluído: 3 K9 não autorizados · 1 K9 com falha de leitura.",
    );
  });
});
