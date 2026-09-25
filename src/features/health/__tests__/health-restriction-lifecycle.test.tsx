import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AccessAction, AccessModuleId } from "@/lib/permissions/access-control";
import {
  cancelHealthRestriction,
  endHealthRestriction,
  generateIdempotencyKey,
  parseOperationalRestriction,
  type OperationalRestriction,
} from "@/features/health/data/health-restriction-service";
import { K9OperationalRestrictions } from "@/features/health/components/k9-operational-restrictions";
import { useK9RosterDetail } from "@/features/effective/hooks/use-k9-roster-detail";

// ---------------------------------------------------------------------------
// MOCKS
// ---------------------------------------------------------------------------

const mockCallEnd = vi.fn();
const mockCallCancel = vi.fn();

vi.mock("@/lib/firebase/functions", () => ({
  callHealthRestrictionEnd: (...args: unknown[]) => mockCallEnd(...args),
  callHealthRestrictionCancel: (...args: unknown[]) => mockCallCancel(...args),
}));

// Mock firestore listeners for useK9RosterDetail
let snapshotCallback: ((snapshot: unknown) => void) | null = null;

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  doc: vi.fn((_db, _col, _id, sub) => ({ kind: "doc", sub })),
  onSnapshot: vi.fn((ref: { kind?: string }, cb: (snap: unknown) => void) => {
    if (ref?.kind === "doc") {
      snapshotCallback = cb;
    } else {
      cb({ docs: [] });
    }
    return vi.fn();
  }),
  query: vi.fn(() => ({ kind: "query" })),
  where: vi.fn(),
}));

vi.mock("@/lib/firebase/client", () => ({
  auth: {},
  db: {},
  functions: {},
  storage: {},
}));

let mockAllowedCapabilities: string[] = [];

vi.mock("@/features/access/providers/access-control-provider", () => ({
  useAccessControl: () => ({
    can: (module: AccessModuleId, action?: AccessAction) => {
      const capability = `${module}.${action}`;
      return mockAllowedCapabilities.includes(capability);
    },
    error: null,
    profileId: "gestor",
    status: "ready",
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockAllowedCapabilities = [];
  snapshotCallback = null;
});

// ---------------------------------------------------------------------------
// FIXTURES
// ---------------------------------------------------------------------------

const sampleActiveAbsolute: OperationalRestriction = {
  category: "Ortopedia",
  description: "Repouso total por lesão ligamentar no joelho direito",
  dogId: "dog-bono",
  expected_end: new Date(2026, 9, 30),
  id: "rest-001",
  issued_at: new Date(2026, 8, 15),
  level: "absolute",
  professional: {
    clinic: "Hospital Veterinário São Camilo",
    name: "Dr. Carlos Eduardo Lima",
    registration_number: "28491/SP",
    registration_type: "CRMV",
    specialty: "Cirurgia e Ortopedia",
  },
  recorded_by: {
    internal_role: "Gestor Veterinário",
    name: "Subinspetor Marcos",
    uid: "user-marcos",
  },
  source_document: {
    description: "Laudo com raio-X de joelho e parecer cirúrgico",
    health_document_id: "doc-orto-2026-881",
  },
  status: "active",
};

const sampleActivePartial: OperationalRestriction = {
  category: "Cardiovascular",
  description: "Treino reduzido: evitar sprints prolongados sob sol forte",
  dogId: "dog-bono",
  expected_end: null,
  id: "rest-002",
  issued_at: new Date(2026, 8, 10),
  level: "partial",
  professional: {
    clinic: "Clínica Vet Canil",
    name: "Dra. Beatriz Santos",
    registration_number: "31200/SP",
    registration_type: "CRMV",
    specialty: "Cardiologia Veterinária",
  },
  recorded_by: {
    internal_role: "Veterinário Responsável",
    name: "Dra. Beatriz",
    uid: "user-beatriz",
  },
  source_document: {
    description: "Ecocardiograma e termo de recomendação física",
    health_document_id: "doc-cardio-552",
  },
  status: "active",
};

const sampleEnded: OperationalRestriction = {
  actual_end: new Date(2026, 8, 20),
  category: "Dermatologia",
  description: "Dermatite de contato na pata esquerda",
  dogId: "dog-bono",
  end_professional: {
    clinic: "Clínica Vet Canil",
    name: "Dr. Carlos Eduardo Lima",
    registration_number: "28491/SP",
    registration_type: "CRMV",
    specialty: "Dermatologia",
  },
  end_reason: "Cão totalmente assintomático após tratamento com pomada",
  end_source_document: {
    description: "Termo de liberação dermatológica",
    health_document_id: "doc-dermato-alta-01",
  },
  ended_by: {
    internal_role: "Veterinário Responsável",
    name: "Dr. Carlos",
    uid: "user-carlos",
  },
  expected_end: new Date(2026, 8, 20),
  id: "rest-ended-1",
  issued_at: new Date(2026, 8, 5),
  level: "attention",
  professional: {
    clinic: "Clínica Vet Canil",
    name: "Dr. Carlos Eduardo Lima",
    registration_number: "28491/SP",
    registration_type: "CRMV",
    specialty: "Dermatologia",
  },
  recorded_by: {
    name: "Dr. Carlos",
    uid: "user-carlos",
  },
  source_document: {
    health_document_id: "doc-dermato-inicio-01",
  },
  status: "ended",
};

const sampleCancelled: OperationalRestriction = {
  cancel_reason: "Registro duplicado lançado por engano no cão Bono em vez do cão Thor",
  cancelled_at: new Date(2026, 8, 12),
  cancelled_by: {
    internal_role: "Gestor do Canil",
    name: "Subinspetor Silva",
    uid: "user-silva",
  },
  category: "Oftalmologia",
  description: "Úlcera de córnea superficial",
  dogId: "dog-bono",
  expected_end: null,
  id: "rest-cancelled-1",
  issued_at: new Date(2026, 8, 11),
  level: "attention",
  professional: {
    name: "Dr. Paulo",
    registration_number: "1111/SP",
    registration_type: "CRMV",
  },
  recorded_by: {
    name: "Subinspetor Silva",
    uid: "user-silva",
  },
  source_document: {
    health_document_id: "doc-oftalmo-errado",
  },
  status: "cancelled",
};

// ===========================================================================
// TEST SUITES
// ===========================================================================

describe("1. READINESS CONTRACT FIX (useK9RosterDetail)", () => {
  it("extrai readiness_status canônico com precedência sobre readiness, readiness_state e state", () => {
    const { result } = renderHook(() => useK9RosterDetail("dog-bono"));

    expect(snapshotCallback).toBeDefined();

    // 1. canonical F20 projector field readiness_status takes precedence
    act(() => {
      snapshotCallback!({
        exists: () => true,
        data: () => ({
          readiness_status: "operational_attention",
          readiness: "operational",
          readiness_state: "fit_with_restrictions",
          state: "temporarily_unfit",
          readiness_reason: "Em observação clínica pós-cirúrgica",
          readiness_reason_code: "POST_OP_OBSERVATION",
          active_restrictions: 1,
          evaluated_at: "2026-09-24T18:00:00Z",
        }),
      });
    });

    expect(result.current.readiness).not.toBeNull();
    expect(result.current.readiness?.state).toBe("operational_attention");
    expect(result.current.readiness?.reason).toBe("Em observação clínica pós-cirúrgica");
    expect(result.current.readiness?.reasonCode).toBe("POST_OP_OBSERVATION");
    expect(result.current.readiness?.activeRestrictions).toBe(1);
  });

  it("respeita fallback em cadeia quando readiness_status está ausente", () => {
    const { result } = renderHook(() => useK9RosterDetail("dog-bono"));

    // Fallback to readiness
    act(() => {
      snapshotCallback!({
        exists: () => true,
        data: () => ({
          readiness: "fit_with_restrictions",
          state: "temporarily_unfit",
        }),
      });
    });
    expect(result.current.readiness?.state).toBe("fit_with_restrictions");

    // Fallback to readiness_state
    act(() => {
      snapshotCallback!({
        exists: () => true,
        data: () => ({
          readiness_state: "temporarily_unfit",
          state: "operational",
        }),
      });
    });
    expect(result.current.readiness?.state).toBe("temporarily_unfit");

    // Fallback to legacy state
    act(() => {
      snapshotCallback!({
        exists: () => true,
        data: () => ({
          state: "operational",
        }),
      });
    });
    expect(result.current.readiness?.state).toBe("operational");
  });
});

describe("2. SERVICE LAYER & PAYLOAD CONSTRUCTIONS", () => {
  it("endHealthRestriction constrói payload correto com campos clínicos e idempotência", async () => {
    mockCallEnd.mockResolvedValueOnce({
      data: { dogId: "dog-bono", restrictionId: "rest-001", status: "ended", replayed: false },
    });

    const res = await endHealthRestriction({
      dogId: "dog-bono",
      restrictionId: "rest-001",
      idempotencyKey: "test-idempotency-key-123",
      endReason: "   Liberação clínica concedida após avaliação física completa.   ",
      endProfessional: {
        name: "  Dra. Camila Nogueira  ",
        registration_type: "CRMV",
        registration_number: " 45678/SP ",
        clinic: " Hospital Vet Sul ",
        specialty: " Fisioterapia ",
      },
      endSourceDocument: {
        health_document_id: " doc-alta-fisioterapia ",
        description: " Parecer de reabilitação motora ",
      },
    });

    expect(res.status).toBe("ended");
    expect(mockCallEnd).toHaveBeenCalledWith({
      dogId: "dog-bono",
      restrictionId: "rest-001",
      idempotencyKey: "test-idempotency-key-123",
      endReason: "Liberação clínica concedida após avaliação física completa.",
      endProfessional: {
        clinic: "Hospital Vet Sul",
        name: "Dra. Camila Nogueira",
        registration_number: "45678/SP",
        registration_type: "CRMV",
        specialty: "Fisioterapia",
      },
      endSourceDocument: {
        description: "Parecer de reabilitação motora",
        health_document_id: "doc-alta-fisioterapia",
      },
    });
  });

  it("cancelHealthRestriction constrói payload puramente administrativo SEM campos clínicos ou profissionais", async () => {
    mockCallCancel.mockResolvedValueOnce({
      data: { dogId: "dog-bono", restrictionId: "rest-001", status: "cancelled", replayed: false },
    });

    const res = await cancelHealthRestriction({
      dogId: "dog-bono",
      restrictionId: "rest-001",
      idempotencyKey: "custom-cancel-idemp-456",
      cancelReason: " Lançamento duplicado por erro cadastral. ",
    });

    expect(res.status).toBe("cancelled");
    expect(mockCallCancel).toHaveBeenCalledTimes(1);

    const sentPayload = mockCallCancel.mock.calls[0][0];
    expect(sentPayload).toEqual({
      cancelReason: "Lançamento duplicado por erro cadastral.",
      dogId: "dog-bono",
      idempotencyKey: "custom-cancel-idemp-456",
      restrictionId: "rest-001",
    });

    // VERIFICAÇÃO CRÍTICA DE INVARIANTE:
    // O cancelamento administrativo JAMAIS pode enviar campos clínicos/profissionais
    expect(sentPayload).not.toHaveProperty("professional");
    expect(sentPayload).not.toHaveProperty("endProfessional");
    expect(sentPayload).not.toHaveProperty("sourceDocument");
    expect(sentPayload).not.toHaveProperty("endSourceDocument");
    expect(sentPayload).not.toHaveProperty("endReason");
  });

  it("generateIdempotencyKey gera chaves únicas não-vazias", () => {
    const key1 = generateIdempotencyKey();
    const key2 = generateIdempotencyKey();
    expect(key1).toBeTruthy();
    expect(key2).toBeTruthy();
    expect(key1).not.toBe(key2);
  });

  it("parseOperationalRestriction mapeia campos Firestore com segurança e resiliência", () => {
    const parsed = parseOperationalRestriction("r1", "dog-bono", {
      status: "active",
      level: "absolute",
      category: "Cirúrgica",
      description: "Pós-operatório",
      issued_at: "2026-08-01T10:00:00Z",
      expected_end: "2026-09-01T10:00:00Z",
      professional: {
        name: "Dr. João",
        registration_type: "CRMV",
        registration_number: "999",
      },
      source_document: {
        health_document_id: "doc-1",
      },
      recorded_by: {
        name: "Admin",
        uid: "u1",
      },
    });

    expect(parsed.id).toBe("r1");
    expect(parsed.dogId).toBe("dog-bono");
    expect(parsed.level).toBe("absolute");
    expect(parsed.status).toBe("active");
    expect(parsed.professional.name).toBe("Dr. João");
    expect(parsed.source_document.health_document_id).toBe("doc-1");
  });
});

describe("3. UI RENDERING & ACTIVE RESTRICTIONS DISPLAY", () => {
  it("renderiza restrição ativa com todos os campos obrigatórios e badges de nível", () => {
    render(
      <K9OperationalRestrictions
        dogId="dog-bono"
        initialRestrictions={[sampleActiveAbsolute, sampleActivePartial]}
      />,
    );

    expect(screen.getByText("Restrições Operacionais")).toBeInTheDocument();
    expect(screen.getByText("2 restrições ativas")).toBeInTheDocument();

    // Restrição Absoluta
    expect(screen.getByText("Restrição Absoluta")).toBeInTheDocument();
    expect(screen.getByText(/Repouso total por lesão ligamentar/)).toBeInTheDocument();
    expect(screen.getByText("Dr. Carlos Eduardo Lima")).toBeInTheDocument();
    expect(screen.getByText(/CRMV 28491\/SP/)).toBeInTheDocument();
    expect(screen.getByText("doc-orto-2026-881")).toBeInTheDocument();

    // Restrição Parcial
    expect(screen.getByText("Restrição Parcial")).toBeInTheDocument();
    expect(screen.getByText(/Treino reduzido: evitar sprints prolongados/)).toBeInTheDocument();
    expect(screen.getByText("Dra. Beatriz Santos")).toBeInTheDocument();
    expect(screen.getByText("doc-cardio-552")).toBeInTheDocument();
  });

  it("renderiza mensagem amigável quando não há restrições ativas", () => {
    render(
      <K9OperationalRestrictions
        dogId="dog-bono"
        initialRestrictions={[]}
      />,
    );

    expect(screen.getByText("Nenhuma restrição ativa")).toBeInTheDocument();
    expect(
      screen.getByText("Nenhuma restrição operacional ativa para este K9."),
    ).toBeInTheDocument();
  });
});

describe("4. CAPABILITY GATING (health.release_restriction & health.cancel_restriction)", () => {
  it("botão de Liberação Clínica só aparece quando o ator possui a capability health.release_restriction", () => {
    // 1. Sem permissão
    mockAllowedCapabilities = [];
    const { rerender } = render(
      <K9OperationalRestrictions
        dogId="dog-bono"
        initialRestrictions={[sampleActiveAbsolute]}
      />,
    );
    expect(
      screen.queryByTestId("btn-end-restriction"),
    ).not.toBeInTheDocument();

    // 2. Com capability health.release_restriction
    mockAllowedCapabilities = ["health.release_restriction"];
    rerender(
      <K9OperationalRestrictions
        dogId="dog-bono"
        initialRestrictions={[sampleActiveAbsolute]}
      />,
    );
    expect(
      screen.getByTestId("btn-end-restriction"),
    ).toBeInTheDocument();
  });

  it("botão de Invalidar Registro só aparece quando o ator possui a capability health.cancel_restriction", () => {
    // 1. Sem permissão
    mockAllowedCapabilities = [];
    const { rerender } = render(
      <K9OperationalRestrictions
        dogId="dog-bono"
        initialRestrictions={[sampleActiveAbsolute]}
      />,
    );
    expect(
      screen.queryByTestId("btn-cancel-restriction"),
    ).not.toBeInTheDocument();

    // 2. Com capability health.cancel_restriction
    mockAllowedCapabilities = ["health.cancel_restriction"];
    rerender(
      <K9OperationalRestrictions
        dogId="dog-bono"
        initialRestrictions={[sampleActiveAbsolute]}
      />,
    );
    expect(
      screen.getByTestId("btn-cancel-restriction"),
    ).toBeInTheDocument();
  });

  it("não usa papéis hardcoded (ex: gestor/admin) para liberar ações, dependendo estritamente de capability", () => {
    // Mesmo estando com profile gestor (conforme mock padrão do provider),
    // se as capabilities estiverem vazias, NENHUM botão de ação é renderizado!
    mockAllowedCapabilities = [];
    render(
      <K9OperationalRestrictions
        dogId="dog-bono"
        initialRestrictions={[sampleActiveAbsolute]}
      />,
    );

    expect(screen.queryByText(/Liberar \/ Encerrar Clinicamente/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Invalidar Registro/i)).not.toBeInTheDocument();
  });
});

describe("5. MODAL: LIBERAR CLINICAMENTE (END) LIFECYCLE & FORM VALIDATION", () => {
  it("abre modal, valida campos obrigatórios e submete payload clínico completo", async () => {
    mockAllowedCapabilities = ["health.release_restriction"];
    mockCallEnd.mockResolvedValueOnce({
      data: { dogId: "dog-bono", restrictionId: "rest-001", status: "ended", replayed: false },
    });

    const onEnded = vi.fn();

    render(
      <K9OperationalRestrictions
        dogId="dog-bono"
        initialRestrictions={[sampleActiveAbsolute]}
        onEnded={onEnded}
      />,
    );

    // Abre o modal
    const endBtn = screen.getByTestId("btn-end-restriction");
    fireEvent.click(endBtn);

    expect(screen.getByTestId("modal-end-restriction")).toBeInTheDocument();
    expect(screen.getByText("Liberar Restrição Clinicamente")).toBeInTheDocument();

    // Preenche campos do formulário
    fireEvent.change(screen.getByLabelText(/Motivo da Liberação Clínica/i), {
      target: { value: "Recuperação total dos movimentos e alta concedida" },
    });
    fireEvent.change(screen.getByLabelText(/Nome do Profissional/i), {
      target: { value: "Dra. Ana Paula Silveira" },
    });
    fireEvent.change(screen.getByLabelText(/Número do Registro/i), {
      target: { value: "12345/SP" },
    });
    fireEvent.change(screen.getByLabelText(/Clínica \/ Hospital/i), {
      target: { value: "Hospital Canil Central" },
    });
    fireEvent.change(screen.getByLabelText(/Especialidade/i), {
      target: { value: "Ortopedia Canina" },
    });
    fireEvent.change(screen.getByLabelText(/ID do Documento de Saúde/i), {
      target: { value: "doc-alta-laudo-001" },
    });
    fireEvent.change(screen.getByLabelText(/Descrição do Documento/i), {
      target: { value: "Laudo pericial de alta" },
    });

    // Submete o formulário
    const submitBtn = screen.getByText("Confirmar Liberação");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockCallEnd).toHaveBeenCalledTimes(1);
    });

    expect(mockCallEnd).toHaveBeenCalledWith(
      expect.objectContaining({
        dogId: "dog-bono",
        restrictionId: "rest-001",
        endReason: "Recuperação total dos movimentos e alta concedida",
        endProfessional: {
          clinic: "Hospital Canil Central",
          name: "Dra. Ana Paula Silveira",
          registration_number: "12345/SP",
          registration_type: "CRMV",
          specialty: "Ortopedia Canina",
        },
        endSourceDocument: {
          description: "Laudo pericial de alta",
          health_document_id: "doc-alta-laudo-001",
        },
      }),
    );

    // Sucesso exibido
    await waitFor(() => {
      expect(screen.getByText("Restrição liberada clinicamente com sucesso!")).toBeInTheDocument();
    });
  });

  it("trata erro na liberação clínica e exibe mensagem amigável sem quebrar UI", async () => {
    mockAllowedCapabilities = ["health.release_restriction"];
    mockCallEnd.mockRejectedValueOnce(new Error("Permissão negada pelo backend F20."));

    render(
      <K9OperationalRestrictions
        dogId="dog-bono"
        initialRestrictions={[sampleActiveAbsolute]}
      />,
    );

    fireEvent.click(screen.getByTestId("btn-end-restriction"));

    fireEvent.change(screen.getByLabelText(/Motivo da Liberação Clínica/i), {
      target: { value: "Alta médica" },
    });
    fireEvent.change(screen.getByLabelText(/Nome do Profissional/i), {
      target: { value: "Dra. Ana" },
    });
    fireEvent.change(screen.getByLabelText(/Número do Registro/i), {
      target: { value: "111" },
    });
    fireEvent.change(screen.getByLabelText(/ID do Documento de Saúde/i), {
      target: { value: "doc-1" },
    });

    fireEvent.click(screen.getByText("Confirmar Liberação"));

    await waitFor(() => {
      expect(screen.getByText("Permissão negada pelo backend F20.")).toBeInTheDocument();
    });
  });
});

describe("6. MODAL: INVALIDAR REGISTRO (CANCEL) DISCLAIMER & BEHAVIOR", () => {
  it("exibe disclaimer de forma proeminente e envia justificativa administrativa sem dados clínicos", async () => {
    mockAllowedCapabilities = ["health.cancel_restriction"];
    mockCallCancel.mockResolvedValueOnce({
      data: { dogId: "dog-bono", restrictionId: "rest-001", status: "cancelled", replayed: false },
    });

    const onCancelled = vi.fn();

    render(
      <K9OperationalRestrictions
        dogId="dog-bono"
        initialRestrictions={[sampleActiveAbsolute]}
        onCancelled={onCancelled}
      />,
    );

    fireEvent.click(screen.getByTestId("btn-cancel-restriction"));

    expect(screen.getByTestId("modal-cancel-restriction")).toBeInTheDocument();

    // DISCLAIMER OBRIGATÓRIO CONFORME ESPECIFICAÇÃO
    expect(
      screen.getByText(/Esta ação invalida um registro incorreto \(duplicado, cão errado ou erro formal\)\. NÃO constitui alta ou liberação clínica\./i),
    ).toBeInTheDocument();

    // GARANTE QUE NÃO EXISTE CAMPO DE CRMV OU DOCUMENTO CLÍNICO NO MODAL DE INVALIDAÇÃO
    expect(screen.queryByLabelText(/CRMV/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Profissional/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Documento de Saúde/i)).not.toBeInTheDocument();

    // Preenche justificativa
    fireEvent.change(screen.getByLabelText(/Justificativa Administrativa do Cancelamento/i), {
      target: { value: "Cão selecionado por equívoco no dropdown." },
    });

    fireEvent.click(screen.getByText("Confirmar Invalidação"));

    await waitFor(() => {
      expect(mockCallCancel).toHaveBeenCalledTimes(1);
    });

    expect(mockCallCancel).toHaveBeenCalledWith(
      expect.objectContaining({
        cancelReason: "Cão selecionado por equívoco no dropdown.",
        dogId: "dog-bono",
        restrictionId: "rest-001",
      }),
    );

    await waitFor(() => {
      expect(screen.getByText("Registro de restrição invalidado com sucesso.")).toBeInTheDocument();
    });
  });

  it("trata erro na invalidação e exibe feedback", async () => {
    mockAllowedCapabilities = ["health.cancel_restriction"];
    mockCallCancel.mockRejectedValueOnce(new Error("Erro interno ao invalidar restrição"));

    render(
      <K9OperationalRestrictions
        dogId="dog-bono"
        initialRestrictions={[sampleActiveAbsolute]}
      />,
    );

    fireEvent.click(screen.getByTestId("btn-cancel-restriction"));

    fireEvent.change(screen.getByLabelText(/Justificativa Administrativa do Cancelamento/i), {
      target: { value: "Cancelamento de teste" },
    });

    fireEvent.click(screen.getByText("Confirmar Invalidação"));

    await waitFor(() => {
      expect(screen.getByText("Erro interno ao invalidar restrição")).toBeInTheDocument();
    });
  });
});

describe("7. RESTRICTION HISTORY DISPLAY", () => {
  it("renderiza histórico com seções distintas para restrições liberadas e invalidadas", () => {
    render(
      <K9OperationalRestrictions
        dogId="dog-bono"
        initialRestrictions={[sampleEnded, sampleCancelled]}
      />,
    );

    expect(
      screen.getByText("Histórico de Restrições Encerradas / Invalidadas"),
    ).toBeInTheDocument();

    // Item liberado
    expect(screen.getByText("Liberada Clinicamente")).toBeInTheDocument();
    expect(screen.getByText(/Cão totalmente assintomático após tratamento/)).toBeInTheDocument();
    expect(screen.getByText(/Dr\. Carlos Eduardo Lima/)).toBeInTheDocument();
    expect(screen.getByText("doc-dermato-alta-01")).toBeInTheDocument();

    // Item cancelado
    expect(screen.getByText("Registro Invalidado")).toBeInTheDocument();
    expect(
      screen.getByText(/Registro duplicado lançado por engano no cão Bono/),
    ).toBeInTheDocument();
  });
});
