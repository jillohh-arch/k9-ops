import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Gate 10H-HUMAN-EDIT-WEB.IMPL.C2 — HumanEditV1 UI.
 *
 * Mocks only the UI boundaries: B2 loader, C1 save orchestrator, access
 * provider, router. A1/B1 are not exercised here (patch semantics belong to
 * A1's own suite). No live Firebase, no env, no route mutation.
 */

const push = vi.fn();
const loadHumanForEdit = vi.fn();
const saveHumanEdit = vi.fn();
const can = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/features/access/providers/access-control-provider", () => ({
  useAccessControl: () => ({ can }),
}));

vi.mock("@/features/effective/data/human-edit-service", () => ({
  loadHumanForEdit,
}));

vi.mock("../human-edit-save", async () => {
  // Keep the real typed error classes; only intercept the save call.
  const actual =
    await vi.importActual<typeof import("../human-edit-save")>(
      "../human-edit-save",
    );
  return { ...actual, saveHumanEdit };
});

// The save module imports the Firebase callable client; stub the boundary so
// the UI test initializes no SDK.
vi.mock("@/lib/firebase/functions", () => ({
  callAdminPatchHumanPersonnel: vi.fn(),
}));

const { HumanEditV1 } = await import("../human-edit-v1");
const { HumanEditSaveError } = await import("../human-edit-save");

const RA = "990011";
const TOKEN = 1787443394308;

function baseline(overrides: Record<string, string> = {}) {
  return {
    fullName: "Ana Paula",
    callsign: "APAULA",
    cpf: "111",
    birthDate: "1990-01-01",
    phone: "1199",
    institutionalEmail: "a@gcm",
    rank: "Cabo",
    cargo: "Adestrador",
    unit: "Canil",
    team: "Alpha",
    admissionDate: "2010-05-05",
    notes: "obs",
    ...overrides,
  };
}

function mockLoad(
  options: { archived?: boolean; token?: number | null } = {},
  overrides: Record<string, string> = {},
) {
  // "token" absent → default TOKEN; token explicitly null must stay null
  // (never `options.token ?? TOKEN`, which would collapse null back to TOKEN).
  const versionToken = "token" in options ? (options.token ?? null) : TOKEN;
  loadHumanForEdit.mockResolvedValueOnce({
    ra: RA,
    baseline: baseline(overrides),
    versionToken,
    archived: options.archived ?? false,
  });
}

beforeEach(() => {
  push.mockReset();
  loadHumanForEdit.mockReset();
  saveHumanEdit.mockReset();
  can.mockReset();
  can.mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const SUCCESS_MESSAGE = "Alterações salvas com sucesso.";
/** Must mirror SUCCESS_NAVIGATION_DELAY_MS in the component. */
const DELAY_MS = 1000;

/**
 * Flush pending promise callbacks without RTL's `waitFor`: under Vitest fake
 * timers `waitFor` cannot detect the fake clock (it probes the `jest` global),
 * so it would stall on its own timer. Vitest does not fake microtasks, so an
 * awaited `act` drains the save promise chain deterministically.
 */
async function flush() {
  await act(async () => {});
}

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

function okResult(fields: string[] = ["cargo"]) {
  return { ra: RA, noop: false, updatedFields: fields, clearedFields: [] };
}

function submitForm() {
  fireEvent.submit(document.querySelector("form")!);
}

async function renderReady(
  overrides: Record<string, string> = {},
  options: { token?: number | null } = {},
) {
  mockLoad(options, overrides);
  render(<HumanEditV1 ra={RA} />);
  await screen.findByText("Editar integrante");
}

describe("C2 — load", () => {
  it("shows loading state initially", () => {
    loadHumanForEdit.mockReturnValueOnce(new Promise(() => {}));
    render(<HumanEditV1 ra={RA} />);
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("successful load renders the 12 Personnel controls", async () => {
    await renderReady();
    for (const id of [
      "human-edit-fullName",
      "human-edit-callsign",
      "human-edit-cpf",
      "human-edit-birthDate",
      "human-edit-phone",
      "human-edit-institutionalEmail",
      "human-edit-rank",
      "human-edit-cargo",
      "human-edit-unit",
      "human-edit-team",
      "human-edit-admissionDate",
      "human-edit-notes",
    ]) {
      expect(document.getElementById(id)).toBeTruthy();
    }
  });

  it("RA is read-only (no input element)", async () => {
    await renderReady();
    const raNode = screen.getByTestId("human-edit-ra-readonly");
    expect(raNode.tagName).not.toBe("INPUT");
    expect(raNode.textContent).toBe(RA);
    expect(document.getElementById("human-edit-ra")).toBeNull();
  });

  it("missing record shows missing state", async () => {
    loadHumanForEdit.mockResolvedValueOnce(null);
    render(<HumanEditV1 ra={RA} />);
    await screen.findByText("Integrante não localizado para edição.");
  });

  it("loader rejection shows ERROR state, not missing", async () => {
    loadHumanForEdit.mockRejectedValueOnce(new Error("permission-denied"));
    render(<HumanEditV1 ra={RA} />);
    await screen.findByText("Falha ao carregar o cadastro.");
    expect(screen.queryByText("Integrante não localizado para edição.")).toBeNull();
  });

  it("archived initial load shows archived state, no form", async () => {
    mockLoad({ archived: true });
    render(<HumanEditV1 ra={RA} />);
    await screen.findByText("Integrante arquivado");
    expect(screen.queryByText("Editar integrante")).toBeNull();
  });

  it("no access/Auth/photo controls exist", async () => {
    await renderReady();
    for (const id of [
      "human-edit-role",
      "human-edit-accessLevel",
      "human-edit-email",
      "human-edit-photoUrl",
      "human-edit-password",
    ]) {
      expect(document.getElementById(id)).toBeNull();
    }
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });
});

describe("C2 — permission", () => {
  it("no editable form when can('humans','edit') is false", async () => {
    can.mockReturnValue(false);
    render(<HumanEditV1 ra={RA} />);
    await screen.findByText("Edição não permitida");
    expect(document.getElementById("human-edit-fullName")).toBeNull();
  });

  it("unauthorized profile performs ZERO edit load (no users/{ra} read)", async () => {
    can.mockReturnValue(false);
    render(<HumanEditV1 ra={RA} />);
    await screen.findByText("Edição não permitida");
    expect(loadHumanForEdit).not.toHaveBeenCalled();
    expect(saveHumanEdit).not.toHaveBeenCalled();
  });

  it("permission false→true re-runs the load effect and reaches ready", async () => {
    can.mockReturnValue(false);
    const view = render(<HumanEditV1 ra={RA} />);
    await screen.findByText("Edição não permitida");
    expect(loadHumanForEdit).not.toHaveBeenCalled();

    // Permission granted while mounted: the effect (canEditHuman in deps)
    // re-runs and now performs exactly one authorized load.
    can.mockReturnValue(true);
    mockLoad();
    view.rerender(<HumanEditV1 ra={RA} />);
    await screen.findByText("Editar integrante");
    expect(loadHumanForEdit).toHaveBeenCalledTimes(1);
    expect(document.getElementById("human-edit-fullName")).toBeTruthy();
  });
});

describe("C2 — dirty state", () => {
  it("save disabled when clean, enabled when dirty", async () => {
    await renderReady();
    const save = screen.getByText("Salvar alterações") as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(document.getElementById("human-edit-cargo")!, {
      target: { value: "Condutor" },
    });
    expect(save.disabled).toBe(false);
  });

  it("optional field can be cleared in the UI", async () => {
    await renderReady();
    const phone = document.getElementById("human-edit-phone") as HTMLInputElement;
    fireEvent.change(phone, { target: { value: "" } });
    expect(phone.value).toBe("");
    expect((screen.getByText("Salvar alterações") as HTMLButtonElement).disabled).toBe(
      false,
    );
  });
});

describe("C2 — save wiring", () => {
  it("submit calls C1 with ra, baseline, current draft, and loaded token", async () => {
    await renderReady();
    saveHumanEdit.mockResolvedValueOnce({
      ra: RA,
      noop: false,
      updatedFields: ["cargo"],
      clearedFields: [],
    });
    fireEvent.change(document.getElementById("human-edit-cargo")!, {
      target: { value: "Condutor" },
    });
    // R2: navigation is now deferred behind the success window, so the clock is
    // faked from here on. The REQUEST semantics asserted below are unchanged.
    vi.useFakeTimers();
    fireEvent.click(screen.getByText("Salvar alterações"));
    await flush();
    expect(saveHumanEdit).toHaveBeenCalledTimes(1);
    const arg = saveHumanEdit.mock.calls[0][0];
    expect(arg.ra).toBe(RA);
    expect(arg.baseline.cargo).toBe("Adestrador");
    expect(arg.current.cargo).toBe("Condutor");
    expect(arg.versionToken).toBe(TOKEN);
    await advance(DELAY_MS);
    expect(push).toHaveBeenCalledWith(`/humans/${RA}`);
  });

  it("versionToken null is passed as null", async () => {
    await renderReady({}, { token: null });
    saveHumanEdit.mockResolvedValueOnce({
      ra: RA,
      noop: false,
      updatedFields: ["notes"],
      clearedFields: [],
    });
    fireEvent.change(document.getElementById("human-edit-notes")!, {
      target: { value: "nova obs" },
    });
    fireEvent.click(screen.getByText("Salvar alterações"));
    await waitFor(() => expect(saveHumanEdit).toHaveBeenCalledTimes(1));
    expect(saveHumanEdit.mock.calls[0][0].versionToken).toBeNull();
  });

  it("noop success still navigates to profile", async () => {
    await renderReady();
    saveHumanEdit.mockResolvedValueOnce({
      ra: RA,
      noop: true,
      updatedFields: [],
      clearedFields: [],
    });
    // force dirty so submit is enabled, but C1 decides noop
    fireEvent.change(document.getElementById("human-edit-cargo")!, {
      target: { value: "Condutor" },
    });
    // R2: a C1 no-op is still a RESOLVED save, so it takes the same success
    // window (message then deferred navigation) as a mutating save.
    vi.useFakeTimers();
    fireEvent.click(screen.getByText("Salvar alterações"));
    await flush();
    expect(push).not.toHaveBeenCalled();
    await advance(DELAY_MS);
    expect(push).toHaveBeenCalledWith(`/humans/${RA}`);
  });

  it("rapid double submit causes exactly one save invocation", async () => {
    await renderReady();
    let resolve: (v: unknown) => void = () => {};
    saveHumanEdit.mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      }),
    );
    fireEvent.change(document.getElementById("human-edit-cargo")!, {
      target: { value: "Condutor" },
    });
    const save = screen.getByText("Salvar alterações");
    fireEvent.click(save);
    fireEvent.click(save);
    resolve({ ra: RA, noop: false, updatedFields: ["cargo"], clearedFields: [] });
    await waitFor(() => expect(saveHumanEdit).toHaveBeenCalledTimes(1));
  });

  it("required field emptied blocks save locally (no C1 call)", async () => {
    await renderReady();
    fireEvent.change(document.getElementById("human-edit-fullName")!, {
      target: { value: "" },
    });
    fireEvent.change(document.getElementById("human-edit-cargo")!, {
      target: { value: "Condutor" },
    });
    fireEvent.click(screen.getByText("Salvar alterações"));
    await screen.findByText("Informe o nome completo.");
    expect(saveHumanEdit).not.toHaveBeenCalled();
  });
});

describe("C2 — error mapping", () => {
  async function saveThrows(category: string) {
    await renderReady();
    saveHumanEdit.mockRejectedValueOnce(
      new HumanEditSaveError(
        category as never,
        "backend prose that must not be UI authority",
      ),
    );
    fireEvent.change(document.getElementById("human-edit-cargo")!, {
      target: { value: "Condutor" },
    });
    fireEvent.click(screen.getByText("Salvar alterações"));
  }

  it("UNAUTHENTICATED message", async () => {
    await saveThrows("UNAUTHENTICATED");
    await screen.findByText(/sess.o expirou/i);
  });

  it("PERMISSION_DENIED message", async () => {
    await saveThrows("PERMISSION_DENIED");
    await screen.findByText(/perfil n.o permite editar/i);
  });

  it("INVALID_ARGUMENT message", async () => {
    await saveThrows("INVALID_ARGUMENT");
    await screen.findByText(/revise os campos/i);
  });

  it("NOT_FOUND message", async () => {
    await saveThrows("NOT_FOUND");
    await screen.findByText(/n.o encontrado/i);
  });

  it("UNKNOWN generic message", async () => {
    await saveThrows("UNKNOWN");
    await screen.findByText(/n.o foi poss.vel salvar as altera..es/i);
  });

  it("raw backend prose does not become UI authority", async () => {
    await saveThrows("UNKNOWN");
    await screen.findByText(/n.o foi poss.vel salvar as altera..es/i);
    expect(
      screen.queryByText("backend prose that must not be UI authority"),
    ).toBeNull();
  });
});

describe("C2 — concurrency conflict", () => {
  async function triggerConflict(rereadArchived = false, rereadNull = false) {
    await renderReady({}, { token: TOKEN });
    saveHumanEdit.mockRejectedValueOnce(
      new HumanEditSaveError("PRECONDITION_FAILED", "stale"),
    );
    // The conflict re-read (second loadHumanForEdit call)
    if (rereadNull) {
      loadHumanForEdit.mockResolvedValueOnce(null);
    } else {
      loadHumanForEdit.mockResolvedValueOnce({
        ra: RA,
        baseline: baseline({ cargo: "SERVIDOR MUDOU" }),
        versionToken: 9999,
        archived: rereadArchived,
      });
    }
    fireEvent.change(document.getElementById("human-edit-cargo")!, {
      target: { value: "Meu rascunho" },
    });
    fireEvent.click(screen.getByText("Salvar alterações"));
  }

  it("PRECONDITION_FAILED triggers exactly one re-read and shows conflict notice", async () => {
    await triggerConflict();
    await screen.findByText(
      "Este cadastro foi alterado enquanto você estava editando.",
    );
    // 1 initial load + 1 conflict re-read
    expect(loadHumanForEdit).toHaveBeenCalledTimes(2);
  });

  it("draft is preserved after active conflict re-read (no auto-overwrite)", async () => {
    await triggerConflict();
    await screen.findByText(
      "Este cadastro foi alterado enquanto você estava editando.",
    );
    expect(
      (document.getElementById("human-edit-cargo") as HTMLInputElement).value,
    ).toBe("Meu rascunho");
    // no automatic retry of save
    expect(saveHumanEdit).toHaveBeenCalledTimes(1);
  });

  it("archived on re-read transitions to archived state", async () => {
    await triggerConflict(true);
    await screen.findByText("Integrante arquivado");
  });

  it("null on re-read transitions to missing state", async () => {
    await triggerConflict(false, true);
    await screen.findByText("Integrante não localizado para edição.");
  });

  it("explicit review/reload adopts server state and clears conflict", async () => {
    await triggerConflict();
    await screen.findByText(
      "Este cadastro foi alterado enquanto você estava editando.",
    );
    // explicit reload — server baseline replaces draft
    loadHumanForEdit.mockResolvedValueOnce({
      ra: RA,
      baseline: baseline({ cargo: "VERSAO SERVIDOR" }),
      versionToken: 12345,
      archived: false,
    });
    fireEvent.click(screen.getByText("Revisar versão atual"));
    await waitFor(() =>
      expect(
        (document.getElementById("human-edit-cargo") as HTMLInputElement).value,
      ).toBe("VERSAO SERVIDOR"),
    );
    expect(
      screen.queryByText(
        "Este cadastro foi alterado enquanto você estava editando.",
      ),
    ).toBeNull();
  });
});

describe("C2 — dirty exit", () => {
  it("clean Cancel navigates immediately", async () => {
    await renderReady();
    fireEvent.click(screen.getByText("Cancelar"));
    expect(push).toHaveBeenCalledWith(`/humans/${RA}`);
  });

  it("dirty Cancel opens discard confirmation", async () => {
    await renderReady();
    fireEvent.change(document.getElementById("human-edit-cargo")!, {
      target: { value: "Condutor" },
    });
    fireEvent.click(screen.getByText("Cancelar"));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it("continue editing keeps the draft", async () => {
    await renderReady();
    fireEvent.change(document.getElementById("human-edit-cargo")!, {
      target: { value: "Condutor" },
    });
    fireEvent.click(screen.getByText("Cancelar"));
    fireEvent.click(screen.getByText("Continuar editando"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      (document.getElementById("human-edit-cargo") as HTMLInputElement).value,
    ).toBe("Condutor");
    expect(push).not.toHaveBeenCalled();
  });

  it("discard navigates away", async () => {
    await renderReady();
    fireEvent.change(document.getElementById("human-edit-cargo")!, {
      target: { value: "Condutor" },
    });
    fireEvent.click(screen.getByText("Cancelar"));
    fireEvent.click(screen.getByText("Descartar"));
    expect(push).toHaveBeenCalledWith(`/humans/${RA}`);
  });
});

/**
 * Gate 10H-HUMAN-EDIT-WEB.C2.R2 — explicit success acknowledgement.
 *
 * R2 changes ONLY the interval between a resolved C1 save and the existing
 * `router.push(profilePath(ra))`. Request semantics, error mapping, conflict
 * handling and the destination are untouched and are asserted as invariants.
 */
describe("C2.R2 — success acknowledgement", () => {
  /** Dirty the form and submit with a resolving C1, under fake timers. */
  async function saveSucceeds() {
    await renderReady();
    saveHumanEdit.mockResolvedValueOnce(okResult());
    fireEvent.change(document.getElementById("human-edit-cargo")!, {
      target: { value: "Condutor" },
    });
    vi.useFakeTimers();
    fireEvent.click(screen.getByText("Salvar alterações"));
    await flush();
  }

  it("resolved save shows the status message and defers navigation past the delay", async () => {
    await saveSucceeds();

    const status = screen.getByText(SUCCESS_MESSAGE);
    expect(status.getAttribute("role")).toBe("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    // message is up, navigation has NOT happened yet
    expect(push).toHaveBeenCalledTimes(0);

    // strictly inside the window: still no navigation
    await advance(DELAY_MS - 1);
    expect(push).toHaveBeenCalledTimes(0);

    // reaching the delay navigates exactly once, to the unchanged destination
    await advance(1);
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith(`/humans/${RA}`);

    // and no further navigation afterwards
    await advance(DELAY_MS * 5);
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("the success copy appears exactly once", async () => {
    await saveSucceeds();
    expect(screen.getAllByText(SUCCESS_MESSAGE)).toHaveLength(1);
    await advance(DELAY_MS - 1);
    expect(screen.getAllByText(SUCCESS_MESSAGE)).toHaveLength(1);
  });

  it("no success status before the save resolves", async () => {
    await renderReady();
    saveHumanEdit.mockReturnValueOnce(new Promise(() => {}));
    fireEvent.change(document.getElementById("human-edit-cargo")!, {
      target: { value: "Condutor" },
    });
    vi.useFakeTimers();
    fireEvent.click(screen.getByText("Salvar alterações"));
    await flush();
    expect(screen.queryByText(SUCCESS_MESSAGE)).toBeNull();
    await advance(DELAY_MS * 3);
    expect(screen.queryByText(SUCCESS_MESSAGE)).toBeNull();
    expect(push).toHaveBeenCalledTimes(0);
  });

  it("initial ready load shows no success status", async () => {
    await renderReady();
    expect(screen.queryByText(SUCCESS_MESSAGE)).toBeNull();
  });

  it("rejected save produces no success status and no delayed navigation", async () => {
    await renderReady();
    saveHumanEdit.mockRejectedValueOnce(
      new HumanEditSaveError("UNKNOWN", "falhou"),
    );
    fireEvent.change(document.getElementById("human-edit-cargo")!, {
      target: { value: "Condutor" },
    });
    vi.useFakeTimers();
    fireEvent.click(screen.getByText("Salvar alterações"));
    await flush();

    expect(screen.queryByText(SUCCESS_MESSAGE)).toBeNull();
    await advance(DELAY_MS * 3);
    expect(screen.queryByText(SUCCESS_MESSAGE)).toBeNull();
    expect(push).toHaveBeenCalledTimes(0);
  });

  it("PERMISSION_DENIED produces no success status", async () => {
    await renderReady();
    saveHumanEdit.mockRejectedValueOnce(
      new HumanEditSaveError("PERMISSION_DENIED", "negado"),
    );
    fireEvent.change(document.getElementById("human-edit-cargo")!, {
      target: { value: "Condutor" },
    });
    vi.useFakeTimers();
    fireEvent.click(screen.getByText("Salvar alterações"));
    await flush();
    expect(screen.queryByText(SUCCESS_MESSAGE)).toBeNull();
    await advance(DELAY_MS * 3);
    expect(push).toHaveBeenCalledTimes(0);
  });

  it("local validation block produces no success status (no C1 call)", async () => {
    await renderReady();
    vi.useFakeTimers();
    fireEvent.change(document.getElementById("human-edit-fullName")!, {
      target: { value: "" },
    });
    fireEvent.click(screen.getByText("Salvar alterações"));
    await flush();
    expect(saveHumanEdit).not.toHaveBeenCalled();
    expect(screen.queryByText(SUCCESS_MESSAGE)).toBeNull();
    await advance(DELAY_MS * 3);
    expect(push).toHaveBeenCalledTimes(0);
  });

  it("PRECONDITION_FAILED conflict keeps its UI and produces no success status", async () => {
    await renderReady({}, { token: TOKEN });
    saveHumanEdit.mockRejectedValueOnce(
      new HumanEditSaveError("PRECONDITION_FAILED", "stale"),
    );
    loadHumanForEdit.mockResolvedValueOnce({
      ra: RA,
      baseline: baseline({ cargo: "SERVIDOR MUDOU" }),
      versionToken: 9999,
      archived: false,
    });
    fireEvent.change(document.getElementById("human-edit-cargo")!, {
      target: { value: "Meu rascunho" },
    });
    vi.useFakeTimers();
    fireEvent.click(screen.getByText("Salvar alterações"));
    await flush();

    // conflict UI unchanged, draft preserved
    expect(
      screen.getByText(
        "Este cadastro foi alterado enquanto você estava editando.",
      ),
    ).toBeTruthy();
    expect(
      (document.getElementById("human-edit-cargo") as HTMLInputElement).value,
    ).toBe("Meu rascunho");
    expect(screen.queryByText(SUCCESS_MESSAGE)).toBeNull();

    await advance(DELAY_MS * 3);
    expect(screen.queryByText(SUCCESS_MESSAGE)).toBeNull();
    expect(push).toHaveBeenCalledTimes(0);
  });

  it("archived re-read after conflict produces no success status", async () => {
    await renderReady({}, { token: TOKEN });
    saveHumanEdit.mockRejectedValueOnce(
      new HumanEditSaveError("PRECONDITION_FAILED", "stale"),
    );
    loadHumanForEdit.mockResolvedValueOnce({
      ra: RA,
      baseline: baseline(),
      versionToken: 9999,
      archived: true,
    });
    fireEvent.change(document.getElementById("human-edit-cargo")!, {
      target: { value: "Meu rascunho" },
    });
    vi.useFakeTimers();
    fireEvent.click(screen.getByText("Salvar alterações"));
    await flush();
    expect(screen.getByText("Integrante arquivado")).toBeTruthy();
    expect(screen.queryByText(SUCCESS_MESSAGE)).toBeNull();
    await advance(DELAY_MS * 3);
    expect(push).toHaveBeenCalledTimes(0);
  });

  it("second submit inside the success window does not re-save or re-navigate", async () => {
    await saveSucceeds();

    // The submit button is inert during the success transition, so drive the
    // form directly — that proves the GUARD, not merely the disabled attribute.
    submitForm();
    submitForm();
    await flush();

    expect(saveHumanEdit).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText(SUCCESS_MESSAGE)).toHaveLength(1);
    expect(push).toHaveBeenCalledTimes(0);

    await advance(DELAY_MS);
    expect(saveHumanEdit).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith(`/humans/${RA}`);
  });

  it("submit button is disabled during the success window", async () => {
    await saveSucceeds();
    expect(
      (screen.getByText("Salvar alterações") as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("Cancel inside the success window opens no discard flow and adds no navigation", async () => {
    await saveSucceeds();

    const cancel = screen.getByText("Cancelar") as HTMLButtonElement;
    expect(cancel.disabled).toBe(true);
    // click through the disabled affordance to prove the handler guard too
    fireEvent.click(cancel);
    await flush();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(push).toHaveBeenCalledTimes(0);

    await advance(DELAY_MS);
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith(`/humans/${RA}`);
  });

  it("unmount before the delay expires performs no navigation", async () => {
    await renderReady();
    saveHumanEdit.mockResolvedValueOnce(okResult());
    fireEvent.change(document.getElementById("human-edit-cargo")!, {
      target: { value: "Condutor" },
    });
    vi.useFakeTimers();
    fireEvent.click(screen.getByText("Salvar alterações"));
    await flush();
    expect(screen.getByText(SUCCESS_MESSAGE)).toBeTruthy();

    cleanup();
    await advance(DELAY_MS * 3);
    expect(push).toHaveBeenCalledTimes(0);
  });

  it("dirty save success suppresses the unsaved-changes warning", async () => {
    await saveSucceeds();
    // Post-success the draft still differs from the loaded baseline, but the
    // save is confirmed: beforeunload must not claim unsaved changes.
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("dirty editing without a save still warns on unload", async () => {
    await renderReady();
    fireEvent.change(document.getElementById("human-edit-cargo")!, {
      target: { value: "Condutor" },
    });
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
