/**
 * K9 Ops Web — Health Web v1 HW-4 Agenda — UX-R1 Component & Unit Tests
 *
 * Validates UX and presentation enhancements:
 * - schedule item rendering
 * - status badges across all states
 * - empty state presentation
 * - loading skeleton presentation
 * - error state presentation
 * - cancelled item presentation
 * - completed item presentation
 * - upcoming item presentation
 * - truthful accounting without fabricated values
 * - interactive summary card filtering and search
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ScheduleStatus } from "../../domain/read-states";
import type { ComposedScheduleEntry } from "../composition/schedule-composition";
import type { ScheduleType } from "../types";
import { ScheduleHeader } from "../presentation/schedule-header";
import {
  ScheduleSummaryCards,
  type ScheduleSummaryCounts,
} from "../presentation/schedule-summary-cards";
import {
  ScheduleEmpty,
  ScheduleError,
  ScheduleSkeleton,
} from "../presentation/schedule-states";
import { ScheduleRow } from "../presentation/schedule-row";

function createMockEntry(
  id: string,
  overrides: {
    dogName?: string;
    dogReg?: string | null;
    title?: string | null;
    scheduleType?: string | null;
    notes?: string | null;
    scheduledFor?: Date | null;
    dueUntil?: Date | null;
    timezone?: string | null;
    temporalStatus?: string | null;
  } = {},
): ComposedScheduleEntry {
  const {
    dogName = "Apollo",
    dogReg = "K9-001",
    title = "Reforço Vacinal V10",
    scheduleType = "vaccination",
    notes = "Dose anual preventiva",
    scheduledFor = new Date("2026-09-15T14:00:00Z"),
    dueUntil = new Date("2026-09-20T14:00:00Z"),
    timezone = "America/Sao_Paulo",
    temporalStatus = "upcoming",
  } = overrides;

  return {
    entry: {
      entryId: `k9-dog:${id}`,
      dogId: "k9-dog",
      scheduleId: id,
      dog: { id: "k9-dog", name: dogName, registrationNumber: dogReg },
      item: {
        scheduledFor,
        dueUntil,
        timezone,
        title,
        scheduleType: scheduleType as ScheduleType | null,
        notes,
      },
    },
    temporal: {
      temporalStatus: temporalStatus as ScheduleStatus | null,
      temporalAvailability: temporalStatus ? "available" : "invalid_schedule_temporal_input",
      effectiveDueUntil: dueUntil,
    },
    displayWindow: {
      inDisplayWindow: true,
      offsetDays: 1,
      availability: "available",
    },
  } as unknown as ComposedScheduleEntry;
}

describe("ScheduleHeader", () => {
  it("renders header title, description, and truthful total count", () => {
    render(
      <ScheduleHeader
        totalCount={12}
        overdueCount={0}
        todayCount={0}
      />,
    );

    expect(screen.getByText("Agenda de Procedimentos e Cuidados K9")).toBeTruthy();
    expect(screen.getByTestId("schedule-header-total").textContent).toBe("12");
    expect(screen.queryByTestId("schedule-header-overdue")).toBeNull();
    expect(screen.queryByTestId("schedule-header-today")).toBeNull();
  });

  it("renders overdue alert pill when overdueCount > 0", () => {
    render(
      <ScheduleHeader
        totalCount={8}
        overdueCount={3}
        todayCount={1}
      />,
    );

    expect(screen.getByTestId("schedule-header-overdue").textContent).toContain("3");
    expect(screen.getByTestId("schedule-header-today").textContent).toContain("1");
  });

  it("renders refresh button and triggers onRefresh callback", () => {
    const onRefresh = vi.fn();
    render(
      <ScheduleHeader
        totalCount={5}
        overdueCount={0}
        todayCount={0}
        onRefresh={onRefresh}
      />,
    );

    const refreshBtn = screen.getByRole("button", { name: /Atualizar agenda/i });
    fireEvent.click(refreshBtn);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});

describe("ScheduleSummaryCards", () => {
  const sampleCounts: ScheduleSummaryCounts = {
    total: 10,
    overdue: 2,
    today: 1,
    upcoming: 5,
    completed: 2,
    cancelled: 0,
    unavailable: 0,
  };

  it("renders all five summary card metrics honestly", () => {
    const onSelect = vi.fn();
    render(
      <ScheduleSummaryCards
        counts={sampleCounts}
        activeFilter="all"
        onSelectFilter={onSelect}
      />,
    );

    expect(screen.getByTestId("schedule-summary-card-all").textContent).toContain("10");
    expect(screen.getByTestId("schedule-summary-card-overdue").textContent).toContain("2");
    expect(screen.getByTestId("schedule-summary-card-today").textContent).toContain("1");
    expect(screen.getByTestId("schedule-summary-card-upcoming").textContent).toContain("5");
    expect(screen.getByTestId("schedule-summary-card-completed").textContent).toContain("2");
  });

  it("clicking an inactive card selects that filter", () => {
    const onSelect = vi.fn();
    render(
      <ScheduleSummaryCards
        counts={sampleCounts}
        activeFilter="all"
        onSelectFilter={onSelect}
      />,
    );

    fireEvent.click(screen.getByTestId("schedule-summary-card-overdue"));
    expect(onSelect).toHaveBeenCalledWith("overdue");
  });

  it("clicking an already active card resets to all", () => {
    const onSelect = vi.fn();
    render(
      <ScheduleSummaryCards
        counts={sampleCounts}
        activeFilter="overdue"
        onSelectFilter={onSelect}
      />,
    );

    fireEvent.click(screen.getByTestId("schedule-summary-card-overdue"));
    expect(onSelect).toHaveBeenCalledWith("all");
  });

  it("does not render fake values when counts are 0", () => {
    const emptyCounts: ScheduleSummaryCounts = {
      total: 0,
      overdue: 0,
      today: 0,
      upcoming: 0,
      completed: 0,
      cancelled: 0,
      unavailable: 0,
    };

    render(
      <ScheduleSummaryCards
        counts={emptyCounts}
        activeFilter="all"
        onSelectFilter={vi.fn()}
      />,
    );

    const overdueCard = screen.getByTestId("schedule-summary-card-overdue");
    expect(overdueCard.textContent).toContain("0");
    expect(overdueCard.textContent).toContain("em dia");
  });
});

describe("ScheduleStates", () => {
  it("renders loading skeleton with accessibility attributes and no fake data", () => {
    render(<ScheduleSkeleton />);

    const skeleton = screen.getByTestId("schedule-skeleton");
    expect(skeleton.getAttribute("aria-busy")).toBe("true");
    expect(screen.queryByTestId("schedule-list")).toBeNull();
    expect(screen.queryByText(/Nenhum agendamento/i)).toBeNull();
  });

  it("renders empty state with authoritative message", () => {
    const onRetry = vi.fn();
    render(<ScheduleEmpty onRetry={onRetry} />);

    expect(screen.getByTestId("schedule-empty")).toBeTruthy();
    expect(screen.getByText("Nenhum agendamento encontrado.")).toBeTruthy();
    expect(screen.getByText("Nenhum item de agenda existe para o efetivo autorizado.")).toBeTruthy();

    const retryBtn = screen.getByRole("button", { name: /Atualizar agenda/i });
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders error state with code, message, and retry button", () => {
    const onRetry = vi.fn();
    render(
      <ScheduleError
        message="Erro de comunicação com o servidor de dados."
        code="ERR_NETWORK"
        retryable={true}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByTestId("schedule-error")).toBeTruthy();
    expect(screen.getByText(/Erro de comunicação com o servidor de dados/i)).toBeTruthy();
    expect(screen.getByText("Código: ERR_NETWORK")).toBeTruthy();

    const retryBtn = screen.getByRole("button", { name: /Tentar novamente/i });
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("error state omits retry button when retryable is false or onRetry is omitted", () => {
    render(
      <ScheduleError
        message="Falha sem suporte a retry"
        retryable={false}
      />,
    );

    expect(screen.queryByRole("button", { name: /Tentar novamente/i })).toBeNull();
  });
});

describe("ScheduleRow item rendering", () => {
  it("renders complete schedule item card with title, date, dog badge, and type", () => {
    const entry = createMockEntry("e1", {
      dogName: "Zeus",
      dogReg: "K9-042",
      title: "Exame Ortopédico Preventivo",
      scheduleType: "exam",
      scheduledFor: new Date("2026-09-20T10:00:00Z"),
      timezone: "America/Sao_Paulo",
      temporalStatus: "upcoming",
    });

    render(<ScheduleRow composed={entry} />);

    const row = screen.getByTestId("schedule-row");
    // Invariant: title is first <p>
    expect(row.querySelector("p")?.textContent).toBe("Exame Ortopédico Preventivo");

    // Dog name and registration
    expect(screen.getByTestId("schedule-row-dog").textContent).toBe("Zeus");
    expect(screen.getByText("(K9-042)")).toBeTruthy();

    // Localized schedule type
    expect(screen.getByTestId("schedule-row-type").textContent).toBe("Exame");

    // Formatted datetime in timezone
    const dt = screen.getByTestId("schedule-row-datetime");
    expect(dt.textContent).toContain("20/09/2026");

    // Status badge
    expect(screen.getByTestId("schedule-row-status").textContent).toBe("Próximo");
  });

  it("renders cancelled item with distinct dimmed styling", () => {
    const entry = createMockEntry("e-cancelled", {
      title: "Consulta cancelada",
      temporalStatus: "cancelled",
    });

    render(<ScheduleRow composed={entry} />);

    const badge = screen.getByTestId("schedule-row-status");
    expect(badge.textContent).toBe("Cancelado");
    expect(badge.getAttribute("data-status")).toBe("cancelled");
    expect(badge.className).toContain("opacity-70");
  });

  it("renders completed item with distinct dimmed styling", () => {
    const entry = createMockEntry("e-completed", {
      title: "Banho e Tosa Concluído",
      scheduleType: "bath",
      temporalStatus: "completed",
    });

    render(<ScheduleRow composed={entry} />);

    const badge = screen.getByTestId("schedule-row-status");
    expect(badge.textContent).toBe("Concluído");
    expect(badge.getAttribute("data-status")).toBe("completed");
    expect(badge.className).toContain("opacity-70");
  });

  it("renders overdue item with alert tone", () => {
    const entry = createMockEntry("e-overdue", {
      title: "Vacina Antirrábica Atrasada",
      temporalStatus: "overdue",
    });

    render(<ScheduleRow composed={entry} />);

    const badge = screen.getByTestId("schedule-row-status");
    expect(badge.textContent).toBe("Atrasado");
    expect(badge.getAttribute("data-status")).toBe("overdue");
    expect(badge.className).toContain("border-red-400");
  });

  it("renders today item with cyan tone", () => {
    const entry = createMockEntry("e-today", {
      title: "Pesagem de Rotina",
      scheduleType: "weighing",
      temporalStatus: "today",
    });

    render(<ScheduleRow composed={entry} />);

    const badge = screen.getByTestId("schedule-row-status");
    expect(badge.textContent).toBe("Hoje");
    expect(badge.getAttribute("data-status")).toBe("today");
    expect(badge.className).toContain("border-cyan-300");
  });

  it("renders unavailable status when temporal status is null without fabricating a state", () => {
    const entry = createMockEntry("e-null", {
      title: "Item sem status temporal",
      temporalStatus: null,
    });

    render(<ScheduleRow composed={entry} />);

    const badge = screen.getByTestId("schedule-row-status");
    expect(badge.textContent).toBe("Status indisponível");
    expect(badge.getAttribute("data-status")).toBe("unavailable");
  });
});
