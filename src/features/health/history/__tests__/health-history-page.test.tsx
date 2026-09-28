/**
 * K9 Ops Web — Health Web v1 F30 History
 * /health/history Page Route test.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HealthHistoryPage from "@/app/(app)/health/history/page";
import type { UseHealthHistoryDataResult } from "../hooks/use-health-history-data";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("@/features/access/providers/access-control-provider", () => ({
  useAccessControl: () => ({
    can: () => true,
    status: "ready",
    profile: { id: "admin", permissions: { health: { view: true } } },
  }),
}));

const mockUseHealthHistoryData = vi.fn();
vi.mock("../hooks/use-health-history-data", () => ({
  useHealthHistoryData: () => mockUseHealthHistoryData(),
}));

describe("HealthHistoryPage (/health/history)", () => {
  it("mounts inside HealthModuleShell and renders HealthHistoryView terminating loading truthfully", () => {
    const hookResult: UseHealthHistoryDataResult = {
      state: { status: "loading" },
      authorityStatus: "allowed",
      filter: { category: "all", period: "all", search: "" },
      setCategory: vi.fn(),
      setPeriod: vi.fn(),
      setSearch: vi.fn(),
      resetFilters: vi.fn(),
      refresh: vi.fn(),
    };
    mockUseHealthHistoryData.mockReturnValue(hookResult);

    render(<HealthHistoryPage />);

    expect(screen.getByRole("heading", { name: "Histórico" })).toBeDefined();
    expect(screen.getByText("Timeline unificada do domínio Health")).toBeDefined();
    expect(screen.getByText(/Carregando histórico do domínio Health.../i)).toBeDefined();
  });
});
