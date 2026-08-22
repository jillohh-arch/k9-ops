import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const back = vi.fn();
const createHumanV1 = vi.fn();
const can = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back, push }),
}));

vi.mock("@/features/access/providers/access-control-provider", () => ({
  useAccessControl: () => ({ can }),
}));

vi.mock("@/features/auth/providers/auth-provider", () => ({
  useAuth: () => ({ profile: { uid: "tester" } }),
}));

vi.mock("../human-create-service", () => ({ createHumanV1 }));

const { HumanCreateForm } = await import("../human-create-form");

function fillRequired() {
  fireEvent.change(screen.getByLabelText(/^RA/), { target: { value: "123456" } });
  fireEvent.change(screen.getByLabelText(/Nome completo/), {
    target: { value: "Jilles Ragonha" },
  });
  fireEvent.change(screen.getByLabelText(/Nome de guerra/), {
    target: { value: "Ragonha" },
  });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: /Cadastrar integrante/ }));
}

describe("Human Create V1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    can.mockReturnValue(true);
    createHumanV1.mockResolvedValue({ ra: "123456", created: true });
  });

  afterEach(() => cleanup());

  it("renderiza as quatro seções do contrato de pessoal", () => {
    render(<HumanCreateForm />);

    expect(screen.getByText("Identificação")).toBeInTheDocument();
    expect(screen.getByText("Dados funcionais")).toBeInTheDocument();
    expect(screen.getByText("Contato / pessoal")).toBeInTheDocument();
    expect(screen.getByLabelText(/Observações/)).toBeInTheDocument();
  });

  it("renderiza os 13 campos do contrato e nada de outro domínio", () => {
    render(<HumanCreateForm />);

    for (const label of [
      /^RA/,
      /Nome completo/,
      /Nome de guerra/,
      /Posto \/ graduação/,
      /Cargo \/ função/,
      /Unidade/,
      /Equipe/,
      /Data de ingresso/,
      /^CPF/,
      /Nascimento/,
      /Telefone/,
      /E-mail institucional/,
      /Observações/,
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }

    // Acesso / Auth
    expect(screen.queryByLabelText(/Perfil de acesso/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Nível de acesso/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Senha/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Operador/)).not.toBeInTheDocument();
    // Treino / Binômio / Turno
    expect(screen.queryByLabelText(/Instrutor/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Especialidades/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Condutor/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Turno/i)).not.toBeInTheDocument();
  });

  it("não exige perfil de acesso para cadastrar", async () => {
    render(<HumanCreateForm />);
    fillRequired();
    submit();

    // Sem campo de perfil de acesso e sem erro exigindo um: o submit passa
    // apenas com os obrigatórios de pessoal. (O subtítulo menciona "perfil de
    // acesso" só para dizer que é configurado depois, então a asserção olha
    // controles/erros, não prosa.)
    await waitFor(() => expect(createHumanV1).toHaveBeenCalledTimes(1));
    expect(screen.queryByLabelText(/perfil de acesso/i)).not.toBeInTheDocument();
    expect(document.querySelector("select")).toBeNull();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("mostra status Ativo automático e não oferece edição", () => {
    render(<HumanCreateForm />);

    const statusLabel = screen.getByText("Situação cadastral:");
    expect(statusLabel.parentElement?.textContent).toContain("Ativo");
    expect(screen.queryByLabelText(/Situação cadastral/)).not.toBeInTheDocument();
  });

  it("não oferece nenhum caminho de upload de foto", () => {
    render(<HumanCreateForm />);

    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(screen.queryByText(/Adicionar foto/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Trocar foto/)).not.toBeInTheDocument();
    expect(
      screen.getByText("Foto poderá ser adicionada após o cadastro."),
    ).toBeInTheDocument();
  });

  it("valida os obrigatórios e não chama o serviço", async () => {
    render(<HumanCreateForm />);
    submit();

    expect(await screen.findByText("Informe o RA.")).toBeInTheDocument();
    expect(screen.getByText("Informe o nome completo.")).toBeInTheDocument();
    expect(screen.getByText("Informe o nome de guerra.")).toBeInTheDocument();
    expect(createHumanV1).not.toHaveBeenCalled();
  });

  it("rejeita RA fora de ^\\d{4,12}$", async () => {
    render(<HumanCreateForm />);
    fillRequired();

    for (const invalid of ["12A456", "123", "1234567890123"]) {
      fireEvent.change(screen.getByLabelText(/^RA/), { target: { value: invalid } });
      submit();
      expect(
        await screen.findByText("RA deve conter apenas números (4 a 12 dígitos)."),
      ).toBeInTheDocument();
    }
    expect(createHumanV1).not.toHaveBeenCalled();
  });

  it("aceita RA válido de 4 a 12 dígitos", async () => {
    render(<HumanCreateForm />);
    fillRequired();
    fireEvent.change(screen.getByLabelText(/^RA/), { target: { value: "9900" } });
    submit();

    await waitFor(() => expect(createHumanV1).toHaveBeenCalledTimes(1));
  });

  it("rejeita nascimento futuro", async () => {
    render(<HumanCreateForm />);
    fillRequired();
    fireEvent.change(screen.getByLabelText(/Nascimento/), {
      target: { value: "2999-01-01" },
    });
    submit();

    expect(await screen.findByText("A data não pode ser futura.")).toBeInTheDocument();
    expect(createHumanV1).not.toHaveBeenCalled();
  });

  it("não exige os campos opcionais de pessoal", async () => {
    render(<HumanCreateForm />);
    fillRequired();
    submit();

    await waitFor(() => expect(createHumanV1).toHaveBeenCalledTimes(1));
    const values = createHumanV1.mock.calls[0][0];
    expect(values.cargo).toBe("");
    expect(values.rank).toBe("");
    expect(values.notes).toBe("");
  });

  it("bloqueia double submit e navega para /humans/{ra} da resposta", async () => {
    let resolveSave: (result: { ra: string; created: true }) => void = () => undefined;
    createHumanV1.mockImplementation(
      () => new Promise((resolve) => (resolveSave = resolve)),
    );
    render(<HumanCreateForm />);
    fillRequired();

    const button = screen.getByRole("button", { name: /Cadastrar integrante/ });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(createHumanV1).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();

    resolveSave({ ra: "654321", created: true });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/humans/654321"));
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("não navega quando o cadastro falha e mostra a mensagem", async () => {
    createHumanV1.mockRejectedValue(new Error("Já existe um integrante com este RA."));
    render(<HumanCreateForm />);
    fillRequired();
    submit();

    expect(
      await screen.findByText("Já existe um integrante com este RA."),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /Cadastrar integrante/ }),
    ).not.toBeDisabled();
  });

  it("governa a tela por humans.create", () => {
    render(<HumanCreateForm />);
    expect(can).toHaveBeenCalledWith("humans", "create");
  });

  it("bloqueia a tela sem humans.create", () => {
    can.mockImplementation(
      (moduleId: string, action?: string) =>
        !(moduleId === "humans" && action === "create"),
    );
    render(<HumanCreateForm />);

    expect(
      screen.getByText("Seu perfil não permite cadastrar integrantes."),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/^RA/)).not.toBeInTheDocument();
  });

  it("não exige access.create nem access.edit", () => {
    can.mockImplementation(
      (moduleId: string, action?: string) => moduleId === "humans" && action === "create",
    );
    render(<HumanCreateForm />);

    expect(screen.getByLabelText(/^RA/)).toBeInTheDocument();
    for (const call of can.mock.calls) {
      expect(call[0]).not.toBe("access");
    }
  });

  it("cancela voltando sem enviar nada", () => {
    render(<HumanCreateForm />);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(back).toHaveBeenCalledTimes(1);
    expect(createHumanV1).not.toHaveBeenCalled();
  });
});
