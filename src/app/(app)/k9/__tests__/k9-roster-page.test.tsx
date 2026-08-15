import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  EffectiveBinomial,
  EffectiveDog,
  EffectiveShift,
  EffectiveUser,
} from "@/features/effective/hooks/use-effective-data";
import type { AccessAction, AccessModuleId } from "@/lib/permissions/access-control";

let allowedActions: Array<`${AccessModuleId}:${AccessAction}`> | "all" = "all";
let effectiveState: {
  binomials: EffectiveBinomial[];
  dogs: EffectiveDog[];
  error: string | null;
  loading: boolean;
  shifts: EffectiveShift[];
  users: EffectiveUser[];
};

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("next/image", () => ({
  // Mock de `next/image`: um <img> real é necessário para que os testes
  // possam verificar o texto alternativo. A regra de LCP não se aplica aqui.
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

vi.mock("@/features/access/providers/access-control-provider", () => ({
  useAccessControl: () => ({
    can: (moduleId: AccessModuleId, action: AccessAction) =>
      allowedActions === "all" ||
      allowedActions.includes(`${moduleId}:${action}`),
    status: "ready",
  }),
}));

vi.mock("@/lib/firebase/client", () => ({ auth: {}, db: {} }));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  onSnapshot: vi.fn(() => () => undefined),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
}));

vi.mock("@/features/effective/hooks/use-effective-data", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/effective/hooks/use-effective-data")
  >("@/features/effective/hooks/use-effective-data");
  return {
    ...actual,
    useEffectiveData: () => effectiveState,
  };
});

// O detalhe on-demand é exercitado no teste do drawer; aqui o foco é o roster.
vi.mock("@/features/effective/hooks/use-k9-roster-detail", () => ({
  useK9RosterDetail: (dogId: string | null) => ({
    error: null,
    lastTrainingSession: null,
    loading: false,
    readiness: null,
    readinessUnavailable: true,
    _dogId: dogId,
  }),
}));

const { default: K9Page } = await import("@/app/(app)/k9/page");

function dog(overrides: Partial<EffectiveDog> & { id: string; name: string }) {
  return {
    breed: "Malinois Belga",
    color: null,
    conductorRa: null,
    dateOfBirth: null,
    microchip: null,
    profileImageUrl: null,
    registrationNumber: null,
    sex: null,
    specialties: [],
    status: "Ativo",
    ...overrides,
  } satisfies EffectiveDog;
}

/** Oito K9 — acima do antigo pageSize de 6, para provar que não há paginação. */
const manyDogs: EffectiveDog[] = Array.from({ length: 8 }, (_, index) =>
  dog({
    id: `dog-${index}`,
    name: `K9 ${index}`,
    specialties: [
      { id: `s-${index}`, status: "operational", type: "deteccao" },
    ],
  }),
);

beforeEach(() => {
  allowedActions = "all";
  effectiveState = {
    binomials: [],
    dogs: [
      dog({
        conductorRa: "691755",
        id: "bono",
        name: "Bono",
        registrationNumber: "111222",
        specialties: [{ id: "s1", status: "operational", type: "deteccao" }],
      }),
      dog({
        id: "kira",
        name: "Kira",
        specialties: [{ id: "s2", status: "in_formation", type: "deteccao" }],
      }),
      dog({ id: "athos", name: "Athos", status: "Licenca" }),
      dog({ id: "lua", name: "Lua" }),
    ],
    error: null,
    loading: false,
    shifts: [],
    users: [
      {
        accessLevel: "Operador K9",
        active: true,
        callsign: "Ragonha",
        fullName: "Ragonha",
        isK9Instructor: false,
        photoUrl: null,
        ra: "691755",
        unit: "GCM",
      },
    ],
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("header e permissão", () => {
  it("exibe o título e a descrição aprovados", () => {
    render(<K9Page />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Efetivo K9" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Visão operacional da matilha da unidade"),
    ).toBeInTheDocument();
  });

  it("mostra Cadastrar K9 com can('k9','create')", () => {
    render(<K9Page />);

    expect(screen.getByRole("link", { name: /Cadastrar K9/ })).toHaveAttribute(
      "href",
      "/k9/new",
    );
  });

  it("esconde Cadastrar K9 sem permissão — e não cria botão desabilitado", () => {
    allowedActions = ["k9:view"];
    render(<K9Page />);

    expect(
      screen.queryByRole("link", { name: /Cadastrar K9/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Cadastrar K9/ }),
    ).not.toBeInTheDocument();
  });
});

describe("KPIs", () => {
  it("usa as labels aprovadas", () => {
    render(<K9Page />);

    // "Prontos para emprego" e "Em formação" aparecem também como título de
    // seção e como pill de status, então restringimos a busca aos KPIs.
    const kpis = screen.getByTestId("k9-roster-summary");

    expect(within(kpis).getByText("Efetivo total")).toBeInTheDocument();
    expect(
      within(kpis).getByText("Prontos para emprego"),
    ).toBeInTheDocument();
    expect(within(kpis).getByText("Em formação")).toBeInTheDocument();
    expect(within(kpis).getByText("Indisponíveis")).toBeInTheDocument();
  });

  it("conta cada grupo conforme a classificação", () => {
    render(<K9Page />);

    // 4 no total: 1 pronto, 1 em formação, 1 indisponível, 1 sem classificação.
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(3);
  });
});

describe("seções e agrupamento", () => {
  it("renderiza apenas as seções com registros", () => {
    render(<K9Page />);

    expect(
      screen.getByRole("heading", { name: /Prontos para emprego/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Indisponíveis \/ com restrições/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Ativos sem classificação operacional/,
      }),
    ).toBeInTheDocument();
  });

  it("omite a seção de escape quando não há K9 sem classificação", () => {
    effectiveState.dogs = [
      dog({
        id: "bono",
        name: "Bono",
        specialties: [{ id: "s1", status: "operational", type: "deteccao" }],
      }),
    ];
    render(<K9Page />);

    expect(
      screen.queryByRole("heading", {
        name: /Ativos sem classificação operacional/,
      }),
    ).not.toBeInTheDocument();
  });

  it("nenhum K9 desaparece da tela", () => {
    render(<K9Page />);

    for (const name of ["Bono", "Kira", "Athos", "Lua"]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
  });
});

describe("paginação removida", () => {
  it("renderiza todos os resultados, sem limite de 6", () => {
    effectiveState.dogs = manyDogs;
    render(<K9Page />);

    for (const item of manyDogs) {
      expect(screen.getByRole("heading", { name: item.name })).toBeInTheDocument();
    }
    expect(screen.queryByText(/Exibindo 1-6 de/)).not.toBeInTheDocument();
  });
});

describe("filtros na tela", () => {
  it("filtra pela busca e oferece limpar filtros", () => {
    render(<K9Page />);

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "Kira" },
    });

    expect(screen.getByRole("heading", { name: "Kira" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Bono" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Limpar filtros/ }));
    expect(screen.getByRole("heading", { name: "Bono" })).toBeInTheDocument();
  });

  it("mostra estado vazio de filtros com ação de limpar", () => {
    render(<K9Page />);

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "inexistente" },
    });

    expect(
      screen.getByText("Nenhum K9 corresponde aos filtros selecionados."),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /Limpar filtros/ }).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("filtra por situação operacional", () => {
    render(<K9Page />);

    fireEvent.change(
      screen.getByLabelText("Filtrar por situação operacional"),
      { target: { value: "formation" } },
    );

    expect(screen.getByRole("heading", { name: "Kira" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Bono" }),
    ).not.toBeInTheDocument();
  });
});

describe("seleção e drawer", () => {
  it("abre o drawer ao selecionar um card", () => {
    render(<K9Page />);

    expect(screen.queryByText("Detalhes do K9")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Bono —/ }));

    expect(screen.getByText("Detalhes do K9")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Ver perfil/ }),
    ).toHaveAttribute("href", "/k9/bono");
  });

  it("card é acionável por teclado", () => {
    render(<K9Page />);

    const card = screen.getByRole("button", { name: /^Bono —/ });
    expect(card).toHaveAttribute("tabindex", "0");

    fireEvent.keyDown(card, { key: "Enter" });
    expect(screen.getByText("Detalhes do K9")).toBeInTheDocument();
  });

  it("troca a seleção ao clicar em outro K9", () => {
    render(<K9Page />);

    fireEvent.click(screen.getByRole("button", { name: /^Bono —/ }));
    expect(
      screen.getByRole("link", { name: /Ver perfil/ }),
    ).toHaveAttribute("href", "/k9/bono");

    fireEvent.click(screen.getByRole("button", { name: /^Kira —/ }));
    expect(
      screen.getByRole("link", { name: /Ver perfil/ }),
    ).toHaveAttribute("href", "/k9/kira");
  });

  it("fechar limpa a seleção", () => {
    render(<K9Page />);

    fireEvent.click(screen.getByRole("button", { name: /^Bono —/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Fechar detalhes do K9" }),
    );

    expect(screen.queryByText("Detalhes do K9")).not.toBeInTheDocument();
  });

  it("seleção filtrada para fora fecha o drawer", () => {
    render(<K9Page />);

    fireEvent.click(screen.getByRole("button", { name: /^Bono —/ }));
    expect(screen.getByText("Detalhes do K9")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "Kira" },
    });
    expect(screen.queryByText("Detalhes do K9")).not.toBeInTheDocument();
  });
});

describe("estados de carregamento, vazio e erro", () => {
  it("mostra skeleton estrutural enquanto carrega", () => {
    effectiveState = { ...effectiveState, dogs: [], loading: true };
    render(<K9Page />);

    expect(screen.getByText("Carregando o efetivo K9...")).toBeInTheDocument();
  });

  it("mostra empty state quando não há K9 cadastrado", () => {
    effectiveState = { ...effectiveState, dogs: [] };
    render(<K9Page />);

    expect(screen.getByText("Nenhum K9 cadastrado")).toBeInTheDocument();
  });

  it("empty state esconde o CTA sem permissão de criação", () => {
    allowedActions = ["k9:view"];
    effectiveState = { ...effectiveState, dogs: [] };
    render(<K9Page />);

    expect(screen.getByText("Nenhum K9 cadastrado")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Cadastrar K9/ }),
    ).not.toBeInTheDocument();
  });

  it("falha da listagem informa erro e não vira contagem zero silenciosa", () => {
    effectiveState = {
      ...effectiveState,
      dogs: [],
      error: "permission-denied",
    };
    render(<K9Page />);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/Falha ao carregar o efetivo K9/);
    expect(status).toHaveTextContent(/permission-denied/);
    expect(status).toHaveTextContent(/não interprete como efetivo zerado/);
    // O shell da tela permanece.
    expect(
      screen.getByRole("heading", { level: 1, name: "Efetivo K9" }),
    ).toBeInTheDocument();
  });
});

describe("acessibilidade e semântica de status", () => {
  it("status do card tem label textual além da cor", () => {
    render(<K9Page />);

    const card = screen.getByRole("button", { name: /^Bono —/ });
    expect(
      within(card).getByText("Prontos para emprego"),
    ).toBeInTheDocument();
  });

  it("fotos têm alt descritivo quando existe imagem", () => {
    effectiveState.dogs = [
      dog({
        id: "bono",
        name: "Bono",
        profileImageUrl: "https://example.test/bono.png",
        specialties: [{ id: "s1", status: "operational", type: "deteccao" }],
      }),
    ];
    render(<K9Page />);

    expect(screen.getByAltText("Foto de Bono")).toBeInTheDocument();
  });

  it("K9 sem foto usa fallback sem imagem quebrada", () => {
    render(<K9Page />);

    // Bono não tem `profileImageUrl` no fixture padrão: nenhum <img> é
    // renderizado, apenas o ícone de fallback.
    expect(screen.queryByAltText("Foto de Bono")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bono" })).toBeInTheDocument();
  });
});
