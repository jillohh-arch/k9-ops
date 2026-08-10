/**
 * WEIGHT-01E-C2C-C — o Web não registra pesagem operacional.
 *
 * O hub oferecia a seção "Pesagem", que chamava `createHealthWeight` →
 * `adminCreateK9WeightRecord`: um writer legítimo, mas não canônico — sem
 * receipt/idempotência, sem validação de cronologia e com dual-write em
 * `weight_history`, concorrendo com o comando canônico do app.
 *
 * Estes testes renderizam o hub de verdade (não havia harness de render antes)
 * e provam que a superfície de escrita desapareceu enquanto os outros tipos de
 * registro continuam disponíveis.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase/client", () => ({ db: {}, storage: {} }));
vi.mock("@/lib/firebase/functions", () => ({
  callAdminCreateHealthEvent: vi.fn(),
  callAdminCreateK9HealthDocument: vi.fn(),
}));

import {
  HealthEventHub,
  type HealthHubSection,
} from "@/features/health/components/health-event-hub";

const dogs = [
  { dogId: "dog-1", dogName: "Apolo" },
] as unknown as Parameters<typeof HealthEventHub>[0]["dogs"];

function renderHub(initialSection?: HealthHubSection) {
  return render(
    <HealthEventHub
      dogs={dogs}
      initialDogId="dog-1"
      initialSection={initialSection}
      onClose={() => undefined}
      onSaved={() => undefined}
      open
    />,
  );
}

describe("HealthEventHub — pesagem aposentada", () => {
  it("T1 não oferece a seção de pesagem", () => {
    renderHub();

    expect(screen.queryByText("Pesagem")).toBeNull();
    expect(screen.queryByText(/registro canonico de peso/i)).toBeNull();
  });

  it("T2 não expõe campo de peso operacional", () => {
    renderHub();

    expect(screen.queryByText("Peso (kg)")).toBeNull();
    expect(screen.queryByText("Local / contexto")).toBeNull();
    expect(screen.queryByText("Observações da pesagem")).toBeNull();
  });

  it("T3 os outros tipos de registro permanecem disponíveis", () => {
    renderHub();

    // `getAllByText`: os rótulos aparecem na aba e também no cabeçalho do
    // formulário da seção ativa. O que importa é que continuem presentes.
    expect(screen.getAllByText("Vacina").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Exame / consulta").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Medicação").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Documento").length).toBeGreaterThan(0);
  });

  it("a seção padrão continua sendo vacinação e renderiza seu formulário", () => {
    renderHub();

    // Rótulo genérico de data: não existe mais variante "Data da pesagem".
    expect(screen.getByText("Data do evento")).toBeTruthy();
    expect(screen.queryByText("Data da pesagem")).toBeNull();
  });
});
