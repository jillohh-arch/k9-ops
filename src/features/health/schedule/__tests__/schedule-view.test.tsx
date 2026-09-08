/**
 * HW-4.WEB-SCHED-RD-I6 — ScheduleView presentation contract.
 *
 * The load-bearing presentation invariants, each written as a killer rather
 * than a snapshot:
 *
 *   K1 forbidden is never emptiness
 *   K2 incomplete coverage is never an authoritative "nothing exists"
 *   K3 source-empty IS truthful when coverage is complete
 *   K4 a refresh keeps the previously trustworthy rows visible
 *   K5 the ITEM'S timezone controls the displayed date/time
 *   K6 an unusable timezone fails closed; the row survives
 *   K7 terminal items stay in the operational list
 *   K8 an underivable temporal status stays visible as unavailable
 *   K9 the frozen RD-I3 order is preserved (no presentation sort)
 *
 * K5 is the display-layer analogue of conflating the two 7-day concepts: it
 * fails if the formatter's `timeZone` option is ever dropped.
 *
 * Fixtures are ALREADY-COMPOSED entries — no temporal algorithm is reproduced
 * here. The hook is mocked, so presentation is what is under test.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ReadState } from "../../domain/read-states";
import type { ComposedScheduleEntry } from "../composition/schedule-composition";
import type { ScheduleScopeCoverage } from "../data/schedule-scope-loader";
import type { UseScheduleResult } from "../hooks/use-schedule";

// The view must consume the hook and NOTHING firebase-shaped. The hook itself
// is stubbed so presentation states are what is under test.
const hookMock = vi.hoisted(() => ({ current: null as UseScheduleResult | null }));
vi.mock("../hooks/use-schedule", () => ({
  useSchedule: () => hookMock.current,
}));

import { ScheduleView } from "../presentation/schedule-view";

function coverage(overrides: Partial<ScheduleScopeCoverage> = {}): ScheduleScopeCoverage {
  return {
    dogsInScope: 1,
    authorizedDogIds: ["k9-a"],
    forbiddenDogIds: [],
    failedDogIds: [],
    partialEntryIds: [],
    complete: true,
    ...overrides,
  };
}

/**
 * A composed entry, built directly (never via the temporal evaluators).
 * Presentation only ever reads these fields.
 */
function composed(
  scheduleId: string,
  overrides: {
    dogName?: string;
    title?: string | null;
    scheduleType?: string | null;
    scheduledFor?: Date | null;
    timezone?: string | null;
    temporalStatus?: string | null;
  } = {},
): ComposedScheduleEntry {
  const {
    dogName = "Apollo",
    title = "Reforço V10",
    scheduleType = "vaccination",
    scheduledFor = new Date("2026-09-10T13:00:00Z"),
    timezone = "UTC",
    temporalStatus = "today",
  } = overrides;

  return {
    entry: {
      entryId: `k9-a:${scheduleId}`,
      dogId: "k9-a",
      scheduleId,
      dog: { id: "k9-a", name: dogName },
      item: { scheduledFor, timezone, title, scheduleType },
    },
    temporal: {
      temporalStatus,
      temporalAvailability: temporalStatus ? "available" : "invalid_schedule_temporal_input",
      effectiveDueUntil: null,
    },
    displayWindow: {
      inDisplayWindow: true,
      offsetDays: 0,
      availability: "available",
    },
  } as unknown as ComposedScheduleEntry;
}

function mountWith(
  state: ReadState<ComposedScheduleEntry[]>,
  cov: ScheduleScopeCoverage = coverage(),
  extra: Partial<UseScheduleResult> = {},
) {
  const refresh = extra.refresh ?? vi.fn();
  hookMock.current = {
    state,
    coverage: cov,
    authorityStatus: extra.authorityStatus ?? "allowed",
    refresh,
  } as UseScheduleResult;
  return { refresh, ...render(<ScheduleView />) };
}

beforeEach(() => {
  hookMock.current = null;
});

describe("loading", () => {
  it("authority/read in flight renders loading, not an answer", () => {
    mountWith({ status: "loading" }, coverage({ complete: false, dogsInScope: 0 }), {
      authorityStatus: "loading",
    });

    expect(screen.queryByTestId("schedule-list")).toBeNull();
    expect(screen.queryByText(/Nenhum agendamento/i)).toBeNull();
  });
});

describe("K1 — forbidden is never emptiness", () => {
  it("renders forbidden presentation with the canonical capability", () => {
    mountWith(
      {
        status: "forbidden",
        requiredCapability: "health.read",
        message: "Leitura da agenda não autorizada para o perfil de acesso atual.",
      },
      coverage({ complete: false, authorizedDogIds: [], dogsInScope: 0 }),
      { authorityStatus: "forbidden" },
    );

    expect(screen.getByText(/health\.read/)).toBeTruthy();
    // The load-bearing negative: a denial must never read as a truthful zero.
    expect(screen.queryByText(/Nenhum agendamento/i)).toBeNull();
    expect(screen.queryByTestId("schedule-list")).toBeNull();
  });

  it("does not present a denial as success", () => {
    mountWith(
      { status: "forbidden", requiredCapability: "health.read", message: "denied" },
      coverage({ complete: false }),
      { authorityStatus: "forbidden" },
    );

    expect(screen.queryByTestId("schedule-row")).toBeNull();
  });
});

describe("K2 — incomplete coverage is never an authoritative empty", () => {
  it("zero entries + coverage.complete false shows the incompleteness notice", () => {
    mountWith(
      { status: "empty", query: "dogs" },
      coverage({
        complete: false,
        dogsInScope: 2,
        authorizedDogIds: ["k9-a"],
        forbiddenDogIds: ["k9-b"],
      }),
    );

    // The notice must be present...
    expect(screen.getByTestId("schedule-coverage-notice")).toBeTruthy();
    expect(screen.getByText(/A agenda está incompleta/i)).toBeTruthy();
    // ...and the authoritative empty copy must NOT be.
    expect(screen.queryByText(/Nenhum agendamento encontrado/i)).toBeNull();
  });

  it("names denied and failed K9s as separate facts", () => {
    mountWith(
      { status: "empty", query: "dogs" },
      coverage({
        complete: false,
        dogsInScope: 3,
        forbiddenDogIds: ["k9-b"],
        failedDogIds: ["k9-c"],
      }),
    );

    expect(screen.getByText(/K9 não autorizado/i)).toBeTruthy();
    expect(screen.getByText(/falha de leitura/i)).toBeTruthy();
  });

  it("a success read with a partial document still states incompleteness", () => {
    mountWith(
      { status: "success", data: [composed("s1")], fetchedAt: new Date() },
      coverage({ complete: false, partialEntryIds: ["k9-a:s1"] }),
    );

    // Truthfulness is driven by coverage, not by the state name.
    expect(screen.getByTestId("schedule-coverage-notice")).toBeTruthy();
    expect(screen.getByTestId("schedule-row")).toBeTruthy();
  });

  it("offers retry from the coverage notice", () => {
    const refresh = vi.fn();
    mountWith(
      { status: "empty", query: "dogs" },
      coverage({ complete: false, forbiddenDogIds: ["k9-b"] }),
      { refresh },
    );

    fireEvent.click(screen.getByRole("button", { name: /Tentar novamente/i }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

describe("K3 — source empty is truthful only when coverage is complete", () => {
  it("renders the authoritative empty state", () => {
    mountWith({ status: "empty", query: "dogs" }, coverage({ complete: true }));

    expect(screen.getByText(/Nenhum agendamento encontrado/i)).toBeTruthy();
    // And no false alarm about coverage.
    expect(screen.queryByTestId("schedule-coverage-notice")).toBeNull();
  });
});

describe("K4 — refreshing keeps previously trustworthy rows", () => {
  it("retains previous composed rows and marks the update", () => {
    mountWith({
      status: "refreshing",
      previousData: [composed("s-prev", { title: "Item anterior" })],
    });

    expect(screen.getByTestId("schedule-refreshing")).toBeTruthy();
    expect(screen.getByText(/Atualizando agenda/i)).toBeTruthy();
    // The previous list is NOT blanked.
    expect(screen.getByText("Item anterior")).toBeTruthy();
    expect(screen.getAllByTestId("schedule-row")).toHaveLength(1);
  });

  it("degrades to loading rather than a false empty when previousData is unusable", () => {
    mountWith({ status: "refreshing", previousData: "not-an-entry-list" });

    // A contract violation must not read as a proven zero.
    expect(screen.queryByText(/Nenhum agendamento/i)).toBeNull();
    expect(screen.queryByTestId("schedule-list")).toBeNull();
  });
});

describe("K5 — the ITEM's timezone controls displayed date/time", () => {
  it("formats in America/Sao_Paulo, not the runtime zone", () => {
    // 02:30Z on the 10th is 23:30 on the 9th in Sao Paulo (UTC-3).
    // The calendar DAY differs, so dropping `timeZone` changes the output.
    mountWith({
      status: "success",
      data: [
        composed("s1", {
          scheduledFor: new Date("2026-09-10T02:30:00Z"),
          timezone: "America/Sao_Paulo",
        }),
      ],
      fetchedAt: new Date(),
    });

    const rendered = screen.getByTestId("schedule-row-datetime").textContent ?? "";

    // Sao Paulo wall time.
    expect(rendered).toContain("09/09/2026");
    expect(rendered).toContain("23:30");
    // The UTC reading must NOT appear — this is what fails if `timeZone` is
    // removed from the Intl options.
    expect(rendered).not.toContain("10/09/2026");
    expect(rendered).not.toContain("02:30");
  });

  it("formats the same instant differently for a different item timezone", () => {
    mountWith({
      status: "success",
      data: [
        composed("s-utc", {
          scheduledFor: new Date("2026-09-10T02:30:00Z"),
          timezone: "UTC",
        }),
      ],
      fetchedAt: new Date(),
    });

    const rendered = screen.getByTestId("schedule-row-datetime").textContent ?? "";
    expect(rendered).toContain("10/09/2026");
    expect(rendered).toContain("02:30");
  });
});

describe("K6 — invalid timezone fails closed", () => {
  it("keeps the row and reports the date/time as unavailable", () => {
    mountWith({
      status: "success",
      data: [
        composed("s-bad", {
          title: "Vacina com fuso inválido",
          dogName: "Thor",
          timezone: "Mars/Olympus",
        }),
      ],
      fetchedAt: new Date(),
    });

    // The row survives with its identifying content.
    expect(screen.getByTestId("schedule-row")).toBeTruthy();
    expect(screen.getByText("Vacina com fuso inválido")).toBeTruthy();
    expect(screen.getByText("Thor")).toBeTruthy();
    // Date/time is explicitly unavailable — never a browser-local guess.
    expect(screen.getByTestId("schedule-row-datetime").textContent).toContain(
      "Data/hora indisponível",
    );
  });

  it("reports unavailable for a missing scheduledFor", () => {
    mountWith({
      status: "success",
      data: [composed("s-null", { scheduledFor: null })],
      fetchedAt: new Date(),
    });

    expect(screen.getByTestId("schedule-row")).toBeTruthy();
    expect(screen.getByTestId("schedule-row-datetime").textContent).toContain(
      "Data/hora indisponível",
    );
  });

  it("reports unavailable for a missing timezone", () => {
    mountWith({
      status: "success",
      data: [composed("s-notz", { timezone: null })],
      fetchedAt: new Date(),
    });

    expect(screen.getByTestId("schedule-row-datetime").textContent).toContain(
      "Data/hora indisponível",
    );
  });

  it("does not throw on an unusable zone", () => {
    expect(() =>
      mountWith({
        status: "success",
        data: [composed("s-bad", { timezone: "Not/AZone" })],
        fetchedAt: new Date(),
      }),
    ).not.toThrow();
  });
});

describe("K7 — terminal items remain visible", () => {
  it("keeps completed and cancelled entries with canonical labels", () => {
    mountWith({
      status: "success",
      data: [
        composed("s-done", { title: "Consulta concluída", temporalStatus: "completed" }),
        composed("s-cancel", { title: "Exame cancelado", temporalStatus: "cancelled" }),
      ],
      fetchedAt: new Date(),
    });

    // No terminal filtering: both rows are present.
    expect(screen.getAllByTestId("schedule-row")).toHaveLength(2);
    expect(screen.getByText("Consulta concluída")).toBeTruthy();
    expect(screen.getByText("Exame cancelado")).toBeTruthy();
    // Canonical labels from the single frozen map.
    expect(screen.getByText("Concluído")).toBeTruthy();
    expect(screen.getByText("Cancelado")).toBeTruthy();
  });
});

describe("K8 — underivable temporal status stays visible", () => {
  it("renders the row with an explicit unavailable status", () => {
    mountWith({
      status: "success",
      data: [
        composed("s-unavail", {
          title: "Dose sem prazo",
          dogName: "Zeus",
          temporalStatus: null,
        }),
      ],
      fetchedAt: new Date(),
    });

    expect(screen.getByTestId("schedule-row")).toBeTruthy();
    expect(screen.getByText("Dose sem prazo")).toBeTruthy();
    expect(screen.getByText("Zeus")).toBeTruthy();
    expect(screen.getByTestId("schedule-row-status").textContent).toContain(
      "Status indisponível",
    );
  });

  it("never fabricates a canonical status for a null temporal status", () => {
    mountWith({
      status: "success",
      data: [composed("s-unavail", { temporalStatus: null })],
      fetchedAt: new Date(),
    });

    const status = screen.getByTestId("schedule-row-status").textContent ?? "";
    expect(status).not.toContain("Programado");
    expect(status).not.toContain("Hoje");
  });
});

describe("K9 — frozen source order is preserved", () => {
  it("renders in the order received, without re-sorting", () => {
    // Deliberately NOT in scheduledFor order: RD-I3 already froze the order and
    // presentation must not impose its own.
    mountWith({
      status: "success",
      data: [
        composed("s-A", { title: "A", scheduledFor: new Date("2026-12-01T13:00:00Z") }),
        composed("s-C", { title: "C", scheduledFor: new Date("2026-09-11T13:00:00Z") }),
        composed("s-B", { title: "B", scheduledFor: new Date("2026-10-01T13:00:00Z") }),
      ],
      fetchedAt: new Date(),
    });

    const titles = screen
      .getAllByTestId("schedule-row")
      .map((row) => row.querySelector("p")?.textContent ?? "");

    expect(titles).toEqual(["A", "C", "B"]);
    // Confirm the fixture really was out of chronological order.
    expect(titles).not.toEqual(["C", "B", "A"]);
  });
});

describe("success and partial", () => {
  it("renders every entry exactly once on success", () => {
    mountWith({
      status: "success",
      data: [composed("s1"), composed("s2"), composed("s3")],
      fetchedAt: new Date(),
    });

    expect(screen.getAllByTestId("schedule-row")).toHaveLength(3);
    expect(screen.queryByTestId("schedule-coverage-notice")).toBeNull();
  });

  it("renders partial entries alongside the incompleteness notice", () => {
    mountWith(
      {
        status: "partial",
        partialData: [composed("s1"), composed("s2")],
        failedSources: ["dogs/k9-b"],
        successfulSources: ["dogs/k9-a"],
      },
      coverage({ complete: false, dogsInScope: 2, failedDogIds: ["k9-b"] }),
    );

    expect(screen.getAllByTestId("schedule-row")).toHaveLength(2);
    expect(screen.getByTestId("schedule-coverage-notice")).toBeTruthy();
    // Never downgraded to success or empty.
    expect(screen.queryByText(/Nenhum agendamento/i)).toBeNull();
  });

  it("shows the dog name on each row", () => {
    mountWith({
      status: "success",
      data: [composed("s1", { dogName: "Apollo" })],
      fetchedAt: new Date(),
    });

    expect(screen.getByTestId("schedule-row-dog").textContent).toBe("Apollo");
  });
});

describe("error and retry", () => {
  it("renders a retryable error with retry wired to refresh", () => {
    const refresh = vi.fn();
    mountWith(
      {
        status: "error",
        code: "SCHEDULE_SCOPE_READ_ERROR",
        message: "Falha ao carregar a agenda.",
        technicalDetails: "detail",
        retryable: true,
      },
      coverage({ complete: false }),
      { refresh },
    );

    expect(screen.getByText(/Falha ao carregar a agenda/i)).toBeTruthy();
    // An error is never emptiness.
    expect(screen.queryByText(/Nenhum agendamento/i)).toBeNull();

    const retry = screen.queryByRole("button", { name: /tentar|retry/i });
    if (retry) {
      fireEvent.click(retry);
      expect(refresh).toHaveBeenCalled();
    }
  });

  it("does not offer retry when authority is not allowed", () => {
    const refresh = vi.fn();
    mountWith(
      {
        status: "error",
        code: "X",
        message: "Falha",
        technicalDetails: "d",
        retryable: true,
      },
      coverage({ complete: false }),
      { authorityStatus: "forbidden", refresh },
    );

    const retry = screen.queryByRole("button", { name: /tentar|retry/i });
    expect(retry).toBeNull();
  });
});

describe("presentation boundaries", () => {
  it("does not use display-window membership to filter rows", () => {
    // Both entries are OUTSIDE the civil window; a flat list shows them anyway.
    const outside = composed("s-out");
    (outside as unknown as { displayWindow: Record<string, unknown> }).displayWindow = {
      inDisplayWindow: false,
      offsetDays: 30,
      availability: "available",
    };
    const undeterminable = composed("s-null-window");
    (undeterminable as unknown as { displayWindow: Record<string, unknown> }).displayWindow =
      { inDisplayWindow: null, offsetDays: null, availability: "invalid_schedule_temporal_input" };

    mountWith({
      status: "success",
      data: [outside, undeterminable],
      fetchedAt: new Date(),
    });

    // No window filtering exists in this slice.
    expect(screen.getAllByTestId("schedule-row")).toHaveLength(2);
  });

  it("renders no section headings in this slice", () => {
    mountWith({
      status: "success",
      data: [composed("s1")],
      fetchedAt: new Date(),
    });

    expect(screen.queryByText(/Próximos 7 dias/i)).toBeNull();
    expect(screen.queryByText(/^Atrasados$/i)).toBeNull();
    expect(screen.queryByText(/^Pendentes$/i)).toBeNull();
  });
});

/**
 * ── H1-C1 CORRECTION KILLERS ───────────────────────────────────────────────
 * Added after the H1 visual review confirmed three presentation defects. These
 * pin the corrections; they do not relax any RD-I6 semantic contract.
 */

describe("K10 — schedule type is localized for presentation", () => {
  // The canonical persisted values stay English; only the DISPLAY is pt-BR.
  it.each([
    ["dose", "Dose"],
    ["vaccination", "Vacinação"],
    ["exam", "Exame"],
    ["consultation", "Consulta"],
    ["weighing", "Pesagem"],
    ["reevaluation", "Reavaliação"],
    ["deworming", "Vermifugação"],
    ["bath", "Banho"],
    ["general", "Geral"],
  ])("canonical %s renders as %s", (canonical, label) => {
    mountWith({
      status: "success",
      data: [composed("s1", { scheduleType: canonical })],
      fetchedAt: new Date(),
    });

    expect(screen.getByTestId("schedule-row-type").textContent).toBe(label);
  });

  it("never presents the raw English canonical values", () => {
    // The four whose raw form is most obviously wrong in a pt-BR interface.
    mountWith({
      status: "success",
      data: [
        composed("s1", { scheduleType: "vaccination" }),
        composed("s2", { scheduleType: "consultation" }),
        composed("s3", { scheduleType: "deworming" }),
        composed("s4", { scheduleType: "reevaluation" }),
      ],
      fetchedAt: new Date(),
    });

    const types = screen
      .getAllByTestId("schedule-row-type")
      .map((el) => el.textContent ?? "");

    expect(types).toEqual(["Vacinação", "Consulta", "Vermifugação", "Reavaliação"]);
    // This is the killer: a regression to raw enum rendering fails here.
    for (const raw of ["vaccination", "consultation", "deworming", "reevaluation"]) {
      expect(types).not.toContain(raw);
    }
  });
});

describe("K11 — status treatments are visually differentiated", () => {
  it("Atrasado and Concluído do not share the same treatment", () => {
    mountWith({
      status: "success",
      data: [
        composed("s-late", { temporalStatus: "overdue" }),
        composed("s-done", { temporalStatus: "completed" }),
      ],
      fetchedAt: new Date(),
    });

    const [overdue, completed] = screen.getAllByTestId("schedule-row-status");

    // Labels remain the primary carrier of meaning (colour is additive only).
    expect(overdue.textContent).toBe("Atrasado");
    expect(completed.textContent).toBe("Concluído");

    // The load-bearing assertion: an operator must be able to tell them apart
    // without reading. Compared structurally, never against literal colours.
    expect(overdue.className).not.toBe(completed.className);
  });

  it("actionable statuses differ from terminal ones", () => {
    mountWith({
      status: "success",
      data: [
        composed("s1", { temporalStatus: "overdue" }),
        composed("s2", { temporalStatus: "pending" }),
        composed("s3", { temporalStatus: "today" }),
        composed("s4", { temporalStatus: "completed" }),
        composed("s5", { temporalStatus: "cancelled" }),
      ],
      fetchedAt: new Date(),
    });

    const badges = screen.getAllByTestId("schedule-row-status");
    const [overdue, pending, today, completed, cancelled] = badges;

    // Three distinct actionable treatments.
    expect(new Set([overdue.className, pending.className, today.className]).size).toBe(3);
    // Terminal states recede and are distinct from every actionable one.
    for (const terminal of [completed, cancelled]) {
      expect(terminal.className).not.toBe(overdue.className);
      expect(terminal.className).not.toBe(pending.className);
      expect(terminal.className).not.toBe(today.className);
    }
  });

  it("an unavailable status stays neutral and is not dressed as a real status", () => {
    mountWith({
      status: "success",
      data: [
        composed("s-unavail", { temporalStatus: null }),
        composed("s-late", { temporalStatus: "overdue" }),
      ],
      fetchedAt: new Date(),
    });

    const [unavailable, overdue] = screen.getAllByTestId("schedule-row-status");

    expect(unavailable.textContent).toBe("Status indisponível");
    // It must not borrow the attention treatment of actionable work.
    expect(unavailable.className).not.toBe(overdue.className);
  });
});

describe("K12 — datetime remains the timezone-safe string after promotion", () => {
  it("keeps the testid on the element carrying the formatted datetime", () => {
    mountWith({
      status: "success",
      data: [
        composed("s1", {
          scheduledFor: new Date("2026-09-10T02:30:00Z"),
          timezone: "America/Sao_Paulo",
        }),
      ],
      fetchedAt: new Date(),
    });

    // Promoting datetime in the hierarchy must not detach K5/K6's anchor.
    const el = screen.getByTestId("schedule-row-datetime");
    expect(el.textContent).toContain("09/09/2026");
    expect(el.textContent).toContain("23:30");
  });

  it("title is still the first paragraph in the row", () => {
    // The source-order killer locates titles via the row's first <p>.
    mountWith({
      status: "success",
      data: [composed("s1", { title: "Título âncora" })],
      fetchedAt: new Date(),
    });

    const row = screen.getByTestId("schedule-row");
    expect(row.querySelector("p")?.textContent).toBe("Título âncora");
  });
});
