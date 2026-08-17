import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AccessModuleId } from "@/lib/permissions/access-control";

let allowedModules: AccessModuleId[] = [];
let accessStatus: "loading" | "ready" = "ready";

const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock("@/features/access/providers/access-control-provider", () => ({
  useAccessControl: () => ({
    can: (moduleId: AccessModuleId) => allowedModules.includes(moduleId),
    status: accessStatus,
  }),
}));

const { default: EffectivePage } = await import("@/app/(app)/effective/page");

beforeEach(() => {
  allowedModules = ["k9", "humans", "binomials", "vehicles"];
  accessStatus = "ready";
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("resolução de destino", () => {
  it("redireciona para /k9 quando k9/view está liberado", () => {
    render(<EffectivePage />);

    expect(mockReplace).toHaveBeenCalledExactlyOnceWith("/k9");
  });

  it("redireciona para o primeiro núcleo permitido quando k9 está bloqueado", () => {
    allowedModules = ["humans", "vehicles"];
    render(<EffectivePage />);

    expect(mockReplace).toHaveBeenCalledExactlyOnceWith("/humans");
  });

  it("redireciona para viaturas quando é o único núcleo liberado", () => {
    allowedModules = ["vehicles"];
    render(<EffectivePage />);

    expect(mockReplace).toHaveBeenCalledExactlyOnceWith("/vehicles");
  });

  it("usa replace para não criar laço com o botão voltar", () => {
    render(<EffectivePage />);

    expect(mockReplace).toHaveBeenCalledWith("/k9");
    // Nunca redireciona para si mesmo.
    expect(mockReplace).not.toHaveBeenCalledWith("/effective");
  });
});

describe("fail-closed", () => {
  it("não redireciona quando nenhum núcleo está liberado", () => {
    allowedModules = [];
    render(<EffectivePage />);

    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.getByText("Nenhum núcleo liberado")).toBeInTheDocument();
  });

  it("aguarda a resolução do acesso antes de decidir", () => {
    accessStatus = "loading";
    render(<EffectivePage />);

    expect(mockReplace).not.toHaveBeenCalled();
    expect(
      screen.getByText("Resolvendo acesso aos núcleos do efetivo..."),
    ).toBeInTheDocument();
  });
});

describe("remoção do hub", () => {
  it("não renderiza mais o header, o badge nem os quatro cards", () => {
    render(<EffectivePage />);

    expect(
      screen.queryByText("Gestão do efetivo operacional"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("4 núcleos")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /K9/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Viaturas/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Binômios/ }),
    ).not.toBeInTheDocument();
  });
});
