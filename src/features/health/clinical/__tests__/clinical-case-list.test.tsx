/**
 * K9 Ops Web — Health Web v1 HW-6A.I3
 * ClinicalCaseList — grouping, ordering preservation and empty-state truth.
 *
 * Invariants under test:
 * - Group order is fixed: acompanhamento -> encerrados -> não reconhecido.
 * - Empty groups do not render.
 * - The I2 composition order is PRESERVED inside each group (never re-sorted).
 * - FILTER-empty and GLOBAL-empty are different statements.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ClinicalCaseStatus } from "../../domain/read-states";
import type { ClinicalCaseReadModel } from "../types";
import type { ClinicalCaseListEntry } from "../data/clinical-scope-loader";
import {
  ClinicalCaseList,
  groupClinicalEntries,
} from "../presentation/clinical-case-list";

function entry(
  caseId: string,
  clinicalStatus: ClinicalCaseStatus | null,
  overrides: Partial<ClinicalCaseReadModel> = {},
): ClinicalCaseListEntry {
  const item: ClinicalCaseReadModel = {
    dogId: "k9-a",
    caseId,
    clinicalStatus,
    rawClinicalStatus: clinicalStatus,
    title: `Caso ${caseId}`,
    openedAt: new Date("2026-02-01T00:00:00Z"),
    openedBy: null,
    recordedBy: null,
    openingEventId: null,
    openingType: null,
    primaryProfessional: null,
    closedAt: null,
    closedBy: null,
    closureType: null,
    closureReason: null,
    hasActiveRestriction: null,
    hasPendingSchedule: null,
    activeTreatmentsCount: null,
    lastEventAt: null,
    eventCount: null,
    schemaVersion: 1,
    dataQuality: "complete",
    issues: [],
    ...overrides,
  };

  return {
    entryId: `k9-a:${caseId}`,
    dogId: "k9-a",
    caseId,
    dog: {
      id: "k9-a",
      name: "Apollo",
      registrationNumber: null,
      photoUrl: null,
      breed: null,
      sex: null,
      dateOfBirth: null,
      conductor: null,
      specialties: [],
    },
    case: item,
  };
}

describe("HW-6A.I3 — groupClinicalEntries", () => {
  // 1
  it("1. buckets the four active statuses into 'em acompanhamento'", () => {
    const groups = groupClinicalEntries([
      entry("c1", "open"),
      entry("c2", "under_investigation"),
      entry("c3", "under_treatment"),
      entry("c4", "monitoring"),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("active");
    expect(groups[0].entries).toHaveLength(4);
  });

  // 2
  it("2. buckets discharged and cancelled into 'encerrados'", () => {
    const groups = groupClinicalEntries([
      entry("c1", "discharged"),
      entry("c2", "cancelled"),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("closed");
  });

  // 3
  it("3. clinicalStatus null becomes the 'unrecognized' bucket, never dropped", () => {
    const groups = groupClinicalEntries([entry("c1", null)]);

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("unrecognized");
    expect(groups[0].entries).toHaveLength(1);
  });

  // 4
  it("4. group order is active -> closed -> unrecognized regardless of input order", () => {
    const groups = groupClinicalEntries([
      entry("c1", null),
      entry("c2", "discharged"),
      entry("c3", "open"),
    ]);

    expect(groups.map((g) => g.key)).toEqual(["active", "closed", "unrecognized"]);
  });

  // 5
  it("5. empty groups are omitted entirely", () => {
    const groups = groupClinicalEntries([entry("c1", "open")]);
    expect(groups.map((g) => g.key)).toEqual(["active"]);
  });

  // 6 — ordering preservation
  it("6. preserves the incoming (I2) order inside each group — no re-sorting", () => {
    // Deliberately NOT in activity order: the list must not "fix" it.
    const input = [
      entry("z-case", "open", { lastEventAt: new Date("2026-01-01T00:00:00Z") }),
      entry("a-case", "open", { lastEventAt: new Date("2026-06-01T00:00:00Z") }),
      entry("m-case", "open", { lastEventAt: null }),
    ];

    const groups = groupClinicalEntries(input);
    expect(groups[0].entries.map((e) => e.caseId)).toEqual([
      "z-case",
      "a-case",
      "m-case",
    ]);
  });
});

describe("HW-6A.I3 — ClinicalCaseList rendering", () => {
  // 7
  it("7. renders one section per non-empty group with its heading", () => {
    render(
      <ClinicalCaseList
        entries={[entry("c1", "open"), entry("c2", "discharged")]}
        filtersActive={false}
        onResetFilters={() => {}}
        onOpenCase={() => {}}
        onOpenK9={() => {}}
      />,
    );

    expect(screen.getByTestId("clinical-group-active")).toBeInTheDocument();
    expect(screen.getByTestId("clinical-group-closed")).toBeInTheDocument();
    expect(screen.queryByTestId("clinical-group-unrecognized")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Em acompanhamento/i }),
    ).toBeInTheDocument();
  });

  // 8
  it("8. renders every case as a card", () => {
    render(
      <ClinicalCaseList
        entries={[entry("c1", "open"), entry("c2", null)]}
        filtersActive={false}
        onResetFilters={() => {}}
        onOpenCase={() => {}}
        onOpenK9={() => {}}
      />,
    );

    expect(screen.getAllByTestId("clinical-case-card")).toHaveLength(2);
  });

  // 9 — GLOBAL empty
  it("9. zero cases with no filters is a proven institutional zero", () => {
    render(
      <ClinicalCaseList
        entries={[]}
        filtersActive={false}
        onResetFilters={() => {}}
        onOpenCase={() => {}}
        onOpenK9={() => {}}
      />,
    );

    expect(screen.getByTestId("clinical-scope-empty")).toBeInTheDocument();
    expect(
      screen.getByText("Nenhum caso clínico registrado no escopo autorizado."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("clinical-filter-empty")).not.toBeInTheDocument();
  });

  // 10 — FILTER empty, a DIFFERENT statement
  it("10. zero cases WITH filters is a filtering outcome, not an empty scope", () => {
    render(
      <ClinicalCaseList
        entries={[]}
        filtersActive
        onResetFilters={() => {}}
        onOpenCase={() => {}}
        onOpenK9={() => {}}
      />,
    );

    expect(screen.getByTestId("clinical-filter-empty")).toBeInTheDocument();
    expect(
      screen.getByText("Nenhum caso corresponde aos filtros aplicados."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Nenhum caso clínico registrado no escopo autorizado."),
    ).not.toBeInTheDocument();
  });

  // 11
  it("11. the filter-empty state offers a reset affordance", () => {
    const onReset = vi.fn();
    render(
      <ClinicalCaseList
        entries={[]}
        filtersActive
        onResetFilters={onReset}
        onOpenCase={() => {}}
        onOpenK9={() => {}}
      />,
    );

    screen.getByRole("button", { name: /Limpar filtros/i }).click();
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  // 12
  it("12. the unrecognized group states it is a technical, not clinical, bucket", () => {
    render(
      <ClinicalCaseList
        entries={[entry("c1", null)]}
        filtersActive={false}
        onResetFilters={() => {}}
        onOpenCase={() => {}}
        onOpenK9={() => {}}
      />,
    );

    expect(screen.getByTestId("clinical-group-unrecognized")).toHaveTextContent(
      /não pôde ser reconhecido/i,
    );
  });

  // 13 — interaction boundary at list level.
  //
  // I4A §16 made each card a real button. I4B §3/§4 DELIBERATELY REVERSES that:
  // every card now hosts TWO sibling controls — a K9 identity action and a case
  // action — so a 2-case list exposes 4 buttons. What must still hold is that ALL
  // controls are buttons: no navigation link, and no <a>/[href] slipped in.
  it("13. a populated list exposes two sibling actions per card and no link", () => {
    const { container } = render(
      <ClinicalCaseList
        entries={[entry("c1", "open"), entry("c2", "discharged")]}
        filtersActive={false}
        onResetFilters={() => {}}
        onOpenCase={() => {}}
        onOpenK9={() => {}}
      />,
    );

    expect(container.querySelectorAll("a")).toHaveLength(0);
    expect(container.querySelectorAll("[href]")).toHaveLength(0);
    // Two cards × two sibling actions each.
    expect(container.querySelectorAll("button")).toHaveLength(4);
    expect(
      container.querySelectorAll('[data-testid="clinical-case-card"]'),
    ).toHaveLength(2);
    expect(
      container.querySelectorAll('[data-testid="clinical-card-k9-action"]'),
    ).toHaveLength(2);
    expect(
      container.querySelectorAll('[data-testid="clinical-case-action"]'),
    ).toHaveLength(2);
  });
});

/**
 * HW-6A.V1.RF4 §21/§26 — group header visual lift.
 *
 * The header received a modest typography and spacing lift so it is not dwarfed
 * by the rescaled rows. Group SEMANTICS — order, membership, counts, and the two
 * distinct empty statements — are FROZEN and re-asserted here.
 */
describe("HW-6A.V1.RF4 — group header visual lift", () => {
  function renderGroups() {
    return render(
      <ClinicalCaseList
        entries={[
          entry("c1", "open"),
          entry("c2", "monitoring"),
          entry("c3", "discharged"),
          entry("c4", null),
        ]}
        filtersActive={false}
        onResetFilters={() => {}}
        onOpenCase={() => {}}
        onOpenK9={() => {}}
      />,
    );
  }

  // 1 — §21 the heading is no longer a 10px micro-label
  it("1. the group heading typography is lifted to 11px", () => {
    renderGroups();
    const heading = screen.getByRole("heading", { name: /Em acompanhamento/i });

    expect(heading.className).toMatch(/text-\[11px\]/);
    expect(heading.className).not.toMatch(/text-\[10px\]/);
    // Institutional uppercase treatment preserved.
    expect(heading.className).toMatch(/\buppercase\b/);
  });

  // 2 — §21 the hint is readable
  it("2. the group hint reaches 13px", () => {
    renderGroups();
    const heading = screen.getByRole("heading", { name: /Em acompanhamento/i });
    const hint = heading.nextElementSibling as HTMLElement;

    expect(hint.tagName).toBe("P");
    expect(hint.className).toMatch(/text-\[13px\]/);
    expect(hint.className).not.toMatch(/text-\[11px\]/);
  });

  // 3 — FROZEN: group order is unchanged by the lift
  it("3. group order remains active -> closed -> unrecognized", () => {
    const { container } = renderGroups();
    const sections = [...container.querySelectorAll("section")].map((s) =>
      s.getAttribute("data-testid"),
    );

    expect(sections).toEqual([
      "clinical-group-active",
      "clinical-group-closed",
      "clinical-group-unrecognized",
    ]);
  });

  // 4 — FROZEN: membership and counts are unchanged by the lift
  it("4. group membership and counts are unchanged", () => {
    renderGroups();

    expect(screen.getByTestId("clinical-group-active")).toHaveTextContent("2 casos");
    expect(screen.getByTestId("clinical-group-closed")).toHaveTextContent("1 caso");
    expect(screen.getByTestId("clinical-group-unrecognized")).toHaveTextContent(
      "1 caso",
    );
  });

  // 5 — no interaction leaked into the header
  // Scoped to the HEADER, not the whole section: since I4A the section also
  // contains the card grid, whose cards are legitimately buttons. The invariant
  // this test exists for is that the group HEADER itself is not a control (no
  // collapse toggle, no filter-by-group link).
  it("5. the lifted header exposes no control", () => {
    renderGroups();
    const header = screen.getByRole("heading", {
      name: /Em acompanhamento/i,
    }).closest("div")?.parentElement as HTMLElement;

    expect(header.querySelector("button")).toBeNull();
    expect(header.querySelector("a")).toBeNull();
    expect(header.querySelector("[tabindex]")).toBeNull();
    // And the grid is a sibling of the header, not nested inside it.
    expect(
      header.querySelector('[data-testid="clinical-case-card"]'),
    ).toBeNull();
  });
});

/**
 * HW-6A.I4A §9/§14/§29 — the card grid, and the grouping guarantees it must not
 * disturb.
 *
 * jsdom has no layout engine, so the grid is asserted STRUCTURALLY (one card per
 * entry, cards inside the right group, order preserved) plus the responsive
 * track declaration. Column COUNT at a given viewport is a browser concern.
 */
describe("HW-6A.I4A — card grid inside preserved groups", () => {
  function renderCards(
    entries: ClinicalCaseListEntry[],
    onOpenCase: (entry: ClinicalCaseListEntry) => void = () => {},
    onOpenK9: (entry: ClinicalCaseListEntry) => void = () => {},
  ) {
    return render(
      <ClinicalCaseList
        entries={entries}
        filtersActive={false}
        onResetFilters={() => {}}
        onOpenCase={onOpenCase}
        onOpenK9={onOpenK9}
      />,
    );
  }

  // 1 — §29 one card per entry.
  //
  // I4B §4 changed the CONTAINER tag from BUTTON to ARTICLE: the card is now an
  // inert wrapper around two sibling controls, so its interactivity is asserted on
  // those controls, not on the container.
  it("1. renders exactly one card per entry, each holding two actions", () => {
    renderCards([entry("c1", "open"), entry("c2", "monitoring"), entry("c3", null)]);
    const cards = screen.getAllByTestId("clinical-case-card");

    expect(cards).toHaveLength(3);
    for (const card of cards) {
      expect(card.tagName).toBe("ARTICLE");
      expect(card.querySelectorAll("button")).toHaveLength(2);
    }
    // The row presentation is gone.
    expect(screen.queryByTestId("clinical-case-row")).not.toBeInTheDocument();
  });

  // 2 — §1/§29 ONE CARD = ONE CASE, so a K9 with several cases gets several cards
  it("2. the same K9 legitimately appears on multiple case cards", () => {
    renderCards([
      entry("c1", "open"),
      entry("c2", "under_treatment"),
      entry("c3", "monitoring"),
    ]);

    // All three entries share dogId k9-a by construction.
    const cards = screen.getAllByTestId("clinical-case-card");
    expect(cards).toHaveLength(3);
    expect(screen.getAllByTestId("clinical-card-k9-name")).toHaveLength(3);

    // Distinct CASES, not a deduplicated K9 roster.
    const entryIds = cards.map((c) => c.getAttribute("data-entry-id"));
    expect(new Set(entryIds).size).toBe(3);
  });

  // 3 — §9/§27 the responsive track is declared on the grid, not a fixed count
  it("3. the group grid declares a responsive auto-fill track", () => {
    renderCards([entry("c1", "open")]);
    const grid = screen.getByTestId("clinical-group-active-grid");

    expect(grid.className).toContain("grid");
    // ~280px minimum keeps cards readable and lets the count follow the width.
    expect(grid.className).toContain("minmax(280px,1fr)");
    expect(grid.className).toContain("grid-cols-1");
    // The old divided row stack is gone.
    expect(grid.className).not.toContain("divide-y");
  });

  // 4 — §14 cards live INSIDE their group, not in one flat list
  it("4. each card is nested inside its own group section", () => {
    renderCards([entry("c1", "open"), entry("c2", "discharged"), entry("c3", null)]);

    const active = screen.getByTestId("clinical-group-active");
    const closed = screen.getByTestId("clinical-group-closed");
    const unknown = screen.getByTestId("clinical-group-unrecognized");

    expect(active.querySelectorAll('[data-testid="clinical-case-card"]')).toHaveLength(1);
    expect(closed.querySelectorAll('[data-testid="clinical-case-card"]')).toHaveLength(1);
    expect(unknown.querySelectorAll('[data-testid="clinical-case-card"]')).toHaveLength(1);
  });

  // 5 — §14 group order unchanged by the card migration
  it("5. group order remains active -> closed -> unrecognized", () => {
    const { container } = renderCards([
      entry("c1", null),
      entry("c2", "discharged"),
      entry("c3", "open"),
    ]);

    expect(
      [...container.querySelectorAll("section")].map((s) =>
        s.getAttribute("data-testid"),
      ),
    ).toEqual([
      "clinical-group-active",
      "clinical-group-closed",
      "clinical-group-unrecognized",
    ]);
  });

  // 6 — the I2 composition order survives inside a group (never re-sorted)
  it("6. input order is preserved inside a group", () => {
    renderCards([entry("c3", "open"), entry("c1", "open"), entry("c2", "open")]);

    expect(
      screen
        .getAllByTestId("clinical-case-card")
        .map((c) => c.getAttribute("data-entry-id")),
    ).toEqual(["k9-a:c3", "k9-a:c1", "k9-a:c2"]);
  });

  // 7 — §16 the open request carries the right entry from inside a group
  it("7. clicking a card's case action in a group requests that exact case", () => {
    const onOpenCase = vi.fn();
    renderCards([entry("c1", "open"), entry("c2", "discharged")], onOpenCase);

    const closedAction = screen
      .getByTestId("clinical-group-closed")
      .querySelector('[data-testid="clinical-case-action"]') as HTMLElement;
    fireEvent.click(closedAction);

    expect(onOpenCase).toHaveBeenCalledTimes(1);
    expect(onOpenCase.mock.calls[0][0]).toMatchObject({ caseId: "c2" });
  });

  // 7b — §3B/§7 the K9 action from inside a group requests that card's K9
  it("7b. clicking a card's K9 action in a group requests that K9 view", () => {
    const onOpenCase = vi.fn();
    const onOpenK9 = vi.fn();
    renderCards(
      [entry("c1", "open"), entry("c2", "discharged")],
      onOpenCase,
      onOpenK9,
    );

    const closedK9 = screen
      .getByTestId("clinical-group-closed")
      .querySelector('[data-testid="clinical-card-k9-action"]') as HTMLElement;
    fireEvent.click(closedK9);

    expect(onOpenK9).toHaveBeenCalledTimes(1);
    expect(onOpenK9.mock.calls[0][0]).toMatchObject({ caseId: "c2" });
    expect(onOpenCase).not.toHaveBeenCalled();
  });

  // 8 — §24 only the selected card's case action is emphasized
  it("8. selectedEntryId emphasizes exactly one card's case action", () => {
    render(
      <ClinicalCaseList
        entries={[entry("c1", "open"), entry("c2", "open")]}
        filtersActive={false}
        onResetFilters={() => {}}
        onOpenCase={() => {}}
        onOpenK9={() => {}}
        selectedEntryId="k9-a:c2"
      />,
    );

    const actions = screen.getAllByTestId("clinical-case-action");
    const expanded = actions.map((c) => c.getAttribute("aria-expanded"));
    expect(expanded).toEqual(["false", "true"]);
  });

  // 8b — §24 selectedDogId emphasizes the matching K9 actions.
  //
  // Both entries here share dogId k9-a, so BOTH K9 actions reflect the open K9
  // view — which is correct: one K9's view is open, and every card for that K9
  // shows it.
  it("8b. selectedDogId emphasizes every card's K9 action for that dog", () => {
    render(
      <ClinicalCaseList
        entries={[entry("c1", "open"), entry("c2", "open")]}
        filtersActive={false}
        onResetFilters={() => {}}
        onOpenCase={() => {}}
        onOpenK9={() => {}}
        selectedDogId="k9-a"
      />,
    );

    const k9Actions = screen.getAllByTestId("clinical-card-k9-action");
    expect(k9Actions.map((c) => c.getAttribute("aria-expanded"))).toEqual([
      "true",
      "true",
    ]);
    // And the case actions are NOT emphasized: the two selections are distinct.
    const caseActions = screen.getAllByTestId("clinical-case-action");
    expect(caseActions.map((c) => c.getAttribute("aria-expanded"))).toEqual([
      "false",
      "false",
    ]);
  });

  // 9 — §15 the two empty statements stay distinct after the card migration
  it("9. filter-empty and global-empty remain different statements", () => {
    const globalEmpty = render(
      <ClinicalCaseList
        entries={[]}
        filtersActive={false}
        onResetFilters={() => {}}
        onOpenCase={() => {}}
        onOpenK9={() => {}}
      />,
    );
    expect(screen.getByTestId("clinical-scope-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("clinical-filter-empty")).not.toBeInTheDocument();
    const globalText = screen.getByTestId("clinical-scope-empty").textContent ?? "";
    globalEmpty.unmount();

    render(
      <ClinicalCaseList
        entries={[]}
        filtersActive
        onResetFilters={() => {}}
        onOpenCase={() => {}}
        onOpenK9={() => {}}
      />,
    );
    expect(screen.getByTestId("clinical-filter-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("clinical-scope-empty")).not.toBeInTheDocument();
    const filterText = screen.getByTestId("clinical-filter-empty").textContent ?? "";

    // Not merely different testids — different STATEMENTS.
    expect(filterText).not.toBe(globalText);
  });
});
