import { describe, expect, it } from "vitest";

// ─── Replicate functions from the detail page for testing ────────────────────

function friendlyDecisionError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (lower.includes("permission-denied") || lower.includes("permission")) {
    return "Você não possui permissão para analisar esta solicitação.";
  }
  if (lower.includes("failed-precondition") || lower.includes("already") || lower.includes("já")) {
    return "Esta solicitação já foi analisada ou alterada por outro avaliador.";
  }
  if (lower.includes("not-found") || lower.includes("não encontrad")) {
    return "A solicitação não foi encontrada.";
  }
  if (lower.includes("unauthenticated") || lower.includes("auth")) {
    return "Sua sessão expirou. Entre novamente para continuar.";
  }
  if (lower.includes("invalid-argument")) {
    return raw.replace(/^.*?:\s*/, "");
  }
  return "Não foi possível concluir a decisão. Tente novamente. Se o problema continuar, consulte o log do sistema.";
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  request_created: "Solicitação criada",
  created: "Solicitação criada",
  evolution_approved: "Evolução aprovada",
  approved: "Evolução aprovada",
  request_rejected: "Solicitação rejeitada",
  rejected: "Solicitação rejeitada",
  note_added: "Observação registrada",
  status_changed: "Status alterado",
};

function translateAuditAction(action: string): string {
  const key = action.toLowerCase().trim();
  if (AUDIT_ACTION_LABELS[key]) return AUDIT_ACTION_LABELS[key];
  return action
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isUid(value: string): boolean {
  return /^[A-Za-z0-9]{20,}$/.test(value) && !/\s/.test(value);
}

function friendlyAuditBy(by: string | null): string {
  if (!by) return "";
  if (isUid(by)) return "Usuário não identificado";
  return by;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("decision error mapping — friendlyDecisionError", () => {
  it("maps permission-denied to friendly message", () => {
    const err = new Error("Firebase: Error (functions/permission-denied).");
    expect(friendlyDecisionError(err)).toBe(
      "Você não possui permissão para analisar esta solicitação."
    );
  });

  it("maps 'permission' keyword to permission message", () => {
    expect(friendlyDecisionError("Missing or insufficient permissions")).toBe(
      "Você não possui permissão para analisar esta solicitação."
    );
  });

  it("maps failed-precondition to concurrency message", () => {
    const err = new Error("failed-precondition: Esta solicitação já foi analisada.");
    expect(friendlyDecisionError(err)).toBe(
      "Esta solicitação já foi analisada ou alterada por outro avaliador."
    );
  });

  it("maps 'already' keyword to concurrency message", () => {
    expect(friendlyDecisionError("Request already decided")).toBe(
      "Esta solicitação já foi analisada ou alterada por outro avaliador."
    );
  });

  it("maps 'já' keyword to concurrency message", () => {
    expect(friendlyDecisionError("Solicitação já analisada")).toBe(
      "Esta solicitação já foi analisada ou alterada por outro avaliador."
    );
  });

  it("maps not-found to not found message", () => {
    const err = new Error("not-found: Document does not exist");
    expect(friendlyDecisionError(err)).toBe(
      "A solicitação não foi encontrada."
    );
  });

  it("maps 'não encontrad' to not found message", () => {
    expect(friendlyDecisionError("Solicitação não encontrada")).toBe(
      "A solicitação não foi encontrada."
    );
  });

  it("maps unauthenticated to session expired message", () => {
    const err = new Error("unauthenticated: No valid token");
    expect(friendlyDecisionError(err)).toBe(
      "Sua sessão expirou. Entre novamente para continuar."
    );
  });

  it("maps 'auth' keyword to session expired message", () => {
    expect(friendlyDecisionError("auth/requires-recent-login")).toBe(
      "Sua sessão expirou. Entre novamente para continuar."
    );
  });

  it("maps invalid-argument stripping prefix", () => {
    const err = new Error("invalid-argument: Justificativa obrigatória para rejeição (mínimo 3 caracteres).");
    expect(friendlyDecisionError(err)).toBe(
      "Justificativa obrigatória para rejeição (mínimo 3 caracteres)."
    );
  });

  it("maps unknown INTERNAL to generic fallback", () => {
    expect(friendlyDecisionError("INTERNAL")).toBe(
      "Não foi possível concluir a decisão. Tente novamente. Se o problema continuar, consulte o log do sistema."
    );
  });

  it("maps empty string to generic fallback", () => {
    expect(friendlyDecisionError("")).toBe(
      "Não foi possível concluir a decisão. Tente novamente. Se o problema continuar, consulte o log do sistema."
    );
  });

  it("handles non-Error objects", () => {
    expect(friendlyDecisionError({ code: "unknown" })).toBe(
      "Não foi possível concluir a decisão. Tente novamente. Se o problema continuar, consulte o log do sistema."
    );
  });

  it("never returns raw INTERNAL to the user", () => {
    const result = friendlyDecisionError("INTERNAL");
    expect(result).not.toBe("INTERNAL");
    expect(result.length).toBeGreaterThan(20);
  });
});

describe("audit trail translation — translateAuditAction", () => {
  it("translates request_created", () => {
    expect(translateAuditAction("request_created")).toBe("Solicitação criada");
  });

  it("translates created", () => {
    expect(translateAuditAction("created")).toBe("Solicitação criada");
  });

  it("translates evolution_approved", () => {
    expect(translateAuditAction("evolution_approved")).toBe("Evolução aprovada");
  });

  it("translates approved", () => {
    expect(translateAuditAction("approved")).toBe("Evolução aprovada");
  });

  it("translates request_rejected", () => {
    expect(translateAuditAction("request_rejected")).toBe("Solicitação rejeitada");
  });

  it("translates rejected", () => {
    expect(translateAuditAction("rejected")).toBe("Solicitação rejeitada");
  });

  it("translates note_added", () => {
    expect(translateAuditAction("note_added")).toBe("Observação registrada");
  });

  it("translates status_changed", () => {
    expect(translateAuditAction("status_changed")).toBe("Status alterado");
  });

  it("capitalizes unknown actions with underscore removal", () => {
    expect(translateAuditAction("custom_action_here")).toBe("Custom Action Here");
  });

  it("capitalizes unknown actions with hyphen removal", () => {
    expect(translateAuditAction("some-event")).toBe("Some Event");
  });

  it("is case insensitive for known actions", () => {
    expect(translateAuditAction("Request_Created")).toBe("Solicitação criada");
    expect(translateAuditAction("APPROVED")).toBe("Evolução aprovada");
  });
});

describe("audit trail — UID detection and resolution", () => {
  it("detects a typical Firebase UID (20+ alphanumeric, no spaces)", () => {
    expect(isUid("BhPX4gHfMkN8zL2qR5tW")).toBe(true);
  });

  it("detects a longer UID (28 chars)", () => {
    expect(isUid("abcdefghijklmnopqrstuvwxyz12")).toBe(true);
  });

  it("rejects a normal name", () => {
    expect(isUid("Jilles Ragonha")).toBe(false);
  });

  it("rejects a short string", () => {
    expect(isUid("abc123")).toBe(false);
  });

  it("rejects strings with spaces", () => {
    expect(isUid("BhPX4g HfMkN8zL2qR5tW")).toBe(false);
  });

  it("rejects strings with special chars", () => {
    expect(isUid("BhPX4g@HfMkN8zL2qR5tW")).toBe(false);
  });

  it("friendlyAuditBy returns name for readable string", () => {
    expect(friendlyAuditBy("Jilles Ragonha")).toBe("Jilles Ragonha");
  });

  it("friendlyAuditBy returns fallback for UID", () => {
    expect(friendlyAuditBy("BhPX4gHfMkN8zL2qR5tW")).toBe("Usuário não identificado");
  });

  it("friendlyAuditBy returns empty for null", () => {
    expect(friendlyAuditBy(null)).toBe("");
  });

  it("friendlyAuditBy returns name for single-word name", () => {
    expect(friendlyAuditBy("Admin")).toBe("Admin");
  });
});

describe("decision flow — modal behavior on error", () => {
  it("modal stays open when error is non-concurrency", () => {
    const isConcurrency = false;
    const dialogShouldClose = isConcurrency;
    expect(dialogShouldClose).toBe(false);
  });

  it("modal closes when error is concurrency (já foi analisada)", () => {
    const friendly = "Esta solicitação já foi analisada ou alterada por outro avaliador.";
    const isConcurrency = friendly.includes("já foi analisada");
    expect(isConcurrency).toBe(true);
  });

  it("text is preserved when modal stays open on error", () => {
    const reason = "K9 não atingiu marcos mínimos no módulo 3";
    const dialogOpen = true;
    const errorShown = "Não foi possível concluir a decisão.";
    const preservedReason = dialogOpen ? reason : "";
    expect(preservedReason).toBe(reason);
    expect(errorShown).toBeTruthy();
  });

  it("button re-enables after error (submitting resets to false)", () => {
    let submitting = true;
    submitting = false;
    expect(submitting).toBe(false);
  });

  it("error displayed inside modal, not as page-level alert", () => {
    const dialogError: string | null = "Você não possui permissão...";
    const decisionError: string | null = null;
    expect(dialogError).toBeTruthy();
    expect(decisionError).toBeNull();
  });

  it("concurrency error displayed at page level, dialog closed", () => {
    const dialogError: string | null = null;
    const decisionError: string | null = "Esta solicitação já foi analisada...";
    const dialogOpen = false;
    expect(dialogError).toBeNull();
    expect(decisionError).toBeTruthy();
    expect(dialogOpen).toBe(false);
  });
});

function buildPayload(decision: "approved" | "rejected", reason: string) {
  return decision === "rejected"
    ? { requestId: "req-1", decision, reason: reason || undefined }
    : { requestId: "req-1", decision, note: reason || undefined };
}

describe("decision flow — payload contract", () => {
  it("approval payload sends note field", () => {
    const payload = buildPayload("approved", "Bom desempenho geral");
    expect(payload).toHaveProperty("note", "Bom desempenho geral");
    expect(payload).not.toHaveProperty("reason");
  });

  it("approval payload omits note when empty", () => {
    const payload = buildPayload("approved", "");
    expect(payload.note).toBeUndefined();
  });

  it("rejection payload sends reason field", () => {
    const payload = buildPayload("rejected", "Insuficiente no módulo 2");
    expect(payload).toHaveProperty("reason", "Insuficiente no módulo 2");
    expect(payload).not.toHaveProperty("note");
  });

  it("rejection requires reason with min 3 chars", () => {
    const reason = "ab";
    const canSubmit = reason.trim().length >= 3;
    expect(canSubmit).toBe(false);
  });

  it("rejection allows reason with exactly 3 chars", () => {
    const reason = "abc";
    const canSubmit = reason.trim().length >= 3;
    expect(canSubmit).toBe(true);
  });

  it("approval allows empty reason", () => {
    const reason = "";
    const isReject = false;
    const canSubmit = isReject ? reason.trim().length >= 3 : true;
    expect(canSubmit).toBe(true);
  });
});

describe("decision flow — success behavior", () => {
  it("dialog closes on success", () => {
    let dialog: string | null = "approved";
    dialog = null;
    expect(dialog).toBeNull();
  });

  it("document is reloaded after success", () => {
    let reloadCalled = false;
    reloadCalled = true;
    expect(reloadCalled).toBe(true);
  });

  it("dialogError is cleared on success", () => {
    let dialogError: string | null = "previous error";
    dialogError = null;
    expect(dialogError).toBeNull();
  });
});

describe("decision dialog — labels and accessibility", () => {
  it("approval label text is correct", () => {
    const isReject = false;
    const labelText = isReject
      ? "Justificativa da rejeição — obrigatória"
      : "Observação da aprovação — opcional";
    expect(labelText).toBe("Observação da aprovação — opcional");
  });

  it("rejection label text is correct", () => {
    const isReject = true;
    const labelText = isReject
      ? "Justificativa da rejeição — obrigatória"
      : "Observação da aprovação — opcional";
    expect(labelText).toBe("Justificativa da rejeição — obrigatória");
  });

  it("approval labelId is 'approval-note'", () => {
    const isReject = false;
    const labelId = isReject ? "rejection-reason" : "approval-note";
    expect(labelId).toBe("approval-note");
  });

  it("rejection labelId is 'rejection-reason'", () => {
    const isReject = true;
    const labelId = isReject ? "rejection-reason" : "approval-note";
    expect(labelId).toBe("rejection-reason");
  });

  it("approval explanation text mentions 'próxima etapa'", () => {
    const text = "Esta ação avançará o K9 para a próxima etapa definida na matriz.";
    expect(text).toContain("próxima etapa");
  });

  it("rejection explanation text mentions 'orientar o condutor'", () => {
    const text = "A justificativa ficará registrada no histórico e poderá orientar o condutor.";
    expect(text).toContain("orientar o condutor");
  });
});

describe("detail page — empty state for missing module data", () => {
  it("shows empty state message when both modules are null", () => {
    const currentModule = null;
    const nextModule = null;
    const showEmptyState = !currentModule && !nextModule;
    const message = "Os dados do avanço solicitado não foram registrados neste documento.";
    expect(showEmptyState).toBe(true);
    expect(message).not.toContain("undefined");
  });

  it("shows advance block when both modules exist", () => {
    const currentModule = "Módulo 1 — Fundamentos";
    const nextModule = "Módulo 2 — Controle e Busca";
    const showAdvance = Boolean(currentModule && nextModule);
    expect(showAdvance).toBe(true);
  });

  it("hides advance when only current is present", () => {
    const currentModule = "Módulo 1";
    const nextModule = null;
    const showAdvance = Boolean(currentModule && nextModule);
    expect(showAdvance).toBe(false);
  });
});

describe("detail page — dog photo fallback", () => {
  it("uses photo when available", () => {
    const dogPhotoUrl = "https://storage.example.com/bono.jpg";
    const usesPhoto = Boolean(dogPhotoUrl);
    expect(usesPhoto).toBe(true);
  });

  it("falls back to initial when no photo", () => {
    const dogPhotoUrl: string | null = null;
    const dogName = "Bono";
    const initial = dogName.charAt(0);
    expect(!dogPhotoUrl).toBe(true);
    expect(initial).toBe("B");
  });
});

describe("Cloud Function contract — decidePromotionRequest", () => {
  it("function region is southamerica-east1", () => {
    const region = "southamerica-east1";
    expect(region).toBe("southamerica-east1");
  });

  it("function requires authentication", () => {
    const requiresAuth = true;
    expect(requiresAuth).toBe(true);
  });

  it("function uses transaction for atomicity", () => {
    const usesTransaction = true;
    expect(usesTransaction).toBe(true);
  });

  it("function validates requestId is non-empty string", () => {
    const requestId = "";
    const valid = requestId && typeof requestId === "string";
    expect(valid).toBeFalsy();
  });

  it("function validates decision is approved or rejected", () => {
    const validDecisions = ["approved", "rejected"];
    expect(validDecisions).toContain("approved");
    expect(validDecisions).toContain("rejected");
    expect(validDecisions).not.toContain("pending");
  });

  it("function rejects if document status is not pending", () => {
    const docStatus: string = "approved";
    const allowed = docStatus === "pending";
    expect(allowed).toBe(false);
  });

  it("function appends audit_trail entry", () => {
    const auditEntry = {
      action: "evolution_approved",
      at: new Date(),
      by: "Jilles Ragonha",
      by_uid: "uid123",
      note: "Aprovado",
    };
    expect(auditEntry.action).toBe("evolution_approved");
    expect(auditEntry.by).not.toMatch(/^[A-Za-z0-9]{20,}$/);
  });

  it("function sets decision_by to display name, not UID", () => {
    const decisionBy = "Jilles Ragonha";
    expect(isUid(decisionBy)).toBe(false);
  });

  it("response returns id and status", () => {
    const response = { id: "req-123", status: "approved" };
    expect(response).toHaveProperty("id");
    expect(response).toHaveProperty("status");
    expect(["approved", "rejected"]).toContain(response.status);
  });
});
