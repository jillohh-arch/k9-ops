import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { K9ProfileHero } from "@/features/effective/components/k9-profile-v1/k9-profile-hero";
import { K9ActivityTimeline } from "@/features/effective/components/k9-profile-v1/k9-profile-timeline";
import type { K9ProfileBinomialContext } from "@/features/effective/hooks/use-k9-profile-context";
import type {
  EffectiveBinomial,
  EffectiveDog,
  EffectiveUser,
} from "@/features/effective/hooks/use-effective-data";
import { buildK9Activity } from "@/features/effective/lib/k9-profile-activity";
import { buildK9ProfileStatus } from "@/features/effective/lib/k9-profile-status";
import type { ProfileRecord } from "@/features/effective/lib/k9-profile-records";

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

afterEach(cleanup);

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

function renderHero(context: Partial<K9ProfileBinomialContext>) {
  const merged: K9ProfileBinomialContext = {
    binomial: null,
    conductor: null,
    hasActiveShift: false,
    isLegacyFallback: false,
    ...context,
  };
  const status = buildK9ProfileStatus({
    hasActiveShift: merged.hasActiveShift,
    readiness: null,
    specialties: dog.specialties,
    status: dog.status,
  });

  return render(
    <K9ProfileHero
      ageYears={6}
      binomialContext={merged}
      canEdit
      dog={dog}
      editHref="/k9/bono/edit"
      specialtyLabels={["Detecção"]}
      status={status}
    />,
  );
}

describe("P6 — título segue a autoridade do dado", () => {
  it("com vínculo ativo real exibe 'Binômio atual'", () => {
    renderHero({ binomial, conductor, hasActiveShift: true });

    expect(
      screen.getByRole("heading", { name: /Binômio atual/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /Condutor de referência/i }),
    ).not.toBeInTheDocument();
  });

  it("só com fallback cadastral exibe 'Condutor de referência'", () => {
    renderHero({ conductor, isLegacyFallback: true });

    expect(
      screen.getByRole("heading", { name: /Condutor de referência/i }),
    ).toBeInTheDocument();
    // Chamar isso de "binômio atual" afirmaria um vínculo inexistente.
    expect(
      screen.queryByRole("heading", { name: /Binômio atual/i }),
    ).not.toBeInTheDocument();
  });

  it("fallback recebe indicação institucional de origem", () => {
    renderHero({ conductor, isLegacyFallback: true });

    expect(screen.getByText(/Referência cadastral/i)).toBeInTheDocument();
  });
});

describe("P6/P10 — nenhuma linguagem técnica na superfície", () => {
  const FORBIDDEN = [
    /dogs\.conductorRa/,
    /conductor_ra/,
    /\bbinomials\b/,
    /active_shifts/,
    /health_summary/,
    /readinessScore/,
    /readiness_score/,
  ];

  it("fallback não expõe path, coleção ou campo interno", () => {
    const { container } = renderHero({ conductor, isLegacyFallback: true });
    const text = container.textContent ?? "";

    for (const pattern of FORBIDDEN) {
      expect(text).not.toMatch(pattern);
    }
  });

  it("fallback explica a origem em linguagem de negócio", () => {
    renderHero({ conductor, isLegacyFallback: true });

    expect(
      screen.getByText(/Condutor indicado no cadastro do K9/i),
    ).toBeInTheDocument();
  });

  it("com binômio real também não expõe termo técnico", () => {
    const { container } = renderHero({
      binomial,
      conductor,
      hasActiveShift: true,
    });
    const text = container.textContent ?? "";

    for (const pattern of FORBIDDEN) {
      expect(text).not.toMatch(pattern);
    }
    // `readinessScore` do fixture é 92: não pode vazar como número.
    expect(text).not.toMatch(/92/);
  });
});

describe("P6 — turno ativo é dimensão factual independente", () => {
  it("turno ativo continua visível no fallback", () => {
    renderHero({ conductor, hasActiveShift: true, isLegacyFallback: true });

    expect(screen.getByText("Ativo no turno")).toBeInTheDocument();
  });

  it("sem turno ativo o fallback não afirma turno", () => {
    renderHero({ conductor, hasActiveShift: false, isLegacyFallback: true });

    expect(screen.getByText("Sem turno ativo")).toBeInTheDocument();
    expect(screen.queryByText("Ativo no turno")).not.toBeInTheDocument();
  });
});

describe("P6 — nenhum link falso sem binomialId", () => {
  it("fallback desabilita a ação em vez de linkar", () => {
    renderHero({ conductor, hasActiveShift: true, isLegacyFallback: true });

    expect(
      screen.queryByRole("link", { name: /Ver perfil do binômio/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Ver perfil do binômio/i }),
    ).toBeDisabled();
  });

  it("nenhum href para /binomials é emitido no fallback", () => {
    const { container } = renderHero({ conductor, isLegacyFallback: true });

    expect(container.querySelector('a[href*="/binomials"]')).toBeNull();
  });

  it("com vínculo real o link aponta para o binômio", () => {
    renderHero({ binomial, conductor, hasActiveShift: true });

    expect(
      screen.getByRole("link", { name: /Ver perfil do binômio/i }),
    ).toHaveAttribute("href", "/binomials/bin-1");
  });

  it("'Vínculo desde' não é afirmado no fallback", () => {
    renderHero({ conductor, isLegacyFallback: true });

    expect(screen.queryByText(/Vínculo desde/i)).not.toBeInTheDocument();
  });
});

describe("P9 — timeline preserva fatos e ordem", () => {
  function record(fields: Record<string, unknown>, id: string): ProfileRecord {
    return { _id: id, ...fields } as ProfileRecord;
  }

  const activity = buildK9Activity({
    healthEvents: [record({ date: "2026-01-10", type: "exam" }, "h1")],
    sessions: [
      record({ date: "2026-03-01", trainingType: "detection_formation" }, "s1"),
    ],
    weights: [record({ date: "2026-02-01", weight_kg: 29.5 }, "w1")],
  });

  it("renderiza as categorias reais como chips legíveis", () => {
    render(<K9ActivityTimeline items={activity} />);

    expect(screen.getByText("Treinamento")).toBeInTheDocument();
    expect(screen.getByText("Peso")).toBeInTheDocument();
    expect(screen.getByText("Saúde")).toBeInTheDocument();
  });

  it("preserva a ordem por timestamp decrescente", () => {
    render(<K9ActivityTimeline items={activity} />);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Treinamento");
    expect(items[1]).toHaveTextContent("Peso");
    expect(items[2]).toHaveTextContent("Saúde");
  });

  it("usa lista ordenada — leitura de timeline, não tabela", () => {
    const { container } = render(<K9ActivityTimeline items={activity} />);

    expect(container.querySelector("ol")).not.toBeNull();
    expect(container.querySelector("table")).toBeNull();
  });

  it("variante compacta mantém os mesmos fatos", () => {
    render(<K9ActivityTimeline items={activity} variant="compact" />);

    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("29.5 kg")).toBeInTheDocument();
  });

  it("nenhum token técnico chega à timeline", () => {
    const { container } = render(<K9ActivityTimeline items={activity} />);

    expect(container.textContent).not.toMatch(/detection_formation/);
    expect(container.textContent).toMatch(/Detecção — Em formação/);
  });
});
