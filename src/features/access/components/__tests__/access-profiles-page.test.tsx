import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AccessUser } from "@/features/access/data/access-profile-service";
import type { AccessProfile } from "@/lib/permissions/access-control";

const {
  mockCan,
  mockAssignUserAccessProfile,
  mockSeedDefaultAccessProfiles,
  mockUnassignUserAccessProfile,
} = vi.hoisted(() => ({
  mockCan: vi.fn(),
  mockAssignUserAccessProfile: vi.fn(),
  mockSeedDefaultAccessProfiles: vi.fn(),
  mockUnassignUserAccessProfile: vi.fn(),
}));

let mockProfiles: AccessProfile[] = [];
let mockUsers: AccessUser[] = [];
const mockAuthProfile: { ra: string | null } | null = { ra: "990001" };

vi.mock("@/lib/firebase/client", () => ({
  auth: {},
  db: {},
  functions: {},
  storage: {},
}));

vi.mock("@/features/auth/providers/auth-provider", () => ({
  useAuth: () => ({ profile: mockAuthProfile }),
}));

vi.mock("@/features/access/providers/access-control-provider", () => ({
  useAccessControl: () => ({ can: mockCan }),
}));

vi.mock("@/features/access/hooks/use-access-profiles", () => ({
  useAccessProfiles: () => ({
    error: null,
    loading: false,
    profiles: mockProfiles,
  }),
}));

vi.mock("@/features/access/hooks/use-access-users", () => ({
  useAccessUsers: () => ({
    error: null,
    loading: false,
    users: mockUsers,
  }),
}));

vi.mock("@/features/access/data/access-profile-service", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/access/data/access-profile-service")
  >("@/features/access/data/access-profile-service");
  return {
    ...actual,
    assignUserAccessProfile: mockAssignUserAccessProfile,
    seedDefaultAccessProfiles: mockSeedDefaultAccessProfiles,
    unassignUserAccessProfile: mockUnassignUserAccessProfile,
  };
});

import { AccessProfilesPage } from "../access-profiles-page";

describe("AccessProfilesPage (F10.ACCESS-UX.IA-POLISH-V1)", () => {
  beforeEach(() => {
    mockCan.mockReset();
    mockAssignUserAccessProfile.mockReset();
    mockSeedDefaultAccessProfiles.mockReset();
    mockUnassignUserAccessProfile.mockReset();
    mockCan.mockImplementation((mod: string, act: string) => mod === "access" && act === "edit");

    mockProfiles = [
      {
        description: "Operador de cães de serviço",
        id: "operador_k9",
        level: "operacional",
        module_tags: ["k9"],
        name: "Operador",
        permissions: {
          k9: { view: true, create: true, edit: true },
        },
        role_keys: ["operador_k9"],
        seed_version: 2,
        slug: "operador_k9",
        status: "active",
        tone: "cyan",
      },
      {
        description: "Controle total da plataforma",
        id: "administrador",
        level: "máximo",
        module_tags: ["k9", "access", "reports"],
        name: "Administrador",
        permissions: {
          access: { view: true, create: true, edit: true, delete: true, export: true, approve: true, audit: true },
        },
        role_keys: ["administrador"],
        seed_version: 2,
        slug: "administrador",
        status: "active",
        tone: "amber",
      },
    ];

    mockUsers = [
      {
        accessLevel: "operacional",
        accessProfile: "operador_k9",
        accessProfileId: "operador_k9",
        active: true,
        callsign: "Condutor Alpha",
        fullName: "Agente Alpha",
        isK9Instructor: false,
        photoUrl: null,
        ra: "990011",
        role: "Operador",
        unit: "Canil",
      },
      {
        accessLevel: "máximo",
        accessProfile: "administrador",
        accessProfileId: "administrador",
        active: true,
        callsign: "Admin Beta",
        fullName: "Agente Beta",
        isK9Instructor: true,
        photoUrl: null,
        ra: "990012",
        role: "Administrador",
        unit: "Comando",
      },
      {
        accessLevel: null,
        accessProfile: null,
        accessProfileId: null,
        active: true,
        callsign: "Agente Novo Gamma",
        fullName: "Agente Gamma",
        isK9Instructor: false,
        photoUrl: null,
        ra: "990013",
        role: "Guarda Civil",
        unit: "GCM",
      },
    ];
  });

  afterEach(() => {
    cleanup();
  });

  // --- CANONICAL PRESERVED TESTS ---

  it("renderiza usuário vinculado no perfil selecionado com botão 'Desvincular' quando can('access','edit')", async () => {
    render(<AccessProfilesPage />);

    expect(screen.getAllByText("Condutor Alpha").length).toBeGreaterThanOrEqual(1);
    const unassignBtn = screen.getByRole("button", { name: /desvincular/i });
    expect(unassignBtn).toBeDefined();
    expect(unassignBtn.getAttribute("disabled")).toBeNull();
  });

  it("desabilita botão 'Desvincular' quando o usuário vinculado está inativo", async () => {
    mockUsers = [
      {
        ...mockUsers[0],
        active: false,
      },
    ];

    render(<AccessProfilesPage />);

    const unassignBtn = screen.getByRole("button", { name: /desvincular/i });
    expect(unassignBtn.getAttribute("disabled")).not.toBeNull();
    expect(unassignBtn.getAttribute("title")).toContain(
      "Reative o integrante antes de alterar o perfil de acesso.",
    );
  });

  it("abre modal com copy rigorosa de invariantes e invoca unassignUserAccessProfile ao confirmar", async () => {
    mockUnassignUserAccessProfile.mockResolvedValue({
      previousProfileId: "operador_k9",
      previousProfileName: "Operador",
      ra: "990011",
      unassigned: true,
    });

    render(<AccessProfilesPage />);

    const unassignBtn = screen.getByRole("button", { name: /desvincular/i });
    fireEvent.click(unassignBtn);

    // Modal dialog aberto com invariantes explicitados
    expect(screen.getByText(/Desvincular perfil de acesso/i)).toBeDefined();
    expect(screen.getByText(/Não provisionado/i)).toBeDefined();
    expect(screen.getByText(/não é desativado/i)).toBeDefined();
    expect(screen.getByText(/permanece inalterada/i)).toBeDefined();
    expect(screen.getByText(/não é removida/i)).toBeDefined();

    // Confirmar
    const confirmBtn = screen.getByRole("button", {
      name: /confirmar desvinculação/i,
    });
    fireEvent.click(confirmBtn);

    await waitFor(() =>
      expect(mockUnassignUserAccessProfile).toHaveBeenCalledWith("990011", "990001"),
    );
  });

  it("não renderiza botão 'Desvincular' quando o usuário não possui permissão can('access','edit')", async () => {
    mockCan.mockReturnValue(false);

    render(<AccessProfilesPage />);

    expect(screen.getAllByText("Condutor Alpha").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole("button", { name: /desvincular/i })).toBeNull();
  });

  it("não faz alias silencioso de 'instrutor_k9' para 'operador_k9', classificando-o honestamente como legado", async () => {
    mockUsers = [
      {
        accessLevel: null,
        accessProfile: "instrutor_k9",
        accessProfileId: "instrutor_k9",
        active: true,
        callsign: "Instrutor Bravo",
        fullName: "Agente Bravo",
        isK9Instructor: true,
        photoUrl: null,
        ra: "990022",
        role: "Instrutor",
        unit: "Canil",
      },
    ];

    render(<AccessProfilesPage />);

    // Não deve aparecer vinculado a operador_k9
    expect(screen.getByText("Nenhum usuário vinculado a este perfil.")).toBeDefined();

    // Deve ser reportado sob Cadastros a revisar como legado
    expect(screen.getAllByText(/1 legado\(s\)/i).length).toBeGreaterThanOrEqual(1);
  });

  // --- NEW FOCUSED IA / NAVIGATION / REGRESSION TESTS ---

  describe("Navigation & Information Architecture", () => {
    it("inicia na seção padrão 'Perfis e usuários'", () => {
      render(<AccessProfilesPage />);

      const profilesTab = screen.getByRole("tab", { name: /perfis e usuários/i });
      expect(profilesTab.getAttribute("aria-selected")).toBe("true");

      // Master list presente
      expect(screen.getByText("Perfis oficiais")).toBeDefined();
      // Detail pane presente
      expect(screen.getByRole("heading", { name: "Operador", level: 2 })).toBeDefined();
      expect(screen.getByText("Usuários vinculados")).toBeDefined();
      expect(screen.getByText("Atribuir usuário")).toBeDefined();
    });

    it("navega para 'Capacidades especiais' separadamente", () => {
      render(<AccessProfilesPage />);

      const capabilitiesTab = screen.getByRole("tab", { name: /capacidades especiais/i });
      fireEvent.click(capabilitiesTab);

      expect(capabilitiesTab.getAttribute("aria-selected")).toBe("true");
      expect(
        screen.getByText(/Capacidades especiais são independentes do perfil de acesso\./i),
      ).toBeDefined();
      expect(screen.getByText(/Habilitação técnica para avaliação e progressão/i)).toBeDefined();
      // Verifica que master-detail foi ocultado
      expect(screen.queryByText(/Atribuir usuário/i)).toBeNull();
    });

    it("navega para 'Sincronização' separadamente", () => {
      render(<AccessProfilesPage />);

      const syncTab = screen.getByRole("tab", { name: /sincronização/i });
      fireEvent.click(syncTab);

      expect(syncTab.getAttribute("aria-selected")).toBe("true");
      expect(screen.getByText(/Sincronização de perfis oficiais/i)).toBeDefined();
      expect(screen.getByText(/Perfis do sistema/i)).toBeDefined();
      // Verifica que master-detail foi ocultado
      expect(screen.queryByText(/Atribuir usuário/i)).toBeNull();
    });
  });

  describe("Profile Master-Detail", () => {
    it("seleciona Operador inicialmente e exibe seus integrantes vinculados", () => {
      render(<AccessProfilesPage />);

      // Detalhe mostra Operador
      expect(screen.getByRole("heading", { name: "Operador", level: 2 })).toBeDefined();

      // Condutor Alpha está vinculado a Operador
      expect(screen.getAllByText("Condutor Alpha").length).toBeGreaterThanOrEqual(1);
      // Admin Beta NÃO deve estar nos vinculados a Operador (apenas na busca de atribuição)
      const linkedSection = screen.getByText("Usuários vinculados").closest("section");
      expect(linkedSection).toBeDefined();
      expect(within(linkedSection!).getByText("Condutor Alpha")).toBeDefined();
      expect(within(linkedSection!).queryByText("Admin Beta")).toBeNull();
    });

    it("troca o painel de detalhes ao selecionar Administrador no master", () => {
      render(<AccessProfilesPage />);

      // Master list buttons
      const adminButton = screen.getAllByRole("button").find(
        (b) => b.textContent?.includes("Administrador") && b.textContent?.includes("Controle total"),
      );
      expect(adminButton).toBeDefined();
      fireEvent.click(adminButton!);

      // Detail agora reflete Administrador
      expect(screen.getByRole("heading", { name: "Administrador", level: 2 })).toBeDefined();

      const linkedSection = screen.getByText("Usuários vinculados").closest("section");
      expect(linkedSection).toBeDefined();
      // Admin Beta agora está na seção vinculados
      expect(within(linkedSection!).getByText("Admin Beta")).toBeDefined();
      expect(within(linkedSection!).queryByText("Condutor Alpha")).toBeNull();
    });
  });

  describe("Copy Semantics", () => {
    it("expressa claramente a independência entre capacidade especial e perfil de acesso", () => {
      render(<AccessProfilesPage />);

      const capabilitiesTab = screen.getByRole("tab", { name: /capacidades especiais/i });
      fireEvent.click(capabilitiesTab);

      expect(
        screen.getByText(/Capacidades especiais são independentes do perfil de acesso\./i),
      ).toBeDefined();
      expect(
        screen.getByText(/não constituem um perfil de acesso isolado/i),
      ).toBeDefined();
    });

    it("utiliza terminologia explícita para pendências de sincronização", () => {
      render(<AccessProfilesPage />);

      const syncTab = screen.getByRole("tab", { name: /sincronização/i });
      fireEvent.click(syncTab);

      // Deve usar terminologia explícita
      const hasSyncTerminology =
        screen.queryByText(/Perfis aguardando sincronização/i) !== null ||
        screen.queryByText(/sincronizados com a política/i) !== null;
      expect(hasSyncTerminology).toBe(true);
    });

    it("mantém 'Cadastros a revisar' distinto e com contadores próprios", () => {
      render(<AccessProfilesPage />);

      const capabilitiesTab = screen.getByRole("tab", { name: /capacidades especiais/i });
      fireEvent.click(capabilitiesTab);

      expect(screen.getAllByText(/cadastros a revisar/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/1 sem perfil oficial/i)).toBeDefined();
    });
  });

  describe("Actions & Handlers", () => {
    it("chama assignUserAccessProfile com perfil ativo ao clicar em atribuir usuário", async () => {
      mockAssignUserAccessProfile.mockResolvedValue({
        assigned: true,
        profileId: "operador_k9",
        profileName: "Operador",
        ra: "990013",
      });

      render(<AccessProfilesPage />);

      // Busca e clica no Agente Novo Gamma na seção Atribuir usuário
      const assignSection = screen.getByText("Atribuir usuário").closest("section");
      expect(assignSection).toBeDefined();

      const gammaBtn = within(assignSection!).getByRole("button", {
        name: /Agente Novo Gamma/i,
      });
      fireEvent.click(gammaBtn);

      await waitFor(() =>
        expect(mockAssignUserAccessProfile).toHaveBeenCalledWith(
          expect.objectContaining({ ra: "990013" }),
          expect.objectContaining({ id: "operador_k9" }),
          "990001",
        ),
      );
    });

    it("chama seedDefaultAccessProfiles na aba de Sincronização ao clicar no botão", async () => {
      mockSeedDefaultAccessProfiles.mockResolvedValue({
        created: [],
        updated: ["operador_k9"],
      });

      render(<AccessProfilesPage />);

      const syncTab = screen.getByRole("tab", { name: /sincronização/i });
      fireEvent.click(syncTab);

      const syncBtn = screen.getByRole("button", { name: /sincronizar perfis/i });
      fireEvent.click(syncBtn);

      await waitFor(() =>
        expect(mockSeedDefaultAccessProfiles).toHaveBeenCalledWith("990001"),
      );
    });

    it("desabilita ação de atribuição quando can('access','edit') é negado", () => {
      mockCan.mockReturnValue(false);

      render(<AccessProfilesPage />);

      const assignSection = screen.getByText("Atribuir usuário").closest("section");
      expect(assignSection).toBeDefined();

      const gammaBtn = within(assignSection!).getByRole("button", {
        name: /Agente Novo Gamma/i,
      });
      expect(gammaBtn.getAttribute("disabled")).not.toBeNull();
    });
  });
});
