import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AccessUser } from "@/features/access/data/access-profile-service";
import type { AccessProfile } from "@/lib/permissions/access-control";

const {
  mockAssignUserAccessProfile,
  mockProvisionHumanAuth,
} = vi.hoisted(() => ({
  mockAssignUserAccessProfile: vi.fn(),
  mockProvisionHumanAuth: vi.fn(),
}));

vi.mock("@/lib/firebase/client", () => ({
  auth: {},
  db: {},
  functions: {},
  storage: {},
}));

vi.mock("@/features/access/data/access-profile-service", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/access/data/access-profile-service")
  >("@/features/access/data/access-profile-service");
  return {
    ...actual,
    assignUserAccessProfile: mockAssignUserAccessProfile,
    provisionHumanAuth: mockProvisionHumanAuth,
  };
});

import { AccessOnboardingJourney } from "../access-onboarding-journey";

describe("AccessOnboardingJourney (F10.AUTH-PROVISIONING-CREDENTIALS-R1)", () => {
  const mockProfiles: AccessProfile[] = [
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
        access: { view: true, create: true, edit: true },
      },
      role_keys: ["administrador"],
      seed_version: 2,
      slug: "administrador",
      status: "active",
      tone: "amber",
    },
  ];

  const targetUserWithoutAuth: AccessUser = {
    accessLevel: null,
    accessProfile: null,
    accessProfileId: null,
    active: true,
    authUid: null,
    callsign: "Falcão",
    fullName: "Lucas Silva",
    isK9Instructor: false,
    photoUrl: null,
    ra: "770001",
    role: "Operador",
    unit: "Canil Central",
  };

  const targetUserWithAuth: AccessUser = {
    ...targetUserWithoutAuth,
    authUid: "uid-preexisting-999",
  };

  beforeEach(() => {
    mockAssignUserAccessProfile.mockReset();
    mockProvisionHumanAuth.mockReset();
  });

  it("exibe dados do integrante na Etapa 1 e aguarda provisionamento na Etapa 2", () => {
    render(
      <AccessOnboardingJourney
        canManageAccess={true}
        profiles={mockProfiles}
        targetRa="770001"
        targetUser={targetUserWithoutAuth}
      />,
    );

    expect(screen.getByText(/Configuração de Acesso: Falcão/i)).toBeInTheDocument();
    expect(screen.getByText(/Etapa 1: Cadastro de Pessoal/i)).toBeInTheDocument();
    expect(screen.getByText(/Lucas Silva/i)).toBeInTheDocument();
    expect(screen.getByText(/770001@gcm.com.br/i)).toBeInTheDocument();

    // Etapa 2 pendente
    expect(screen.getByRole("button", { name: /Provisionar autenticação/i })).toBeInTheDocument();
    // Etapa 3 bloqueada
    expect(screen.getByText(/Bloqueado/i)).toBeInTheDocument();
    // Etapa 4 não existe ainda
    expect(screen.queryByTestId("credentials-presentation-card")).not.toBeInTheDocument();
  });

  it("se provisionamento falhar, exibe erro e Etapa 3 permanece bloqueada", async () => {
    mockProvisionHumanAuth.mockRejectedValue(new Error("Conflito de identidade no Auth"));

    render(
      <AccessOnboardingJourney
        canManageAccess={true}
        profiles={mockProfiles}
        targetRa="770001"
        targetUser={targetUserWithoutAuth}
      />,
    );

    const provBtn = screen.getByRole("button", { name: /Provisionar autenticação/i });
    fireEvent.click(provBtn);

    await waitFor(() => {
      expect(screen.getByText(/Conflito de identidade no Auth/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Bloqueado/i)).toBeInTheDocument();
    expect(screen.queryByTestId("credentials-presentation-card")).not.toBeInTheDocument();
  });

  it("se atribuição de perfil falhar, NÃO avança e NÃO exibe credenciais (requisito estrito)", async () => {
    mockProvisionHumanAuth.mockResolvedValue({
      auth_uid: "uid-new-123",
      created: true,
      email: "770001@gcm.com.br",
      initial_password: "GeneratedSecret123!Aa",
      ra: "770001",
    });
    mockAssignUserAccessProfile.mockRejectedValue(new Error("Falha no serviço de perfis"));

    render(
      <AccessOnboardingJourney
        canManageAccess={true}
        profiles={mockProfiles}
        targetRa="770001"
        targetUser={targetUserWithoutAuth}
      />,
    );

    // 1. Provisiona Auth
    fireEvent.click(screen.getByRole("button", { name: /Provisionar autenticação/i }));
    await waitFor(() => {
      expect(screen.getByText(/Atribuir perfil e concluir acesso/i)).toBeInTheDocument();
    });

    // 2. Tenta atribuir perfil
    fireEvent.click(screen.getByRole("button", { name: /Atribuir perfil e concluir acesso/i }));

    await waitFor(() => {
      expect(screen.getByText(/Falha no serviço de perfis/i)).toBeInTheDocument();
    });

    // Crucial: Etapa 4 NÃO aparece e a senha NÃO é orientada para entrega
    expect(screen.queryByTestId("credentials-presentation-card")).not.toBeInTheDocument();
    expect(screen.queryByText(/GeneratedSecret123!Aa/i)).not.toBeInTheDocument();
  });

  it("jornada completa de sucesso: provisiona Auth -> atribui perfil -> apresenta senha inicial", async () => {
    mockProvisionHumanAuth.mockResolvedValue({
      auth_uid: "uid-new-123",
      created: true,
      email: "770001@gcm.com.br",
      initial_password: "GeneratedSecret123!Aa",
      ra: "770001",
    });
    mockAssignUserAccessProfile.mockResolvedValue({});

    render(
      <AccessOnboardingJourney
        actorRa="990001"
        canManageAccess={true}
        profiles={mockProfiles}
        targetRa="770001"
        targetUser={targetUserWithoutAuth}
      />,
    );

    // Etapa 2
    fireEvent.click(screen.getByRole("button", { name: /Provisionar autenticação/i }));
    await waitFor(() => {
      expect(screen.getByText(/Atribuir perfil e concluir acesso/i)).toBeInTheDocument();
    });

    // Etapa 3
    fireEvent.click(screen.getByRole("button", { name: /Atribuir perfil e concluir acesso/i }));
    await waitFor(() => {
      expect(screen.getByTestId("credentials-presentation-card")).toBeInTheDocument();
    });

    // Etapa 4: Exibe credencial inicial com termo obrigatório "Senha inicial"
    const credCard = screen.getByTestId("credentials-presentation-card");
    expect(credCard).toBeInTheDocument();
    expect(screen.getAllByText(/Senha inicial/i).length).toBeGreaterThan(0);
    expect(screen.getByText("GeneratedSecret123!Aa")).toBeInTheDocument();
    expect(screen.getByText(/Onboarding concluído com sucesso/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copiar senha inicial/i })).toBeInTheDocument();
  });

  it("integrante com Auth já existente pula Etapa 2 e ao atribuir perfil exibe orientação correspondente", async () => {
    mockAssignUserAccessProfile.mockResolvedValue({});

    render(
      <AccessOnboardingJourney
        canManageAccess={true}
        profiles={mockProfiles}
        targetRa="770001"
        targetUser={targetUserWithAuth}
      />,
    );

    // Etapa 2 já aparece como Concluído
    expect(screen.getByText(/Identidade de acesso vinculada no Firebase Auth/i)).toBeInTheDocument();
    expect(screen.getByText(/uid-preexisting-999/i)).toBeInTheDocument();

    // Etapa 3 pronta
    const assignBtn = screen.getByRole("button", { name: /Atribuir perfil e concluir acesso/i });
    fireEvent.click(assignBtn);

    await waitFor(() => {
      expect(screen.getByTestId("credentials-presentation-card")).toBeInTheDocument();
    });

    // Como a conta era preexistente nesta sessão, orienta reset se necessário
    expect(screen.getByText(/Conta de autenticação preexistente/i)).toBeInTheDocument();
  });

  it("respeita autoridade do operador: botões desabilitados quando canManageAccess é falso", () => {
    render(
      <AccessOnboardingJourney
        canManageAccess={false}
        profiles={mockProfiles}
        targetRa="770001"
        targetUser={targetUserWithoutAuth}
      />,
    );

    const btn = screen.getByRole("button", { name: /Provisionar autenticação/i });
    expect(btn.getAttribute("disabled")).not.toBeNull();
  });
});
