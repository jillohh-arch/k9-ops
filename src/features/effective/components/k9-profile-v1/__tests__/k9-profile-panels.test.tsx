import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { K9ProfileDocuments } from "@/features/effective/components/k9-profile-v1/k9-profile-documents";
import { K9ProfileHealth } from "@/features/effective/components/k9-profile-v1/k9-profile-health";
import { K9ProfileHistory } from "@/features/effective/components/k9-profile-v1/k9-profile-history";
import { K9ProfileTraining } from "@/features/effective/components/k9-profile-v1/k9-profile-training";
import type { K9RosterDetail } from "@/features/effective/hooks/use-k9-roster-detail";
import type { ProfileRecord } from "@/features/effective/lib/k9-profile-records";
import { buildK9Activity } from "@/features/effective/lib/k9-profile-activity";
import { buildK9ProfileStatus } from "@/features/effective/lib/k9-profile-status";
import type { HealthDogSummary } from "@/features/health/hooks/use-health-data";

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

afterEach(cleanup);

const emptyDetail: K9RosterDetail = {
  error: null,
  lastTrainingSession: null,
  loading: false,
  readiness: null,
  readinessUnavailable: true,
};

function record(fields: Record<string, unknown>, id = "r1"): ProfileRecord {
  return { _id: id, ...fields } as ProfileRecord;
}

function statusWith(readiness: Parameters<typeof buildK9ProfileStatus>[0]["readiness"]) {
  return buildK9ProfileStatus({
    hasActiveShift: false,
    readiness,
    specialties: [{ status: "in_formation", type: "deteccao" }],
    status: "Ativo",
  });
}

const summary: HealthDogSummary = {
  documentsCount: 1,
  dogId: "bono",
  dogName: "Bono",
  eventsCount: 16,
  exam: "current",
  idealRange: { max: 32, min: 25 },
  issues: [],
  latestExamAt: new Date("2026-08-11T00:00:00Z"),
  latestVaccineAt: new Date("2026-08-11T00:00:00Z"),
  latestVaccineDueAt: new Date("2027-08-11T00:00:00Z"),
  latestWeightAt: new Date("2026-08-13T00:00:00Z"),
  latestWeightKg: 29.5,
  photoUrl: null,
  ready: true,
  status: "Ativo",
  vaccine: "current",
  weight: "in_range",
};

describe("Aba Saúde — consome outputs do módulo Health", () => {
  it("prontidão indisponível usa o texto literal do contrato", () => {
    render(
      <K9ProfileHealth
        error={null}
        events={[]}
        loading={false}
        status={statusWith(null)}
        summary={summary}
      />,
    );

    expect(screen.getByText("Prontidão não disponível")).toBeInTheDocument();
    expect(screen.getByText("Sem resumo clínico disponível.")).toBeInTheDocument();
  });

  it("prontidão disponível mostra o rótulo oficial", () => {
    render(
      <K9ProfileHealth
        error={null}
        events={[]}
        loading={false}
        status={statusWith("fit_with_restrictions")}
        summary={summary}
      />,
    );

    expect(screen.getByText("Apto com restrições")).toBeInTheDocument();
  });

  it("vacina e peso vêm do resumo Health, sem recálculo local", () => {
    render(
      <K9ProfileHealth
        error={null}
        events={[]}
        loading={false}
        status={statusWith(null)}
        summary={summary}
      />,
    );

    expect(screen.getByText("Em dia")).toBeInTheDocument();
    expect(screen.getByText("Dentro da faixa ideal")).toBeInTheDocument();
    expect(screen.getByText("29.5 kg")).toBeInTheDocument();
    expect(screen.getByText("25.0–32.0 kg")).toBeInTheDocument();
  });

  it("resumo Health ausente degrada sem inventar estado", () => {
    render(
      <K9ProfileHealth
        error={null}
        events={[]}
        loading={false}
        status={statusWith(null)}
        summary={null}
      />,
    );

    expect(
      screen.getByText("Resumo de vacinação não disponível para este K9."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Resumo de peso não disponível para este K9."),
    ).toBeInTheDocument();
  });

  it("nunca exibe percentual sintético de prontidão", () => {
    render(
      <K9ProfileHealth
        error={null}
        events={[]}
        loading={false}
        status={statusWith("operational")}
        summary={summary}
      />,
    );

    expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument();
  });

  it("erro do módulo é local, sem derrubar o painel", () => {
    render(
      <K9ProfileHealth
        error="permission-denied"
        events={[]}
        loading={false}
        status={statusWith(null)}
        summary={null}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("permission-denied");
    expect(screen.getByText("Prontidão não disponível")).toBeInTheDocument();
  });

  it("CTA aponta para a rota real do módulo Saúde", () => {
    render(
      <K9ProfileHealth
        error={null}
        events={[]}
        loading={false}
        status={statusWith(null)}
        summary={summary}
      />,
    );

    expect(screen.getByRole("link", { name: /Acessar Saúde/ })).toHaveAttribute(
      "href",
      "/health",
    );
  });
});

describe("Aba Treinamento — resumo com deep-link real", () => {
  it("deep-link usa a rota existente por cão", () => {
    render(
      <K9ProfileTraining
        detail={emptyDetail}
        dogId="bono"
        error={null}
        loading={false}
        sessions={[]}
        specialties={[]}
      />,
    );

    expect(
      screen.getByRole("link", { name: /Abrir treinamento completo/ }),
    ).toHaveAttribute("href", "/training/dogs/bono");
  });

  it("sem sessão registrada declara ausência", () => {
    render(
      <K9ProfileTraining
        detail={emptyDetail}
        dogId="bono"
        error={null}
        loading={false}
        sessions={[]}
        specialties={[]}
      />,
    );

    expect(
      screen.getByText("Nenhuma sessão de treinamento registrada."),
    ).toBeInTheDocument();
  });

  it("situação por especialidade vem do registro, sem reclassificar", () => {
    render(
      <K9ProfileTraining
        detail={emptyDetail}
        dogId="bono"
        error={null}
        loading={false}
        sessions={[]}
        specialties={[
          record({ status: "in_formation", type: "deteccao" }, "sp1"),
        ]}
      />,
    );

    expect(screen.getByText("Detecção")).toBeInTheDocument();
    expect(screen.getByText("Em formação")).toBeInTheDocument();
  });
});

describe("Aba Histórico — somente eventos reais", () => {
  it("ordena por timestamp e rotula a categoria", () => {
    const activity = buildK9Activity({
      healthEvents: [record({ date: "2026-01-10", type: "exam" }, "h1")],
      sessions: [record({ date: "2026-03-01" }, "s1")],
    });

    render(<K9ProfileHistory activity={activity} error={null} loading={false} />);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Treinamento");
    expect(items[1]).toHaveTextContent("Saúde");
  });

  it("timeline vazia explica que registros sem data não são exibidos", () => {
    render(<K9ProfileHistory activity={[]} error={null} loading={false} />);

    expect(
      screen.getByText(/Registros sem timestamp não são exibidos/),
    ).toBeInTheDocument();
  });
});

describe("Aba Documentos", () => {
  it("lista documentos reais com data e tipo", () => {
    render(
      <K9ProfileDocuments
        documents={[
          record(
            {
              // Meio-dia local: evita que o fuso empurre a data para o dia
              // anterior na formatação.
              dataUpload: new Date(2026, 3, 12, 12),
              nome: "Carteira de Identificação",
              tipo: "Identificação",
            },
            "d1",
          ),
        ]}
        error={null}
        loading={false}
      />,
    );

    expect(screen.getByText("Carteira de Identificação")).toBeInTheDocument();
    expect(screen.getByText("Identificação")).toBeInTheDocument();
    expect(screen.getByText("12/04/2026")).toBeInTheDocument();
  });

  it("documento sem arquivo não ganha link falso", () => {
    render(
      <K9ProfileDocuments
        documents={[record({ dataUpload: "2026-04-12", nome: "Sem anexo" }, "d1")]}
        error={null}
        loading={false}
      />,
    );

    expect(screen.queryByRole("link", { name: /Abrir/ })).not.toBeInTheDocument();
    expect(screen.getByText("Sem arquivo")).toBeInTheDocument();
  });

  it("empty state é honesto", () => {
    render(<K9ProfileDocuments documents={[]} error={null} loading={false} />);

    expect(
      screen.getByText("Nenhum documento registrado para este K9."),
    ).toBeInTheDocument();
  });

  it("não oferece upload nesta rodada", () => {
    render(<K9ProfileDocuments documents={[]} error={null} loading={false} />);

    expect(screen.queryByRole("button", { name: /Enviar|Upload|Anexar/ })).not.toBeInTheDocument();
  });
});
