import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
});

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
    fireEvent.click(screen.getByText("Salvar alterações"));
    await waitFor(() => expect(saveHumanEdit).toHaveBeenCalledTimes(1));
    const arg = saveHumanEdit.mock.calls[0][0];
    expect(arg.ra).toBe(RA);
    expect(arg.baseline.cargo).toBe("Adestrador");
    expect(arg.current.cargo).toBe("Condutor");
    expect(arg.versionToken).toBe(TOKEN);
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/humans/${RA}`));
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
    fireEvent.click(screen.getByText("Salvar alterações"));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/humans/${RA}`));
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
