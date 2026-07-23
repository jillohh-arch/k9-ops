import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthGate } from "../auth-gate";

const mockReplace = vi.fn();
let mockStatus: "loading" | "authenticated" | "unauthenticated" = "loading";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

vi.mock("@/features/auth/providers/auth-provider", () => ({
  useAuth: () => ({
    status: mockStatus,
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AuthGate — Integração com K9OpsLoadingScreen", () => {
  it("status 'loading': renderiza K9OpsLoadingScreen em validatingAccess / 30%", () => {
    mockStatus = "loading";
    render(
      <AuthGate>
        <div>Conteúdo Protegido</div>
      </AuthGate>,
    );

    expect(screen.getByText("PREPARANDO PAINEL OPERACIONAL...")).toBeInTheDocument();
    expect(screen.getByText("Validando acesso")).toBeInTheDocument();
    expect(screen.getByText("30%")).toBeInTheDocument();
    expect(screen.queryByText("Conteúdo Protegido")).not.toBeInTheDocument();
  });

  it("status 'unauthenticated': redireciona para login e não renderiza children", () => {
    mockStatus = "unauthenticated";
    render(
      <AuthGate>
        <div>Conteúdo Protegido</div>
      </AuthGate>,
    );

    expect(mockReplace).toHaveBeenCalledWith("/login?next=%2Fdashboard");
    expect(screen.queryByText("Conteúdo Protegido")).not.toBeInTheDocument();
  });

  it("status 'authenticated': renderiza os filhos normalmente", () => {
    mockStatus = "authenticated";
    render(
      <AuthGate>
        <div>Conteúdo Protegido</div>
      </AuthGate>,
    );

    expect(screen.getByText("Conteúdo Protegido")).toBeInTheDocument();
  });
});
