import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  EffectiveDog,
  EffectiveShift,
  EffectiveUser,
} from "@/features/effective/hooks/use-effective-data";

let effectiveState: {
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
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

vi.mock("@/features/access/providers/access-control-provider", () => ({
  useAccessControl: () => ({
    can: () => true,
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

const { default: HumansPage } = await import("@/app/(app)/humans/page");

function human(overrides: Partial<EffectiveUser> & { ra: string; callsign: string }) {
  return {
    accessLevel: null,
    accessProfileId: null,
    active: true,
    fullName: null,
    isK9Instructor: false,
    photoUrl: null,
    unit: null,
    ...overrides,
  } satisfies EffectiveUser;
}

/** Localiza o card do roster pelo RA e devolve seu escopo de consulta. */
function card(ra: string) {
  const raLabel = screen.getByText(`RA ${ra}`);
  const article = raLabel.closest("article");
  if (!article) throw new Error(`card do RA ${ra} não encontrado`);
  return within(article);
}

beforeEach(() => {
  effectiveState = {
    dogs: [],
    error: null,
    loading: false,
    shifts: [],
    users: [
      // CASO A: perfil canônico explícito, SEM espelho legado.
      // Espelha users/990010 em staging.
      human({
        accessProfileId: "gestor",
        callsign: "VISUAL-GESTOR",
        ra: "990010",
      }),
      // CASO B: nenhuma chave de acesso.
      human({ callsign: "VISUAL-NP", ra: "990011" }),
      // CASO C: id explícito que não resolve para nenhum perfil conhecido.
      human({
        accessProfileId: "stg_k9_edit_homologator",
        callsign: "VISUAL-INCOMPLETO",
        ra: "990001",
      }),
      // CASO D: valor legado reconhecido, sem id explícito.
      human({
        accessLevel: "gestor",
        callsign: "VISUAL-LEGADO",
        ra: "990020",
      }),
    ],
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Human roster — estado administrativo de acesso (C1)", () => {
  it("CASO A: access_profile_id conhecido exibe 'Perfil configurado', nunca 'Não provisionado'", () => {
    render(<HumansPage />);

    const configured = card("990010");

    expect(configured.getByText("Perfil configurado")).toBeInTheDocument();
    expect(
      configured.queryByText("Não provisionado"),
    ).not.toBeInTheDocument();
    expect(configured.queryByText("Operador")).not.toBeInTheDocument();
    expect(configured.queryByText(/^Operador/)).not.toBeInTheDocument();
  });

  it("CASO B: ausência total de acesso exibe 'Não provisionado' e nunca 'Operador'", () => {
    render(<HumansPage />);

    const unprovisioned = card("990011");

    expect(unprovisioned.getByText("Não provisionado")).toBeInTheDocument();
    expect(
      unprovisioned.queryByText("Perfil configurado"),
    ).not.toBeInTheDocument();
    expect(unprovisioned.queryByText("Operador")).not.toBeInTheDocument();
  });

  it("CASO C: id explícito não resolvível exibe 'Configuração incompleta'", () => {
    render(<HumansPage />);

    const incomplete = card("990001");

    expect(incomplete.getByText("Configuração incompleta")).toBeInTheDocument();
    expect(incomplete.queryByText("Não provisionado")).not.toBeInTheDocument();
    expect(incomplete.queryByText("Operador")).not.toBeInTheDocument();
  });

  it("CASO D: valor legado reconhecido preserva o comportamento canônico do resolver", () => {
    render(<HumansPage />);

    const legacy = card("990020");

    expect(legacy.getByText("Perfil configurado")).toBeInTheDocument();
    expect(legacy.queryByText("Não provisionado")).not.toBeInTheDocument();
  });

  it("nenhum card do roster fabrica 'Operador'", () => {
    render(<HumansPage />);

    expect(screen.queryByText("Operador")).not.toBeInTheDocument();
  });

  it("o filtro/busca legado continua ancorado em accessLevel", () => {
    render(<HumansPage />);

    // O legado "gestor" (990020) é a única opção de Função, pois é o único
    // registro com accessLevel textual. O id canônico de 990010 NÃO vira
    // opção de Função — prova de que as duas semânticas seguem separadas.
    const roleFilter = screen.getByLabelText("Função");
    const options = within(roleFilter).getAllByRole("option");
    const values = options.map((option) => option.textContent);

    expect(values).toContain("gestor");
    expect(values).not.toContain("Perfil configurado");
    expect(values).not.toContain("Não provisionado");
  });
});
