import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import Loading from "../loading";

afterEach(cleanup);

describe("Route-level Loading — Integração com K9OpsLoadingScreen", () => {
  it("renderiza K9OpsLoadingScreen com stage syncingModules e 95% de progresso", () => {
    render(<Loading />);

    expect(screen.getByText("PREPARANDO PAINEL OPERACIONAL...")).toBeInTheDocument();
    expect(screen.getByText("Sincronizando módulos")).toBeInTheDocument();
    expect(screen.getByText("95%")).toBeInTheDocument();
  });
});
