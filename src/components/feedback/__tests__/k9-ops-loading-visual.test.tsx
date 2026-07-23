import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { K9OpsLoadingVisual } from "../k9-ops-loading-visual";

const mockUseReducedMotion = vi.fn(() => false);

vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>(
    "framer-motion",
  );
  return {
    ...actual,
    useReducedMotion: () => mockUseReducedMotion(),
  };
});

afterEach(() => {
  cleanup();
  mockUseReducedMotion.mockReturnValue(false);
});

describe("K9OpsLoadingVisual — comportamento de mídia e fallbacks", () => {
  it("1. comportamento padrão renderiza o Animated WebP oficial", () => {
    render(<K9OpsLoadingVisual />);

    const img = screen.getByAltText("Malinois K9 Ops — carregando sistema");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute(
      "src",
      "/assets/loading/k9_ops_loading_dog_animated.webp",
    );
  });

  it("2. reduced motion (useReducedMotion = true) alterna para o PNG estático oficial", () => {
    mockUseReducedMotion.mockReturnValue(true);

    render(<K9OpsLoadingVisual />);

    const img = screen.getByAltText("Malinois K9 Ops — carregando sistema");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute(
      "src",
      "/assets/loading/k9_ops_loading_dog_static_v1.png",
    );
  });

  it("3. src customizado (override) continua sendo respeitado", () => {
    render(<K9OpsLoadingVisual src="/custom/path/dog.webp" />);

    const img = screen.getByAltText("Malinois K9 Ops — carregando sistema");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "/custom/path/dog.webp");
  });

  it("4. erro no WebP animado faz fallback automático para o PNG estático", () => {
    render(<K9OpsLoadingVisual />);

    const img = screen.getByAltText("Malinois K9 Ops — carregando sistema");
    expect(img).toHaveAttribute(
      "src",
      "/assets/loading/k9_ops_loading_dog_animated.webp",
    );

    // Simula erro no carregamento do WebP
    fireEvent.error(img);

    const fallbackImg = screen.getByAltText(
      "Malinois K9 Ops — carregando sistema",
    );
    expect(fallbackImg).toHaveAttribute(
      "src",
      "/assets/loading/k9_ops_loading_dog_static_v1.png",
    );
  });

  it("5. erro final no PNG estático preserva o fallback SVG neutro", () => {
    render(<K9OpsLoadingVisual />);

    const img = screen.getByAltText("Malinois K9 Ops — carregando sistema");

    // Primeiro erro: falha no WebP -> muda para PNG
    fireEvent.error(img);

    // Segundo erro: falha no PNG -> exibe SVG neutro
    const pngImg = screen.getByAltText("Malinois K9 Ops — carregando sistema");
    fireEvent.error(pngImg);

    expect(
      screen.queryByAltText("Malinois K9 Ops — carregando sistema"),
    ).not.toBeInTheDocument();
  });
});
