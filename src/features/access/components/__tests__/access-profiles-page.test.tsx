import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
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

describe("AccessProfilesPage (F10.AUTHORIZATION-UX.V1)", () => {
  beforeEach(() => {
    mockCan.mockReset();
    mockAssignUserAccessProfile.mockReset();
    mockUnassignUserAccessProfile.mockReset();
    mockCan.mockImplementation((mod: string, act: string) => mod === "access" && act === "edit");

    mockProfiles = [
      {
        description: "Operador de cães de serviço",
        id: "operador_k9",
        level: "operacional",
        module_tags: ["k9"],
        name: "Operador",
        permissions: {},
        role_keys: ["operador_k9"],
        seed_version: 2,
        slug: "operador_k9",
        status: "active",
        tone: "cyan",
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
    ];
  });

  afterEach(() => {
    cleanup();
  });

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
    expect(screen.getByText("1 legado(s)")).toBeDefined();
  });
});
