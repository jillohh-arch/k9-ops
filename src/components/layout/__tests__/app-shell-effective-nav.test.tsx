import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AccessModuleId } from "@/lib/permissions/access-control";

let mockPathname = "/dashboard";
let allowedModules: AccessModuleId[] | "all" = "all";

const mockReplace = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

vi.mock("next/image", () => ({
  default: () => <span data-testid="image" />,
}));

vi.mock("@/features/auth/providers/auth-provider", () => ({
  useAuth: () => ({
    profile: { displayName: "Ragonha", photoUrl: null, ra: "691755" },
    signOut: vi.fn(),
    status: "authenticated",
  }),
}));

vi.mock("@/features/access/providers/access-control-provider", () => ({
  useAccessControl: () => ({
    can: (moduleId: AccessModuleId) =>
      allowedModules === "all" || allowedModules.includes(moduleId),
    status: "ready",
  }),
}));

// O shell abre listeners de notificação; o Firestore é irrelevante aqui.
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({})),
  onSnapshot: vi.fn(() => () => undefined),
  orderBy: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
}));

vi.mock("@/lib/firebase/client", () => ({ db: {} }));

const { AppShell } = await import("@/components/layout/app-shell");

/** A sidebar desktop é a primeira ocorrência; a mobile é duplicada no shell. */
function desktopSidebar() {
  return screen.getAllByRole("navigation")[0];
}

function effectiveToggle() {
  return within(desktopSidebar()).getAllByRole("button", {
    name: /Efetivo/,
  })[0];
}

beforeEach(() => {
  mockPathname = "/dashboard";
  allowedModules = "all";
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderShell() {
  return render(
    <AppShell>
      <div>Conteúdo</div>
    </AppShell>,
  );
}

describe("grupo Efetivo — expansão", () => {
  it("inicia recolhido fora das rotas do Efetivo, com aria-expanded=false", () => {
    renderShell();
    const toggle = effectiveToggle();

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(
      within(desktopSidebar()).queryByRole("link", { name: "Efetivo K9" }),
    ).not.toBeInTheDocument();
  });

  it("expande ao clicar e revela os quatro subitens", () => {
    renderShell();

    fireEvent.click(effectiveToggle());

    expect(effectiveToggle()).toHaveAttribute("aria-expanded", "true");
    const sidebar = desktopSidebar();
    expect(
      within(sidebar).getByRole("link", { name: "Efetivo K9" }),
    ).toHaveAttribute("href", "/k9");
    expect(
      within(sidebar).getByRole("link", { name: "Efetivo Humano" }),
    ).toHaveAttribute("href", "/humans");
    expect(
      within(sidebar).getByRole("link", { name: "Binômios" }),
    ).toHaveAttribute("href", "/binomials");
    expect(
      within(sidebar).getByRole("link", { name: "Viaturas" }),
    ).toHaveAttribute("href", "/vehicles");
  });

  it("recolhe ao clicar novamente", () => {
    renderShell();

    fireEvent.click(effectiveToggle());
    expect(effectiveToggle()).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(effectiveToggle());
    expect(effectiveToggle()).toHaveAttribute("aria-expanded", "false");
    expect(
      within(desktopSidebar()).queryByRole("link", { name: "Efetivo K9" }),
    ).not.toBeInTheDocument();
  });

  it("é acionável por teclado e recebe foco", () => {
    renderShell();

    const toggle = effectiveToggle();
    toggle.focus();
    expect(toggle).toHaveFocus();

    // Sendo um <button> nativo, Enter e Espaço disparam o click do navegador.
    // Verificamos o elemento correto e o acionamento por teclado via click.
    expect(toggle.tagName).toBe("BUTTON");
    expect(toggle).not.toHaveAttribute("tabindex", "-1");

    fireEvent.click(toggle);
    expect(effectiveToggle()).toHaveAttribute("aria-expanded", "true");
  });

  it("o toggle controla o painel que lista os filhos", () => {
    renderShell();
    fireEvent.click(effectiveToggle());

    const controlled = effectiveToggle().getAttribute("aria-controls");
    expect(controlled).toBeTruthy();
    expect(document.getElementById(controlled as string)).toBeTruthy();
  });
});

describe("autoexpansão e estado ativo", () => {
  it("/k9 autoexpande o pai e marca Efetivo K9 como ativo", () => {
    mockPathname = "/k9";
    renderShell();

    expect(effectiveToggle()).toHaveAttribute("aria-expanded", "true");
    expect(
      within(desktopSidebar()).getByRole("link", { name: "Efetivo K9" }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("/humans ativa Efetivo Humano", () => {
    mockPathname = "/humans";
    renderShell();

    const sidebar = desktopSidebar();
    expect(
      within(sidebar).getByRole("link", { name: "Efetivo Humano" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(sidebar).getByRole("link", { name: "Efetivo K9" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("/binomials ativa Binômios", () => {
    mockPathname = "/binomials";
    renderShell();

    expect(
      within(desktopSidebar()).getByRole("link", { name: "Binômios" }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("/vehicles ativa Viaturas", () => {
    mockPathname = "/vehicles";
    renderShell();

    expect(
      within(desktopSidebar()).getByRole("link", { name: "Viaturas" }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("subrota de perfil mantém o filho ativo", () => {
    mockPathname = "/k9/bono";
    renderShell();

    expect(effectiveToggle()).toHaveAttribute("aria-expanded", "true");
    expect(
      within(desktopSidebar()).getByRole("link", { name: "Efetivo K9" }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("pai e filho ativo têm estados visuais distintos", () => {
    mockPathname = "/k9";
    renderShell();

    const parentClasses = effectiveToggle().className;
    const childClasses = within(desktopSidebar())
      .getByRole("link", { name: "Efetivo K9" })
      .className;

    expect(parentClasses).not.toEqual(childClasses);
    // O filho recebe destaque mais compacto que o pai.
    expect(parentClasses).toContain("py-3.5");
    expect(childClasses).toContain("py-2.5");
  });
});

describe("permissão por filho", () => {
  it("esconde filhos sem permissão de visualização", () => {
    allowedModules = ["dashboard", "k9", "vehicles"];
    renderShell();

    fireEvent.click(effectiveToggle());
    const sidebar = desktopSidebar();

    expect(
      within(sidebar).getByRole("link", { name: "Efetivo K9" }),
    ).toBeInTheDocument();
    expect(
      within(sidebar).getByRole("link", { name: "Viaturas" }),
    ).toBeInTheDocument();
    expect(
      within(sidebar).queryByRole("link", { name: "Efetivo Humano" }),
    ).not.toBeInTheDocument();
    expect(
      within(sidebar).queryByRole("link", { name: "Binômios" }),
    ).not.toBeInTheDocument();
  });

  it("esconde o grupo inteiro quando nenhum núcleo é visível", () => {
    allowedModules = ["dashboard"];
    renderShell();

    expect(
      within(desktopSidebar()).queryByRole("button", { name: /Efetivo/ }),
    ).not.toBeInTheDocument();
  });
});

describe("shell mobile", () => {
  it("fecha o menu ao navegar para um filho", () => {
    renderShell();

    // Abre a sidebar mobile.
    fireEvent.click(
      screen.getByRole("button", { name: "Abrir menu principal" }),
    );
    const mobileToggleButton = screen.getByRole("button", {
      name: "Abrir menu principal",
    });
    expect(mobileToggleButton).toHaveAttribute("aria-expanded", "true");

    // A sidebar mobile é a segunda navegação renderizada.
    const mobileSidebar = screen.getAllByRole("navigation")[1];
    fireEvent.click(
      within(mobileSidebar).getAllByRole("button", { name: /Efetivo/ })[0],
    );
    // `preventDefault` evita que o jsdom tente navegar de verdade; o handler
    // de fechamento do menu roda igual.
    const childLink = within(mobileSidebar).getByRole("link", {
      name: "Efetivo K9",
    });
    childLink.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(childLink);

    expect(
      screen.getByRole("button", { name: "Abrir menu principal" }),
    ).toHaveAttribute("aria-expanded", "false");
  });
});
