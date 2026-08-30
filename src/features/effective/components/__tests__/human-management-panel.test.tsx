import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * FRONT10.HUMAN-LIFECYCLE-V1.W1 — HumanManagementPanel.
 *
 * Mocka apenas as fronteiras: service de lifecycle, service legado de acesso,
 * provider de acesso e provider de auth. Sem Firebase vivo, sem env.
 *
 * Tres propriedades sao o alvo central:
 *   1. SEPARACAO DE AUTORIDADE — lifecycle usa `humans.archive`, acoes de acesso
 *      usam `access.edit`. O gestor (archive sem edit) precisa conseguir
 *      desativar SEM ganhar Reset Password/Instrutor.
 *   2. ZERO ESCRITA DIRETA — os writers legados `deactivateUser`/`reactivateUser`
 *      nao podem mais ser consumidos pelo fluxo vivo.
 *   3. SEMANTICA PROTEGIDA DE ERRO — `AUTH_APPLIED_AUDIT_FAILED` nao pode ser
 *      apresentado como "nao foi possivel desativar": o acesso FOI suspenso.
 */

const can = vi.fn();
const deactivateHumanLifecycle = vi.fn();
const reactivateHumanLifecycle = vi.fn();
const getUserRoles = vi.fn();
const resetHumanPassword = vi.fn();
const toggleInstructorRole = vi.fn();
const deactivateUser = vi.fn();
const reactivateUser = vi.fn();
const getUserStatus = vi.fn();
let authProfile: { ra: string | null } | null = null;

vi.mock("@/features/access/providers/access-control-provider", () => ({
  useAccessControl: () => ({ can }),
}));

vi.mock("@/features/auth/providers/auth-provider", () => ({
  useAuth: () => ({ profile: authProfile }),
}));

vi.mock("@/features/effective/data/human-lifecycle-service", async () => {
  // Preserva as classes/constantes reais; intercepta apenas as chamadas.
  const actual = await vi.importActual<
    typeof import("@/features/effective/data/human-lifecycle-service")
  >("@/features/effective/data/human-lifecycle-service");
  return { ...actual, deactivateHumanLifecycle, reactivateHumanLifecycle };
});

vi.mock("@/features/effective/data/human-management-service", () => ({
  deactivateUser,
  getUserRoles,
  getUserStatus,
  reactivateUser,
  resetHumanPassword,
  toggleInstructorRole,
}));

vi.mock("@/lib/firebase/functions", () => ({
  callAdminDeactivateHuman: vi.fn(),
  callAdminReactivateHuman: vi.fn(),
}));

const { HumanManagementPanel } = await import("../human-management-panel");
const { HumanLifecycleError } = await import(
  "@/features/effective/data/human-lifecycle-service"
);

const RA = "990011";
const BASE = 1_700_000_000_000;

function activeRecord(overrides: Record<string, unknown> = {}) {
  return {
    ra: RA,
    active: true,
    status: "Ativo",
    updated_at: { toMillis: () => BASE },
    updatedAt: { toMillis: () => BASE },
    ...overrides,
  };
}

function inactiveRecord() {
  return activeRecord({ active: false, status: "Inativo", deleted_at: "x" });
}

/** `humans.archive` e `access.edit` controlados independentemente. */
function grant({
  archive = false,
  access = false,
}: {
  access?: boolean;
  archive?: boolean;
}) {
  can.mockImplementation((module: string, action: string) => {
    if (module === "humans" && action === "archive") return archive;
    if (module === "access" && action === "edit") return access;
    return false;
  });
}

function renderPanel(record: Record<string, unknown> | null = activeRecord()) {
  return render(
    <HumanManagementPanel ra={RA} record={record} userName="Silva" />,
  );
}

beforeEach(() => {
  authProfile = { ra: "1234" };
  getUserRoles.mockResolvedValue([]);
  // Results FIEIS ao freeze: os cinco campos, com literais fixos por operacao.
  deactivateHumanLifecycle.mockResolvedValue({
    active: false,
    authState: "updated",
    ra: RA,
    reconciliationOnly: false,
    status: "Inativo",
  });
  reactivateHumanLifecycle.mockResolvedValue({
    active: true,
    status: "Ativo",
    authState: "updated",
    ra: RA,
    reconciliationOnly: false,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/**
 * Abre o diálogo de desativação e preenche um motivo válido.
 *
 * Usa `findByRole` porque, quando o perfil tem `access.edit`, o painel exibe
 * spinner até `getUserRoles` resolver. Quem tem apenas `humans.archive` nunca
 * espera — mas o helper serve aos dois casos.
 */
async function openDeactivateWithReason(reason = "afastamento administrativo") {
  fireEvent.click(
    await screen.findByRole("button", { name: /desativar/i }),
  );
  const textarea = await screen.findByLabelText(/motivo/i);
  fireEvent.change(textarea, { target: { value: reason } });
  return textarea;
}

// ---------------------------------------------------------------------------
// A. SEPARACAO DE AUTORIDADE
// ---------------------------------------------------------------------------

describe("W1 — separacao de autoridade", () => {
  it("sem nenhuma capability o painel nao renderiza", () => {
    grant({});
    const { container } = renderPanel();
    expect(container).toBeEmptyDOMElement();
  });

  it("administrador (archive + edit) ve lifecycle E acoes de acesso", async () => {
    grant({ access: true, archive: true });
    renderPanel();
    expect(
      await screen.findByRole("button", { name: /desativar/i }),
    ).toBeTruthy();
    expect(screen.getByText(/instrutor k9/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /gerar senha/i })).toBeTruthy();
  });

  it("gestor (archive SEM edit) desativa mas NAO ganha acoes de acesso", async () => {
    grant({ archive: true });
    renderPanel();
    // A anomalia que o W0 provou fica corrigida: gestor consegue agir.
    expect(
      await screen.findByRole("button", { name: /desativar/i }),
    ).toBeTruthy();
    // E nao herda nada do dominio de acesso.
    expect(screen.queryByText(/instrutor k9/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /gerar senha/i })).toBeNull();
    // Tampouco dispara o fetch de roles, que e de acesso.
    expect(getUserRoles).not.toHaveBeenCalled();
  });

  it("access.edit SEM humans.archive nao ve lifecycle", async () => {
    grant({ access: true });
    renderPanel();
    expect(
      await screen.findByRole("button", { name: /gerar senha/i }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /desativar/i })).toBeNull();
    expect(screen.queryByText(/status do agente/i)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// B. ESTADO DERIVADO DO SNAPSHOT
// ---------------------------------------------------------------------------

describe("W1 — estado vem do snapshot, nao de leitura propria", () => {
  it("nunca chama getUserStatus", async () => {
    grant({ access: true, archive: true });
    renderPanel();
    await screen.findByRole("button", { name: /desativar/i });
    expect(getUserStatus).not.toHaveBeenCalled();
  });

  it("record ativo mostra Desativar; record inativo mostra Reativar", async () => {
    grant({ archive: true });
    renderPanel(activeRecord());
    expect(
      await screen.findByRole("button", { name: /desativar/i }),
    ).toBeTruthy();
    cleanup();

    renderPanel(inactiveRecord());
    expect(
      await screen.findByRole("button", { name: /reativar/i }),
    ).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// C. DESATIVACAO
// ---------------------------------------------------------------------------

describe("W1 — desativacao", () => {
  it("motivo curto mantem o confirmar desabilitado e nao chama o service", async () => {
    grant({ archive: true });
    renderPanel();
    await openDeactivateWithReason("abc");
    const confirm = screen.getByRole("button", { name: /desativar agente/i });
    expect(confirm.hasAttribute("disabled")).toBe(true);
    fireEvent.click(confirm);
    expect(deactivateHumanLifecycle).not.toHaveBeenCalled();
  });

  it("motivo valido chama o service com ra, reason e record", async () => {
    grant({ archive: true });
    const record = activeRecord();
    renderPanel(record);
    await openDeactivateWithReason("afastado por sindicancia");
    fireEvent.click(screen.getByRole("button", { name: /desativar agente/i }));
    await waitFor(() => expect(deactivateHumanLifecycle).toHaveBeenCalledTimes(1));
    expect(deactivateHumanLifecycle).toHaveBeenCalledWith({
      ra: RA,
      reason: "afastado por sindicancia",
      record,
    });
  });

  it("sucesso apresenta feedback e nao escreve Firestore", async () => {
    grant({ archive: true });
    renderPanel();
    await openDeactivateWithReason();
    fireEvent.click(screen.getByRole("button", { name: /desativar agente/i }));
    expect(
      await screen.findByText(/agente desativado com sucesso/i),
    ).toBeTruthy();
    expect(deactivateUser).not.toHaveBeenCalled();
  });

  it("authState not_provisioned informa que nao havia acesso a suspender", async () => {
    grant({ archive: true });
    deactivateHumanLifecycle.mockResolvedValueOnce({
      active: false,
      authState: "not_provisioned",
      ra: RA,
      reconciliationOnly: false,
      status: "Inativo",
    });
    renderPanel();
    await openDeactivateWithReason();
    fireEvent.click(screen.getByRole("button", { name: /desativar agente/i }));
    expect(
      await screen.findByText(/não havia conta de acesso provisionada/i),
    ).toBeTruthy();
  });

  it("reconciliationOnly informa que so o acesso foi suspenso", async () => {
    grant({ archive: true });
    deactivateHumanLifecycle.mockResolvedValueOnce({
      active: false,
      authState: "updated",
      ra: RA,
      reconciliationOnly: true,
      status: "Inativo",
    });
    renderPanel();
    await openDeactivateWithReason();
    fireEvent.click(screen.getByRole("button", { name: /desativar agente/i }));
    expect(
      await screen.findByText(/cadastro já estava inativo/i),
    ).toBeTruthy();
  });

  it("cancelar limpa o motivo e nao chama o service", async () => {
    grant({ archive: true });
    renderPanel();
    await openDeactivateWithReason();
    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(deactivateHumanLifecycle).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /desativar/i }));
    const textarea = await screen.findByLabelText(/motivo/i);
    expect((textarea as HTMLTextAreaElement).value).toBe("");
  });
});

// ---------------------------------------------------------------------------
// D. REATIVACAO
// ---------------------------------------------------------------------------

describe("W1 — reativacao", () => {
  it("exige confirmacao: um clique no botao NAO chama o service", async () => {
    grant({ archive: true });
    renderPanel(inactiveRecord());
    fireEvent.click(await screen.findByRole("button", { name: /reativar/i }));
    expect(reactivateHumanLifecycle).not.toHaveBeenCalled();
    // O dialogo aparece. Busca pelo HEADING: o botao de confirmar tem o mesmo
    // texto acessivel, entao `findByText` seria ambiguo.
    expect(
      await screen.findByRole("heading", { name: /reativar agente/i }),
    ).toBeTruthy();
  });

  it("confirmar chama o service com ra e record, sem reason", async () => {
    grant({ archive: true });
    const record = inactiveRecord();
    renderPanel(record);
    fireEvent.click(await screen.findByRole("button", { name: /reativar/i }));
    fireEvent.click(
      await screen.findByRole("button", { name: /reativar agente/i }),
    );
    await waitFor(() => expect(reactivateHumanLifecycle).toHaveBeenCalledTimes(1));
    const payload = reactivateHumanLifecycle.mock.calls[0][0];
    expect(payload).toEqual({ ra: RA, record });
    expect(payload).not.toHaveProperty("reason");
  });

  it("cancelar fecha sem chamar o service", async () => {
    grant({ archive: true });
    renderPanel(inactiveRecord());
    fireEvent.click(await screen.findByRole("button", { name: /reativar/i }));
    fireEvent.click(await screen.findByRole("button", { name: /cancelar/i }));
    expect(reactivateHumanLifecycle).not.toHaveBeenCalled();
  });

  it("sucesso apresenta feedback e nao escreve Firestore", async () => {
    grant({ archive: true });
    renderPanel(inactiveRecord());
    fireEvent.click(await screen.findByRole("button", { name: /reativar/i }));
    fireEvent.click(
      await screen.findByRole("button", { name: /reativar agente/i }),
    );
    expect(
      await screen.findByText(/agente reativado com sucesso/i),
    ).toBeTruthy();
    expect(reactivateUser).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// E. EARLY GUARD DE AUTO-DESATIVACAO
// ---------------------------------------------------------------------------

describe("W1 — early guard de auto-desativacao", () => {
  it("proprio RA: acao visivel mas desabilitada, zero chamada", async () => {
    grant({ archive: true });
    authProfile = { ra: RA };
    renderPanel();
    const button = await screen.findByRole("button", { name: /desativar/i });
    // Visivel de proposito: o operador precisa entender por que nao pode agir.
    expect(button).toBeTruthy();
    expect(button.hasAttribute("disabled")).toBe(true);
    fireEvent.click(button);
    expect(deactivateHumanLifecycle).not.toHaveBeenCalled();
  });

  it("outro RA: acao habilitada", async () => {
    grant({ archive: true });
    authProfile = { ra: "1234" };
    renderPanel();
    const button = await screen.findByRole("button", { name: /desativar/i });
    expect(button.hasAttribute("disabled")).toBe(false);
  });

  it("RA do usuario indisponivel: NAO adivinha, backend decide", async () => {
    grant({ archive: true });
    authProfile = { ra: null };
    renderPanel();
    const button = await screen.findByRole("button", { name: /desativar/i });
    expect(button.hasAttribute("disabled")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// F. SEMANTICA DE ERRO — os tres reasons protegidos
// ---------------------------------------------------------------------------

describe("W1 — semantica protegida de erro", () => {
  async function failDeactivateWith(error: unknown) {
    grant({ archive: true });
    deactivateHumanLifecycle.mockRejectedValueOnce(error);
    renderPanel();
    await openDeactivateWithReason();
    fireEvent.click(screen.getByRole("button", { name: /desativar agente/i }));
  }

  it("AUTH_APPLIED_AUDIT_FAILED: diz que o acesso FOI suspenso", async () => {
    await failDeactivateWith(
      new HumanLifecycleError("AUTH_APPLIED_AUDIT_FAILED", "x", {
        mutationApplied: true,
      }),
    );
    const message = await screen.findByText(/acesso do agente foi suspenso/i);
    expect(message).toBeTruthy();
    // A negativa e o ponto: nunca afirmar que a desativacao nao aconteceu.
    expect(screen.queryByText(/falha ao desativar/i)).toBeNull();
  });

  it("COMPENSATION_FAILED: declara estado possivelmente inconsistente", async () => {
    await failDeactivateWith(
      new HumanLifecycleError("COMPENSATION_FAILED", "x", {
        mutationApplied: "unknown",
      }),
    );
    expect(
      await screen.findByText(/estado pode estar inconsistente/i),
    ).toBeTruthy();
  });

  it("ACTIVE_SHIFT: orienta regularizar o turno", async () => {
    await failDeactivateWith(
      new HumanLifecycleError("ACTIVE_SHIFT", "x"),
    );
    expect(await screen.findByText(/turno ativo/i)).toBeTruthy();
  });

  it("STALE_WRITE: informa conflito sem sugerir sobrescrita", async () => {
    await failDeactivateWith(new HumanLifecycleError("STALE_WRITE", "x"));
    const message = await screen.findByText(/alterado por outra sessão/i);
    expect(message).toBeTruthy();
    expect(message.textContent).toMatch(/nada foi sobrescrito/i);
  });

  it("ALREADY_IN_STATE: informativo, nao erro critico", async () => {
    await failDeactivateWith(new HumanLifecycleError("ALREADY_IN_STATE", "x"));
    expect(await screen.findByText(/já está atualizado/i)).toBeTruthy();
  });

  it("AUTH_ENABLE_REVERTED_AUDIT_FAILED na reativacao: conta segue bloqueada", async () => {
    grant({ archive: true });
    reactivateHumanLifecycle.mockRejectedValueOnce(
      new HumanLifecycleError("AUTH_ENABLE_REVERTED_AUDIT_FAILED", "x"),
    );
    renderPanel(inactiveRecord());
    fireEvent.click(await screen.findByRole("button", { name: /reativar/i }));
    fireEvent.click(
      await screen.findByRole("button", { name: /reativar agente/i }),
    );
    const message = await screen.findByText(/alteração foi revertida/i);
    expect(message.textContent).toMatch(/permanece bloqueada/i);
  });

  it("SELF_DEACTIVATION_FORBIDDEN vindo do backend e apresentado", async () => {
    await failDeactivateWith(
      new HumanLifecycleError("SELF_DEACTIVATION_FORBIDDEN", "x"),
    );
    expect(await screen.findByText(/próprio cadastro/i)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// G. DOUBLE SUBMIT REAL [finding W2-3A]
//
// Verificar `disabled` nao basta: e preciso manter a primeira callable PENDENTE
// e tentar uma segunda interacao de verdade.
// ---------------------------------------------------------------------------

describe("W1.R1 — double submit com callable pendente", () => {
  it("segunda tentativa durante request pendente NAO dispara nova chamada", async () => {
    grant({ archive: true });
    // Promise deferred: a primeira chamada fica pendente sob nosso controle.
    let resolveFirst: (value: unknown) => void = () => {};
    deactivateHumanLifecycle.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );

    renderPanel();
    await openDeactivateWithReason();
    const confirm = screen.getByRole("button", { name: /desativar agente/i });

    fireEvent.click(confirm);
    await waitFor(() =>
      expect(deactivateHumanLifecycle).toHaveBeenCalledTimes(1),
    );

    // Tentativas REAIS de reenvio enquanto a primeira esta em voo.
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(deactivateHumanLifecycle).toHaveBeenCalledTimes(1);

    // Concluir o fluxo.
    resolveFirst({
      ra: RA,
      active: false,
      status: "Inativo",
      authState: "updated",
      reconciliationOnly: false,
    });
    expect(
      await screen.findByText(/agente desativado com sucesso/i),
    ).toBeTruthy();
    expect(deactivateHumanLifecycle).toHaveBeenCalledTimes(1);
  });

  it("reativacao pendente tambem bloqueia reenvio", async () => {
    grant({ archive: true });
    let resolveFirst: (value: unknown) => void = () => {};
    reactivateHumanLifecycle.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );

    renderPanel(inactiveRecord());
    fireEvent.click(await screen.findByRole("button", { name: /reativar/i }));
    const confirm = await screen.findByRole("button", {
      name: /reativar agente/i,
    });

    fireEvent.click(confirm);
    await waitFor(() =>
      expect(reactivateHumanLifecycle).toHaveBeenCalledTimes(1),
    );
    fireEvent.click(confirm);
    expect(reactivateHumanLifecycle).toHaveBeenCalledTimes(1);

    resolveFirst({
      ra: RA,
      active: true,
      status: "Ativo",
      authState: "updated",
      reconciliationOnly: false,
    });
    expect(
      await screen.findByText(/agente reativado com sucesso/i),
    ).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// H. OCC FRESCO APOS RERENDER [finding W2-3B]
//
// Prova por comportamento (nao por inspecao) que abrir o modal NAO congela o
// record: se o onSnapshot entregar uma versao nova antes do Confirm, o
// `expectedUpdatedAt` enviado deve ser o NOVO.
// ---------------------------------------------------------------------------

describe("W1.R1 — record atualizado enquanto o modal esta aberto", () => {
  it("desativacao usa o token da versao MAIS RECENTE, nao a da abertura", async () => {
    grant({ archive: true });
    const v1 = activeRecord({
      updated_at: { toMillis: () => 100 },
      updatedAt: { toMillis: () => 100 },
    });
    const v2 = activeRecord({
      updated_at: { toMillis: () => 200 },
      updatedAt: { toMillis: () => 200 },
    });

    const view = render(
      <HumanManagementPanel ra={RA} record={v1} userName="Silva" />,
    );
    await openDeactivateWithReason();

    // onSnapshot entrega V2 enquanto o modal continua aberto.
    view.rerender(
      <HumanManagementPanel ra={RA} record={v2} userName="Silva" />,
    );

    fireEvent.click(screen.getByRole("button", { name: /desativar agente/i }));
    await waitFor(() =>
      expect(deactivateHumanLifecycle).toHaveBeenCalledTimes(1),
    );
    // O record repassado e o V2: o service derivara token 200, nao 100.
    expect(deactivateHumanLifecycle.mock.calls[0][0].record).toBe(v2);
  });

  it("reativacao usa o token da versao MAIS RECENTE", async () => {
    grant({ archive: true });
    const v1 = {
      ...inactiveRecord(),
      updated_at: { toMillis: () => 100 },
      updatedAt: { toMillis: () => 100 },
    };
    const v2 = {
      ...inactiveRecord(),
      updated_at: { toMillis: () => 200 },
      updatedAt: { toMillis: () => 200 },
    };

    const view = render(
      <HumanManagementPanel ra={RA} record={v1} userName="Silva" />,
    );
    fireEvent.click(await screen.findByRole("button", { name: /reativar/i }));

    view.rerender(
      <HumanManagementPanel ra={RA} record={v2} userName="Silva" />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: /reativar agente/i }),
    );
    await waitFor(() =>
      expect(reactivateHumanLifecycle).toHaveBeenCalledTimes(1),
    );
    expect(reactivateHumanLifecycle.mock.calls[0][0].record).toBe(v2);
  });
});

// ---------------------------------------------------------------------------
// I. ACESSIBILIDADE DO SELF GUARD [finding W2-2]
// ---------------------------------------------------------------------------

describe("W1.R1 — explicacao perceptivel do self guard", () => {
  it("proprio RA: razao aparece como TEXTO, nao apenas em title", async () => {
    grant({ archive: true });
    authProfile = { ra: RA };
    renderPanel();
    const button = await screen.findByRole("button", { name: /desativar/i });
    // Texto visivel — perceptivel por teclado e touch.
    const hint = screen.getByText(/não pode desativar seu próprio cadastro/i);
    expect(hint).toBeTruthy();
    // E semanticamente associado ao controle.
    expect(button.getAttribute("aria-describedby")).toBe(hint.id);
    expect(hint.id.length).toBeGreaterThan(0);
  });

  it("outro RA: nenhuma explicacao de self guard e exibida", async () => {
    grant({ archive: true });
    authProfile = { ra: "1234" };
    renderPanel();
    const button = await screen.findByRole("button", { name: /desativar/i });
    expect(
      screen.queryByText(/não pode desativar seu próprio cadastro/i),
    ).toBeNull();
    expect(button.getAttribute("aria-describedby")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// J. WRITERS LEGADOS
// ---------------------------------------------------------------------------

describe("W1 — writers diretos legados", () => {
  it("o fluxo vivo nunca consome deactivateUser/reactivateUser", async () => {
    grant({ access: true, archive: true });

    renderPanel(activeRecord());
    await openDeactivateWithReason();
    fireEvent.click(screen.getByRole("button", { name: /desativar agente/i }));
    await waitFor(() => expect(deactivateHumanLifecycle).toHaveBeenCalled());
    cleanup();

    renderPanel(inactiveRecord());
    fireEvent.click(await screen.findByRole("button", { name: /reativar/i }));
    fireEvent.click(
      await screen.findByRole("button", { name: /reativar agente/i }),
    );
    await waitFor(() => expect(reactivateHumanLifecycle).toHaveBeenCalled());

    expect(deactivateUser).not.toHaveBeenCalled();
    expect(reactivateUser).not.toHaveBeenCalled();
    expect(getUserStatus).not.toHaveBeenCalled();
  });
});
