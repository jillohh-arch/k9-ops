import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * FRONT10.HUMAN-LIFECYCLE-V1.W1 — service de lifecycle Web.
 *
 * As duas callables sao mockadas (sem Firebase vivo, sem env, sem emulador),
 * mas `resolveHumanVersionToken` roda DE VERDADE: estes testes provam o wiring
 * ao helper OCC congelado do Human Edit V1, nao uma reimplementacao.
 *
 * O foco central e o mapper de erro. O backend congelado
 * (`ba5284388023ff04cf42e7aa30f29a9fca78508f`) coloca QUATRO reasons sob
 * `failed-precondition` e TRES sob `internal`; um mapper por `code` achataria
 * exatamente as distincoes que o contrato existe para garantir. Por isso vários
 * testes abaixo fixam o mesmo `code` e variam apenas `details.reason`.
 */

const callAdminDeactivateHuman = vi.fn();
const callAdminReactivateHuman = vi.fn();

vi.mock("@/lib/firebase/functions", () => ({
  callAdminDeactivateHuman,
  callAdminReactivateHuman,
}));

const {
  deactivateHumanLifecycle,
  isHumanLifecycleActive,
  LIFECYCLE_MIN_REASON_LENGTH,
  mapHumanLifecycleError,
  reactivateHumanLifecycle,
} = await import("../human-lifecycle-service");

const RA = "990011";
const BASE = 1_700_000_000_000;

/** Documento com os dois espelhos de timestamp, como o onSnapshot entrega. */
function record(overrides: Record<string, unknown> = {}) {
  return {
    ra: RA,
    active: true,
    status: "Ativo",
    updated_at: { toMillis: () => BASE },
    updatedAt: { toMillis: () => BASE },
    ...overrides,
  };
}

/**
 * Results FIEIS ao freeze: os cinco campos sempre presentes, com os literais
 * fixos de cada operacao. Um mock que devolvesse shape parcial nao representaria
 * nada que o backend produza [W2-1].
 */
function deactivateResult(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      ra: RA,
      active: false,
      status: "Inativo",
      authState: "updated",
      reconciliationOnly: false,
      ...overrides,
    },
  };
}

function reactivateResult(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      ra: RA,
      active: true,
      status: "Ativo",
      authState: "updated",
      reconciliationOnly: false,
      ...overrides,
    },
  };
}

/** Erro de callable no formato do Firebase Functions. */
function callableError(code: string, reason?: string, message = "boom") {
  const error = new Error(message) as Error & {
    code: string;
    details?: unknown;
  };
  error.code = code;
  if (reason !== undefined) error.details = { reason };
  return error;
}

afterEach(() => {
  callAdminDeactivateHuman.mockReset();
  callAdminReactivateHuman.mockReset();
});

// ---------------------------------------------------------------------------
// A. PAYLOAD
// ---------------------------------------------------------------------------

describe("W1 — payload de desativacao", () => {
  it("envia exatamente ra, reason e expectedUpdatedAt", async () => {
    callAdminDeactivateHuman.mockResolvedValueOnce(deactivateResult());
    await deactivateHumanLifecycle({
      ra: RA,
      reason: "afastamento administrativo",
      record: record(),
    });
    expect(callAdminDeactivateHuman).toHaveBeenCalledTimes(1);
    const payload = callAdminDeactivateHuman.mock.calls[0][0];
    expect(Object.keys(payload).sort()).toEqual([
      "expectedUpdatedAt",
      "ra",
      "reason",
    ]);
    expect(payload.ra).toBe(RA);
    expect(payload.expectedUpdatedAt).toBe(BASE);
  });

  it("trima o motivo antes de enviar", async () => {
    callAdminDeactivateHuman.mockResolvedValueOnce(deactivateResult());
    await deactivateHumanLifecycle({
      ra: RA,
      reason: "   afastado por sindicancia   ",
      record: record(),
    });
    expect(callAdminDeactivateHuman.mock.calls[0][0].reason).toBe(
      "afastado por sindicancia",
    );
  });

  it("nao envia ator, timestamp, active, status nem acesso", async () => {
    callAdminDeactivateHuman.mockResolvedValueOnce(deactivateResult());
    await deactivateHumanLifecycle({
      ra: RA,
      reason: "motivo valido",
      record: record({ roles: ["gestor"], access_profile: "gestor" }),
    });
    const payload = callAdminDeactivateHuman.mock.calls[0][0];
    for (const forbidden of [
      "actor",
      "actorRa",
      "timestamp",
      "active",
      "status",
      "roles",
      "access_profile",
      "disabled",
      "audit_trail",
    ]) {
      expect(payload).not.toHaveProperty(forbidden);
    }
  });
});

describe("W1 — payload de reativacao", () => {
  it("envia exatamente ra e expectedUpdatedAt", async () => {
    callAdminReactivateHuman.mockResolvedValueOnce(reactivateResult());
    await reactivateHumanLifecycle({ ra: RA, record: record() });
    const payload = callAdminReactivateHuman.mock.calls[0][0];
    expect(Object.keys(payload).sort()).toEqual(["expectedUpdatedAt", "ra"]);
  });

  it("OMITE reason — nunca envia string vazia", async () => {
    callAdminReactivateHuman.mockResolvedValueOnce(reactivateResult());
    await reactivateHumanLifecycle({ ra: RA, record: record() });
    const payload = callAdminReactivateHuman.mock.calls[0][0];
    // O payload do backend e fechado: `reason: ""` seria recusado.
    expect(payload).not.toHaveProperty("reason");
  });
});

// ---------------------------------------------------------------------------
// B. OCC
// ---------------------------------------------------------------------------

describe("W1 — OCC via resolveHumanVersionToken", () => {
  it("usa o MAIS NOVO quando updated_at > updatedAt", async () => {
    const newer = BASE + 60_000;
    callAdminDeactivateHuman.mockResolvedValueOnce(deactivateResult());
    await deactivateHumanLifecycle({
      ra: RA,
      reason: "motivo valido",
      record: record({
        updated_at: { toMillis: () => newer },
        updatedAt: { toMillis: () => BASE },
      }),
    });
    expect(callAdminDeactivateHuman.mock.calls[0][0].expectedUpdatedAt).toBe(
      newer,
    );
  });

  it("usa o MAIS NOVO quando updatedAt > updated_at", async () => {
    const newer = BASE + 90_000;
    callAdminDeactivateHuman.mockResolvedValueOnce(deactivateResult());
    await deactivateHumanLifecycle({
      ra: RA,
      reason: "motivo valido",
      record: record({
        updated_at: { toMillis: () => BASE },
        updatedAt: { toMillis: () => newer },
      }),
    });
    expect(callAdminDeactivateHuman.mock.calls[0][0].expectedUpdatedAt).toBe(
      newer,
    );
  });

  it("aceita apenas um espelho presente", async () => {
    callAdminDeactivateHuman.mockResolvedValueOnce(deactivateResult());
    const doc = record();
    delete (doc as Record<string, unknown>).updatedAt;
    await deactivateHumanLifecycle({
      ra: RA,
      reason: "motivo valido",
      record: doc,
    });
    expect(callAdminDeactivateHuman.mock.calls[0][0].expectedUpdatedAt).toBe(
      BASE,
    );
  });

  it("envia null quando o documento nao tem espelho algum (valor de contrato)", async () => {
    callAdminDeactivateHuman.mockResolvedValueOnce(deactivateResult());
    const doc = record();
    delete (doc as Record<string, unknown>).updated_at;
    delete (doc as Record<string, unknown>).updatedAt;
    await deactivateHumanLifecycle({
      ra: RA,
      reason: "motivo valido",
      record: doc,
    });
    expect(callAdminDeactivateHuman.mock.calls[0][0].expectedUpdatedAt).toBeNull();
  });

  it("SEM record: zero callable, erro local — nunca inventa 0", async () => {
    await expect(
      deactivateHumanLifecycle({
        ra: RA,
        reason: "motivo valido",
        record: null,
      }),
    ).rejects.toMatchObject({ category: "INVALID_INPUT" });
    expect(callAdminDeactivateHuman).not.toHaveBeenCalled();

    await expect(
      reactivateHumanLifecycle({ ra: RA, record: undefined }),
    ).rejects.toMatchObject({ category: "INVALID_INPUT" });
    expect(callAdminReactivateHuman).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// C. VALIDACAO LOCAL
// ---------------------------------------------------------------------------

describe("W1 — validacao local antes da rede", () => {
  it("motivo curto/vazio bloqueia sem chamar a callable", async () => {
    for (const reason of ["", "   ", "abc", "  a  "]) {
      await expect(
        deactivateHumanLifecycle({ ra: RA, reason, record: record() }),
      ).rejects.toMatchObject({ category: "INVALID_INPUT" });
    }
    expect(callAdminDeactivateHuman).not.toHaveBeenCalled();
    expect(LIFECYCLE_MIN_REASON_LENGTH).toBe(5);
  });

  it("RA vazio bloqueia sem chamar a callable", async () => {
    await expect(
      deactivateHumanLifecycle({
        ra: "   ",
        reason: "motivo valido",
        record: record(),
      }),
    ).rejects.toMatchObject({ category: "INVALID_INPUT" });
    expect(callAdminDeactivateHuman).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// D. ERROR MAPPER — o coracao do gate
// ---------------------------------------------------------------------------

describe("W1 — mapper por details.reason", () => {
  const cases: Array<[string, string, string]> = [
    ["ACTIVE_SHIFT", "failed-precondition", "ACTIVE_SHIFT"],
    ["STALE_WRITE", "failed-precondition", "STALE_WRITE"],
    ["ALREADY_IN_STATE", "failed-precondition", "ALREADY_IN_STATE"],
    [
      "SELF_DEACTIVATION_FORBIDDEN",
      "failed-precondition",
      "SELF_DEACTIVATION_FORBIDDEN",
    ],
    ["AUTH_IDENTITY_NOT_FOUND", "failed-precondition", "AUTH_IDENTITY_BROKEN"],
    ["AUTH_OPERATION_FAILED", "internal", "AUTH_OPERATION_FAILED"],
    ["AUTH_APPLIED_AUDIT_FAILED", "internal", "AUTH_APPLIED_AUDIT_FAILED"],
    [
      "AUTH_ENABLE_REVERTED_AUDIT_FAILED",
      "internal",
      "AUTH_ENABLE_REVERTED_AUDIT_FAILED",
    ],
    ["COMPENSATION_FAILED", "internal", "COMPENSATION_FAILED"],
    ["INVALID_ARGUMENT", "invalid-argument", "INVALID_INPUT"],
    ["NOT_FOUND", "not-found", "NOT_FOUND"],
    ["PERMISSION_DENIED", "permission-denied", "PERMISSION_DENIED"],
  ];

  for (const [reason, code, category] of cases) {
    it(`${reason} -> ${category}`, () => {
      const mapped = mapHumanLifecycleError(callableError(code, reason));
      expect(mapped.category).toBe(category);
      expect(mapped.reason).toBe(reason);
    });
  }

  it("MESMO code failed-precondition, reasons diferentes => categorias diferentes", () => {
    const shift = mapHumanLifecycleError(
      callableError("failed-precondition", "ACTIVE_SHIFT"),
    );
    const stale = mapHumanLifecycleError(
      callableError("failed-precondition", "STALE_WRITE"),
    );
    const already = mapHumanLifecycleError(
      callableError("failed-precondition", "ALREADY_IN_STATE"),
    );
    expect(shift.code).toBe(stale.code);
    expect(stale.code).toBe(already.code);
    expect(
      new Set([shift.category, stale.category, already.category]).size,
    ).toBe(3);
  });

  it("MESMO code internal, os tres reasons protegidos permanecem distintos", () => {
    const applied = mapHumanLifecycleError(
      callableError("internal", "AUTH_APPLIED_AUDIT_FAILED"),
    );
    const reverted = mapHumanLifecycleError(
      callableError("internal", "AUTH_ENABLE_REVERTED_AUDIT_FAILED"),
    );
    const compensation = mapHumanLifecycleError(
      callableError("internal", "COMPENSATION_FAILED"),
    );
    expect(applied.code).toBe("internal");
    expect(reverted.code).toBe("internal");
    expect(compensation.code).toBe("internal");
    expect(
      new Set([
        applied.category,
        reverted.category,
        compensation.category,
      ]).size,
    ).toBe(3);
  });

  it("AUTH_APPLIED_AUDIT_FAILED declara que a mutacao FOI aplicada", () => {
    // Esta e a asercao que impede a UI de dizer "nao foi possivel desativar".
    const mapped = mapHumanLifecycleError(
      callableError("internal", "AUTH_APPLIED_AUDIT_FAILED"),
    );
    expect(mapped.mutationApplied).toBe(true);
  });

  it("AUTH_ENABLE_REVERTED_AUDIT_FAILED declara que nada permaneceu aplicado", () => {
    const mapped = mapHumanLifecycleError(
      callableError("internal", "AUTH_ENABLE_REVERTED_AUDIT_FAILED"),
    );
    expect(mapped.mutationApplied).toBe(false);
  });

  it("COMPENSATION_FAILED declara estado DESCONHECIDO", () => {
    const mapped = mapHumanLifecycleError(
      callableError("internal", "COMPENSATION_FAILED"),
    );
    expect(mapped.mutationApplied).toBe("unknown");
  });

  it("reason desconhecido cai em fallback seguro, sem presumir estado", () => {
    const mapped = mapHumanLifecycleError(
      callableError("internal", "SOMETHING_NEW"),
    );
    expect(mapped.category).toBe("UNKNOWN");
    expect(mapped.mutationApplied).toBe("unknown");
  });

  it("sem details.reason usa fallback por code", () => {
    expect(mapHumanLifecycleError(callableError("not-found")).category).toBe(
      "NOT_FOUND",
    );
    expect(
      mapHumanLifecycleError(callableError("permission-denied")).category,
    ).toBe("PERMISSION_DENIED");
    expect(
      mapHumanLifecycleError(callableError("unauthenticated")).category,
    ).toBe("PERMISSION_DENIED");
    expect(mapHumanLifecycleError(callableError("weird")).category).toBe(
      "UNKNOWN",
    );
  });

  it("aceita o prefixo functions/ do SDK", () => {
    expect(
      mapHumanLifecycleError(callableError("functions/not-found")).category,
    ).toBe("NOT_FOUND");
  });

  it("nunca desambigua por substring da mensagem", () => {
    // Mensagem menciona turno, mas o reason e outro: o reason vence.
    const mapped = mapHumanLifecycleError(
      callableError(
        "failed-precondition",
        "STALE_WRITE",
        "existe turno operacional ativo",
      ),
    );
    expect(mapped.category).toBe("STALE_WRITE");
  });

  it("erros nao-callable nao explodem o mapper", () => {
    expect(mapHumanLifecycleError(null).category).toBe("UNKNOWN");
    expect(mapHumanLifecycleError("string").category).toBe("UNKNOWN");
    expect(mapHumanLifecycleError({ details: "not-an-object" }).category).toBe(
      "UNKNOWN",
    );
  });

  it("erros do proprio service passam intactos", () => {
    const original = mapHumanLifecycleError(
      callableError("failed-precondition", "ACTIVE_SHIFT"),
    );
    expect(mapHumanLifecycleError(original)).toBe(original);
  });
});

describe("W1 — erros das callables sao mapeados", () => {
  it("deactivate propaga categoria mapeada", async () => {
    callAdminDeactivateHuman.mockRejectedValueOnce(
      callableError("failed-precondition", "ACTIVE_SHIFT"),
    );
    await expect(
      deactivateHumanLifecycle({
        ra: RA,
        reason: "motivo valido",
        record: record(),
      }),
    ).rejects.toMatchObject({ category: "ACTIVE_SHIFT" });
  });

  it("reactivate propaga categoria mapeada", async () => {
    callAdminReactivateHuman.mockRejectedValueOnce(
      callableError("internal", "COMPENSATION_FAILED"),
    );
    await expect(
      reactivateHumanLifecycle({ ra: RA, record: record() }),
    ).rejects.toMatchObject({
      category: "COMPENSATION_FAILED",
      mutationApplied: "unknown",
    });
  });
});

// ---------------------------------------------------------------------------
// E. RESULTADO
// ---------------------------------------------------------------------------

describe("W1 — resultado tipado", () => {
  it("propaga authState e reconciliationOnly", async () => {
    callAdminDeactivateHuman.mockResolvedValueOnce({
      data: {
        ra: RA,
        authState: "not_provisioned",
        reconciliationOnly: false,
      },
    });
    const result = await deactivateHumanLifecycle({
      ra: RA,
      reason: "motivo valido",
      record: record(),
    });
    expect(result).toEqual({
      authState: "not_provisioned",
      ra: RA,
      reconciliationOnly: false,
    });
  });

  /**
   * Revisto em W1.R1 [finding W2-1]: antes este teste assertava que uma resposta
   * PARCIAL era "tolerada" com defaults (`authState: null`,
   * `reconciliationOnly: false`) — ou seja, congelava o enfraquecimento de tipo
   * como comportamento desejado. O freeze garante os cinco campos em todos os
   * cinco caminhos de sucesso, entao o service agora repassa o result sem
   * fabricar valor nenhum.
   */
  it("repassa os CINCO campos do freeze sem fabricar defaults", async () => {
    callAdminReactivateHuman.mockResolvedValueOnce({
      data: {
        ra: RA,
        active: true,
        status: "Ativo",
        authState: "already_converged",
        reconciliationOnly: false,
      },
    });
    const result = await reactivateHumanLifecycle({ ra: RA, record: record() });
    expect(result).toEqual({
      ra: RA,
      active: true,
      status: "Ativo",
      authState: "already_converged",
      reconciliationOnly: false,
    });
  });

  it("desativacao tambem repassa os cinco campos, incluindo literais fixos", async () => {
    callAdminDeactivateHuman.mockResolvedValueOnce({
      data: {
        ra: RA,
        active: false,
        status: "Inativo",
        authState: "updated",
        reconciliationOnly: true,
      },
    });
    const result = await deactivateHumanLifecycle({
      ra: RA,
      reason: "motivo valido",
      record: record(),
    });
    // `active`/`status` sao literais fixos por operacao no contrato congelado.
    expect(result.active).toBe(false);
    expect(result.status).toBe("Inativo");
    expect(result.authState).toBe("updated");
    expect(result.reconciliationOnly).toBe(true);
    expect(result.ra).toBe(RA);
  });
});

// ---------------------------------------------------------------------------
// F. ESTADO DERIVADO
// ---------------------------------------------------------------------------

describe("W1 — isHumanLifecycleActive", () => {
  it("reconhece todos os marcadores canonicos de arquivamento", () => {
    expect(isHumanLifecycleActive(record())).toBe(true);
    expect(isHumanLifecycleActive({})).toBe(true);
    expect(isHumanLifecycleActive({ active: false })).toBe(false);
    expect(isHumanLifecycleActive({ deleted_at: "x" })).toBe(false);
    expect(isHumanLifecycleActive({ archived_at: "x" })).toBe(false);
    expect(isHumanLifecycleActive({ status: "Inativo" })).toBe(false);
    expect(isHumanLifecycleActive({ status: "inativo" })).toBe(false);
    expect(isHumanLifecycleActive({ status: "inactive" })).toBe(false);
    // Nulos explicitos nao sao marcadores.
    expect(
      isHumanLifecycleActive({ deleted_at: null, archived_at: null }),
    ).toBe(true);
  });

  it("sem record assume ativo (a pagina ainda nao entregou o snapshot)", () => {
    expect(isHumanLifecycleActive(null)).toBe(true);
    expect(isHumanLifecycleActive(undefined)).toBe(true);
  });
});
