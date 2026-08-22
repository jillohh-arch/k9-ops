import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const can = vi.fn();
const loadHumanForEdit = vi.fn();
const saveHuman = vi.fn();
const archiveHuman = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/features/access/providers/access-control-provider", () => ({
  useAccessControl: () => ({ can }),
}));

// Evita a inicialização real do Firebase (auth/invalid-api-key em jsdom) ao
// importar o serviço real para preservar os helpers puros do W3.
vi.mock("@/lib/firebase/client", () => ({ db: {}, storage: {} }));
vi.mock("firebase/firestore", () => ({
  doc: vi.fn(() => ({})),
  getDoc: vi.fn(),
}));
vi.mock("firebase/storage", () => ({
  ref: vi.fn(() => ({})),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
}));
vi.mock("@/lib/firebase/functions", () => ({
  callAdminUpsertHuman: vi.fn(),
  callAdminArchiveHuman: vi.fn(),
  callAdminArchiveHumanCertification: vi.fn(),
  callAdminArchiveHumanDocument: vi.fn(),
  callAdminArchiveHumanMovement: vi.fn(),
  callAdminSaveHumanCertification: vi.fn(),
  callAdminSaveHumanDocument: vi.fn(),
  callAdminSaveHumanMovement: vi.fn(),
}));

// Perfis de acesso disponíveis — os canônicos visíveis do sistema.
vi.mock("@/features/access/hooks/use-access-profiles", () => ({
  useAccessProfiles: () => ({
    error: null,
    loading: false,
    profiles: [],
  }),
}));

vi.mock("@/features/effective/data/human-admin-service", async () => {
  const actual = await vi.importActual<
    typeof import("../../data/human-admin-service")
  >("../../data/human-admin-service");
  return {
    ...actual,
    archiveHuman,
    loadHumanForEdit,
    saveHuman,
  };
});

const { HumanAdminForm } = await import("../human-admin-form");

const BLOCKED_COPY =
  /edição administrativa legada não pode ser usada sem um perfil de acesso/i;

function unprovisionedRecord() {
  return {
    accessLevel: "",
    accessProfile: "",
    accessProfileId: "",
    active: true,
    admissionDate: "",
    birthDate: "",
    callsign: "SILVA",
    cpf: "",
    fullName: "Agente Silva",
    institutionalEmail: "",
    isK9Instructor: false,
    notes: "",
    phone: "",
    photoUrl: "",
    ra: "998877",
    rank: "",
    role: "Condutor K9",
    shiftGroupId: "",
    shiftLabel: "",
    specialties: [],
    status: "Ativo",
    team: "",
    unit: "",
  };
}

function provisionedRecord() {
  return {
    ...unprovisionedRecord(),
    accessLevel: "Gestor / Comando",
    accessProfile: "Gestor / Comando",
    accessProfileId: "gestor",
    callsign: "COMANDANTE",
    fullName: "Comandante",
    ra: "1003",
  };
}

describe("H3-W3 — HumanAdminForm guarda de Edit legado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    can.mockReturnValue(true);
    saveHuman.mockResolvedValue({ ra: "1003" });
  });

  afterEach(() => cleanup());

  it("registro não provisionado renderiza estado honesto de acesso ausente", async () => {
    loadHumanForEdit.mockResolvedValue(unprovisionedRecord());

    render(<HumanAdminForm mode="edit" ra="998877" />);

    await waitFor(() =>
      expect(screen.getByText("Acesso não provisionado")).toBeInTheDocument(),
    );
    expect(screen.getByText(BLOCKED_COPY)).toBeInTheDocument();

    // O acesso RESOLVIDO é exibido como "Não provisionado". "Operador" só pode
    // aparecer como rótulo de <option> selecionável, nunca como estado atual.
    expect(screen.getByText("Não provisionado")).toBeInTheDocument();
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.selectedOptions[0]?.textContent).toBe("Sem perfil de acesso");
    const operadorLabels = screen
      .queryAllByText("Operador")
      .filter((node) => node.tagName !== "OPTION");
    expect(operadorLabels).toHaveLength(0);
  });

  it("registro não provisionado NÃO pré-seleciona nenhum perfil de acesso", async () => {
    loadHumanForEdit.mockResolvedValue(unprovisionedRecord());

    render(<HumanAdminForm mode="edit" ra="998877" />);

    await waitFor(() =>
      expect(screen.getByText("Acesso não provisionado")).toBeInTheDocument(),
    );

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    // Valor vazio e placeholder honesto, não coagido para operador_k9.
    expect(select.value).toBe("");
    expect(select.value).not.toBe("operador_k9");
    expect(
      screen.getByRole("option", { name: "Sem perfil de acesso" }),
    ).toBeInTheDocument();
  });

  it("submit de Edit legado não provisionado é bloqueado e NÃO chama saveHuman", async () => {
    loadHumanForEdit.mockResolvedValue(unprovisionedRecord());

    render(<HumanAdminForm mode="edit" ra="998877" />);

    await waitFor(() =>
      expect(screen.getByText("Acesso não provisionado")).toBeInTheDocument(),
    );

    const saveButton = screen.getByRole("button", { name: /Salvar efetivo/ });
    expect(saveButton).toBeDisabled();

    // Mesmo forçando o submit do form, saveHuman nunca é chamado.
    const form = saveButton.closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(saveHuman).toHaveBeenCalledTimes(0);
  });

  it("registro provisionado permite submit usando o perfil explícito", async () => {
    loadHumanForEdit.mockResolvedValue(provisionedRecord());

    render(<HumanAdminForm mode="edit" ra="1003" />);

    await waitFor(() =>
      expect(
        screen.queryByText("Acesso não provisionado"),
      ).not.toBeInTheDocument(),
    );

    const saveButton = screen.getByRole("button", { name: /Salvar efetivo/ });
    expect(saveButton).not.toBeDisabled();

    fireEvent.click(saveButton);

    await waitFor(() => expect(saveHuman).toHaveBeenCalledTimes(1));
    const [mode, values] = saveHuman.mock.calls[0];
    expect(mode).toBe("edit");
    expect(values.accessProfileId).toBe("gestor");
  });
});
