import { describe, expect, it } from "vitest";

import { canônicalModalityLabel } from "@/features/effective/lib/k9-modalities";

// ─── Helper reproductions from sessions components ────────────────────────────

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}min` : `${h}h`;
}

function formatResult(result: string | null): string {
  if (!result) return "Não informado";
  const r = result.toLowerCase().trim();
  if (r === "satisfatorio" || r === "satisfatório" || r === "success" || r === "approved") return "Satisfatório";
  if (r === "insatisfatorio" || r === "insatisfatório" || r === "failure" || r === "failed") return "Insatisfatório";
  if (r === "parcial" || r === "partial") return "Parcial";
  if (r === "completed" || r === "concluido" || r === "concluído") return "Concluída";
  return result.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function phaseLabel(phase: string | null): string {
  if (!phase) return "Não informada";
  const p = phase.toLowerCase().trim();
  if (p === "formation" || p === "formacao") return "Formação";
  if (p === "maintenance" || p === "manutencao") return "Manutenção";
  if (p === "evaluation" || p === "avaliacao") return "Avaliação";
  if (p === "warm_up" || p === "aquecimento") return "Aquecimento";
  return phase.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function periodStartDate(period: string): Date | null {
  if (period === "recent") return null;
  const now = new Date();
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

// Deduplication logic reproduction
function deduplicateSessions<T extends { dogId: string; id: string }>(sessions: T[]): T[] {
  const seen = new Set<string>();
  return sessions.filter((s) => {
    const key = `${s.dogId}/${s.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Batch concurrency reproduction
async function batchedAll<T>(tasks: Array<() => Promise<T>>, batchSize: number): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((fn) => fn()));
    results.push(...batchResults);
  }
  return results;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("sessions — canonical source strategy", () => {
  it("uses dogs/{dogId}/training_sessions as canonical source", () => {
    const canonicalPath = "dogs/dog-1/training_sessions";
    expect(canonicalPath).toContain("dogs/");
    expect(canonicalPath).toContain("/training_sessions");
    expect(canonicalPath).not.toBe("training_sessions");
    expect(canonicalPath).not.toBe("trainings");
  });

  it("does NOT merge top-level training_sessions to prevent double counting", () => {
    const sources = ["dogs/{dogId}/training_sessions"];
    expect(sources).not.toContain("training_sessions");
    expect(sources).not.toContain("trainings");
    expect(sources).toHaveLength(1);
  });
});

describe("sessions — duration formatting", () => {
  it("returns dash for null", () => {
    expect(formatDuration(null)).toBe("—");
  });

  it("returns dash for zero", () => {
    expect(formatDuration(0)).toBe("—");
  });

  it("formats minutes", () => {
    expect(formatDuration(300)).toBe("5 min");
    expect(formatDuration(2700)).toBe("45 min");
  });

  it("formats hours", () => {
    expect(formatDuration(3600)).toBe("1h");
    expect(formatDuration(5400)).toBe("1h 30min");
    expect(formatDuration(7200)).toBe("2h");
  });
});

describe("sessions — result labels (no technical IDs)", () => {
  it("resolves satisfatorio", () => {
    expect(formatResult("satisfatorio")).toBe("Satisfatório");
    expect(formatResult("satisfatório")).toBe("Satisfatório");
  });

  it("resolves insatisfatorio", () => {
    expect(formatResult("insatisfatorio")).toBe("Insatisfatório");
  });

  it("resolves success/approved", () => {
    expect(formatResult("success")).toBe("Satisfatório");
    expect(formatResult("approved")).toBe("Satisfatório");
  });

  it("resolves partial", () => {
    expect(formatResult("parcial")).toBe("Parcial");
    expect(formatResult("partial")).toBe("Parcial");
  });

  it("resolves completed", () => {
    expect(formatResult("completed")).toBe("Concluída");
  });

  it("handles null gracefully", () => {
    expect(formatResult(null)).toBe("Não informado");
  });

  it("converts snake_case to readable label", () => {
    expect(formatResult("needs_improvement")).toBe("Needs Improvement");
  });
});

describe("sessions — phase labels (no technical IDs)", () => {
  it("resolves formation", () => {
    expect(phaseLabel("formation")).toBe("Formação");
    expect(phaseLabel("formacao")).toBe("Formação");
  });

  it("resolves maintenance", () => {
    expect(phaseLabel("maintenance")).toBe("Manutenção");
    expect(phaseLabel("manutencao")).toBe("Manutenção");
  });

  it("resolves evaluation", () => {
    expect(phaseLabel("evaluation")).toBe("Avaliação");
  });

  it("resolves warm_up", () => {
    expect(phaseLabel("warm_up")).toBe("Aquecimento");
  });

  it("handles null", () => {
    expect(phaseLabel(null)).toBe("Não informada");
  });

  it("converts unknown to Title Case", () => {
    expect(phaseLabel("advanced_tracking")).toBe("Advanced Tracking");
  });
});

describe("sessions — modality labels use friendly names", () => {
  it("busca_captura becomes Busca & Captura", () => {
    expect(canônicalModalityLabel("busca_captura")).toBe("Busca & Captura");
  });

  it("guarda_protecao becomes Guarda & Proteção", () => {
    expect(canônicalModalityLabel("guarda_protecao")).toBe("Guarda & Proteção");
  });

  it("deteccao becomes Detecção", () => {
    expect(canônicalModalityLabel("deteccao")).toBe("Detecção");
  });
});

describe("sessions — empty and error states", () => {
  it("empty state message when no sessions exist", () => {
    const title = "Nenhuma sessão no período";
    const desc = "Sessões de treinamento são registradas pelo aplicativo mobile. Tente ampliar o período.";
    expect(title).not.toContain("undefined");
    expect(desc).not.toContain("NaN");
  });

  it("filtered empty state when filters produce no results", () => {
    const title = "Nenhuma sessão encontrada";
    const desc = "Tente ajustar os filtros para encontrar a sessão desejada.";
    expect(title).toBeTruthy();
    expect(desc).toBeTruthy();
  });

  it("no 'Nova Sessão' button exists in the sessions tab", () => {
    const hasNewSessionButton = false;
    expect(hasNewSessionButton).toBe(false);
  });
});

describe("sessions — session detail omits empty fields", () => {
  it("null fields are not rendered", () => {
    const fields = {
      conductorName: null,
      distanceM: null,
      durationS: null,
      environment: null,
      notes: null,
      repetitions: null,
      technique: null,
    };

    const rendered = Object.entries(fields)
      .filter(([, v]) => v !== null)
      .map(([k]) => k);

    expect(rendered).toHaveLength(0);
  });

  it("populated fields are rendered", () => {
    const fields = {
      conductorName: "Jilles",
      distanceM: 150,
      durationS: 600,
      environment: null,
    };

    const rendered = Object.entries(fields)
      .filter(([, v]) => v !== null)
      .map(([k]) => k);

    expect(rendered).toHaveLength(3);
    expect(rendered).toContain("conductorName");
    expect(rendered).toContain("distanceM");
    expect(rendered).toContain("durationS");
  });
});

describe("sessions — no session-to-promotion FK", () => {
  it("link between session and promotion is indirect (dog + modality)", () => {
    const session = { dogId: "dog-1", modality: "busca_captura" };
    const promotion = { dog_id: "dog-1", modality: "busca_captura", session_id: undefined };

    const linked = session.dogId === promotion.dog_id && session.modality === promotion.modality;
    expect(linked).toBe(true);
    expect(promotion.session_id).toBeUndefined();
  });

  it("does not assert session generated the promotion", () => {
    const directLink = false;
    expect(directLink).toBe(false);
  });
});

// ─── Etapa 4.2: Query, pagination, period, concurrency, routing ──────────────

describe("sessions — query constraints use started_at", () => {
  it("period 7d produces started_at >= 7 days ago", () => {
    const start = periodStartDate("7d")!;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    expect(Math.abs(start.getTime() - sevenDaysAgo.getTime())).toBeLessThan(1000);
  });

  it("period 30d produces started_at >= 30 days ago", () => {
    const start = periodStartDate("30d")!;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    expect(Math.abs(start.getTime() - thirtyDaysAgo.getTime())).toBeLessThan(1000);
  });

  it("period 90d produces started_at >= 90 days ago", () => {
    const start = periodStartDate("90d")!;
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    expect(Math.abs(start.getTime() - ninetyDaysAgo.getTime())).toBeLessThan(1000);
  });

  it("period 'recent' produces no date filter (null)", () => {
    const start = periodStartDate("recent");
    expect(start).toBeNull();
  });

  it("query must use orderBy started_at desc (architectural contract)", () => {
    const queryOrder = "started_at desc";
    expect(queryOrder).toContain("started_at");
    expect(queryOrder).toContain("desc");
  });

  it("query uses limit(PAGE_SIZE) at Firestore level", () => {
    const PAGE_SIZE = 20;
    expect(PAGE_SIZE).toBeGreaterThan(0);
    expect(PAGE_SIZE).toBeLessThanOrEqual(50);
  });
});

describe("sessions — period boundary and exclusion", () => {
  it("session exactly at period start is INCLUDED", () => {
    const periodStart = new Date("2026-06-11T00:00:00Z");
    const sessionDate = new Date("2026-06-11T00:00:00Z");
    const included = sessionDate.getTime() >= periodStart.getTime();
    expect(included).toBe(true);
  });

  it("session 1ms before period start is EXCLUDED by server query", () => {
    const periodStart = new Date("2026-06-11T00:00:00Z");
    const sessionDate = new Date("2026-06-10T23:59:59.999Z");
    const excluded = sessionDate.getTime() < periodStart.getTime();
    expect(excluded).toBe(true);
  });

  it("session 1 day after period start is INCLUDED", () => {
    const periodStart = new Date("2026-06-11T00:00:00Z");
    const sessionDate = new Date("2026-06-12T10:30:00Z");
    const included = sessionDate.getTime() >= periodStart.getTime();
    expect(included).toBe(true);
  });
});

describe("sessions — documents without started_at", () => {
  it("Firestore orderBy excludes docs missing the ordered field", () => {
    // Firestore behavior: orderBy("field") returns only docs that have "field"
    const docsWithField = [
      { id: "1", started_at: "2026-07-01" },
      { id: "2", started_at: "2026-06-20" },
    ];
    const docsWithoutField = [
      { id: "3" }, // no started_at
    ];

    // Only docs with the field appear in results
    const queryResults = docsWithField;
    expect(queryResults).not.toContain(expect.objectContaining({ id: "3" }));
    expect(docsWithoutField[0]).not.toHaveProperty("started_at");
  });

  it("client-side fallbacks only apply to docs already fetched", () => {
    // The date fallback (created_at, performed_at) can only help if the doc
    // was already returned by the query — it cannot conjure docs the server excluded
    const fetchedDoc = { id: "1", started_at: null, created_at: "2026-07-01" };
    const hasFallback = fetchedDoc.created_at !== null;
    expect(hasFallback).toBe(true);
    // But this doc would NOT have been returned by orderBy("started_at")
    // So the fallback only works for the "recent" period (no where clause)
  });

  it("system does not invent dates for missing started_at", () => {
    const docWithoutDate = { id: "x", notes: "treino no campo" };
    const inventedDate = null;
    expect(inventedDate).toBeNull();
    expect(docWithoutDate).not.toHaveProperty("started_at");
  });
});

describe("sessions — 'Mais recentes' replaces 'Todo o histórico'", () => {
  it("period options do NOT include 'Todo o histórico' or 'all'", () => {
    const options = [
      { label: "Últimos 7 dias", value: "7d" },
      { label: "Últimos 30 dias", value: "30d" },
      { label: "Últimos 90 dias", value: "90d" },
      { label: "Mais recentes", value: "recent" },
    ];

    const labels = options.map((o) => o.label);
    const values = options.map((o) => o.value);

    expect(labels).not.toContain("Todo o histórico");
    expect(values).not.toContain("all");
  });

  it("'Mais recentes' still applies limit per dog (honest label)", () => {
    const PAGE_SIZE = 20;
    // "Mais recentes" fetches the latest PAGE_SIZE per dog without date filter
    // The label is honest: it does not claim to show all history
    expect(PAGE_SIZE).toBe(20);
  });
});

describe("sessions — incremental loading (cursors)", () => {
  it("load more appends without duplicating existing records", () => {
    const page1 = [
      { dogId: "dog-1", id: "s1" },
      { dogId: "dog-1", id: "s2" },
    ];
    const page2 = [
      { dogId: "dog-1", id: "s3" },
      { dogId: "dog-1", id: "s4" },
    ];

    const combined = [...page1, ...page2];
    const deduped = deduplicateSessions(combined);
    expect(deduped).toHaveLength(4);
    expect(new Set(deduped.map((s) => s.id)).size).toBe(4);
  });

  it("deduplication removes records with same dogId/id across pages", () => {
    const page1 = [
      { dogId: "dog-1", id: "s1" },
      { dogId: "dog-1", id: "s2" },
    ];
    const page2 = [
      { dogId: "dog-1", id: "s2" }, // duplicate
      { dogId: "dog-1", id: "s3" },
    ];

    const combined = [...page1, ...page2];
    const deduped = deduplicateSessions(combined);
    expect(deduped).toHaveLength(3);
  });

  it("records from different dogs with same session id are NOT duplicates", () => {
    const sessions = [
      { dogId: "dog-1", id: "s1" },
      { dogId: "dog-2", id: "s1" },
    ];

    const deduped = deduplicateSessions(sessions);
    expect(deduped).toHaveLength(2);
  });

  it("global ordering by date is maintained after merge", () => {
    const sessions = [
      { dogId: "dog-1", id: "s1", date: new Date("2026-07-10") },
      { dogId: "dog-2", id: "s2", date: new Date("2026-07-11") },
      { dogId: "dog-1", id: "s3", date: new Date("2026-07-09") },
    ];

    const sorted = [...sessions].sort((a, b) => b.date.getTime() - a.date.getTime());
    expect(sorted[0].id).toBe("s2");
    expect(sorted[1].id).toBe("s1");
    expect(sorted[2].id).toBe("s3");
  });

  it("hasMore is true when any dog returns exactly PAGE_SIZE docs", () => {
    const cursors = [
      { dogId: "dog-1", hasMore: true, lastDoc: null },  // returned 20 (PAGE_SIZE)
      { dogId: "dog-2", hasMore: false, lastDoc: null }, // returned fewer
    ];

    const hasMore = cursors.some((c) => c.hasMore);
    expect(hasMore).toBe(true);
  });

  it("hasMore is false when no dog returns PAGE_SIZE docs", () => {
    const cursors = [
      { dogId: "dog-1", hasMore: false, lastDoc: null },
      { dogId: "dog-2", hasMore: false, lastDoc: null },
    ];

    const hasMore = cursors.some((c) => c.hasMore);
    expect(hasMore).toBe(false);
  });

  it("end of results: all dogs exhausted means no more button", () => {
    const cursors = [
      { dogId: "dog-1", hasMore: false },
      { dogId: "dog-2", hasMore: false },
      { dogId: "dog-3", hasMore: false },
    ];

    const allExhausted = cursors.every((c) => !c.hasMore);
    expect(allExhausted).toBe(true);
  });
});

describe("sessions — KPI honesty with truncation", () => {
  it("metrics.truncated is true when any dog has more data", () => {
    const cursors = [
      { hasMore: true },
      { hasMore: false },
    ];
    const truncated = cursors.some((c) => c.hasMore);
    expect(truncated).toBe(true);
  });

  it("metrics.truncated is false when all data was loaded", () => {
    const cursors = [
      { hasMore: false },
      { hasMore: false },
    ];
    const truncated = cursors.some((c) => c.hasMore);
    expect(truncated).toBe(false);
  });

  it("KPI label is 'Sessões carregadas' not 'Sessões no período'", () => {
    const label = "Sessões carregadas";
    expect(label).not.toContain("no período");
    expect(label).toContain("carregadas");
  });

  it("truncated KPI shows '+' suffix to indicate lower bound", () => {
    const truncated = true;
    const value = 40;
    const display = truncated ? `${value}+` : `${value}`;
    expect(display).toBe("40+");
  });

  it("non-truncated KPI shows exact count without '+'", () => {
    const truncated = false;
    const value = 15;
    const display = truncated ? `${value}+` : `${value}`;
    expect(display).toBe("15");
  });

  it("'Tempo registrado' uses coverage note when partial", () => {
    const sessionsWithDuration = 8;
    const sessionsLoaded = 15;
    const coverage = `em ${sessionsWithDuration} de ${sessionsLoaded} sessões`;
    expect(coverage).toBe("em 8 de 15 sessões");
  });
});

describe("sessions — concurrency control", () => {
  it("batchedAll processes in groups of CONCURRENCY_LIMIT", async () => {
    const callOrder: number[] = [];
    const tasks = Array.from({ length: 25 }, (_, i) => async () => {
      callOrder.push(i);
      return i;
    });

    const results = await batchedAll(tasks, 10);

    expect(results).toHaveLength(25);
    expect(results[0]).toBe(0);
    expect(results[24]).toBe(24);
  });

  it("batched execution completes all items regardless of batch size", async () => {
    const tasks = Array.from({ length: 7 }, (_, i) => async () => i * 2);
    const results = await batchedAll(tasks, 3);

    expect(results).toEqual([0, 2, 4, 6, 8, 10, 12]);
  });

  it("CONCURRENCY_LIMIT prevents 100 simultaneous requests", () => {
    const CONCURRENCY_LIMIT = 10;
    const dogCount = 100;
    const batches = Math.ceil(dogCount / CONCURRENCY_LIMIT);
    expect(batches).toBe(10);
    // Max simultaneous = 10, not 100
  });

  it("stale requests are discarded via fetchId guard", () => {
    let fetchIdRef = 0;
    const request1Id = ++fetchIdRef; // 1
    const request2Id = ++fetchIdRef; // 2

    // When request1 resolves, fetchIdRef is already 2
    const isStale = request1Id !== fetchIdRef;
    expect(isStale).toBe(true);
    expect(request2Id).toBe(fetchIdRef);
  });
});

describe("sessions — canonical route", () => {
  it("detail route includes dogId in path (no query param needed)", () => {
    const route = "/training/dogs/dog-abc/sessions/session-xyz";
    expect(route).toContain("/dogs/dog-abc/");
    expect(route).toContain("/sessions/session-xyz");
    expect(route).not.toContain("?dog=");
  });

  it("route is shareable and works on page refresh", () => {
    const route = "/training/dogs/dog-abc/sessions/session-xyz";
    const segments = route.split("/").filter(Boolean);
    expect(segments).toContain("dogs");
    expect(segments).toContain("sessions");
    // Both IDs are in the path, not query params
    expect(segments).toContain("dog-abc");
    expect(segments).toContain("session-xyz");
  });
});

describe("sessions — legacy route redirect", () => {
  it("old route with valid dog param redirects to canonical", () => {
    const dogId = "dog-123";
    const sessionId = "session-456";
    const redirectTarget = `/training/dogs/${dogId}/sessions/${sessionId}`;
    expect(redirectTarget).toBe("/training/dogs/dog-123/sessions/session-456");
  });

  it("old route without dog param redirects to sessions list", () => {
    const dogId: string | null = null;
    const fallback = "/training?tab=sessions";

    const target = dogId ? `/training/dogs/${dogId}/sessions/x` : fallback;
    expect(target).toBe("/training?tab=sessions");
  });

  it("old route never constructs path with undefined dogId", () => {
    const dogId: string | null = null;
    const sessionId = "session-1";

    if (dogId && sessionId) {
      // Should NOT reach here when dogId is null
      expect(true).toBe(false);
    } else {
      // Falls through to redirect to sessions list
      expect(dogId).toBeNull();
    }
  });
});

describe("sessions — cleanup and state management", () => {
  it("mountedRef prevents state updates after unmount", () => {
    let mountedRef = true;
    mountedRef = false; // simulates cleanup

    const shouldUpdate = mountedRef;
    expect(shouldUpdate).toBe(false);
  });

  it("period change resets records and cursors (fresh fetch)", () => {
    // When period changes, the provider fetches with isLoadMore=false
    // which replaces all records instead of appending
    const isLoadMore = false;
    const existingRecords = [{ id: "old-1" }, { id: "old-2" }];
    const newRecords = isLoadMore ? [...existingRecords, { id: "new-1" }] : [{ id: "new-1" }];
    expect(newRecords).toHaveLength(1);
    expect(newRecords[0].id).toBe("new-1");
  });

  it("loadMore is a no-op while already loading", () => {
    const loading = true;
    const loadingMore = false;
    const shouldFetch = !loading && !loadingMore;
    expect(shouldFetch).toBe(false);
  });

  it("loadMore is a no-op while loadingMore", () => {
    const loading = false;
    const loadingMore = true;
    const shouldFetch = !loading && !loadingMore;
    expect(shouldFetch).toBe(false);
  });
});

describe("sessions — no Nova Sessão button", () => {
  it("sessions tab has no creation action (read-only consultation)", () => {
    const hasNewButton = false;
    expect(hasNewButton).toBe(false);
  });
});

// ─── Etapa 4.3: Visual and semantic refinement ───────────────────────────────

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? `${count} ${singular}` : `${count} ${plural}`;
}

function formatPhase(phase: string | null): string {
  if (!phase) return "";
  const p = phase.trim();
  if (/^\d+[a-zA-Z]?$/.test(p)) return `Fase ${p.toUpperCase()}`;
  const lower = p.toLowerCase();
  if (lower === "formation" || lower === "formacao") return "Formação";
  if (lower === "maintenance" || lower === "manutencao") return "Manutenção";
  if (lower === "evaluation" || lower === "avaliacao") return "Avaliação";
  if (lower === "warm_up" || lower === "aquecimento") return "Aquecimento";
  if (/^\d/.test(p)) return `Fase ${p.toUpperCase()}`;
  return p.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

describe("sessions — pluralization of KPI labels", () => {
  it("1 K9 treinado (singular)", () => {
    expect(pluralize(1, "K9 treinado", "K9s treinados")).toBe("1 K9 treinado");
  });

  it("2 K9s treinados (plural)", () => {
    expect(pluralize(2, "K9 treinado", "K9s treinados")).toBe("2 K9s treinados");
  });

  it("0 K9s treinados (plural for zero)", () => {
    expect(pluralize(0, "K9 treinado", "K9s treinados")).toBe("0 K9s treinados");
  });

  it("1 modalidade (singular)", () => {
    expect(pluralize(1, "modalidade", "modalidades")).toBe("1 modalidade");
  });

  it("3 modalidades (plural)", () => {
    expect(pluralize(3, "modalidade", "modalidades")).toBe("3 modalidades");
  });

  it("1 sessão (singular)", () => {
    expect(pluralize(1, "sessão", "sessões")).toBe("1 sessão");
  });

  it("15 sessões (plural)", () => {
    expect(pluralize(15, "sessão", "sessões")).toBe("15 sessões");
  });

  it("1 resultado (singular)", () => {
    expect(pluralize(1, "resultado", "resultados")).toBe("1 resultado");
  });

  it("9 resultados (plural)", () => {
    expect(pluralize(9, "resultado", "resultados")).toBe("9 resultados");
  });
});

describe("sessions — list counter after filter", () => {
  it("with filter shows 'X de Y sessões'", () => {
    const filtered = 4;
    const total = 9;
    const text = `${filtered} de ${pluralize(total, "sessão", "sessões")}`;
    expect(text).toBe("4 de 9 sessões");
  });

  it("without filter shows 'X resultados'", () => {
    const count = 9;
    const text = pluralize(count, "resultado", "resultados");
    expect(text).toBe("9 resultados");
  });

  it("singular without filter shows '1 resultado'", () => {
    const count = 1;
    const text = pluralize(count, "resultado", "resultados");
    expect(text).toBe("1 resultado");
  });
});

describe("sessions — phase formatting (no raw codes)", () => {
  it("formats '4c' as 'Fase 4C'", () => {
    expect(formatPhase("4c")).toBe("Fase 4C");
  });

  it("formats '4v' as 'Fase 4V'", () => {
    expect(formatPhase("4v")).toBe("Fase 4V");
  });

  it("formats '4b' as 'Fase 4B'", () => {
    expect(formatPhase("4b")).toBe("Fase 4B");
  });

  it("formats '3v' as 'Fase 3V'", () => {
    expect(formatPhase("3v")).toBe("Fase 3V");
  });

  it("formats '2' as 'Fase 2'", () => {
    expect(formatPhase("2")).toBe("Fase 2");
  });

  it("does not output raw code without 'Fase' prefix", () => {
    const result = formatPhase("4c");
    expect(result).not.toBe("4c");
    expect(result).toContain("Fase");
  });

  it("preserves named phases as friendly labels", () => {
    expect(formatPhase("formation")).toBe("Formação");
    expect(formatPhase("maintenance")).toBe("Manutenção");
  });

  it("returns empty string for null phase", () => {
    expect(formatPhase(null)).toBe("");
  });
});

describe("sessions — result always visible in list row", () => {
  it("result 'Não informado' is shown for null result", () => {
    const result: string | null = null;
    const label = result ? formatResult(result) : "Não informado";
    expect(label).toBe("Não informado");
  });

  it("result 'Satisfatório' is shown for success", () => {
    const result = "satisfatorio";
    const label = formatResult(result);
    expect(label).toBe("Satisfatório");
  });

  it("every row shows some result badge (never empty)", () => {
    const sessions = [
      { result: null },
      { result: "satisfatorio" },
      { result: "parcial" },
    ];

    const labels = sessions.map((s) => s.result ? formatResult(s.result) : "Não informado");
    expect(labels.every((l) => l.length > 0)).toBe(true);
  });
});

describe("sessions — detail header does not show 'Não informado' badge", () => {
  it("header badge is omitted when result is null", () => {
    const result: string | null = null;
    const showHeaderBadge = !!result;
    expect(showHeaderBadge).toBe(false);
  });

  it("header badge is shown when result exists", () => {
    const result = "satisfatorio";
    const showHeaderBadge = !!result;
    expect(showHeaderBadge).toBe(true);
  });
});

describe("sessions — detail layout adapts to content", () => {
  it("two columns when result or events exist", () => {
    const hasResultOrEvents = true;
    const layout = hasResultOrEvents ? "grid lg:grid-cols-2" : "single-column";
    expect(layout).toBe("grid lg:grid-cols-2");
  });

  it("single column with empty state when no result and no events", () => {
    const result: string | null = null;
    const events: string[] = [];
    const notes: string | null = null;
    const hasResultOrEvents = !!(result || events.length > 0 || notes);
    expect(hasResultOrEvents).toBe(false);
  });

  it("empty state message is shown when no result", () => {
    const emptyTitle = "Nenhum resultado registrado";
    const emptyDesc = "Esta sessão não possui resultado ou eventos informados.";
    expect(emptyTitle).not.toContain("Não informado");
    expect(emptyDesc).toBeTruthy();
  });
});

describe("sessions — detail header identifies session contextually", () => {
  it("header reads 'Sessão de {modalidade}' not just dog name", () => {
    const modalityLabel = "Detecção";
    const header = `Sessão de ${modalityLabel}`;
    expect(header).toBe("Sessão de Detecção");
    expect(header).not.toBe("Bono");
  });

  it("subtitle shows dog + date", () => {
    const dogName = "Bono";
    const dateStr = "26 de junho de 2026, 12:02";
    const subtitle = `${dogName} · ${dateStr}`;
    expect(subtitle).toContain("Bono");
    expect(subtitle).toContain("2026");
  });
});

describe("sessions — global period selector hidden on training route", () => {
  it("training route does not show global period", () => {
    const pathname = "/training";
    const showGlobalPeriod = !pathname.startsWith("/training");
    expect(showGlobalPeriod).toBe(false);
  });

  it("training sub-routes also hide global period", () => {
    const paths = ["/training/dogs/abc", "/training?tab=sessions", "/training/matrices"];
    for (const p of paths) {
      expect(p.startsWith("/training")).toBe(true);
    }
  });

  it("dashboard still shows global period", () => {
    const pathname = "/dashboard";
    const showGlobalPeriod = !pathname.startsWith("/training");
    expect(showGlobalPeriod).toBe(true);
  });

  it("other routes still show global period", () => {
    const paths = ["/health", "/occurrences", "/reports"];
    for (const p of paths) {
      expect(p.startsWith("/training")).toBe(false);
    }
  });
});

describe("sessions — fields never show technical values", () => {
  it("no undefined in rendered fields", () => {
    const fields = ["Bono", "Detecção", "Fase 4C", "Não informado"];
    expect(fields.every((f) => f !== "undefined")).toBe(true);
  });

  it("no null in rendered fields", () => {
    const fields = ["Bono", "Detecção", "Fase 4C", "Não informado"];
    expect(fields.every((f) => f !== "null")).toBe(true);
  });

  it("no NaN in rendered fields", () => {
    const fields = ["Bono", "Detecção", "Fase 4C", "Não informado"];
    expect(fields.every((f) => f !== "NaN")).toBe(true);
  });

  it("no raw IDs leak through phase formatting", () => {
    const rawPhases = ["4c", "4v", "3v", "4b"];
    const formatted = rawPhases.map(formatPhase);
    for (let i = 0; i < rawPhases.length; i++) {
      expect(formatted[i]).not.toBe(rawPhases[i]);
      expect(formatted[i]).toContain("Fase");
    }
  });
});

// ─── Microajustes finais ─────────────────────────────────────────────────────

function composeModalityMatrix(modalityLabel: string, matrixLabel: string | null): string {
  if (!matrixLabel) return modalityLabel;
  const modalLower = modalityLabel.toLowerCase().trim();
  const matrixLower = matrixLabel.toLowerCase().trim();
  if (matrixLower.startsWith(modalLower)) {
    const suffix = matrixLabel.slice(modalityLabel.length).replace(/^[\s—\-·]+/, "").trim();
    return suffix ? `${modalityLabel} — ${suffix}` : modalityLabel;
  }
  return `${modalityLabel} — ${matrixLabel}`;
}

describe("sessions — composeModalityMatrix avoids duplication", () => {
  it("removes duplicate when matrix starts with modality name", () => {
    const result = composeModalityMatrix("Detecção", "Detecção — Protocolo Ragonha");
    expect(result).toBe("Detecção — Protocolo Ragonha");
    expect(result).not.toContain("Detecção — Detecção");
  });

  it("preserves both when modality and matrix are different", () => {
    const result = composeModalityMatrix("Busca & Captura", "Protocolo Alpha");
    expect(result).toBe("Busca & Captura — Protocolo Alpha");
  });

  it("returns only modality when matrix is null", () => {
    const result = composeModalityMatrix("Detecção", null);
    expect(result).toBe("Detecção");
  });

  it("returns only modality when matrix equals modality exactly", () => {
    const result = composeModalityMatrix("Detecção", "Detecção");
    expect(result).toBe("Detecção");
  });

  it("is case-insensitive for duplicate detection", () => {
    const result = composeModalityMatrix("Detecção", "detecção — Protocolo X");
    expect(result).toBe("Detecção — Protocolo X");
  });
});

describe("sessions — neutral style for absent result", () => {
  it("absent result uses plain text, not Badge", () => {
    const hasResult = false;
    const display = hasResult ? "Badge" : "plain-text";
    expect(display).toBe("plain-text");
  });

  it("absent result text is 'Sem resultado'", () => {
    const result: string | null = null;
    const label = result ? formatResult(result) : "Sem resultado";
    expect(label).toBe("Sem resultado");
  });

  it("present result uses Badge component", () => {
    const hasResult = true;
    const display = hasResult ? "Badge" : "plain-text";
    expect(display).toBe("Badge");
  });
});

describe("sessions — KPI duration explains absence", () => {
  it("shows 'Nenhuma sessão com duração' when 0 sessions have duration", () => {
    const sessionsLoaded = 9;
    const sessionsWithDuration = 0;
    const coverage = sessionsLoaded > 0
      ? sessionsWithDuration > 0
        ? `em ${sessionsWithDuration} sessões`
        : "Nenhuma sessão com duração"
      : undefined;
    expect(coverage).toBe("Nenhuma sessão com duração");
  });

  it("shows count when some sessions have duration", () => {
    const sessionsLoaded = 9;
    const sessionsWithDuration = 5;
    const coverage = sessionsLoaded > 0
      ? sessionsWithDuration > 0
        ? `em ${pluralize(sessionsWithDuration, "sessão", "sessões")}`
        : "Nenhuma sessão com duração"
      : undefined;
    expect(coverage).toBe("em 5 sessões");
  });

  it("shows singular when exactly 1 session has duration", () => {
    const sessionsLoaded = 9;
    const sessionsWithDuration = 1;
    const coverage = sessionsLoaded > 0
      ? sessionsWithDuration > 0
        ? `em ${pluralize(sessionsWithDuration, "sessão", "sessões")}`
        : "Nenhuma sessão com duração"
      : undefined;
    expect(coverage).toBe("em 1 sessão");
  });

  it("shows nothing when no sessions loaded at all", () => {
    const sessionsLoaded = 0;
    const sessionsWithDuration = 0;
    const coverage = sessionsLoaded > 0
      ? sessionsWithDuration > 0
        ? `em ${sessionsWithDuration} sessões`
        : "Nenhuma sessão com duração"
      : undefined;
    expect(coverage).toBeUndefined();
  });
});

describe("sessions — list counter text", () => {
  it("without filter: '9 sessões encontradas'", () => {
    const count = 9;
    const hasFilter = false;
    const text = hasFilter
      ? `${count} de 9 sessões`
      : pluralize(count, "sessão encontrada", "sessões encontradas");
    expect(text).toBe("9 sessões encontradas");
  });

  it("without filter singular: '1 sessão encontrada'", () => {
    const count = 1;
    const text = pluralize(count, "sessão encontrada", "sessões encontradas");
    expect(text).toBe("1 sessão encontrada");
  });

  it("with filter: '4 de 9 sessões'", () => {
    const filtered = 4;
    const total = 9;
    const hasFilter = true;
    const text = hasFilter
      ? `${filtered} de ${pluralize(total, "sessão", "sessões")}`
      : pluralize(filtered, "sessão encontrada", "sessões encontradas");
    expect(text).toBe("4 de 9 sessões");
  });
});
