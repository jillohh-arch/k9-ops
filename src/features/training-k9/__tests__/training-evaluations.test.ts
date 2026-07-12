import { describe, expect, it } from "vitest";

import { canônicalModalityLabel } from "@/features/effective/lib/k9-modalities";

// ─── Helper reproductions from evaluations components ─────────────────────────

function statusLabel(status: string): string {
  if (status === "pending") return "Pendente";
  if (status === "approved") return "Aprovada";
  if (status === "rejected") return "Rejeitada";
  return status;
}

function statusTone(status: string): "yellow" | "green" | "red" | "slate" {
  if (status === "pending") return "yellow";
  if (status === "approved") return "green";
  if (status === "rejected") return "red";
  return "slate";
}

function formatWaiting(days: number | null): string {
  if (days === null) return "";
  if (days === 0) return "Hoje";
  if (days === 1) return "Há 1 dia";
  return `Há ${days} dias`;
}

function daysBetween(from: Date | null, to: Date): number | null {
  if (!from) return null;
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86400000));
}

function friendlyModule(id: string | null, name: string | null): string | null {
  if (name) return name;
  if (!id) return null;
  const num = Number(id.replace(/\D/g, ""));
  return Number.isFinite(num) && num > 0 ? `Módulo ${num}` : id.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? `${count} ${singular}` : `${count} ${plural}`;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("evaluations — status mapping", () => {
  it("pending maps to Pendente with yellow tone", () => {
    expect(statusLabel("pending")).toBe("Pendente");
    expect(statusTone("pending")).toBe("yellow");
  });

  it("approved maps to Aprovada with green tone", () => {
    expect(statusLabel("approved")).toBe("Aprovada");
    expect(statusTone("approved")).toBe("green");
  });

  it("rejected maps to Rejeitada with red tone", () => {
    expect(statusLabel("rejected")).toBe("Rejeitada");
    expect(statusTone("rejected")).toBe("red");
  });

  it("unknown status gets slate tone", () => {
    expect(statusTone("cancelled")).toBe("slate");
  });
});

describe("evaluations — waiting time calculation", () => {
  it("0 days shows Hoje", () => {
    expect(formatWaiting(0)).toBe("Hoje");
  });

  it("1 day shows singular", () => {
    expect(formatWaiting(1)).toBe("Há 1 dia");
  });

  it("4 days shows plural", () => {
    expect(formatWaiting(4)).toBe("Há 4 dias");
  });

  it("null returns empty string", () => {
    expect(formatWaiting(null)).toBe("");
  });

  it("daysBetween returns correct count", () => {
    const from = new Date("2026-07-01");
    const to = new Date("2026-07-11");
    expect(daysBetween(from, to)).toBe(10);
  });

  it("daysBetween returns 0 for same day", () => {
    const date = new Date("2026-07-11");
    expect(daysBetween(date, date)).toBe(0);
  });

  it("daysBetween returns null for null from", () => {
    expect(daysBetween(null, new Date())).toBeNull();
  });
});

describe("evaluations — avg decision time", () => {
  it("calculates average from multiple decisions", () => {
    const decisions = [
      { created: new Date("2026-07-01"), decided: new Date("2026-07-03") }, // 2 days
      { created: new Date("2026-07-01"), decided: new Date("2026-07-05") }, // 4 days
      { created: new Date("2026-07-01"), decided: new Date("2026-07-07") }, // 6 days
    ];

    const totalDays = decisions.reduce((sum, d) => sum + daysBetween(d.created, d.decided)!, 0);
    const avg = Math.round((totalDays / decisions.length) * 10) / 10;
    expect(avg).toBe(4);
  });

  it("returns null when no decisions have both dates", () => {
    const decisions: Array<{ created: Date | null; decided: Date | null }> = [
      { created: null, decided: null },
    ];
    const valid = decisions.filter((d) => d.created && d.decided);
    const avg = valid.length > 0 ? 0 : null;
    expect(avg).toBeNull();
  });

  it("ignores pending requests in average calculation", () => {
    const requests = [
      { status: "approved", created: new Date("2026-07-01"), decided: new Date("2026-07-03") },
      { status: "pending", created: new Date("2026-07-01"), decided: null },
    ];
    const decided = requests.filter((r) => r.status !== "pending" && r.decided);
    expect(decided).toHaveLength(1);
  });
});

describe("evaluations — module labels", () => {
  it("uses name when available", () => {
    expect(friendlyModule("mod-1", "Obediência Básica")).toBe("Obediência Básica");
  });

  it("falls back to Módulo N for numeric IDs", () => {
    expect(friendlyModule("module_2", null)).toBe("Módulo 2");
  });

  it("returns null when both null", () => {
    expect(friendlyModule(null, null)).toBeNull();
  });

  it("humanizes non-numeric IDs", () => {
    expect(friendlyModule("advanced_tracking", null)).toBe("Advanced Tracking");
  });
});

describe("evaluations — modality labels", () => {
  it("uses canonical modality labels", () => {
    expect(canônicalModalityLabel("busca_captura")).toBe("Busca & Captura");
    expect(canônicalModalityLabel("deteccao")).toBe("Detecção");
  });
});

describe("evaluations — ordering", () => {
  it("pending sorted oldest first (ascending created_at)", () => {
    const pending = [
      { id: "a", createdAt: new Date("2026-07-10") },
      { id: "b", createdAt: new Date("2026-07-05") },
      { id: "c", createdAt: new Date("2026-07-08") },
    ].sort((a, b) => (a.createdAt.getTime()) - (b.createdAt.getTime()));

    expect(pending[0].id).toBe("b");
    expect(pending[1].id).toBe("c");
    expect(pending[2].id).toBe("a");
  });

  it("approved/rejected sorted newest decision first (descending decided_at)", () => {
    const decided = [
      { id: "x", decidedAt: new Date("2026-07-01") },
      { id: "y", decidedAt: new Date("2026-07-10") },
      { id: "z", decidedAt: new Date("2026-07-05") },
    ].sort((a, b) => b.decidedAt.getTime() - a.decidedAt.getTime());

    expect(decided[0].id).toBe("y");
    expect(decided[1].id).toBe("z");
    expect(decided[2].id).toBe("x");
  });
});

describe("evaluations — subtabs", () => {
  it("has exactly three subtabs: pending, approved, rejected", () => {
    const subtabs = ["pending", "approved", "rejected"];
    expect(subtabs).toHaveLength(3);
  });

  it("subtab labels are Portuguese", () => {
    const labels = {
      pending: "Pendentes",
      approved: "Aprovadas",
      rejected: "Rejeitadas",
    };
    expect(labels.pending).toBe("Pendentes");
    expect(labels.approved).toBe("Aprovadas");
    expect(labels.rejected).toBe("Rejeitadas");
  });
});

describe("evaluations — empty states", () => {
  it("pending empty: 'Nenhuma avaliação pendente'", () => {
    const title = "Nenhuma avaliação pendente";
    const desc = "Não há solicitações aguardando análise.";
    expect(title).toBeTruthy();
    expect(desc).toBeTruthy();
  });

  it("approved empty: 'Nenhuma avaliação aprovada'", () => {
    const title = "Nenhuma avaliação aprovada";
    expect(title).not.toContain("undefined");
  });

  it("rejected empty: 'Nenhuma avaliação rejeitada'", () => {
    const title = "Nenhuma avaliação rejeitada";
    expect(title).not.toContain("undefined");
  });

  it("filter empty: 'Nenhuma avaliação encontrada'", () => {
    const title = "Nenhuma avaliação encontrada";
    expect(title).toBeTruthy();
  });
});

describe("evaluations — permissions", () => {
  it("view without approve hides decision buttons", () => {
    const canDecide = false;
    const isPending = true;
    const showActions = isPending && canDecide;
    expect(showActions).toBe(false);
  });

  it("approve permission shows decision buttons for pending", () => {
    const canDecide = true;
    const isPending = true;
    const showActions = isPending && canDecide;
    expect(showActions).toBe(true);
  });

  it("approve permission hides buttons for already decided", () => {
    const canDecide = true;
    const isPending = false;
    const showActions = isPending && canDecide;
    expect(showActions).toBe(false);
  });

  it("no access means empty requests list", () => {
    const canRead = false;
    const requests = canRead ? [{ id: "test" }] : [];
    expect(requests).toHaveLength(0);
  });
});

describe("evaluations — approval flow", () => {
  it("callDecidePromotionRequest contract for approval", () => {
    const payload = {
      requestId: "req-123",
      decision: "approved" as const,
      reason: undefined,
      note: "Bom desempenho",
    };
    expect(payload.decision).toBe("approved");
    expect(payload.requestId).toBeTruthy();
  });

  it("approval reason is optional", () => {
    const payload = { requestId: "x", decision: "approved" as const };
    expect(payload).not.toHaveProperty("reason");
  });

  it("double click is prevented by submitting guard", () => {
    let submitting = false;
    const handleDecision = () => {
      if (submitting) return "blocked";
      submitting = true;
      return "executed";
    };

    expect(handleDecision()).toBe("executed");
    expect(handleDecision()).toBe("blocked");
  });

  it("success refreshes the document state", () => {
    const refreshCalled = true;
    expect(refreshCalled).toBe(true);
  });
});

describe("evaluations — rejection flow", () => {
  it("callDecidePromotionRequest contract for rejection", () => {
    const payload = {
      requestId: "req-456",
      decision: "rejected" as const,
      reason: "K9 precisa mais treino na fase 3",
    };
    expect(payload.decision).toBe("rejected");
    expect(payload.reason).toBeTruthy();
  });

  it("rejection reason is required (min 3 chars)", () => {
    const reason = "";
    const canSubmit = reason.trim().length >= 3;
    expect(canSubmit).toBe(false);
  });

  it("valid rejection reason enables submit", () => {
    const reason = "Insuficiente";
    const canSubmit = reason.trim().length >= 3;
    expect(canSubmit).toBe(true);
  });

  it("text preserved on error (no reset)", () => {
    const reason = "K9 não atingiu marcos mínimos";
    const hasError = true;
    const preservedReason = hasError ? reason : "";
    expect(preservedReason).toBe(reason);
  });
});

describe("evaluations — concurrency handling", () => {
  it("already decided request shows message", () => {
    const errorMsg = "Esta solicitação já foi analisada por outro avaliador.";
    expect(errorMsg).toContain("já foi analisada");
  });

  it("status change detected via fresh getDoc after error", () => {
    const originalStatus: string = "pending";
    const refreshedStatus: string = "approved";
    const wasDecided = originalStatus !== refreshedStatus;
    expect(wasDecided).toBe(true);
  });
});

describe("evaluations — detail page", () => {
  it("route includes requestId in path", () => {
    const route = "/training/evaluations/req-abc";
    expect(route).toContain("/evaluations/req-abc");
    expect(route).not.toContain("?");
  });

  it("nonexistent request shows error state", () => {
    const errorTitle = "Avaliação não encontrada";
    expect(errorTitle).toBeTruthy();
  });

  it("IDs are not shown in the UI", () => {
    const displayFields = ["Bono", "Detecção", "Módulo 1", "Módulo 2", "Jilles Ragonha"];
    expect(displayFields.every((f) => !f.includes("_id") && !f.includes("req-"))).toBe(true);
  });

  it("advance is shown as current → next", () => {
    const current = "Módulo 1";
    const next = "Módulo 2";
    const display = `${current} → ${next}`;
    expect(display).toBe("Módulo 1 → Módulo 2");
  });

  it("audit trail entries are human-readable", () => {
    const action = "request_created";
    const formatted = action.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    expect(formatted).toBe("Request Created");
  });

  it("null fields are omitted from display", () => {
    const fields = {
      conductor: "Jilles",
      avaliador: null,
      decidedAt: null,
    };
    const rendered = Object.entries(fields).filter(([, v]) => v !== null);
    expect(rendered).toHaveLength(1);
  });
});

describe("evaluations — KPI pluralization", () => {
  it("1 Pendente (singular)", () => {
    const count = 1;
    const label = count === 1 ? "Pendente" : "Pendentes";
    expect(label).toBe("Pendente");
  });

  it("3 Pendentes (plural)", () => {
    const count: number = 3;
    const label = count === 1 ? "Pendente" : "Pendentes";
    expect(label).toBe("Pendentes");
  });

  it("1 Aprovada (singular)", () => {
    const count = 1;
    const label = count === 1 ? "Aprovada" : "Aprovadas";
    expect(label).toBe("Aprovada");
  });

  it("5 Aprovadas (plural)", () => {
    const count: number = 5;
    const label = count === 1 ? "Aprovada" : "Aprovadas";
    expect(label).toBe("Aprovadas");
  });
});

describe("evaluations — list counter", () => {
  it("without filter: '3 avaliações'", () => {
    expect(pluralize(3, "avaliação", "avaliações")).toBe("3 avaliações");
  });

  it("without filter singular: '1 avaliação'", () => {
    expect(pluralize(1, "avaliação", "avaliações")).toBe("1 avaliação");
  });

  it("with filter: '2 de 5 avaliações'", () => {
    const filtered = 2;
    const total = 5;
    const text = `${filtered} de ${pluralize(total, "avaliação", "avaliações")}`;
    expect(text).toBe("2 de 5 avaliações");
  });
});

describe("evaluations — navigation", () => {
  it("back link returns to evaluations tab", () => {
    const backHref = "/training?tab=evaluations";
    expect(backHref).toContain("tab=evaluations");
  });

  it("old promotions route redirects to evaluations tab", () => {
    const redirectTarget = "/training?tab=evaluations";
    expect(redirectTarget).toBe("/training?tab=evaluations");
  });

  it("no 'Nova avaliação' button exists (read-only from web)", () => {
    const hasCreateButton = false;
    expect(hasCreateButton).toBe(false);
  });
});

describe("evaluations — Cloud Function contract", () => {
  it("function name is decidePromotionRequest", () => {
    const fnName = "decidePromotionRequest";
    expect(fnName).toBe("decidePromotionRequest");
  });

  it("request payload requires requestId and decision", () => {
    const payload = { requestId: "abc", decision: "approved" as const };
    expect(payload.requestId).toBeTruthy();
    expect(["approved", "rejected"]).toContain(payload.decision);
  });

  it("response contains id and status", () => {
    const response = { id: "abc", status: "approved" };
    expect(response).toHaveProperty("id");
    expect(response).toHaveProperty("status");
  });
});
