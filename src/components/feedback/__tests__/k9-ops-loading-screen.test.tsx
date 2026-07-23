import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { K9OpsLoadingScreen } from "../k9-ops-loading-screen";

afterEach(cleanup);

describe("K9OpsLoadingScreen — estrutura visual", () => {
  it("renderiza título e footer oficiais", () => {
    render(<K9OpsLoadingScreen />);

    expect(
      screen.getByText("PREPARANDO PAINEL OPERACIONAL..."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("K9 OPS • INTELLIGENCE IN MOTION"),
    ).toBeInTheDocument();
  });

  it("renderiza as 3 etapas oficiais", () => {
    render(<K9OpsLoadingScreen />);

    expect(screen.getByText("Validando acesso")).toBeInTheDocument();
    expect(screen.getByText("Carregando permissões")).toBeInTheDocument();
    expect(screen.getByText("Sincronizando módulos")).toBeInTheDocument();
  });

  it("exibe build quando fornecido", () => {
    render(<K9OpsLoadingScreen build="BUILD 2.4.7" />);

    expect(screen.getByText(/BUILD 2\.4\.7/)).toBeInTheDocument();
  });
});

describe("K9OpsLoadingScreen — estágios", () => {
  it("validatingAccess não marca etapas como concluídas", () => {
    render(<K9OpsLoadingScreen stage="validatingAccess" />);

    expect(
      screen.getByLabelText("Validando acesso: em andamento"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Carregando permissões: pendente"),
    ).toBeInTheDocument();
  });

  it("loadingPermissions conclui a primeira etapa", () => {
    render(<K9OpsLoadingScreen stage="loadingPermissions" />);

    expect(
      screen.getByLabelText("Validando acesso: concluído"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Carregando permissões: em andamento"),
    ).toBeInTheDocument();
  });

  it("ready conclui todas as etapas", () => {
    render(<K9OpsLoadingScreen stage="ready" />);

    expect(
      screen.getByLabelText("Validando acesso: concluído"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Carregando permissões: concluído"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Sincronizando módulos: concluído"),
    ).toBeInTheDocument();
  });

  it("error exibe mensagem e oculta etapas", () => {
    render(
      <K9OpsLoadingScreen stage="error" errorMessage="Falha de conexão" />,
    );

    expect(screen.getByText("Falha de conexão")).toBeInTheDocument();
    expect(screen.queryByText("Validando acesso")).not.toBeInTheDocument();
  });

  it("error exibe retry e dispara callback", () => {
    const onRetry = vi.fn();
    render(<K9OpsLoadingScreen stage="error" onRetry={onRetry} />);

    const button = screen.getByRole("button", { name: "Tentar novamente" });
    fireEvent.click(button);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("error sem callback não exibe retry", () => {
    render(<K9OpsLoadingScreen stage="error" />);

    expect(
      screen.queryByRole("button", { name: "Tentar novamente" }),
    ).not.toBeInTheDocument();
  });
});

describe("K9OpsLoadingScreen — progresso externo", () => {
  it("exibe percentual quando progress é fornecido", () => {
    render(<K9OpsLoadingScreen progress={0.45} />);

    expect(screen.getByText("45%")).toBeInTheDocument();
  });

  it("não exibe percentual em modo indeterminado", () => {
    render(<K9OpsLoadingScreen />);

    expect(screen.queryByText(/%$/)).not.toBeInTheDocument();
  });

  it("clampa progress acima de 1.0", () => {
    render(<K9OpsLoadingScreen progress={1.5} />);

    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("clampa progress abaixo de 0.0", () => {
    render(<K9OpsLoadingScreen progress={-0.1} />);

    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});

describe("K9OpsLoadingScreen — mensagem de status", () => {
  it("exibe mensagem explícita quando fornecida", () => {
    render(<K9OpsLoadingScreen message="Finalizando inicialização..." />);

    expect(
      screen.getByText("Finalizando inicialização..."),
    ).toBeInTheDocument();
  });
});

describe("K9OpsLoadingScreen — asset injetável e fallback oficial", () => {
  it("renderiza o visual oficial quando visual não é fornecido", () => {
    render(<K9OpsLoadingScreen />);

    const img = screen.getByAltText("Malinois K9 Ops — carregando sistema");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute(
      "src",
      "/assets/loading/k9_ops_loading_dog_animated.webp",
    );
  });

  it("renderiza visual customizado quando prop visual é fornecida", () => {
    render(
      <K9OpsLoadingScreen
        visual={<div data-testid="malinois-override">dog</div>}
      />,
    );

    expect(screen.getByTestId("malinois-override")).toBeInTheDocument();
    expect(
      screen.queryByAltText("Malinois K9 Ops — carregando sistema"),
    ).not.toBeInTheDocument();
  });

  it("opera normalmente sem biblioteca Lottie", () => {
    render(<K9OpsLoadingScreen />);

    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});

describe("K9OpsLoadingScreen — acessibilidade", () => {
  it("expõe region de status com aria-live", () => {
    render(<K9OpsLoadingScreen />);

    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
  });
});
