import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { K9ProfileHero } from "@/features/effective/components/k9-profile-v1/k9-profile-hero";
import type { K9ProfileBinomialContext } from "@/features/effective/hooks/use-k9-profile-context";
import type {
  EffectiveBinomial,
  EffectiveDog,
  EffectiveUser,
} from "@/features/effective/hooks/use-effective-data";
import { buildK9ProfileStatus } from "@/features/effective/lib/k9-profile-status";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} />
  ),
}));

const dog: EffectiveDog = {
  breed: "Pastor Belga Malinois",
  color: "Fulvo Encarvoado",
  conductorRa: "691755",
  dateOfBirth: new Date("2019-11-19T00:00:00Z"),
  id: "bono",
  microchip: null,
  name: "Bono",
  profileImageUrl: null,
  registrationNumber: "111222",
  sex: "M",
  specialties: [{ id: "s1", status: "in_formation", type: "deteccao" }],
  status: "Ativo",
};

const conductor: EffectiveUser = {
  accessLevel: "Operador",
  active: true,
  callsign: "Ragonha",
  fullName: "Ragonha da Silva",
  isK9Instructor: false,
  photoUrl: null,
  ra: "691755",
  unit: null,
};

const binomial: EffectiveBinomial = {
  active: true,
  dogId: "bono",
  dogName: "Bono",
  handlerName: "Ragonha",
  handlerRa: "691755",
  id: "bin-1",
  primary: true,
  primarySpecialty: null,
  readinessScore: 92,
  startAt: new Date("2025-01-10T00:00:00Z"),
  status: "Ativo",
  team: null,
  type: null,
  unit: null,
};

function renderHero(
  overrides: {
    binomialContext?: Partial<K9ProfileBinomialContext>;
    canEdit?: boolean;
    dog?: Partial<EffectiveDog>;
    readiness?: Parameters<typeof buildK9ProfileStatus>[0]["readiness"];
  } = {},
) {
  const mergedDog = { ...dog, ...overrides.dog };
  const context: K9ProfileBinomialContext = {
    binomial,
    conductor,
    hasActiveShift: true,
    isLegacyFallback: false,
    ...overrides.binomialContext,
  };
  const status = buildK9ProfileStatus({
    hasActiveShift: context.hasActiveShift,
    readiness: overrides.readiness ?? null,
    specialties: mergedDog.specialties,
    status: mergedDog.status,
  });

  return render(
    <K9ProfileHero
      ageYears={6}
      binomialContext={context}
      canEdit={overrides.canEdit ?? true}
      dog={mergedDog}
      editHref="/k9/bono/edit"
      specialtyLabels={["Detecção"]}
      status={status}
    />,
  );
}

afterEach(cleanup);

describe("K9ProfileHero — identidade", () => {
  it("exibe nome, raça e metadados principais", () => {
    renderHero();

    expect(screen.getByRole("heading", { level: 1, name: "Bono" })).toBeInTheDocument();
    expect(screen.getByText("Pastor Belga Malinois")).toBeInTheDocument();
    expect(screen.getByText("111222")).toBeInTheDocument();
    expect(screen.getByText("M")).toBeInTheDocument();
    expect(screen.getByText("Fulvo Encarvoado")).toBeInTheDocument();
  });

  it("microchip ausente é declarado, não omitido", () => {
    renderHero();

    const microchip = screen.getByText("Microchip").parentElement;
    expect(microchip).toHaveTextContent("Não informado");
  });

  it("exibe especialidades como chips", () => {
    renderHero();

    expect(screen.getByText("Detecção")).toBeInTheDocument();
  });

  it("sem foto usa fallback institucional em vez de imagem quebrada", () => {
    renderHero();

    expect(screen.queryByAltText("Foto de Bono")).not.toBeInTheDocument();
    expect(screen.getByText("Sem foto cadastrada")).toBeInTheDocument();
  });

  it("foto real recebe alt significativo", () => {
    renderHero({ dog: { profileImageUrl: "https://example.test/bono.png" } });

    expect(screen.getByAltText("Foto de Bono")).toBeInTheDocument();
  });
});

describe("K9ProfileHero — situação operacional", () => {
  it("mostra a situação operacional do classifier canônico", () => {
    renderHero();

    expect(screen.getByText("Em formação")).toBeInTheDocument();
  });

  it("temporarily_unfit não é apresentado como operacional", () => {
    renderHero({ readiness: "temporarily_unfit" });

    expect(
      screen.getByText("Indisponíveis / com restrições"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Prontos para emprego")).not.toBeInTheDocument();
  });
});

describe("K9ProfileHero — binômio", () => {
  it("com binômio ativo mostra dados e link real", () => {
    renderHero();

    expect(screen.getByText("Ragonha")).toBeInTheDocument();
    expect(screen.getByText("MAT. 691755")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Ver perfil do binômio/ }),
    ).toHaveAttribute("href", "/binomials/bin-1");
  });

  it("turno ativo real é afirmado", () => {
    renderHero();

    expect(screen.getByText("Ativo no turno")).toBeInTheDocument();
  });

  it("sem turno ativo não afirma turno", () => {
    renderHero({ binomialContext: { hasActiveShift: false } });

    expect(screen.getByText("Sem turno ativo")).toBeInTheDocument();
    expect(screen.queryByText("Ativo no turno")).not.toBeInTheDocument();
  });

  it("ausência de binômio degrada honestamente e desabilita a ação", () => {
    renderHero({
      binomialContext: { binomial: null, conductor: null, hasActiveShift: false },
    });

    expect(
      screen.getByText("Sem binômio ativo registrado para este K9."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Ver perfil do binômio/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Ver perfil do binômio/ }),
    ).toBeDisabled();
  });

  it("condutor de fallback é rotulado sem expor schema interno", () => {
    renderHero({
      binomialContext: { binomial: null, isLegacyFallback: true },
    });

    // O polish V1.1 trocou o aviso técnico por linguagem institucional: o
    // título passa a ser "Condutor de referência" e nenhum path aparece.
    expect(
      screen.getByRole("heading", { name: /Condutor de referência/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Referência cadastral/i)).toBeInTheDocument();
    expect(screen.queryByText(/dogs\.conductorRa/)).not.toBeInTheDocument();
  });

  it("nunca exibe readinessScore do binômio", () => {
    renderHero();

    // 92 é o `readinessScore` legado do fixture: não pode aparecer.
    expect(screen.queryByText(/92/)).not.toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it("Função não é renderizada: accessLevel não é função operacional", () => {
    renderHero();

    // O polish V1.1 removeu o campo em vez de exibir "Não informado"
    // permanentemente. `accessLevel` cai para "Operador" por padrão, então
    // nem o rótulo nem o valor podem aparecer como função.
    expect(screen.queryByText("Função")).not.toBeInTheDocument();
    expect(screen.queryByText("Operador")).not.toBeInTheDocument();
  });
});

describe("K9ProfileHero — ações", () => {
  it("Editar perfil aponta para a rota real de edição", () => {
    renderHero();

    expect(screen.getByRole("link", { name: /Editar perfil/ })).toHaveAttribute(
      "href",
      "/k9/bono/edit",
    );
  });

  it("sem permissão de edição a ação não é renderizada", () => {
    renderHero({ canEdit: false });

    expect(
      screen.queryByRole("link", { name: /Editar perfil/ }),
    ).not.toBeInTheDocument();
  });

  it("não cria menu de Ações fake", () => {
    renderHero();

    expect(screen.queryByRole("button", { name: /^Ações/ })).not.toBeInTheDocument();
  });
});
