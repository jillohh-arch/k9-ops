import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { K9DetailDrawer } from "@/features/effective/components/k9-roster/k9-detail-drawer";
import type {
  EffectiveBinomial,
  EffectiveDog,
  EffectiveUser,
} from "@/features/effective/hooks/use-effective-data";
import type { K9RosterDetail } from "@/features/effective/hooks/use-k9-roster-detail";
import { classifyK9 } from "@/features/effective/lib/k9-roster-classification";

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
  // Mock de `next/image`: um <img> real é necessário para que os testes
  // possam verificar o texto alternativo. A regra de LCP não se aplica aqui.
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

const dog: EffectiveDog = {
  breed: "Malinois Belga",
  color: "Castanho",
  conductorRa: "691755",
  // Datas em horário local: `Intl` formata no fuso local, então um instante
  // UTC-meia-noite apareceria como o dia anterior em fusos negativos.
  dateOfBirth: new Date(2019, 3, 12),
  id: "bono",
  microchip: "900000001234567",
  name: "Bono",
  profileImageUrl: "https://example.test/bono.png",
  registrationNumber: "111222",
  sex: "Macho",
  specialties: [
    { id: "s1", status: "operational", type: "deteccao" },
    { id: "s2", status: "operational", type: "guarda_protecao" },
  ],
  status: "Ativo",
};

const conductor: EffectiveUser = {
  accessLevel: "Operador K9",
  active: true,
  callsign: "Ragonha",
  fullName: "Ragonha",
  isK9Instructor: false,
  photoUrl: "https://example.test/ragonha.png",
  ra: "691755",
  unit: "GCM",
};

const binomial: EffectiveBinomial = {
  active: true,
  dogId: "bono",
  dogName: "Bono",
  handlerName: "Ragonha",
  handlerRa: "691755",
  id: "bin-1",
  primary: true,
  primarySpecialty: "deteccao",
  readinessScore: 87,
  startAt: new Date(2023, 0, 10),
  status: "Ativo",
  team: null,
  type: null,
  unit: "GCM",
};

const loadedDetail: K9RosterDetail = {
  error: null,
  lastTrainingSession: {
    date: new Date(2026, 6, 11, 7, 35),
    modality: "Pista odor específica",
    title: "Treinamento de detecção",
  },
  loading: false,
  readiness: null,
  readinessUnavailable: true,
};

function renderDrawer(overrides: {
  asOverlay?: boolean;
  binomial?: EffectiveBinomial | null;
  conductor?: EffectiveUser | null;
  detail?: Partial<K9RosterDetail>;
  dog?: Partial<EffectiveDog>;
  hasActiveShift?: boolean;
  microchip?: string | null;
  onClose?: () => void;
  pelage?: string | null;
} = {}) {
  const mergedDog = { ...dog, ...overrides.dog };
  const onClose = overrides.onClose ?? vi.fn();

  const view = render(
    <K9DetailDrawer
      ageYears={6}
      asOverlay={overrides.asOverlay ?? false}
      binomial={
        overrides.binomial === undefined ? binomial : overrides.binomial
      }
      classification={classifyK9({
        specialties: mergedDog.specialties,
        status: mergedDog.status,
      })}
      conductor={
        overrides.conductor === undefined ? conductor : overrides.conductor
      }
      detail={{ ...loadedDetail, ...overrides.detail }}
      dog={mergedDog}
      hasActiveShift={overrides.hasActiveShift ?? true}
      microchip={
        overrides.microchip === undefined
          ? mergedDog.microchip
          : overrides.microchip
      }
      onClose={onClose}
      pelage={
        overrides.pelage === undefined ? mergedDog.color : overrides.pelage
      }
      specialtyLabels={["Detecção", "Guarda & Proteção"]}
    />,
  );

  return { onClose, unmount: view.unmount };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("identificação", () => {
  it("exibe os dados disponíveis do K9", () => {
    renderDrawer();

    expect(screen.getByText("Bono")).toBeInTheDocument();
    expect(screen.getByText("Malinois Belga")).toBeInTheDocument();
    expect(screen.getByText("111222")).toBeInTheDocument();
    expect(screen.getByText("Macho")).toBeInTheDocument();
    expect(screen.getByText("Castanho")).toBeInTheDocument();
    expect(screen.getByText("900000001234567")).toBeInTheDocument();
    expect(screen.getByText(/12\/04\/2019/)).toBeInTheDocument();
  });

  it("usa 'Não informado' para microchip e cor ausentes, sem inventar", () => {
    renderDrawer({ microchip: null, pelage: null });

    expect(screen.getAllByText("Não informado").length).toBeGreaterThanOrEqual(
      2,
    );
    expect(screen.queryByText("900000001234567")).not.toBeInTheDocument();
    expect(screen.queryByText("Castanho")).not.toBeInTheDocument();
  });

  it("tem alt na foto do K9", () => {
    renderDrawer();
    expect(screen.getByAltText("Foto de Bono")).toBeInTheDocument();
  });

  it("funciona sem foto do K9", () => {
    renderDrawer({ dog: { profileImageUrl: null } });
    expect(screen.getByText("Bono")).toBeInTheDocument();
  });
});

describe("binômio", () => {
  it("exibe o vínculo resolvido", () => {
    renderDrawer();

    expect(screen.getByText("Ragonha")).toBeInTheDocument();
    expect(screen.getByText(/691755/)).toBeInTheDocument();
    expect(screen.getByText(/10\/01\/2023/)).toBeInTheDocument();
  });

  it("não apresenta perfil de acesso como função operacional", () => {
    renderDrawer();

    // `accessLevel` é autorização, não função no turno. O campo Função
    // degrada para "Não informado" enquanto não houver fonte canônica.
    expect(screen.queryByText("Operador K9")).not.toBeInTheDocument();
    expect(screen.queryByText("Administrador")).not.toBeInTheDocument();
  });

  it("informa ausência de binômio sem inventar condutor", () => {
    renderDrawer({ binomial: null, conductor: null });

    expect(screen.getByText("Sem binômio ativo")).toBeInTheDocument();
    expect(screen.queryByText("Ragonha")).not.toBeInTheDocument();
  });

  it("não afirma turno ativo apenas por existir condutor", () => {
    renderDrawer({ hasActiveShift: false });

    expect(screen.getByText("Sem turno ativo")).toBeInTheDocument();
    expect(screen.queryByText("Ativo no turno")).not.toBeInTheDocument();
  });

  it("afirma turno ativo somente com turno real", () => {
    renderDrawer({ hasActiveShift: true });
    expect(screen.getByText("Ativo no turno")).toBeInTheDocument();
  });
});

describe("autoridade do vínculo — binômio real vs. referência cadastral", () => {
  it("com binômio ativo real usa 'Binômio atual' e exibe o vínculo", () => {
    renderDrawer();

    expect(
      screen.getByRole("heading", { name: "Binômio atual" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Condutor de referência"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Referência cadastral")).not.toBeInTheDocument();
    // Vínculo formal existe: a data pertence ao binômio.
    expect(screen.getByText("Vínculo desde")).toBeInTheDocument();
    expect(screen.getByText(/10\/01\/2023/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver binômio/ })).toHaveAttribute(
      "href",
      "/binomials/bin-1",
    );
  });

  it("sem binômio real usa 'Condutor de referência' com marcador de origem", () => {
    renderDrawer({ binomial: null });

    expect(
      screen.getByRole("heading", { name: "Condutor de referência" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Referência cadastral")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Binômio atual" }),
    ).not.toBeInTheDocument();
    // O condutor resolvido continua visível — só a autoridade muda.
    expect(screen.getByText("Ragonha")).toBeInTheDocument();
  });

  it("no fallback não exibe campos de vínculo formal", () => {
    renderDrawer({ binomial: null });

    expect(screen.queryByText("Vínculo desde")).not.toBeInTheDocument();
    expect(screen.queryByText("Função")).not.toBeInTheDocument();
    expect(screen.queryByText(/10\/01\/2023/)).not.toBeInTheDocument();
  });

  it("no fallback explica a origem em linguagem institucional", () => {
    renderDrawer({ binomial: null });

    expect(
      screen.getByText(/Condutor indicado no cadastro do K9/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Não há binômio ativo registrado/),
    ).toBeInTheDocument();
  });

  it("nunca expõe path/schema técnico na UI", () => {
    for (const props of [{}, { binomial: null }]) {
      cleanup();
      renderDrawer(props);
      const text = document.body.textContent ?? "";
      for (const leak of [
        "conductorRa",
        "conductor_ra",
        "dogs.conductorRa",
        "binomials",
        "compatibilidade",
        "legacy",
        "isLegacyFallback",
      ]) {
        expect(text).not.toContain(leak);
      }
    }
  });

  it("no fallback o link de binômio não é renderizado e a ação fica desabilitada", () => {
    renderDrawer({ binomial: null });

    expect(
      screen.queryByRole("link", { name: /Ver binômio/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ver binômio/ })).toBeDisabled();
  });

  it("fallback sem turno factual não afirma 'Ativo no turno'", () => {
    renderDrawer({ binomial: null, hasActiveShift: false });

    expect(screen.getByText("Sem turno ativo")).toBeInTheDocument();
    expect(screen.queryByText("Ativo no turno")).not.toBeInTheDocument();
  });

  it("fallback com turno factual mantém 'Ativo no turno'", () => {
    renderDrawer({ binomial: null, hasActiveShift: true });
    expect(screen.getByText("Ativo no turno")).toBeInTheDocument();
  });
});

describe("humanização da última atividade", () => {
  it("não renderiza token técnico cru", () => {
    renderDrawer({
      detail: {
        lastTrainingSession: {
          date: new Date(2026, 6, 11, 7, 35),
          modality: "detection_formation",
          title: "detection_formation",
        },
      },
    });

    const text = document.body.textContent ?? "";
    expect(text).not.toContain("detection_formation");
  });

  it("exibe o rótulo humano equivalente", () => {
    renderDrawer({
      detail: {
        lastTrainingSession: {
          date: new Date(2026, 6, 11, 7, 35),
          modality: "detection_formation",
          title: "detection_formation",
        },
      },
    });

    expect(
      screen.getAllByText(/Detecção — Em formação/).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("nenhum snake_case conhecido vaza pela última atividade", () => {
    const tokens = [
      "guarda_protecao",
      "busca_captura",
      "obedience_formation",
      "in_formation",
    ];

    for (const token of tokens) {
      cleanup();
      renderDrawer({
        detail: {
          lastTrainingSession: {
            date: new Date(2026, 6, 11, 7, 35),
            modality: token,
            title: token,
          },
        },
      });
      expect(document.body.textContent ?? "").not.toContain(token);
    }
  });

  it("título não traduzível cai no texto genérico", () => {
    renderDrawer({
      detail: {
        lastTrainingSession: { date: null, modality: null, title: "" },
      },
    });

    expect(screen.getByText("Sessão de treinamento")).toBeInTheDocument();
  });
});

describe("scroll-lock do sheet", () => {
  it("trava o scroll do body ao abrir como overlay", () => {
    renderDrawer({ asOverlay: true });
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("restaura o scroll ao desmontar", () => {
    const { unmount } = renderDrawer({ asOverlay: true });
    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("não trava o scroll no modo inline", () => {
    renderDrawer({ asOverlay: false });
    expect(document.body.style.overflow).not.toBe("hidden");
  });
});

describe("prontidão", () => {
  it("mostra 'Prontidão não disponível' quando a fonte Health não existe", () => {
    renderDrawer({ detail: { readiness: null, readinessUnavailable: true } });

    expect(screen.getByText("Prontidão não disponível")).toBeInTheDocument();
    // Nunca apresenta score percentual inventado.
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    // Nem converte ausência de fonte em afirmação clínica.
    expect(screen.queryByText("Não avaliado")).not.toBeInTheDocument();
  });

  it("exibe o estado oficial Health quando disponível", () => {
    renderDrawer({
      detail: {
        readiness: {
          evaluatedAt: new Date(2026, 6, 13, 8, 10),
          state: "operational",
        },
        readinessUnavailable: false,
      },
    });

    expect(screen.getByText("Operacional")).toBeInTheDocument();
    expect(
      screen.getByText("Apto para todas as atividades"),
    ).toBeInTheDocument();
  });

  it("exibe temporarily_unfit com label textual, não só cor", () => {
    renderDrawer({
      detail: {
        readiness: { evaluatedAt: null, state: "temporarily_unfit" },
        readinessUnavailable: false,
      },
    });

    expect(screen.getByText("Temporariamente inapto")).toBeInTheDocument();
  });

  it("não usa readinessScore de binômios como substituto", () => {
    renderDrawer({ detail: { readiness: null, readinessUnavailable: true } });
    expect(screen.queryByText("87")).not.toBeInTheDocument();
    expect(screen.queryByText(/87\s*%/)).not.toBeInTheDocument();
  });
});

describe("última atividade e agenda", () => {
  it("mostra a última sessão de treinamento", () => {
    renderDrawer();

    expect(screen.getByText("Treinamento de detecção")).toBeInTheDocument();
    expect(screen.getByText("Pista odor específica")).toBeInTheDocument();
  });

  it("informa ausência de sessão sem inventar atividade", () => {
    renderDrawer({ detail: { lastTrainingSession: null } });

    expect(
      screen.getByText("Nenhuma sessão de treinamento registrada"),
    ).toBeInTheDocument();
  });

  it("não renderiza vacina/data fictícia do mockup", () => {
    renderDrawer();

    expect(screen.queryByText(/Vacina múltipla anual/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Próxima agenda/i)).not.toBeInTheDocument();
  });
});

describe("loading e erro localizados", () => {
  it("mostra carregamento localizado sem esconder a identificação", () => {
    renderDrawer({ detail: { loading: true } });

    // O roster e a identificação seguem visíveis durante o carregamento.
    expect(screen.getByText("Bono")).toBeInTheDocument();
    expect(screen.getByText("111222")).toBeInTheDocument();
  });

  it("mostra erro localizado e mantém o botão fechar disponível", () => {
    renderDrawer({ detail: { error: "permission-denied" } });

    expect(screen.getByRole("status")).toHaveTextContent(/permission-denied/);
    expect(
      screen.getByRole("button", { name: "Fechar detalhes do K9" }),
    ).toBeEnabled();
  });
});

describe("fechamento", () => {
  it("fecha ao clicar no X", () => {
    const { onClose } = renderDrawer();

    fireEvent.click(
      screen.getByRole("button", { name: "Fechar detalhes do K9" }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Escape fecha quando é overlay", () => {
    const { onClose } = renderDrawer({ asOverlay: true });

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Escape não é sequestrado no modo inline", () => {
    const { onClose } = renderDrawer({ asOverlay: false });

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("overlay é um dialog com foco no botão fechar", () => {
    renderDrawer({ asOverlay: true });

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(
      screen.getByRole("button", { name: "Fechar detalhes do K9" }),
    ).toHaveFocus();
  });
});

describe("ações", () => {
  it("Ver perfil aponta para a rota canônica do K9", () => {
    renderDrawer();

    expect(screen.getByRole("link", { name: /Ver perfil/ })).toHaveAttribute(
      "href",
      "/k9/bono",
    );
  });

  it("Ver binômio é habilitado quando o vínculo é resolvível", () => {
    renderDrawer();

    expect(screen.getByRole("link", { name: /Ver binômio/ })).toHaveAttribute(
      "href",
      "/binomials/bin-1",
    );
  });

  it("Ver binômio é desabilitado sem binômio ativo", () => {
    renderDrawer({ binomial: null });

    expect(
      screen.queryByRole("link", { name: /Ver binômio/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ver binômio/ })).toBeDisabled();
  });

  it("Abrir prontuário fica desabilitado — sem rota canônica, sem destino fictício", () => {
    renderDrawer();

    const action = screen.getByRole("button", { name: /Abrir prontuário/ });
    expect(action).toBeDisabled();
    expect(
      screen.queryByRole("link", { name: /Abrir prontuário/ }),
    ).not.toBeInTheDocument();
  });
});
