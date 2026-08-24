/**
 * K9 Ops Web — Health Web v1 / WEB-01B.2
 * Nutrition routing contract.
 *
 * Replaces the pre-Foundation `nutrition-page-url` test: the old `?dogId=`
 * contract is no longer valid. The canonical individual context is exclusively
 * the route param of /health/nutrition/dogs/[dogId].
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { paths } from "../../domain/paths";

vi.mock("firebase/app", () => ({ initializeApp: vi.fn(), getApps: () => [], getApp: vi.fn() }));
vi.mock("firebase/auth", () => ({ getAuth: vi.fn() }));
vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(),
  collection: vi.fn(),
  onSnapshot: vi.fn(() => () => {}),
  doc: vi.fn(),
  getDoc: vi.fn(),
}));
vi.mock("firebase/storage", () => ({ getStorage: vi.fn() }));
vi.mock("@/lib/firebase/client", () => ({ db: {}, auth: {}, storage: {} }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/health/nutrition",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const mockDogView = vi.fn();
vi.mock("../presentation/nutrition-dog-view", () => ({
  NutritionDogView: (props: { dogId: string }) => {
    mockDogView(props);
    return <div data-testid="nutrition-dog-view">{props.dogId}</div>;
  },
}));

vi.mock("../presentation/nutrition-landing-view", () => ({
  NutritionLandingView: () => <div data-testid="nutrition-landing-view" />,
}));

const NutritionDogPage = (await import("@/app/(app)/health/nutrition/dogs/[dogId]/page")).default;
const HealthNutritionPage = (await import("@/app/(app)/health/nutrition/page")).default;

describe("WEB-01B.2 — canonical nutrition paths", () => {
  it("exposes the individual route under /health/nutrition/dogs/", () => {
    expect(paths.health_nutrition_dog("dog-1")).toBe("/health/nutrition/dogs/dog-1");
  });

  it("never builds a ?dogId= query contract", () => {
    expect(paths.health_nutrition_dog("dog-1")).not.toContain("?dogId=");
  });

  it("encodes dog ids with special characters", () => {
    expect(paths.health_nutrition_dog("dog/42")).toBe("/health/nutrition/dogs/dog%2F42");
  });
});

describe("WEB-01B.2 — /health/nutrition landing", () => {
  it("renders the submodule landing inside the Health shell", async () => {
    render(await HealthNutritionPage());
    expect(screen.getByTestId("nutrition-landing-view")).toBeInTheDocument();
    // Health secondary navigation is present, i.e. we are inside the shell.
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });
});

describe("WEB-01B.2 — /health/nutrition/dogs/[dogId]", () => {
  beforeEach(() => {
    mockDogView.mockClear();
  });

  it("takes the dogId from the route param", async () => {
    render(await NutritionDogPage({ params: Promise.resolve({ dogId: "dog-77" }) }));
    expect(mockDogView).toHaveBeenCalledWith({ dogId: "dog-77" });
    expect(screen.getByTestId("nutrition-dog-view")).toHaveTextContent("dog-77");
  });

  it("decodes an encoded route param", async () => {
    render(await NutritionDogPage({ params: Promise.resolve({ dogId: "dog%2F42" }) }));
    expect(mockDogView).toHaveBeenCalledWith({ dogId: "dog/42" });
  });

  it("resolves a different dog when the route changes", async () => {
    render(await NutritionDogPage({ params: Promise.resolve({ dogId: "dog-A" }) }));
    expect(mockDogView).toHaveBeenLastCalledWith({ dogId: "dog-A" });

    render(await NutritionDogPage({ params: Promise.resolve({ dogId: "dog-B" }) }));
    expect(mockDogView).toHaveBeenLastCalledWith({ dogId: "dog-B" });
  });
});
