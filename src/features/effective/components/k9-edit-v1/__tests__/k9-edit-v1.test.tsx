import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const loadK9ForEdit = vi.fn();
const saveK9IdentityV1 = vi.fn();
const can = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/features/access/providers/access-control-provider", () => ({
  useAccessControl: () => ({ can }),
}));

vi.mock("@/features/effective/data/k9-admin-service", () => ({
  loadK9ForEdit,
  saveK9IdentityV1,
}));

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

// The component reaches the adapter for its typed error and projection, and the
// adapter imports the callable client. Stub the Firebase boundary so the UI test
// exercises no real SDK initialization.
vi.mock("@/lib/firebase/client", () => ({ db: {}, functions: {}, storage: {} }));

vi.mock("@/lib/firebase/functions", () => ({
  callAdminPatchK9Identity: vi.fn(),
  callAdminUpsertK9: vi.fn(),
  callAdminArchiveK9: vi.fn(),
}));

const { K9EditV1 } = await import("../k9-edit-v1");
const { K9EditError } = await import("../k9-edit-adapter");

const DOG_ID = "stg-dog-nutrition-unlinked-001";
const TOKEN = 1787150985600;

function loadedValues(overrides: Record<string, unknown> = {}) {
  return {
    birthDate: "2021-03-04",
    breed: "Pastor Belga Malinois",
    color: "Fulvo",
    conductorRa: "990002",
    idealWeightMax: "35",
    idealWeightMin: "30",
    microchip: "900000000000STG1",
    name: "STG K9 Edit Fixture",
    notes: "Observação inicial",
    operationalStatus: "Ativo",
    physicalCondition: "ideal",
    profileImageUrl: "https://example.invalid/a.jpg",
    registrationNumber: "STG-K9-EDIT-0001",
    sex: "M",
    size: "Grande",
    specialties: ["deteccao"],
    weight: "32.5",
    ...overrides,
  };
}

function mockLoad(options: { archived?: boolean; values?: Record<string, unknown> } = {}) {
  loadK9ForEdit.mockResolvedValue({
    archived: options.archived ?? false,
    protectedSpecialties: [],
    values: options.values ?? loadedValues(),
    versionToken: TOKEN,
  });
}

async function renderReady() {
  render(<K9EditV1 dogId={DOG_ID} />);
  await waitFor(() => expect(screen.getByText("Editar K9")).toBeTruthy());
}

function saveButton() {
  return screen.getByRole("button", { name: /Salvar alterações/ });
}

function changeField(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

beforeEach(() => {
  vi.clearAllMocks();
  can.mockReturnValue(true);
  mockLoad();
  saveK9IdentityV1.mockResolvedValue({
    clearedFields: [],
    id: DOG_ID,
    noop: false,
    updatedFields: ["name"],
  });
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => cleanup());

// ------------------------------------------------------------------ render

describe("Edit V1 — identity surface", () => {
  it("renders the 10 identity fields", async () => {
    await renderReady();
    expect(screen.getByLabelText(/Nome operacional/)).toBeTruthy();
    expect(screen.getByLabelText(/Matrícula \/ RGA/)).toBeTruthy();
    expect(screen.getByLabelText(/^Raça/)).toBeTruthy();
    expect(screen.getByLabelText(/^Sexo/)).toBeTruthy();
    expect(screen.getByLabelText(/Data de nascimento/)).toBeTruthy();
    expect(screen.getByLabelText(/Pelagem \/ cor/)).toBeTruthy();
    expect(screen.getByLabelText(/^Porte/)).toBeTruthy();
    expect(screen.getByLabelText(/^Microchip/)).toBeTruthy();
    expect(screen.getByLabelText(/Observações administrativas/)).toBeTruthy();
  });

  it("states the administrative scope in the subtitle", async () => {
    await renderReady();
    expect(screen.getByText(/Identidade e dados administrativos/)).toBeTruthy();
  });

  it("shows the current photo", async () => {
    await renderReady();
    expect(screen.getByAltText("Foto do K9")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Remover foto/ })).toBeTruthy();
  });
});

// --------------------------------------------------------- cross-domain UI

describe("Edit V1 — cross-domain fields are context, not inputs", () => {
  const forbidden: Array<[string, RegExp]> = [
    ["weight", /Peso atual/],
    ["idealWeight", /Peso ideal/],
    ["physicalCondition", /Condição corporal/],
    ["conductorRa", /Condutor \(RA\)/],
  ];

  for (const [field, label] of forbidden) {
    it(`${field} is rendered read-only, never as a form control`, async () => {
      await renderReady();
      expect(screen.getByText(label)).toBeTruthy();
      expect(screen.queryByLabelText(label)).toBeNull();
    });
  }

  it("specialties appear as read-only context", async () => {
    await renderReady();
    expect(screen.getByText("deteccao")).toBeTruthy();
    expect(screen.queryByLabelText(/Modalidades/)).toBeNull();
  });

  it("operationalStatus is not editable", async () => {
    await renderReady();
    expect(screen.queryByLabelText(/Situação cadastral/)).toBeNull();
    expect(screen.queryByLabelText(/Situa/)).toBeNull();
  });

  it("explains that context belongs to other modules", async () => {
    await renderReady();
    expect(
      screen.getByText(/pertencem a outros módulos e não são alteradas/),
    ).toBeTruthy();
  });

  it("offers real domain links", async () => {
    await renderReady();
    expect(screen.getByRole("link", { name: /Gerenciar Saúde/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Gerenciar Binômio/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Ver Formação/ })).toBeTruthy();
  });
});

// ------------------------------------------------------------- dirty state

describe("Edit V1 — dirty state", () => {
  it("disables save when nothing changed", async () => {
    await renderReady();
    expect(saveButton()).toHaveProperty("disabled", true);
  });

  it("enables save after an identity change", async () => {
    await renderReady();
    changeField(/Nome operacional/, "Bono II");
    expect(saveButton()).toHaveProperty("disabled", false);
  });

  it("a cross-domain value cannot be typed, so it cannot make the form dirty", async () => {
    await renderReady();
    expect(screen.queryByLabelText(/Peso atual/)).toBeNull();
    expect(saveButton()).toHaveProperty("disabled", true);
  });
});

// -------------------------------------------------------------- validation

describe("Edit V1 — validation", () => {
  it("color is NOT required (aligns with the homologated contract)", async () => {
    await renderReady();
    changeField(/Pelagem \/ cor/, "");
    fireEvent.click(saveButton());
    await waitFor(() => expect(saveK9IdentityV1).toHaveBeenCalledTimes(1));
  });

  it("clearing color reaches the save path", async () => {
    await renderReady();
    changeField(/Pelagem \/ cor/, "");
    fireEvent.click(saveButton());
    await waitFor(() => expect(saveK9IdentityV1).toHaveBeenCalled());
    expect(saveK9IdentityV1.mock.calls[0][0].values.color).toBe("");
  });

  it("clearing microchip reaches the save path", async () => {
    await renderReady();
    changeField(/^Microchip/, "");
    fireEvent.click(saveButton());
    await waitFor(() => expect(saveK9IdentityV1).toHaveBeenCalled());
    expect(saveK9IdentityV1.mock.calls[0][0].values.microchip).toBe("");
  });

  const required: Array<[string, RegExp, RegExp]> = [
    ["name", /Nome operacional/, /Informe o nome operacional/],
    ["registrationNumber", /Matrícula \/ RGA/, /Informe a matrícula/],
    ["breed", /^Raça/, /Informe a raça/],
    ["sex", /^Sexo/, /Informe o sexo/],
    ["birthDate", /Data de nascimento/, /Informe a data de nascimento/],
  ];

  for (const [field, label, message] of required) {
    it(`${field} is required and blocks the save`, async () => {
      await renderReady();
      changeField(/Nome operacional/, "Bono II");
      changeField(label, "");
      fireEvent.click(saveButton());
      await waitFor(() => expect(screen.getByText(message)).toBeTruthy());
      expect(saveK9IdentityV1).not.toHaveBeenCalled();
    });
  }

  it("does not silently default sex to M for a legacy value", async () => {
    mockLoad({ values: loadedValues({ sex: "indefinido" }) });
    await renderReady();
    expect(screen.getByText(/Valor legado não reconhecido/)).toBeTruthy();
  });
});

// ------------------------------------------------------------------ errors

describe("Edit V1 — error UX", () => {
  async function failWith(category: string, message = "erro") {
    saveK9IdentityV1.mockRejectedValue(new K9EditError(category as never, message));
    await renderReady();
    changeField(/Nome operacional/, "Bono II");
    fireEvent.click(saveButton());
  }

  it("duplicate registration is a field error and keeps the typed value", async () => {
    await failWith("ALREADY_EXISTS");
    await waitFor(() =>
      expect(screen.getByText(/Esta matrícula já está cadastrada/)).toBeTruthy(),
    );
    expect(
      (screen.getByLabelText(/Matrícula \/ RGA/) as HTMLInputElement).value,
    ).toBe("STG-K9-EDIT-0001");
    expect(push).not.toHaveBeenCalled();
  });

  it("permission denied is surfaced", async () => {
    await failWith("PERMISSION_DENIED");
    await waitFor(() =>
      expect(screen.getByText(/não permite editar este K9/)).toBeTruthy(),
    );
  });

  it("unauthenticated is surfaced as an expired session", async () => {
    await failWith("UNAUTHENTICATED");
    await waitFor(() => expect(screen.getByText(/sessão expirou/i)).toBeTruthy());
  });

  it("invalid argument is surfaced safely", async () => {
    await failWith("INVALID_ARGUMENT");
    await waitFor(() => expect(screen.getByText(/dados inválidos/)).toBeTruthy());
  });

  it("cross-domain dirty guard message is surfaced verbatim", async () => {
    await failWith("NON_IDENTITY_DIRTY", "pertencem a outros módulos");
    await waitFor(() =>
      expect(screen.getByText(/pertencem a outros módulos$/)).toBeTruthy(),
    );
  });

  it("does not clear the form on error", async () => {
    await failWith("INVALID_ARGUMENT");
    await waitFor(() => expect(screen.getByText(/dados inválidos/)).toBeTruthy());
    expect((screen.getByLabelText(/Nome operacional/) as HTMLInputElement).value).toBe(
      "Bono II",
    );
  });
});

// ---------------------------------------------------- precondition / conflict

describe("Edit V1 — FAILED_PRECONDITION disambiguation by re-read", () => {
  async function triggerPrecondition() {
    saveK9IdentityV1.mockRejectedValue(
      new K9EditError("PRECONDITION_FAILED", "backend prose", {
        code: "failed-precondition",
      }),
    );
    await renderReady();
    changeField(/Nome operacional/, "Bono II");
    fireEvent.click(saveButton());
  }

  it("re-reads the K9 instead of parsing the message", async () => {
    await triggerPrecondition();
    await waitFor(() => expect(loadK9ForEdit).toHaveBeenCalledTimes(2));
  });

  it("archived after re-read shows the archived state", async () => {
    saveK9IdentityV1.mockRejectedValue(
      new K9EditError("PRECONDITION_FAILED", "x", { code: "failed-precondition" }),
    );
    loadK9ForEdit
      .mockResolvedValueOnce({
        archived: false,
        protectedSpecialties: [],
        values: loadedValues(),
        versionToken: TOKEN,
      })
      .mockResolvedValueOnce({
        archived: true,
        protectedSpecialties: [],
        values: loadedValues({ active: false }),
        versionToken: TOKEN,
      });
    render(<K9EditV1 dogId={DOG_ID} />);
    await waitFor(() => expect(screen.getByText("Editar K9")).toBeTruthy());
    changeField(/Nome operacional/, "Bono II");
    fireEvent.click(saveButton());
    await waitFor(() => expect(screen.getByText("K9 arquivado")).toBeTruthy());
    expect(screen.getByText(/Restaure o K9 antes/)).toBeTruthy();
  });

  it("still active after re-read shows the conflict notice", async () => {
    await triggerPrecondition();
    await waitFor(() =>
      expect(
        screen.getByText(/alterado enquanto você estava editando/),
      ).toBeTruthy(),
    );
  });

  it("conflict preserves the local draft", async () => {
    await triggerPrecondition();
    await waitFor(() =>
      expect(screen.getByText(/alterado enquanto você estava editando/)).toBeTruthy(),
    );
    expect((screen.getByLabelText(/Nome operacional/) as HTMLInputElement).value).toBe(
      "Bono II",
    );
  });

  it("never retries automatically and never merges", async () => {
    await triggerPrecondition();
    await waitFor(() =>
      expect(screen.getByText(/alterado enquanto você estava editando/)).toBeTruthy(),
    );
    expect(saveK9IdentityV1).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it("reload is explicit and operator-initiated", async () => {
    await triggerPrecondition();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Revisar versão atual/ })).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("button", { name: /Revisar versão atual/ }));
    await waitFor(() => expect(loadK9ForEdit).toHaveBeenCalledTimes(3));
  });
});

// ---------------------------------------------------------------- archived

describe("Edit V1 — archived K9", () => {
  it("does not offer an editable form", async () => {
    mockLoad({ archived: true });
    render(<K9EditV1 dogId={DOG_ID} />);
    await waitFor(() => expect(screen.getByText("K9 arquivado")).toBeTruthy());
    expect(screen.queryByLabelText(/Nome operacional/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Salvar alterações/ })).toBeNull();
  });
});

// ------------------------------------------------------------------- photo

describe("Edit V1 — photo", () => {
  it("replacing a photo passes the file to the save path", async () => {
    await renderReady();
    const file = new File(["x"], "k9.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText(/Trocar foto/), {
      target: { files: [file] },
    });
    fireEvent.click(saveButton());
    await waitFor(() => expect(saveK9IdentityV1).toHaveBeenCalled());
    expect(saveK9IdentityV1.mock.calls[0][0].photoFile).toBe(file);
  });

  it("removing the photo empties the reference for an explicit clear", async () => {
    await renderReady();
    fireEvent.click(screen.getByRole("button", { name: /Remover foto/ }));
    fireEvent.click(saveButton());
    await waitFor(() => expect(saveK9IdentityV1).toHaveBeenCalled());
    const arg = saveK9IdentityV1.mock.calls[0][0];
    expect(arg.values.profileImageUrl).toBe("");
    expect(arg.photoFile).toBeNull();
  });

  it("cancelling the picker does not clear the photo", async () => {
    await renderReady();
    fireEvent.change(screen.getByLabelText(/Trocar foto/), {
      target: { files: [] },
    });
    expect(screen.getByAltText("Foto do K9")).toBeTruthy();
    expect(saveButton()).toHaveProperty("disabled", true);
  });
});

// -------------------------------------------------------------------- save

describe("Edit V1 — save behaviour", () => {
  it("passes baseline, dogId and versionToken to the save path", async () => {
    await renderReady();
    changeField(/Nome operacional/, "Bono II");
    fireEvent.click(saveButton());
    await waitFor(() => expect(saveK9IdentityV1).toHaveBeenCalled());
    const arg = saveK9IdentityV1.mock.calls[0][0];
    expect(arg.dogId).toBe(DOG_ID);
    expect(arg.versionToken).toBe(TOKEN);
    expect(arg.baselineValues.name).toBe("STG K9 Edit Fixture");
  });

  it("navigates to the profile after a successful save", async () => {
    await renderReady();
    changeField(/Nome operacional/, "Bono II");
    fireEvent.click(saveButton());
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(`/k9/${encodeURIComponent(DOG_ID)}`),
    );
  });

  it("prevents double submit while saving", async () => {
    let release: (value: unknown) => void = () => {};
    saveK9IdentityV1.mockReturnValue(new Promise((resolve) => (release = resolve)));
    await renderReady();
    changeField(/Nome operacional/, "Bono II");
    fireEvent.click(saveButton());
    // While saving, the CTA relabels to "Salvando..." and is disabled, so it must
    // be queried by role alone rather than by its idle name.
    await waitFor(() => expect(screen.getByText(/Salvando/)).toBeTruthy());
    const submitting = screen.getByRole("button", { name: /Salvando/ });
    expect(submitting).toHaveProperty("disabled", true);
    fireEvent.click(submitting);
    fireEvent.click(submitting);
    expect(saveK9IdentityV1).toHaveBeenCalledTimes(1);
    release({ clearedFields: [], id: DOG_ID, noop: false, updatedFields: [] });
  });

  it("blocks the save when the profile lacks k9.edit", async () => {
    can.mockReturnValue(false);
    render(<K9EditV1 dogId={DOG_ID} />);
    await waitFor(() =>
      expect(screen.getByText(/não permite editar K9/)).toBeTruthy(),
    );
    expect(screen.queryByLabelText(/Nome operacional/)).toBeNull();
  });
});

// ------------------------------------------------- dirty navigation / cancel

describe("Edit V1 — cancel and dirty navigation", () => {
  function cancelButton() {
    return screen.getByRole("button", { name: /^Cancelar$/ });
  }

  it("clean cancel navigates without asking", async () => {
    await renderReady();
    fireEvent.click(cancelButton());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(push).toHaveBeenCalledWith(`/k9/${encodeURIComponent(DOG_ID)}`);
  });

  it("dirty cancel asks for confirmation instead of navigating", async () => {
    await renderReady();
    changeField(/Nome operacional/, "Bono II");
    fireEvent.click(cancelButton());
    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
    expect(screen.getByText("Descartar alterações?")).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it("declining the confirmation preserves the draft", async () => {
    await renderReady();
    changeField(/Nome operacional/, "Bono II");
    fireEvent.click(cancelButton());
    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Continuar editando/ }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect((screen.getByLabelText(/Nome operacional/) as HTMLInputElement).value).toBe(
      "Bono II",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("accepting the confirmation navigates away", async () => {
    await renderReady();
    changeField(/Nome operacional/, "Bono II");
    fireEvent.click(cancelButton());
    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Descartar/ }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(`/k9/${encodeURIComponent(DOG_ID)}`),
    );
  });

  it("a photo selection alone makes the form dirty", async () => {
    await renderReady();
    const file = new File(["x"], "k9.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText(/Trocar foto/), {
      target: { files: [file] },
    });
    fireEvent.click(cancelButton());
    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
  });

  it("never patches global history or router internals", async () => {
    const pushState = window.history.pushState;
    await renderReady();
    changeField(/Nome operacional/, "Bono II");
    expect(window.history.pushState).toBe(pushState);
  });
});

// ------------------------------------------------------ contextual rail shape

describe("Edit V1 — contextual rail is not a form", () => {
  it("contains no form controls at all", async () => {
    await renderReady();
    const rail = screen.getByLabelText("Contexto operacional");
    expect(rail.querySelectorAll("input, select, textarea").length).toBe(0);
  });

  it("uses no disabled controls that could read as broken", async () => {
    await renderReady();
    const rail = screen.getByLabelText("Contexto operacional");
    expect(rail.querySelectorAll("[disabled]").length).toBe(0);
  });
});
