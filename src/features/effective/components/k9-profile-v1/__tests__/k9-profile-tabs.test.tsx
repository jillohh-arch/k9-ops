import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useState } from "react";

import {
  K9ProfileTabPanel,
  K9ProfileTabs,
  type K9ProfileTab,
} from "@/features/effective/components/k9-profile-v1/k9-profile-tabs";

afterEach(cleanup);

/** Harness com o mesmo contrato do Perfil: aba ativa monta, as outras não. */
function Harness({ onRender }: { onRender?: (tab: K9ProfileTab) => void }) {
  const [tab, setTab] = useState<K9ProfileTab>("overview");
  onRender?.(tab);
  return (
    <>
      <K9ProfileTabs activeTab={tab} onChange={setTab} />
      <K9ProfileTabPanel tab={tab}>
        <p>Conteúdo de {tab}</p>
      </K9ProfileTabPanel>
    </>
  );
}

describe("K9ProfileTabs — acessibilidade", () => {
  it("expõe tablist com as cinco seções", () => {
    render(<Harness />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(5);
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Visão Geral",
      "Treinamento",
      "Saúde",
      "Histórico",
      "Documentos",
    ]);
  });

  it("marca aria-selected apenas na aba ativa", () => {
    render(<Harness />);

    expect(screen.getByRole("tab", { name: "Visão Geral" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Saúde" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("usa foco gerenciado: só a aba ativa é tabulável", () => {
    render(<Harness />);

    expect(screen.getByRole("tab", { name: "Visão Geral" })).toHaveAttribute(
      "tabindex",
      "0",
    );
    expect(screen.getByRole("tab", { name: "Histórico" })).toHaveAttribute(
      "tabindex",
      "-1",
    );
  });

  it("associa cada aba ao seu painel", () => {
    render(<Harness />);

    const tab = screen.getByRole("tab", { name: "Visão Geral" });
    const panel = screen.getByRole("tabpanel");
    expect(tab).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveAttribute("aria-labelledby", tab.id);
  });

  it("navega com as setas do teclado", () => {
    render(<Harness />);

    fireEvent.keyDown(screen.getByRole("tab", { name: "Visão Geral" }), {
      key: "ArrowRight",
    });
    expect(screen.getByRole("tab", { name: "Treinamento" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    fireEvent.keyDown(screen.getByRole("tab", { name: "Treinamento" }), {
      key: "ArrowLeft",
    });
    expect(screen.getByRole("tab", { name: "Visão Geral" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("Home e End saltam para a primeira e a última aba", () => {
    render(<Harness />);

    fireEvent.keyDown(screen.getByRole("tab", { name: "Visão Geral" }), {
      key: "End",
    });
    expect(screen.getByRole("tab", { name: "Documentos" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    fireEvent.keyDown(screen.getByRole("tab", { name: "Documentos" }), {
      key: "Home",
    });
    expect(screen.getByRole("tab", { name: "Visão Geral" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("as setas circulam nas extremidades", () => {
    render(<Harness />);

    fireEvent.keyDown(screen.getByRole("tab", { name: "Visão Geral" }), {
      key: "ArrowLeft",
    });
    expect(screen.getByRole("tab", { name: "Documentos" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});

describe("K9ProfileTabs — troca de conteúdo", () => {
  it("clique troca o painel exibido", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("tab", { name: "Saúde" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Conteúdo de health");
  });

  it("apenas um painel existe por vez (lazy por aba)", () => {
    const seen: K9ProfileTab[] = [];
    render(<Harness onRender={(tab) => seen.push(tab)} />);

    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);

    fireEvent.click(screen.getByRole("tab", { name: "Documentos" }));
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    expect(screen.getByRole("tabpanel")).toHaveTextContent(
      "Conteúdo de documents",
    );
    // A aba de Saúde nunca foi ativada, então seu conteúdo nunca montou.
    expect(seen).not.toContain("health");
  });
});
