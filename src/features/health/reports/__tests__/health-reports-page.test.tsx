/**
 * K9 Ops Web — Health Web v1 F30 Reports
 * /health/reports Page Route test.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HealthReportsPage from "@/app/(app)/health/reports/page";
import type { UseHealthReportsDataResult } from "../hooks/use-health-reports-data";

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
    profile: { id: "admin", permissions: { health: { read: true }, reports: { export: true } } },
  }),
}));

const mockUseHealthReportsData = vi.fn();
vi.mock("../hooks/use-health-reports-data", () => ({
  useHealthReportsData: () => mockUseHealthReportsData(),
}));

describe("HealthReportsPage (/health/reports)", () => {
  it("mounts inside HealthModuleShell and renders HealthReportsView", () => {
    const hookResult: UseHealthReportsDataResult = {
      state: { status: "loading" },
      authorityStatus: "allowed",
      exportAuthority: { canExport: true, hasCanonicalRead: true, hasExportCapability: true },
      period: "7d",
      setPeriod: vi.fn(),
      refresh: vi.fn(),
    };
    mockUseHealthReportsData.mockReturnValue(hookResult);

    render(<HealthReportsPage />);

    expect(screen.getByRole("heading", { name: "Relatórios" })).toBeDefined();
    expect(screen.getByText("Análises operacionais e exportações autorizadas")).toBeDefined();
    expect(screen.getByText(/Consolidando dados operacionais dos relatórios de saúde.../i)).toBeDefined();
  });
});
