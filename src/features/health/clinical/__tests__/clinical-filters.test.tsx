/**
 * K9 Ops Web — Health Web v1 HW-6A.I3
 * ClinicalFilters — control contract, tri-state vocabulary, scoped K9 options.
 *
 * Invariants under test:
 * - Every flag filter offers "Indisponível" so a `null` flag is filterable as
 *   its own answer, distinct from "Sem".
 * - The unrecognized status is a selectable option, not hidden.
 * - The K9 selector lists only dogs from the CURRENT result.
 * - Controls are labelled (accessible) and the reset affordance is gated on
 *   there being an active filter.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ClinicalFilters } from "../presentation/clinical-filters";
import { DEFAULT_CLINICAL_FILTERS, type ClinicalDogOption } from "../presentation/types";

const dogOptions: ClinicalDogOption[] = [
  { dogId: "k9-a", name: "Apollo", caseCount: 2 },
  { dogId: "k9-b", name: "Bono", caseCount: 1 },
];

function renderFilters(
  props: Partial<React.ComponentProps<typeof ClinicalFilters>> = {},
) {
  const onChange = vi.fn();
  const onReset = vi.fn();
  const utils = render(
    <ClinicalFilters
      filters={props.filters ?? DEFAULT_CLINICAL_FILTERS}
      dogOptions={props.dogOptions ?? dogOptions}
      onChange={props.onChange ?? onChange}
      onReset={props.onReset ?? onReset}
      filtersActive={props.filtersActive ?? false}
      resultCount={props.resultCount ?? 3}
    />,
  );
  return { onChange, onReset, ...utils };
}

describe("HW-6A.I3 — ClinicalFilters", () => {
  // 1
  it("1. exposes labelled search, K9, status, restriction, treatment and schedule controls", () => {
    renderFilters();
    expect(screen.getByLabelText(/Buscar por K9/i)).toBeInTheDocument();
    expect(screen.getByLabelText("K9:")).toBeInTheDocument();
    expect(screen.getByLabelText("Status:")).toBeInTheDocument();
    expect(screen.getByLabelText("Restrição:")).toBeInTheDocument();
    expect(screen.getByLabelText("Tratamento ativo:")).toBeInTheDocument();
    expect(screen.getByLabelText("Agenda pendente:")).toBeInTheDocument();
  });

  // 2 — null is a first-class filter answer
  it("2. restriction and schedule offer 'Indisponível' as a distinct option", () => {
    renderFilters();
    const restriction = screen.getByLabelText("Restrição:");
    const schedule = screen.getByLabelText("Agenda pendente:");
    expect(within(restriction).getByRole("option", { name: "Indisponível" })).toBeInTheDocument();
    expect(within(restriction).getByRole("option", { name: "Sem" })).toBeInTheDocument();
    expect(within(schedule).getByRole("option", { name: "Indisponível" })).toBeInTheDocument();
  });

  // 3
  it("3. the treatment filter offers 'Indisponível' distinct from 'Sem tratamento ativo'", () => {
    renderFilters();
    const treatment = screen.getByLabelText("Tratamento ativo:");
    expect(within(treatment).getByRole("option", { name: "Indisponível" })).toBeInTheDocument();
    expect(
      within(treatment).getByRole("option", { name: "Sem tratamento ativo" }),
    ).toBeInTheDocument();
  });

  // 4 — unrecognized status is findable
  it("4. the status filter includes the unrecognized bucket as a selectable option", () => {
    renderFilters();
    const status = screen.getByLabelText("Status:");
    expect(
      within(status).getByRole("option", { name: "Status não reconhecido" }),
    ).toBeInTheDocument();
    // And every canonical status is present.
    expect(within(status).getByRole("option", { name: "Aberto" })).toBeInTheDocument();
    expect(within(status).getByRole("option", { name: "Cancelado" })).toBeInTheDocument();
  });

  // 5 — scoped K9 options
  it("5. the K9 selector lists only dogs from the current result", () => {
    renderFilters();
    const dog = screen.getByLabelText("K9:");
    expect(within(dog).getByRole("option", { name: /Apollo/ })).toBeInTheDocument();
    expect(within(dog).getByRole("option", { name: /Bono/ })).toBeInTheDocument();
    // Two dogs + the "Todos os K9" option.
    expect(within(dog).getAllByRole("option")).toHaveLength(3);
  });

  // 6
  it("6. search input emits its value through onChange", () => {
    const { onChange } = renderFilters();
    fireEvent.change(screen.getByLabelText(/Buscar por K9/i), {
      target: { value: "apollo" },
    });
    expect(onChange).toHaveBeenCalledWith({ search: "apollo" });
  });

  // 7
  it("7. selecting a status emits the canonical value", () => {
    const { onChange } = renderFilters();
    fireEvent.change(screen.getByLabelText("Status:"), {
      target: { value: "under_treatment" },
    });
    expect(onChange).toHaveBeenCalledWith({ status: "under_treatment" });
  });

  // 8
  it("8. reset affordance is hidden until a filter is active", () => {
    const { rerender, onReset } = renderFilters({ filtersActive: false });
    expect(screen.queryByRole("button", { name: /Limpar filtros/i })).not.toBeInTheDocument();

    rerender(
      <ClinicalFilters
        filters={{ ...DEFAULT_CLINICAL_FILTERS, search: "x" }}
        dogOptions={dogOptions}
        onChange={() => {}}
        onReset={onReset}
        filtersActive
        resultCount={0}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Limpar filtros/i }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  // 9
  it("9. announces the result count", () => {
    renderFilters({ resultCount: 5 });
    expect(screen.getByText("5 resultados")).toBeInTheDocument();
  });
});

/**
 * HW-6A.V1.RF — tablet reflow contract.
 *
 * Structural class assertions only: at tablet-ish width the six controls must
 * not cram into a single horizontal row. Deliberately NOT pixel-perfect — these
 * assert layout INTENT (search gets its own full-width row, selectors reflow
 * into a grid, dense band returns at the wide breakpoint) and that the filter
 * SEMANTICS are untouched by the refinement.
 */
describe("HW-6A.V1.RF — tablet filter reflow", () => {
  // 1
  it("1. the control band stacks until xl instead of going horizontal at lg", () => {
    renderFilters();
    const controls = screen.getByTestId("clinical-filters-controls");

    expect(controls.className).toContain("flex-col");
    expect(controls.className).toContain("xl:flex-row");
    // The old lg horizontal switch is what compressed the tablet layout.
    expect(controls.className).not.toContain("lg:flex-row");
  });

  // 2 — search gets useful width at tablet
  it("2. the search field is full-width until xl", () => {
    renderFilters();
    const search = screen.getByLabelText(/Buscar por K9/i);

    expect(search.className).toContain("w-full");
    // RF2 §6 replaced the compression-prone `xl:max-w-xs` cap with a real
    // minimum; the tablet full-width behaviour below xl is unchanged.
    const wrapper = search.closest("div")?.parentElement;
    expect(wrapper?.className).toContain("min-w-0");
    expect(wrapper?.className).not.toContain("xl:max-w-xs");
  });

  // 3 — selectors reflow rather than compress
  it("3. the selectors form a responsive grid at narrow/tablet width", () => {
    renderFilters();
    const selectors = screen.getByTestId("clinical-filters-selectors");

    expect(selectors.className).toContain("grid-cols-2");
    expect(selectors.className).toContain("sm:grid-cols-3");
    expect(selectors.className).toContain("lg:flex");
  });

  // 4
  it("4. each selector fills its grid cell at tablet width", () => {
    renderFilters();
    for (const label of [
      "K9:",
      "Status:",
      "Restrição:",
      "Tratamento ativo:",
      "Agenda pendente:",
    ]) {
      expect(screen.getByLabelText(label).className).toContain("w-full");
    }
  });

  // 5 — the refinement must not change WHAT the filters mean
  it("5. reflow preserves every control and the tri-state vocabulary", () => {
    renderFilters();
    const restriction = screen.getByLabelText("Restrição:");

    expect(within(restriction).getByRole("option", { name: "Indisponível" })).toBeInTheDocument();
    expect(within(restriction).getByRole("option", { name: "Sem" })).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("Status:")).getByRole("option", {
        name: "Status não reconhecido",
      }),
    ).toBeInTheDocument();
  });
});

/**
 * HW-6A.V1.RF2 — search width contract at laptop/desktop.
 *
 * V2 measured search at ~197px on a 1366px laptop — narrower than on tablet —
 * because `xl:flex-1` + `xl:max-w-xs` let the selector band compress it. The
 * fix gives search a real basis/min-width and stops it flexing below that, so
 * the band wraps instead of crushing the field (§7 prefers wrapping).
 *
 * These assert the CONTRACT, not pixels: jsdom has no layout engine, so no test
 * here can prove an actual 1366px width. That is human-preview evidence.
 */
describe("HW-6A.V1.RF2 — search width contract", () => {
  /** The wrapper that owns the search flex contract. */
  function searchWrapper() {
    return screen
      .getByLabelText(/Buscar por K9/i)
      .closest("div")?.parentElement as HTMLElement;
  }

  // 1 — the compression-prone contract is gone
  it("1. the old max-width cap and grow contract are removed", () => {
    renderFilters();
    const wrapper = searchWrapper();

    expect(wrapper.className).not.toContain("xl:max-w-xs");
    expect(wrapper.className).not.toContain("xl:flex-1");
  });

  // 2 — a real minimum exists at the desktop/laptop breakpoint
  it("2. search declares a useful minimum width from xl upward", () => {
    renderFilters();
    const wrapper = searchWrapper();

    expect(wrapper.className).toContain("xl:min-w-[17rem]");
    expect(wrapper.className).toContain("xl:basis-[17rem]");
    // It must not shrink below that basis when the row gets crowded.
    expect(wrapper.className).toContain("xl:grow-0");
  });

  // 3 — tablet behaviour preserved exactly as approved
  it("3. below xl the search input stays full-width", () => {
    renderFilters();

    expect(screen.getByLabelText(/Buscar por K9/i).className).toContain("w-full");
    expect(searchWrapper().className).toContain("min-w-0");
  });

  // 4 — the band still wraps rather than dropping controls
  it("4. the control band still wraps at xl instead of forcing one row", () => {
    renderFilters();
    const controls = screen.getByTestId("clinical-filters-controls");

    expect(controls.className).toContain("xl:flex-row");
    expect(controls.className).toContain("xl:flex-wrap");
  });

  // 5 — no control may disappear
  it("5. all six controls remain present after the width change", () => {
    renderFilters();

    expect(screen.getByLabelText(/Buscar por K9/i)).toBeInTheDocument();
    for (const label of [
      "K9:",
      "Status:",
      "Restrição:",
      "Tratamento ativo:",
      "Agenda pendente:",
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  // 6 — predicates/state untouched by a layout change
  it("6. the search predicate contract is unchanged", () => {
    const { onChange } = renderFilters();
    fireEvent.change(screen.getByLabelText(/Buscar por K9/i), {
      target: { value: "thor" },
    });

    // Still emits the raw value through onChange; no debounce, no local state.
    expect(onChange).toHaveBeenCalledWith({ search: "thor" });
    expect(screen.getByLabelText(/Buscar por K9/i)).toHaveAttribute(
      "placeholder",
      "Buscar por K9 ou título do caso...",
    );
  });
});

/**
 * HW-6A.V1.RF4 §20/§26 — filter typography scale.
 *
 * The human review found the top-area text too small to read at 100% zoom. These
 * are STRUCTURAL typography assertions plus re-assertions that the FROZEN filter
 * contract (predicates, option vocabulary, control order, search source, RF2
 * search-width behaviour) survived a purely visual change.
 */
describe("HW-6A.V1.RF4 — filter typography scale", () => {
  /** The wrapper that owns the RF2 search width contract. */
  function rf4SearchWrapper() {
    return screen
      .getByLabelText(/Buscar por K9/i)
      .closest("div")?.parentElement as HTMLElement;
  }

  // 1 — the eyebrow is no longer a 10px micro-label
  it("1. the FILTROS CLÍNICOS eyebrow is more readable", () => {
    renderFilters();
    const eyebrow = screen.getByText("Filtros clínicos");

    expect(eyebrow.className).toMatch(/text-\[11px\]/);
    expect(eyebrow.className).not.toMatch(/text-\[10px\]/);
    // Institutional uppercase treatment preserved.
    expect(eyebrow.className).toMatch(/\buppercase\b/);
  });

  // 2 — the section heading carries real presence
  it("2. the section heading is materially stronger", () => {
    renderFilters();
    const heading = screen.getByRole("heading", {
      name: "Casos clínicos do efetivo",
    });

    expect(heading.className).toMatch(/\btext-xl\b/);
    expect(heading.className).toMatch(/\bfont-bold\b/);
    expect(heading.className).not.toMatch(/\btext-base\b/);
  });

  // 3 — the description is legible, not a footnote
  it("3. the description text reaches 14px", () => {
    renderFilters();
    const description = screen.getByText(/Lista consolidada dos casos clínicos/);

    expect(description.className).toMatch(/\btext-sm\b/);
    expect(description.className).not.toMatch(/\btext-xs\b/);
  });

  // 4 — §20 the six control labels stop being microscopic
  it("4. every filter label is 11px, not 10px", () => {
    renderFilters();

    for (const label of ["Buscar", "K9", "Status", "Restrição", "Tratamento", "Agenda"]) {
      const el = screen.getByText(label, { selector: "span" });
      expect(el.className).toMatch(/text-\[11px\]/);
      expect(el.className).not.toMatch(/text-\[10px\]/);
    }
  });

  // 5 — the control VALUES themselves are readable
  it("5. the search input and every select render 14px values", () => {
    renderFilters();
    const search = screen.getByLabelText(/Buscar por K9/i);

    expect(search.className).toMatch(/\btext-sm\b/);
    expect(search.className).not.toMatch(/\btext-xs\b/);
    expect(search.className).toMatch(/\bh-10\b/);

    for (const label of [
      "K9:",
      "Status:",
      "Restrição:",
      "Tratamento ativo:",
      "Agenda pendente:",
    ]) {
      const select = screen.getByLabelText(label);
      expect(select.className).toMatch(/\btext-sm\b/);
      expect(select.className).not.toMatch(/\btext-xs\b/);
      expect(select.className).toMatch(/\bh-10\b/);
    }
  });

  // 6 — FROZEN: the RF2 search-width contract must survive the type scale
  it("6. the RF2 search width contract is untouched", () => {
    renderFilters();
    const wrapper = rf4SearchWrapper();

    expect(wrapper.className).toContain("xl:basis-[17rem]");
    expect(wrapper.className).toContain("xl:min-w-[17rem]");
    expect(wrapper.className).toContain("xl:grow-0");
    expect(wrapper.className).not.toContain("xl:max-w-xs");
  });

  // 7 — FROZEN: responsive wrapping contract unchanged
  it("7. the tablet reflow and xl band contract are unchanged", () => {
    renderFilters();
    const selectors = screen.getByTestId("clinical-filters-selectors");
    const controls = screen.getByTestId("clinical-filters-controls");

    expect(selectors.className).toContain("grid-cols-2");
    expect(selectors.className).toContain("sm:grid-cols-3");
    expect(selectors.className).toContain("lg:flex");
    expect(controls.className).toContain("xl:flex-row");
    expect(controls.className).toContain("xl:flex-wrap");
  });

  // 8 — FROZEN: option vocabulary is not a visual concern
  it("8. every filter option value and label is unchanged", () => {
    renderFilters();

    const status = screen.getByLabelText("Status:") as HTMLSelectElement;
    expect([...status.options].map((o) => o.value)).toEqual([
      "all",
      "open",
      "under_investigation",
      "under_treatment",
      "monitoring",
      "discharged",
      "cancelled",
      "unknown",
    ]);

    const restriction = screen.getByLabelText("Restrição:") as HTMLSelectElement;
    expect([...restriction.options].map((o) => o.text)).toEqual([
      "Todas",
      "Com",
      "Sem",
      "Indisponível",
    ]);

    const treatment = screen.getByLabelText(
      "Tratamento ativo:",
    ) as HTMLSelectElement;
    expect([...treatment.options].map((o) => o.text)).toEqual([
      "Todos",
      "Com tratamento ativo",
      "Sem tratamento ativo",
      "Indisponível",
    ]);
  });

  // 9 — FROZEN: search still emits the raw value, no debounce, no local state
  it("9. the search predicate contract survives the type scale", () => {
    const { onChange } = renderFilters();
    fireEvent.change(screen.getByLabelText(/Buscar por K9/i), {
      target: { value: "luna" },
    });

    expect(onChange).toHaveBeenCalledWith({ search: "luna" });
    expect(screen.getByLabelText(/Buscar por K9/i)).toHaveAttribute(
      "placeholder",
      "Buscar por K9 ou título do caso...",
    );
  });
});
