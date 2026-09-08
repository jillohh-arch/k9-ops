import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import type { ReadState } from "../../domain/read-states";
import type {
  ClinicalEventReadModel,
  ClinicalAmendmentReadModel,
} from "../types";
import { ClinicalEventTimeline } from "../presentation/clinical-event-timeline";
import { formatOpenPayloadValue } from "../presentation/clinical-event-item";

const hookMock = vi.hoisted(() => ({
  state: { status: "loading" } as ReadState<ClinicalEventReadModel[]>,
  authorityStatus: "allowed" as const,
  refresh: vi.fn(),
  loadAmendmentsForEvent: vi.fn(),
  amendmentsState: {} as Record<string, ReadState<ClinicalAmendmentReadModel[]> | undefined>,
}));

vi.mock("../hooks/use-clinical-case-events", () => ({
  useClinicalCaseEvents: () => ({
    state: hookMock.state,
    authorityStatus: hookMock.authorityStatus,
    refresh: hookMock.refresh,
    loadAmendmentsForEvent: hookMock.loadAmendmentsForEvent,
    amendmentsState: hookMock.amendmentsState,
  }),
}));

function mockEvent(overrides: Partial<ClinicalEventReadModel> = {}): ClinicalEventReadModel {
  return {
    id: "evt-1",
    caseId: "case-1",
    dogId: "k9-apollo",
    type: "consultation",
    rawType: "consultation",
    status: "final",
    rawStatus: "final",
    occurredAt: new Date("2026-09-02T10:00:00Z"),
    recordedAt: new Date("2026-09-02T10:05:00Z"),
    updatedAt: null,
    recordedBy: { uid: "u1", name: "Sgt. Silva", internalRole: "condutor_k9" },
    payloadType: "consultation",
    payloadVersion: 1,
    schemaVersion: 1,
    revision: 1,
    content: {
      queixa: "Claudicação no membro anterior direito",
      conduta: "Repouso e anti-inflamatório",
    },
    attachmentRefs: ["doc-101"],
    hasAmendments: false,
    amendmentCount: 0,
    lastAmendedAt: null,
    finalizedAt: null,
    cancelReason: null,
    cancelledAt: null,
    cancelledBy: null,
    professional: {
      name: "Dr. Roberto",
      registrationType: "CRMV-SP",
      registrationNumber: "12345",
      clinic: "Clínica Vet",
      formattedRegistration: "CRMV-SP 12345",
    },
    examId: null,
    dataQualityIssues: [],
    rawDoc: {},
    ...overrides,
  };
}

describe("ClinicalEventTimeline (Front 30 Presentation)", () => {
  beforeEach(() => {
    hookMock.refresh.mockReset();
    hookMock.loadAmendmentsForEvent.mockReset();
    hookMock.amendmentsState = {};
  });

  it("renders section strictly labelled 'Eventos clínicos'", () => {
    hookMock.state = { status: "empty", query: "test" };

    render(<ClinicalEventTimeline dogId="k9-apollo" caseId="case-1" />);

    expect(screen.getByText("Eventos clínicos")).toBeInTheDocument();
    expect(screen.queryByText(/Histórico completo do caso/i)).not.toBeInTheDocument();
  });

  it("renders loading state", () => {
    hookMock.state = { status: "loading" };

    render(<ClinicalEventTimeline dogId="k9-apollo" caseId="case-1" />);

    expect(screen.getByTestId("clinical-timeline-loading")).toHaveTextContent(
      "Carregando eventos clínicos..."
    );
  });

  it("renders empty state", () => {
    hookMock.state = { status: "empty", query: "test" };

    render(<ClinicalEventTimeline dogId="k9-apollo" caseId="case-1" />);

    expect(screen.getByTestId("clinical-timeline-empty")).toHaveTextContent(
      "Nenhum evento clínico registrado para este caso."
    );
  });

  it("renders forbidden state when access is not permitted", () => {
    hookMock.state = {
      status: "forbidden",
      message: "Consulta não autorizada",
      requiredCapability: "health.read",
    };

    render(<ClinicalEventTimeline dogId="k9-apollo" caseId="case-1" />);

    expect(screen.getByTestId("clinical-timeline-forbidden")).toHaveTextContent(
      "Consulta não autorizada"
    );
  });

  it("renders error state with retry button", () => {
    hookMock.state = {
      status: "error",
      code: "FIRESTORE_ERROR",
      message: "Erro de conexão",
      retryable: true,
    };

    render(<ClinicalEventTimeline dogId="k9-apollo" caseId="case-1" />);

    expect(screen.getByTestId("clinical-timeline-error")).toHaveTextContent(
      "Erro de conexão"
    );
    const retryBtn = screen.getByText("Tentar novamente");
    fireEvent.click(retryBtn);
    expect(hookMock.refresh).toHaveBeenCalled();
  });

  it("renders event list with complete clinical details", () => {
    const evt = mockEvent();
    hookMock.state = {
      status: "success",
      data: [evt],
      fetchedAt: new Date(),
    };

    render(<ClinicalEventTimeline dogId="k9-apollo" caseId="case-1" />);

    expect(screen.getByTestId("clinical-event-type")).toHaveTextContent("Consulta");
    expect(screen.getByTestId("clinical-event-status")).toHaveTextContent("Finalizado");
    expect(screen.getByTestId("clinical-event-content")).toHaveTextContent(
      "Claudicação no membro anterior direito"
    );
    expect(screen.getByTestId("clinical-event-professional")).toHaveTextContent(
      "Dr. Roberto (CRMV-SP 12345) — Clínica Vet"
    );
    expect(screen.getByTestId("clinical-event-recorder")).toHaveTextContent(
      "Sgt. Silva (condutor_k9)"
    );
    expect(screen.getByTestId("clinical-event-attachments")).toHaveTextContent(
      "1 anexo(s)"
    );
    expect(screen.getByTestId("clinical-event-no-amendments")).toHaveTextContent(
      "Sem emendas"
    );
  });

  it("renders cancelled event callout with cancellation metadata", () => {
    const evt = mockEvent({
      status: "cancelled",
      cancelReason: "Duplicidade de registro",
      cancelledAt: new Date("2026-09-02T11:00:00Z"),
      cancelledBy: { uid: "u2", name: "Coord. Santos", internalRole: "coordinator" },
    });

    hookMock.state = {
      status: "success",
      data: [evt],
      fetchedAt: new Date(),
    };

    render(<ClinicalEventTimeline dogId="k9-apollo" caseId="case-1" />);

    expect(screen.getByTestId("clinical-event-status")).toHaveTextContent("Cancelado");
    expect(screen.getByTestId("clinical-event-cancellation-block")).toBeInTheDocument();
    expect(screen.getByTestId("clinical-event-cancel-reason")).toHaveTextContent(
      "Duplicidade de registro"
    );
    expect(screen.getByTestId("clinical-event-cancellation-block")).toHaveTextContent(
      "Coord. Santos"
    );
  });

  it("preserves UNKNOWN semantics truthfully (missing date, missing attachments, missing amendments)", () => {
    const evt = mockEvent({
      occurredAt: null,
      attachmentRefs: null,
      hasAmendments: null,
      amendmentCount: null,
      dataQualityIssues: ["missing_occurred_at"],
    });

    hookMock.state = {
      status: "success",
      data: [evt],
      fetchedAt: new Date(),
    };

    render(<ClinicalEventTimeline dogId="k9-apollo" caseId="case-1" />);

    expect(screen.getByTestId("clinical-event-occurred-at")).toHaveTextContent(
      "Data não informada"
    );
    expect(screen.getByTestId("clinical-event-attachments")).toHaveTextContent(
      "Anexos: Não informado"
    );
    expect(screen.getByTestId("clinical-event-amendments-toggle")).toHaveTextContent(
      "Consultar emendas"
    );
    expect(screen.getByTestId("clinical-event-partial-badge")).toBeInTheDocument();
  });

  it("expands amendments section and invokes lazy loading on toggle", async () => {
    const evt = mockEvent({
      hasAmendments: true,
      amendmentCount: 1,
    });

    hookMock.state = {
      status: "success",
      data: [evt],
      fetchedAt: new Date(),
    };

    const mockAmend: ClinicalAmendmentReadModel = {
      id: "amend-1",
      eventId: "evt-1",
      caseId: "case-1",
      dogId: "k9-apollo",
      type: "correction",
      rawType: "correction",
      reason: "Dose ajustada para 500mg",
      payloadType: null,
      payloadVersion: null,
      content: { dose: "500mg" },
      recordedBy: { uid: "u1", name: "Sgt. Silva", internalRole: "condutor_k9" },
      recordedAt: new Date("2026-09-02T12:00:00Z"),
      schemaVersion: 1,
      ordinal: 1,
      dataQualityIssues: [],
      rawDoc: {},
    };

    hookMock.amendmentsState = {
      "evt-1": {
        status: "success",
        data: [mockAmend],
        fetchedAt: new Date(),
      },
    };

    render(<ClinicalEventTimeline dogId="k9-apollo" caseId="case-1" />);

    const toggleBtn = screen.getByTestId("clinical-event-amendments-toggle");
    expect(toggleBtn).toHaveTextContent("Emendas (1)");

    fireEvent.click(toggleBtn);

    expect(screen.getByTestId("clinical-amendments-list")).toBeInTheDocument();
    expect(screen.getByTestId("clinical-amendment-type")).toHaveTextContent("Correção #1");
    expect(screen.getByTestId("clinical-amendment-reason")).toHaveTextContent(
      "Dose ajustada para 500mg"
    );
  });

  it("renders 'Não informado' for null/undefined content fields instead of literal 'null'/'undefined'", () => {
    const evt = mockEvent({
      content: {
        if_lab_name: null,
        notes: undefined,
        active_status: false,
        retry_count: 0,
        empty_field: "",
      },
    });

    hookMock.state = {
      status: "success",
      data: [evt],
      fetchedAt: new Date(),
    };

    render(<ClinicalEventTimeline dogId="k9-apollo" caseId="case-1" />);

    const contentBox = screen.getByTestId("clinical-event-content");
    expect(contentBox).toBeInTheDocument();

    // Verify null is presented as "Não informado" and NOT literal "null"
    expect(contentBox).toHaveTextContent("if lab name:Não informado");
    expect(contentBox).not.toHaveTextContent("if lab name:null");
    expect(contentBox).not.toHaveTextContent("if lab name: null");

    // Verify undefined is presented as "Não informado"
    expect(contentBox).toHaveTextContent("notes:Não informado");
    expect(contentBox).not.toHaveTextContent("notes:undefined");

    // Verify false, 0, and "" are preserved and NOT converted to "Não informado"
    expect(contentBox).toHaveTextContent("active status:false");
    expect(contentBox).toHaveTextContent("retry count:0");
  });

  it("renders 'Não informado' for null values in amendment content", () => {
    const evt = mockEvent({
      hasAmendments: true,
      amendmentCount: 1,
    });

    hookMock.state = {
      status: "success",
      data: [evt],
      fetchedAt: new Date(),
    };

    const mockAmend: ClinicalAmendmentReadModel = {
      id: "amend-2",
      eventId: "evt-1",
      caseId: "case-1",
      dogId: "k9-apollo",
      type: "correction",
      rawType: "correction",
      reason: "Retificação de laboratório",
      payloadType: null,
      payloadVersion: null,
      content: { if_lab_name: null, confirmed: false },
      recordedBy: { uid: "u1", name: "Sgt. Silva", internalRole: "condutor_k9" },
      recordedAt: new Date("2026-09-02T12:00:00Z"),
      schemaVersion: 1,
      ordinal: 1,
      dataQualityIssues: [],
      rawDoc: {},
    };

    hookMock.amendmentsState = {
      "evt-1": {
        status: "success",
        data: [mockAmend],
        fetchedAt: new Date(),
      },
    };

    render(<ClinicalEventTimeline dogId="k9-apollo" caseId="case-1" />);

    const toggleBtn = screen.getByTestId("clinical-event-amendments-toggle");
    fireEvent.click(toggleBtn);

    const amendItem = screen.getByTestId("clinical-amendment-item-amend-2");
    expect(amendItem).toHaveTextContent("if_lab_name:Não informado");
    expect(amendItem).not.toHaveTextContent("if_lab_name:null");
    expect(amendItem).toHaveTextContent("confirmed:false");
  });

  describe("formatOpenPayloadValue", () => {
    it("renders 'Não informado' for null and undefined", () => {
      expect(formatOpenPayloadValue(null)).toBe("Não informado");
      expect(formatOpenPayloadValue(undefined)).toBe("Não informado");
    });

    it("preserves truthful values: false, 0, and empty string without converting to 'Não informado'", () => {
      expect(formatOpenPayloadValue(false)).toBe("false");
      expect(formatOpenPayloadValue(0)).toBe("0");
      expect(formatOpenPayloadValue("")).toBe("");
    });

    it("formats objects and arrays as JSON strings and preserves plain strings", () => {
      expect(formatOpenPayloadValue({ lab: "BioVet" })).toBe('{"lab":"BioVet"}');
      expect(formatOpenPayloadValue([1, 2])).toBe("[1,2]");
      expect(formatOpenPayloadValue("texto simples")).toBe("texto simples");
    });
  });
});
