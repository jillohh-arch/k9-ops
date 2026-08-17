import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const back = vi.fn();
const saveNewK9V1 = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back, push }),
}));

vi.mock("@/features/access/providers/access-control-provider", () => ({
  useAccessControl: () => ({ can: () => true }),
}));

vi.mock("@/features/auth/providers/auth-provider", () => ({
  useAuth: () => ({ profile: { uid: "tester" } }),
}));

vi.mock("../k9-create-adapter", () => ({
  saveNewK9V1,
}));

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

const { K9CreateForm } = await import("../k9-create-form");

function fillRequired() {
  fireEvent.change(screen.getByLabelText(/Nome operacional/), {
    target: { value: "Bono" },
  });
  fireEvent.change(screen.getByLabelText(/Matrícula \/ RGA/), {
    target: { value: "K9-001" },
  });
  fireEvent.change(screen.getByLabelText(/^Raça/), {
    target: { value: "Malinois Belga" },
  });
  fireEvent.change(screen.getByLabelText(/^Sexo/), {
    target: { value: "M" },
  });
  fireEvent.change(screen.getByLabelText(/Data de nascimento/), {
    target: { value: "2020-01-02" },
  });
}

describe("K9 Create V1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveNewK9V1.mockResolvedValue("dog-123");
    // jsdom não implementa a API de object URLs usada pelo preview local.
    URL.createObjectURL = vi.fn(() => "blob:mock");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => cleanup());

  it("renderiza apenas os campos do contrato CREATE", () => {
    render(<K9CreateForm />);

    expect(screen.getByLabelText(/Nome operacional/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Matrícula \/ RGA/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Raça/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Data de nascimento/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Cor \/ Pelagem/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Microchip/)).toBeInTheDocument();
    expect(screen.getByText("Adicionar foto")).toBeInTheDocument();

    expect(screen.queryByText(/Peso atual/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Peso ideal/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Condutor/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Especialidades/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Prontidão calculada/)).not.toBeInTheDocument();
  });

  it("mostra status Ativo automático e não oferece edição", () => {
    render(<K9CreateForm />);
    const statusLabel = screen.getByText("Situação cadastral:");
    expect(statusLabel.parentElement?.textContent).toContain("Ativo");
    expect(
      screen.queryByLabelText(/Situação cadastral/),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Status cadastral/)).not.toBeInTheDocument();
  });

  it("não pré-seleciona sexo e mostra a opção de escolha", () => {
    render(<K9CreateForm />);
    const sexField = screen.getByLabelText(/^Sexo/) as HTMLSelectElement;

    expect(sexField.value).toBe("");
    expect(sexField.value).not.toBe("M");
    expect(
      screen.getByRole("option", { name: "Selecione o sexo" }),
    ).toBeInTheDocument();
  });

  it("mostra Não informado na prévia antes da escolha de sexo", () => {
    render(<K9CreateForm />);
    const preview = document.forms[0].children[1];

    expect(preview.textContent).toContain("Sexo");
    expect(preview.textContent).not.toContain("Macho");
    expect(preview.textContent).not.toContain("Fêmea");
  });

  it("rejeita submit sem sexo escolhido", async () => {
    render(<K9CreateForm />);
    fireEvent.change(screen.getByLabelText(/Nome operacional/), {
      target: { value: "Bono" },
    });
    fireEvent.change(screen.getByLabelText(/Matrícula \/ RGA/), {
      target: { value: "K9-001" },
    });
    fireEvent.change(screen.getByLabelText(/^Raça/), {
      target: { value: "Malinois Belga" },
    });
    fireEvent.change(screen.getByLabelText(/Data de nascimento/), {
      target: { value: "2020-01-02" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Cadastrar K9/ }));

    expect(await screen.findByText("Informe o sexo.")).toBeInTheDocument();
    expect(saveNewK9V1).not.toHaveBeenCalled();
  });

  it("reflete Macho e Fêmea na prévia conforme a seleção", () => {
    render(<K9CreateForm />);
    const sexField = screen.getByLabelText(/^Sexo/);
    const preview = document.forms[0].children[1];

    fireEvent.change(sexField, { target: { value: "M" } });
    expect(preview.textContent).toContain("Macho");

    fireEvent.change(sexField, { target: { value: "F" } });
    expect(preview.textContent).toContain("Fêmea");
    expect(preview.textContent).not.toContain("Macho");
  });

  it("envia ao adapter exatamente o sexo escolhido", async () => {
    render(<K9CreateForm />);
    fillRequired();
    fireEvent.change(screen.getByLabelText(/^Sexo/), {
      target: { value: "F" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Cadastrar K9/ }));

    await waitFor(() => expect(saveNewK9V1).toHaveBeenCalledTimes(1));
    expect(saveNewK9V1.mock.calls[0][0].values.sex).toBe("F");
  });

  it("valida os obrigatórios", async () => {
    render(<K9CreateForm />);
    fireEvent.click(screen.getByRole("button", { name: /Cadastrar K9/ }));

    expect(await screen.findByText("Informe o nome operacional.")).toBeInTheDocument();
    expect(screen.getByText("Informe a matrícula/RGA.")).toBeInTheDocument();
    expect(screen.getByText("Informe a raça.")).toBeInTheDocument();
    expect(screen.getByText("Informe a data de nascimento.")).toBeInTheDocument();
    expect(saveNewK9V1).not.toHaveBeenCalled();
  });

  it("rejeita data futura", async () => {
    render(<K9CreateForm />);
    fillRequired();
    fireEvent.change(screen.getByLabelText(/Data de nascimento/), {
      target: { value: "2999-01-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Cadastrar K9/ }));

    expect(await screen.findByText("A data não pode ser futura.")).toBeInTheDocument();
    expect(saveNewK9V1).not.toHaveBeenCalled();
  });

  it("atualiza a prévia com nome, raça e matrícula e usa fallbacks vazios", () => {
    render(<K9CreateForm />);
    expect(screen.getByText("Nome do K9")).toBeInTheDocument();
    expect(screen.getByText("Raça não informada")).toBeInTheDocument();
    expect(screen.getAllByText("Não informado").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText(/Nome operacional/), {
      target: { value: "Bono" },
    });
    fireEvent.change(screen.getByLabelText(/^Raça/), {
      target: { value: "Labrador" },
    });
    fireEvent.change(screen.getByLabelText(/Matrícula \/ RGA/), {
      target: { value: "RGA-42" },
    });

    expect(screen.getByText("Bono")).toBeInTheDocument();
    expect(screen.getByText("Labrador")).toBeInTheDocument();
    expect(screen.getByText("RGA-42")).toBeInTheDocument();
  });

  it("bloqueia double submit, envia uma vez e navega ao perfil", async () => {
    let resolveSave: (id: string) => void = () => undefined;
    saveNewK9V1.mockImplementation(
      () => new Promise<string>((resolve) => (resolveSave = resolve)),
    );
    render(<K9CreateForm />);
    fillRequired();

    const submit = screen.getByRole("button", { name: /Cadastrar K9/ });
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(saveNewK9V1).toHaveBeenCalledTimes(1);
    expect(submit).toBeDisabled();

    resolveSave("dog-123");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/k9/dog-123"));
  });

  it("aceita foto válida, troca o rótulo e rejeita tipo inválido", () => {
    render(<K9CreateForm />);
    const input = document.getElementById("k9-create-photo") as HTMLInputElement;

    const valid = new File(["x"], "foto.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [valid] } });
    expect(screen.getByText("Trocar foto")).toBeInTheDocument();

    const invalid = new File(["x"], "doc.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [invalid] } });
    expect(
      screen.getByText("Selecione uma imagem PNG, JPG ou WEBP."),
    ).toBeInTheDocument();
  });

  it("pede confirmação ao cancelar com alterações e permite cancelar sem alterações", () => {
    const { rerender } = render(<K9CreateForm />);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(back).toHaveBeenCalledTimes(1);

    rerender(<K9CreateForm />);
    fireEvent.change(screen.getByLabelText(/Nome operacional/), {
      target: { value: "Bono" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByText("Descartar alterações?")).toBeInTheDocument();
    expect(back).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(back).toHaveBeenCalledTimes(2);
  });
});
