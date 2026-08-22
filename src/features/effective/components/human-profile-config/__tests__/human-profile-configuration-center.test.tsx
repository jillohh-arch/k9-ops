import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HumanProfileConfigurationCenter } from "../human-profile-configuration-center";

vi.mock("@/lib/firebase/client", () => ({
  auth: {},
  db: {},
  functions: {},
  storage: {},
}));

// Mock access control
vi.mock("@/features/access/providers/access-control-provider", () => ({
  useAccessControl: () => ({
    can: (module: string, action: string) => module === "access" && action === "view",
  }),
}));

// Mock access profiles
vi.mock("@/features/access/hooks/use-access-profiles", () => ({
  useAccessProfiles: () => ({
    error: null,
    loading: false,
    profiles: [
      {
        description: "Operador de cães de serviço",
        id: "operador_k9",
        level: "operacional",
        module_tags: ["k9"],
        name: "Operador",
        permissions: {},
        role_keys: ["operador_k9", "condutor"],
        seed_version: 1,
        slug: "operador_k9",
        status: "active",
        tone: "cyan",
      },
      {
        description: "Gestão do canil",
        id: "gestor",
        level: "gerencial",
        module_tags: ["effective"],
        name: "Gestor / Comando",
        permissions: {},
        role_keys: ["gestor"],
        seed_version: 1,
        slug: "gestor",
        status: "active",
        tone: "green",
      },
    ],
  }),
}));

describe("HumanProfileConfigurationCenter (H3-W2)", () => {
  it("renderiza exatamente as 5 linhas conceituais da Configuração do Integrante", () => {
    const freshPersonnelUser = {
      active: true,
      admissionDate: "2026-02-01",
      callsign: "FALCAO",
      fullName: "Carlos Falcão",
      ra: "123456",
      team: "Alfa",
      unit: "Canil Central",
    };

    render(
      <HumanProfileConfigurationCenter
        activeShift={null}
        certifications={[]}
        linkedDogs={[]}
        ra="123456"
        user={freshPersonnelUser}
      />,
    );

    // Card title
    expect(
      screen.getByRole("heading", { name: "CONFIGURAÇÃO DO INTEGRANTE" }),
    ).toBeInTheDocument();

    // 5 Rows
    expect(screen.getByTestId("config-row-foto")).toBeInTheDocument();
    expect(screen.getByTestId("config-row-acesso")).toBeInTheDocument();
    expect(screen.getByTestId("config-row-capacitacoes")).toBeInTheDocument();
    expect(screen.getByTestId("config-row-binomio")).toBeInTheDocument();
    expect(screen.getByTestId("config-row-escala")).toBeInTheDocument();
  });

  it("CANÔNICO NOVO INTEGRANTE: exibe Acesso 'Não provisionado' e NUNCA 'Operador'", () => {
    const freshPersonnelUser = {
      active: true,
      admissionDate: "2026-02-01",
      callsign: "SILVA",
      cargo: "Condutor K9",
      fullName: "Agente Silva",
      ra: "654321",
    };

    render(
      <HumanProfileConfigurationCenter
        activeShift={null}
        certifications={[]}
        linkedDogs={[]}
        ra="654321"
        user={freshPersonnelUser}
      />,
    );

    const acessoRow = screen.getByTestId("config-row-acesso");

    // Status honesto
    expect(acessoRow).toHaveTextContent("Não provisionado");
    expect(acessoRow).toHaveTextContent("Sem perfil de acesso vinculado");

    // NUNCA deve fabricar Operador
    expect(acessoRow).not.toHaveTextContent("Operador");
    expect(acessoRow).not.toHaveTextContent("operador_k9");
  });

  it("ROW FOTO: estado inerte honesto — sem input file ou botão de upload", () => {
    const userWithoutPhoto = {
      callsign: "SILVA",
      ra: "654321",
    };

    render(
      <HumanProfileConfigurationCenter
        ra="654321"
        user={userWithoutPhoto}
      />,
    );

    const fotoRow = screen.getByTestId("config-row-foto");
    expect(fotoRow).toHaveTextContent("Sem foto");
    expect(fotoRow).toHaveTextContent("Sem foto cadastrada · fluxo pós-cadastro");

    // Prova de ausência de controles mutantes
    expect(screen.queryByLabelText(/selecionar foto/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /upload/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /enviar foto/i })).not.toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it("ROW ACESSO: exibe perfil configurado quando explicitamente presente", () => {
    const userWithGestor = {
      access_profile_id: "gestor",
      callsign: "MAJOR",
      ra: "1001",
    };

    render(
      <HumanProfileConfigurationCenter
        ra="1001"
        user={userWithGestor}
      />,
    );

    const acessoRow = screen.getByTestId("config-row-acesso");
    expect(acessoRow).toHaveTextContent("Perfil configurado");
    expect(acessoRow).toHaveTextContent("Gestor / Comando");
  });

  it("ROW ACESSO: exibe 'Configuração incompleta' se ID de perfil for desconhecido", () => {
    const userWithBrokenProfile = {
      access_profile_id: "perfil_inexistente_999",
      callsign: "QUEBRADO",
      ra: "9999",
    };

    render(
      <HumanProfileConfigurationCenter
        ra="9999"
        user={userWithBrokenProfile}
      />,
    );

    const acessoRow = screen.getByTestId("config-row-acesso");
    expect(acessoRow).toHaveTextContent("Configuração incompleta");
    expect(acessoRow).not.toHaveTextContent("Operador");
  });

  it("ROW BINÔMIO: exibe ausência honesta quando não há cão vinculado e NÃO infere de team/unit", () => {
    const userWithTeamAndUnit = {
      callsign: "PATRULHA",
      ra: "4444",
      team: "Bravo",
      unit: "1º Batalhão Canil",
    };

    render(
      <HumanProfileConfigurationCenter
        linkedDogs={[]}
        ra="4444"
        user={userWithTeamAndUnit}
      />,
    );

    const binomioRow = screen.getByTestId("config-row-binomio");
    expect(binomioRow).toHaveTextContent("Sem binômio");
    expect(binomioRow).toHaveTextContent("Sem binômio vinculado");

    // Prova de ausência de mutação
    expect(screen.queryByRole("button", { name: /vincular binômio/i })).not.toBeInTheDocument();
  });

  it("ROW BINÔMIO: exibe cão vinculado factualmente quando presente", () => {
    const linkedDogs = [
      {
        _id: "dog_thor_123",
        _source: "dogs",
        name: "Thor",
      },
    ];

    render(
      <HumanProfileConfigurationCenter
        linkedDogs={linkedDogs}
        ra="4444"
        user={{ callsign: "CONDUTOR", ra: "4444" }}
      />,
    );

    const binomioRow = screen.getByTestId("config-row-binomio");
    expect(binomioRow).toHaveTextContent("1 K9 vinculado(s)");
    expect(binomioRow).toHaveTextContent("Thor");
    expect(screen.getByRole("link", { name: /ver k9/i })).toHaveAttribute(
      "href",
      "/k9/dog_thor_123",
    );
  });

  it("ROW ESCALA: exibe ausência honesta quando sem turno ativo e NÃO infere de team/unit", () => {
    const userWithOperationalMetadata = {
      callsign: "PLANTAO",
      ra: "8888",
      team: "Turno A (12x36)",
      unit: "Canil Setorial",
    };

    render(
      <HumanProfileConfigurationCenter
        activeShift={null}
        ra="8888"
        user={userWithOperationalMetadata}
      />,
    );

    const escalaRow = screen.getByTestId("config-row-escala");
    expect(escalaRow).toHaveTextContent("Sem turno ativo");
    expect(escalaRow).toHaveTextContent("Disponibilidade operacional não vinculada");

    // Prova de ausência de mutação de escala
    expect(screen.queryByRole("button", { name: /iniciar turno/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /escalar/i })).not.toBeInTheDocument();
  });

  it("ROW ESCALA: exibe turno operacional quando ativo", () => {
    const activeShift = {
      _id: "shift_999",
      _source: "active_shifts",
      vehicle_label: "VTR-102 K9",
    };

    render(
      <HumanProfileConfigurationCenter
        activeShift={activeShift}
        ra="8888"
        user={{ callsign: "PLANTAO", ra: "8888" }}
      />,
    );

    const escalaRow = screen.getByTestId("config-row-escala");
    expect(escalaRow).toHaveTextContent("Em turno");
    expect(escalaRow).toHaveTextContent("VTR-102 K9");
  });

  it("ROW CAPACITAÇÕES: exibe certificações e habilitado como instrutor sem permitir escrita", () => {
    const certifications = [
      { _id: "c1", _source: "certifications", name: "Faro de Entorpecentes" },
      { _id: "c2", _source: "certifications", name: "Condutor K9 Avançado" },
    ];

    render(
      <HumanProfileConfigurationCenter
        certifications={certifications}
        ra="7777"
        user={{ callsign: "INSTRUTOR", is_k9_instructor: true, ra: "7777" }}
      />,
    );

    const capRow = screen.getByTestId("config-row-capacitacoes");
    expect(capRow).toHaveTextContent("Instrutor K9");
    expect(capRow).toHaveTextContent("2 curso(s) ou certificação(ões) ativa(s)");

    // Prova de ausência de escrita inline
    expect(screen.queryByRole("button", { name: /adicionar capacitação/i })).not.toBeInTheDocument();
  });
});
