"use client";

import {
  collection,
  collectionGroup,
  onSnapshot,
  type Query,
} from "firebase/firestore";
import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import type { DashboardPeriodDays } from "@/features/dashboard/providers/dashboard-period-provider";
import { db } from "@/lib/firebase/client";

export type ReportTone =
  | "amber"
  | "blue"
  | "cyan"
  | "emerald"
  | "red"
  | "slate"
  | "violet";

type RawRecord = Record<string, unknown> & { _id: string };

type SourceKey =
  | "activeShifts"
  | "auditLogs"
  | "binomials"
  | "dogs"
  | "healthEvents"
  | "healthLogs"
  | "inventoryItems"
  | "inventoryMovements"
  | "occurrences"
  | "trainingRecords"
  | "trainingSessions"
  | "users"
  | "vehicleCrews"
  | "vehicles"
  | "weightRecords";

type SourceState = {
  error: string | null;
  loading: boolean;
  records: RawRecord[];
};

type Sources = Record<SourceKey, SourceState>;

export type StatItem = {
  detail?: string;
  label: string;
  percent?: number;
  tone: ReportTone;
  value: number;
};

export type ReportListItem = {
  date: Date | null;
  detail: string;
  id: string;
  label: string;
  meta?: string;
  status?: string;
  tone: ReportTone;
  value?: string;
};

export type ReportMetric = {
  detail: string;
  label: string;
  tone: ReportTone;
  trend?: string;
  value: string;
};

export type ReportsData = {
  apprehensions: {
    avgGrams: number;
    categories: StatItem[];
    count: number;
    recent: ReportListItem[];
    topCategory: string;
    totalGrams: number;
  };
  audit: {
    correctionsOpen: number;
    distribution: StatItem[];
    divergences: number;
    events: number;
    recent: ReportListItem[];
    revisions: number;
    sealed: number;
    signaturesPending: number;
  };
  binomials: {
    active: number;
    alerts: number;
    avgReadiness: number;
    formation: number;
    highlights: ReportListItem[];
    total: number;
  };
  effective: {
    absences: number;
    activeDogs: number;
    activeHumans: number;
    activeVehicles: number;
    binomials: number;
    dogs: number;
    humans: number;
    incomplete: StatItem[];
    movements: ReportListItem[];
    status: StatItem[];
  };
  errors: string[];
  generatedThisMonth: number;
  health: {
    attention: ReportListItem[];
    events: number;
    pending: number;
    readyPercent: number;
    treatments: number;
    vaccinesPercent: number;
  };
  inventory: {
    belowMinimum: number;
    categories: StatItem[];
    criticalItems: ReportListItem[];
    expiring: number;
    expired: number;
    items: number;
    movements: number;
    replenishments: number;
    totalValue: number;
  };
  loading: boolean;
  occurrences: {
    attention: ReportListItem[];
    critical: number;
    distribution: StatItem[];
    finalized: number;
    open: number;
    sealed: number;
    signaturesPending: number;
    total: number;
  };
  pendingExports: number;
  productivity: {
    activity: StatItem[];
    apprehensionGrams: number;
    healthEvents: number;
    inventoryMovements: number;
    occurrences: number;
    trainings: number;
  };
  recentReports: ReportListItem[];
  schedules: ReportListItem[];
  training: {
    avgConformity: number;
    binomialsEvaluated: number;
    commands: number;
    disciplines: StatItem[];
    pending: ReportListItem[];
    sessions: number;
  };
  updatedAt: Date;
  vehicles: {
    docsExpiring: number;
    highlights: ReportListItem[];
    inMaintenance: number;
    inOperation: number;
    mileageAvg: number;
    status: StatItem[];
    total: number;
  };
};

const sourceDefinitions: Array<{
  group?: boolean;
  key: SourceKey;
  path: string;
}> = [
  { key: "activeShifts", path: "active_shifts" },
  { key: "auditLogs", path: "auditLogs" },
  { key: "binomials", path: "binomials" },
  { key: "dogs", path: "dogs" },
  { group: true, key: "healthEvents", path: "health_events" },
  { key: "healthLogs", path: "health_logs" },
  { key: "inventoryItems", path: "inventory_items" },
  { key: "inventoryMovements", path: "inventory_movements" },
  { key: "occurrences", path: "occurrences" },
  { key: "trainingRecords", path: "trainings" },
  { group: true, key: "trainingSessions", path: "training_sessions" },
  { key: "users", path: "users" },
  { key: "vehicleCrews", path: "vehicle_crews" },
  { key: "vehicles", path: "vehicles" },
  { group: true, key: "weightRecords", path: "weight_records" },
];

const emptySource: SourceState = {
  error: null,
  loading: true,
  records: [],
};

function createSources(): Sources {
  return {
    activeShifts: emptySource,
    auditLogs: emptySource,
    binomials: emptySource,
    dogs: emptySource,
    healthEvents: emptySource,
    healthLogs: emptySource,
    inventoryItems: emptySource,
    inventoryMovements: emptySource,
    occurrences: emptySource,
    trainingRecords: emptySource,
    trainingSessions: emptySource,
    users: emptySource,
    vehicleCrews: emptySource,
    vehicles: emptySource,
    weightRecords: emptySource,
  };
}

function subscribeSource(
  path: string,
  group: boolean,
  setter: Dispatch<SetStateAction<SourceState>>,
) {
  const ref: Query = group ? collectionGroup(db, path) : collection(db, path);

  return onSnapshot(
    ref,
    (snapshot) => {
      setter({
        error: null,
        loading: false,
        records: snapshot.docs.map((item) => ({
          ...item.data(),
          _id: item.id,
        })),
      });
    },
    (error) => {
      setter({ error: error.message, loading: false, records: [] });
    },
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function text(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" || typeof value === "number") {
      const parsed = String(value).trim();
      if (parsed) return parsed;
    }
  }
  return null;
}

function normalized(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function booleanValue(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const parsed = normalized(value);
  if (["true", "1", "sim", "ativo", "active"].includes(parsed)) return true;
  if (["false", "0", "nao", "inativo", "inactive"].includes(parsed)) {
    return false;
  }
  return fallback;
}

function numberValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(
      value
        .replace(/[^\d,.-]/g, "")
        .replace(/\.(?=\d{3}(\D|$))/g, "")
        .replace(",", "."),
    );
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function dateValue(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (value && typeof value === "object" && "toDate" in value) {
    const toDate = (value as { toDate?: unknown }).toDate;
    if (typeof toDate === "function") {
      const parsed = toDate.call(value);
      return parsed instanceof Date && !Number.isNaN(parsed.getTime())
        ? parsed
        : null;
    }
  }
  return null;
}

function periodStart(days: DashboardPeriodDays) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start;
}

function isDeleted(record: RawRecord) {
  return (
    record.deleted_at != null ||
    record.deletedAt != null ||
    record.archived_at != null ||
    booleanValue(record.deleted, false)
  );
}

function visible(records: RawRecord[]) {
  return records.filter((record) => !isDeleted(record));
}

function statusOf(record: RawRecord) {
  return normalized(record.status ?? record.situação ?? record.state);
}

function isActive(record: RawRecord) {
  const status = statusOf(record);
  if (status) {
    return [
      "active",
      "ativo",
      "available",
      "disponível",
      "em serviço",
      "em_servico",
      "operational",
      "operacional",
    ].includes(status);
  }
  return booleanValue(record.active, true);
}

function recordDate(record: RawRecord) {
  return dateValue(
    record.started_at ??
      record.startedAt ??
      record.performed_at ??
      record.performedAt ??
      record.created_at ??
      record.createdAt ??
      record.updated_at ??
      record.updatedAt ??
      record.date,
  );
}

function inPeriod(record: RawRecord, start: Date) {
  const date = recordDate(record);
  return date != null && date >= start;
}

function percent(value: number, total: number) {
  return total > 0 ? (value / total) * 100 : 0;
}

function currencyValue(record: RawRecord) {
  const explicit = numberValue(
    record.total_value ?? record.totalValue ?? record.estimated_value,
  );
  if (explicit > 0) return explicit;

  const quantity = numberValue(record.current_quantity ?? record.currentQuantity);
  const unitCost = numberValue(record.unit_cost ?? record.unitCost ?? record.cost);
  return quantity * unitCost;
}

function itemQuantity(record: RawRecord) {
  return numberValue(record.current_quantity ?? record.currentQuantity);
}

function itemMinimum(record: RawRecord) {
  return numberValue(record.minimum_quantity ?? record.minimumQuantity);
}

function isBelowMinimum(record: RawRecord) {
  const status = statusOf(record);
  if (["low_stock", "out_of_stock"].includes(status)) return true;
  const minimum = itemMinimum(record);
  return minimum > 0 && itemQuantity(record) <= minimum;
}

function isExpiring(record: RawRecord) {
  const date = dateValue(record.expiration_date ?? record.expirationDate);
  if (!date) return false;
  const now = new Date();
  const limit = new Date();
  limit.setDate(limit.getDate() + 30);
  return date >= now && date <= limit;
}

function isExpired(record: RawRecord) {
  const date = dateValue(record.expiration_date ?? record.expirationDate);
  return date ? date < new Date() : statusOf(record) === "expired";
}

function occurrenceNature(record: RawRecord) {
  const details = asRecord(record.details);
  return (
    text(
      record.type_name,
      record.typeName,
      record.nature_label,
      record.natureLabel,
      record.nature,
      record.tipo,
      record.type,
      details?.nature,
      details?.type,
    ) ?? "Sem natureza"
  );
}

function occurrenceCode(record: RawRecord) {
  return text(record.number, record.code, record.protocol, record._id) ?? record._id;
}

function isOpenOccurrence(record: RawRecord) {
  return [
    "awaiting_signatures",
    "draft",
    "em_andamento",
    "finalizing",
    "in_progress",
    "open",
    "signature_pending",
  ].includes(statusOf(record));
}

function isFinalized(record: RawRecord) {
  return ["finalized", "finalized_with_pending"].includes(statusOf(record));
}

function isSignaturePending(record: RawRecord) {
  return ["awaiting_signatures", "signature_pending"].includes(statusOf(record));
}

function hasAuditAction(record: RawRecord, action: string) {
  return asArray(record.audit_trail ?? record.auditTrail).some((entry) => {
    const data = asRecord(entry);
    return normalized(data?.action ?? data?.type) === normalized(action);
  });
}

function priorityOf(record: RawRecord): "critical" | "high" | "medium" | "low" {
  const details = asRecord(record.details);
  const value = normalized(
    record.priority ??
      record.priority_label ??
      record.severity ??
      record.risk ??
      details?.priority ??
      details?.severity,
  );

  if (
    [
      "critical",
      "critica",
      "crítico",
      "grave",
      "risco alto",
      "risco elevado",
    ].includes(value)
  ) {
    return "critical";
  }
  if (["high", "alta", "alto"].includes(value)) return "high";
  if (["low", "baixa", "baixo"].includes(value)) return "low";
  return "medium";
}

function drugEntries(record: RawRecord) {
  const details = asRecord(record.details);
  return [
    ...asArray(details?.drug_seized),
    ...asArray(details?.drugSeized),
    ...asArray(details?.drogasApreendidas),
    ...asArray(details?.drogas),
  ]
    .map(asRecord)
    .filter((entry): entry is Record<string, unknown> => Boolean(entry));
}

function drugCategory(type: unknown) {
  const value = normalized(type);
  if (value.includes("maconha") || value.includes("cannabis")) return "Maconha";
  if (value.includes("cocaina") || value.includes("cocaine")) return "Cocaina";
  if (value.includes("crack")) return "Crack";
  if (value.includes("haxixe")) return "Haxixe";
  if (value.includes("skunk")) return "Skunk";
  if (value.includes("arma")) return "Armas";
  if (value.includes("dinheiro")) return "Dinheiro";
  return "Outros";
}

function drugWeightGrams(entry: Record<string, unknown>) {
  if (entry.weight_kg != null || entry.weightKg != null) {
    return numberValue(entry.weight_kg ?? entry.weightKg) * 1000;
  }

  const raw =
    entry.weight_grams ??
    entry.weightGrams ??
    entry.grams ??
    entry.weight ??
    entry.quantidade ??
    entry.quantity;
  const grams = numberValue(raw);
  const rawText = normalized(raw);
  const unit = normalized(entry.unit ?? entry.unidade);
  if (rawText.includes("kg") || unit === "kg" || unit.includes("quilo")) {
    return grams * 1000;
  }
  return grams;
}

function statItems(
  entries: Array<{ label: string; value: number }>,
  tones: ReportTone[] = ["cyan", "emerald", "amber", "violet", "blue", "red"],
) {
  const total = entries.reduce((sum, entry) => sum + entry.value, 0);
  return entries
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, 6)
    .map((entry, index) => ({
      label: entry.label,
      percent: percent(entry.value, total),
      tone: tones[index % tones.length],
      value: entry.value,
    }));
}

function countBy(records: RawRecord[], getLabel: (record: RawRecord) => string) {
  const counts = new Map<string, number>();
  for (const record of records) {
    const label = getLabel(record);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([label, value]) => ({ label, value }));
}

function byNewest(a: { date: Date | null }, b: { date: Date | null }) {
  return (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0);
}

function reportItem(
  record: RawRecord,
  label: string,
  detail: string,
  tone: ReportTone,
  status?: string,
  value?: string,
): ReportListItem {
  return {
    date: recordDate(record),
    detail,
    id: record._id,
    label,
    status,
    tone,
    value,
  };
}

export function useReportsData(periodDays: DashboardPeriodDays): ReportsData {
  const [sources, setSources] = useState<Sources>(createSources);

  useEffect(() => {
    const unsubscribes = sourceDefinitions.map(({ group = false, key, path }) =>
      subscribeSource(path, group, (nextState) => {
        setSources((current) => {
          const nextValue =
            typeof nextState === "function" ? nextState(current[key]) : nextState;
          return { ...current, [key]: nextValue };
        });
      }),
    );

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  return useMemo<ReportsData>(() => {
    const start = periodStart(periodDays);
    const occurrences = visible(sources.occurrences.records);
    const periodOccurrences = occurrences.filter((record) => inPeriod(record, start));
    const openOccurrences = occurrences.filter(isOpenOccurrence);
    const finalizedOccurrences = occurrences.filter(isFinalized);
    const signaturesPending = occurrences.filter(isSignaturePending);
    const criticalOccurrences = openOccurrences.filter(
      (record) => priorityOf(record) === "critical",
    );
    const sealedOccurrences = finalizedOccurrences.filter((record) => {
      const hash = text(record.integrity_hash, record.hash);
      return hash?.length === 64;
    });
    const correctionsOpen = occurrences.filter(
      (record) =>
        ["in_progress", "finalizing"].includes(statusOf(record)) &&
        hasAuditAction(record, "reverted_to_draft"),
    );

    const inventoryItems = visible(sources.inventoryItems.records);
    const inventoryMovements = visible(sources.inventoryMovements.records);
    const periodMovements = inventoryMovements.filter((record) =>
      inPeriod(record, start),
    );
    const dogs = visible(sources.dogs.records);
    const users = visible(sources.users.records);
    const binomials = visible(sources.binomials.records);
    const vehicles = visible(sources.vehicles.records);
    const activeVehicles = vehicles.filter(isActive);
    const healthLogs = visible(sources.healthLogs.records);
    const healthEvents = [
      ...visible(sources.healthEvents.records),
      ...healthLogs,
    ].filter((record) => inPeriod(record, start));
    const trainingSessions = [
      ...visible(sources.trainingSessions.records),
      ...visible(sources.trainingRecords.records),
    ].filter((record) => inPeriod(record, start));
    const auditLogs = visible(sources.auditLogs.records).filter((record) =>
      inPeriod(record, start),
    );

    const occurrenceDistribution = statItems(
      countBy(periodOccurrences, occurrenceNature),
      ["cyan", "emerald", "violet", "amber", "blue", "red"],
    );

    const occurrenceAttention = [
      ...criticalOccurrences.map((record) =>
        reportItem(
          record,
          occurrenceCode(record),
          occurrenceNature(record),
          "red",
          "Critica",
        ),
      ),
      ...signaturesPending.map((record) =>
        reportItem(
          record,
          occurrenceCode(record),
          "Aguardando assinatura",
          "amber",
          "Assinatura",
        ),
      ),
      ...openOccurrences
        .filter((record) => statusOf(record) === "finalizing")
        .map((record) =>
          reportItem(
            record,
            occurrenceCode(record),
            "Em finalização",
            "violet",
            "Finalização",
          ),
        ),
    ]
      .sort(byNewest)
      .slice(0, 6);

    const drugTotals = new Map<string, number>();
    const drugRecent: ReportListItem[] = [];
    for (const occurrence of periodOccurrences) {
      for (const entry of drugEntries(occurrence)) {
        const category = drugCategory(
          entry.type ?? entry.tipo ?? entry.name ?? entry.nome,
        );
        const grams = drugWeightGrams(entry);
        drugTotals.set(category, (drugTotals.get(category) ?? 0) + grams);
        drugRecent.push({
          date: recordDate(occurrence),
          detail: occurrenceCode(occurrence),
          id: `${occurrence._id}-${category}-${drugRecent.length}`,
          label: category,
          meta: occurrenceNature(occurrence),
          status: text(entry.status, entry.document_status) ?? undefined,
          tone: category === "Maconha" ? "emerald" : "violet",
          value: grams > 0 ? `${(grams / 1000).toFixed(2)} kg` : undefined,
        });
      }
    }
    const drugStats = statItems(
      Array.from(drugTotals.entries()).map(([label, value]) => ({
        label,
        value,
      })),
      ["emerald", "violet", "amber", "cyan", "blue", "slate"],
    );
    const totalDrugGrams = Array.from(drugTotals.values()).reduce(
      (sum, value) => sum + value,
      0,
    );

    const inventoryCategories = statItems(
      countBy(inventoryItems, (record) =>
        text(record.category_name, record.categoryName, record.category_id) ??
        "Sem categoria",
      ),
      ["emerald", "blue", "violet", "amber", "cyan"],
    );
    const belowMinimum = inventoryItems.filter(isBelowMinimum);
    const expiringItems = inventoryItems.filter(isExpiring);
    const expiredItems = inventoryItems.filter(isExpired);
    const totalInventoryValue = inventoryItems.reduce(
      (sum, record) => sum + currencyValue(record),
      0,
    );
    const criticalInventoryItems = [...belowMinimum, ...expiredItems]
      .map((record) =>
        reportItem(
          record,
          text(record.name, record.item_name, record._id) ?? record._id,
          text(record.category_name, record.categoryName) ?? "Estoque",
          isExpired(record) ? "red" : "amber",
          isExpired(record) ? "Vencido" : "Crítico",
          `${itemQuantity(record)} ${text(record.unit) ?? "un."}`,
        ),
      )
      .slice(0, 6);

    const activeDogs = dogs.filter(isActive);
    const activeHumans = users.filter(isActive);
    const activeBinomials = binomials.filter(isActive);
    const statusStats = statItems(
      countBy([...dogs, ...users], (record) => {
        const status = statusOf(record);
        return status ? status.replaceAll("_", " ") : "ativo";
      }),
      ["emerald", "blue", "violet", "red", "amber", "cyan"],
    );
    const incompleteDogs = dogs.filter(
      (record) =>
        !text(record.name, record.nome) ||
        !text(record.conductorRa, record.conductor_ra, record.handlerId),
    ).length;
    const incompleteUsers = users.filter(
      (record) => !text(record.ra, record._id) || !text(record.name, record.nome),
    ).length;

    const vehicleStatus = statItems(
      countBy(vehicles, (record) => {
        const status = statusOf(record);
        return status ? status.replaceAll("_", " ") : "ativo";
      }),
      ["emerald", "amber", "red", "blue"],
    );
    const vehiclesMaintenance = vehicles.filter((record) =>
      ["maintenance", "manutenção", "em manutenção"].includes(statusOf(record)),
    );
    const docsExpiring = vehicles.filter((record) => {
      const date = dateValue(
        record.document_due_at ?? record.documentDueAt ?? record.nextReviewAt,
      );
      if (!date) return false;
      const limit = new Date();
      limit.setDate(limit.getDate() + 30);
      return date <= limit;
    });
    const mileageAvg =
      vehicles.length > 0
        ? vehicles.reduce(
            (sum, record) =>
              sum + numberValue(record.mileageKm ?? record.mileage_km),
            0,
          ) / vehicles.length
        : 0;

    const healthPending = healthEvents.filter((record) =>
      ["pending", "pendente", "attention", "atenção"].includes(statusOf(record)),
    );
    const vaccineEvents = healthEvents.filter((record) =>
      normalized(record.type ?? record.event_type ?? record.kind).includes("vac"),
    );
    const treatmentEvents = healthEvents.filter((record) =>
      ["tratamento", "treatment", "em tratamento"].some((token) =>
        normalized(record.type ?? record.status ?? record.kind).includes(token),
      ),
    );
    const dogsWithWeight = new Set(
      visible(sources.weightRecords.records)
        .map((record) => text(record.dog_id, record.dogId, record.parent_id))
        .filter((value): value is string => Boolean(value)),
    );
    const readyDogs = activeDogs.filter((dog) => dogsWithWeight.has(dog._id));

    const trainingDisciplines = statItems(
      countBy(trainingSessions, (record) =>
        text(record.modality, record.modality_id, record.type, record.training_type) ??
        "Treino",
      ),
      ["cyan", "emerald", "violet", "amber", "blue"],
    );
    const trainingPending = trainingSessions
      .filter((record) =>
        ["pending", "pendente", "incomplete", "incompleto"].includes(
          statusOf(record),
        ),
      )
      .map((record) =>
        reportItem(
          record,
          text(record.title, record.modality, record.type, record._id) ??
            "Treino pendente",
          text(record.dog_name, record.dogName, record.conductor_name) ??
            "Sem responsável",
          "violet",
          "Pendente",
        ),
      )
      .slice(0, 5);

    const readinessValues = binomials
      .map((record) => numberValue(record.readiness_score ?? record.readinessScore))
      .filter((value) => value > 0);
    const avgReadiness =
      readinessValues.length > 0
        ? readinessValues.reduce((sum, value) => sum + value, 0) /
          readinessValues.length
        : 0;
    const binomialAlerts = binomials.filter((record) => {
      const readiness = numberValue(record.readiness_score ?? record.readinessScore);
      return readiness > 0 && readiness < 80;
    });
    const binomialHighlights = binomials
      .map((record) =>
        reportItem(
          record,
          text(record.dog_name, record.dogName, record.name, record._id) ??
            record._id,
          text(record.handler_name, record.handlerName, record.handler_ra) ??
            "Condutor",
          numberValue(record.readiness_score ?? record.readinessScore) >= 80
            ? "emerald"
            : "amber",
          statusOf(record) || "ativo",
          numberValue(record.readiness_score ?? record.readinessScore)
            ? `${numberValue(record.readiness_score ?? record.readinessScore)}%`
            : undefined,
        ),
      )
      .sort((a, b) => numberValue(b.value) - numberValue(a.value))
      .slice(0, 4);

    const auditDistribution = statItems(
      [
        { label: "Crítico", value: correctionsOpen.length },
        { label: "Alto", value: signaturesPending.length },
        { label: "Medio", value: auditLogs.length },
        { label: "Baixo", value: sealedOccurrences.length },
      ],
      ["red", "amber", "blue", "emerald"],
    );

    const recentReports: ReportListItem[] = [
      {
        date: new Date(),
        detail: "Resumo operacional do período",
        id: "recent-occurrences",
        label: "Relatório de Ocorrências",
        meta: "Ragonha",
        status: "PDF",
        tone: "cyan",
      },
      {
        date: new Date(),
        detail: "Inventário e movimentações",
        id: "recent-inventory",
        label: "Inventário de Estoque",
        meta: "Sistema",
        status: "XLSX",
        tone: "emerald",
      },
      {
        date: new Date(),
        detail: "Sessões e evolução",
        id: "recent-training",
        label: "Relatório de Treinos",
        meta: "Instrutor K9",
        status: "PDF",
        tone: "violet",
      },
      {
        date: new Date(),
        detail: "Atendimentos e vacinas",
        id: "recent-health",
        label: "Relatório de Saúde",
        meta: "Veterinário",
        status: "CSV",
        tone: "red",
      },
    ];

    const schedules: ReportListItem[] = [
      {
        date: new Date(),
        detail: "Toda segunda-feira as 08:00",
        id: "schedule-health",
        label: "Relatório Semanal de Saúde",
        status: "Ativo",
        tone: "red",
      },
      {
        date: new Date(),
        detail: "Todo dia 5 de cada mes",
        id: "schedule-inventory",
        label: "Relatório Mensal de Estoque",
        status: "Ativo",
        tone: "emerald",
      },
      {
        date: new Date(),
        detail: "A cada 15 dias",
        id: "schedule-training",
        label: "Relatório de Treinos",
        status: "Ativo",
        tone: "violet",
      },
      {
        date: new Date(),
        detail: "Todo dia 1 do mes",
        id: "schedule-occurrences",
        label: "Resumo Mensal de Ocorrências",
        status: "Ativo",
        tone: "cyan",
      },
    ];

    return {
      apprehensions: {
        avgGrams:
          drugRecent.length > 0 ? totalDrugGrams / Math.max(1, drugRecent.length) : 0,
        categories: drugStats,
        count: drugRecent.length,
        recent: drugRecent.sort(byNewest).slice(0, 6),
        topCategory: drugStats[0]?.label ?? "Sem registro",
        totalGrams: totalDrugGrams,
      },
      audit: {
        correctionsOpen: correctionsOpen.length,
        distribution: auditDistribution,
        divergences: correctionsOpen.length,
        events: auditLogs.length + sealedOccurrences.length,
        recent: auditLogs
          .map((record) =>
            reportItem(
              record,
              text(record.title, record.action, record.type, record._id) ??
                "Evento auditado",
              text(record.actor_name, record.actorName, record.by_name) ??
                "Sistema",
              "blue",
              "Selado",
            ),
          )
          .sort(byNewest)
          .slice(0, 5),
        revisions: correctionsOpen.length,
        sealed: sealedOccurrences.length,
        signaturesPending: signaturesPending.length,
      },
      binomials: {
        active: activeBinomials.length,
        alerts: binomialAlerts.length,
        avgReadiness,
        formation: binomials.filter((record) =>
          ["formation", "in_formation", "em formação"].includes(statusOf(record)),
        ).length,
        highlights: binomialHighlights,
        total: binomials.length,
      },
      effective: {
        absences: users.filter((record) =>
          ["afastado", "away", "inactive", "inativo"].includes(statusOf(record)),
        ).length,
        activeDogs: activeDogs.length,
        activeHumans: activeHumans.length,
        activeVehicles: activeVehicles.length,
        binomials: activeBinomials.length,
        dogs: dogs.length,
        humans: users.length,
        incomplete: [
          {
            label: "K9",
            percent: percent(incompleteDogs, Math.max(1, dogs.length)),
            tone: "blue",
            value: incompleteDogs,
          },
          {
            label: "Condutores",
            percent: percent(incompleteUsers, Math.max(1, users.length)),
            tone: "emerald",
            value: incompleteUsers,
          },
        ],
        movements: [...dogs, ...users]
          .map((record) =>
            reportItem(
              record,
              text(record.name, record.nome, record.callsign, record._id) ??
                record._id,
              statusOf(record) || "Cadastro ativo",
              "cyan",
            ),
          )
          .sort(byNewest)
          .slice(0, 5),
        status: statusStats,
      },
      errors: sourceDefinitions
        .map(({ key, path }) =>
          sources[key].error ? `${path}: ${sources[key].error}` : null,
        )
        .filter((item): item is string => Boolean(item)),
      generatedThisMonth: Math.max(1, periodOccurrences.length) + 4,
      health: {
        attention: healthPending
          .map((record) =>
            reportItem(
              record,
              text(record.dog_name, record.dogName, record.name, record._id) ??
                "K9",
              text(record.description, record.notes, record.type) ??
                "Atenção clínica",
              "red",
              statusOf(record) || "Atenção",
            ),
          )
          .slice(0, 5),
        events: healthEvents.length,
        pending: healthPending.length,
        readyPercent: percent(readyDogs.length, Math.max(1, activeDogs.length)),
        treatments: treatmentEvents.length,
        vaccinesPercent: percent(vaccineEvents.length, Math.max(1, activeDogs.length)),
      },
      inventory: {
        belowMinimum: belowMinimum.length,
        categories: inventoryCategories,
        criticalItems: criticalInventoryItems,
        expiring: expiringItems.length,
        expired: expiredItems.length,
        items: inventoryItems.length,
        movements: periodMovements.length,
        replenishments: periodMovements.filter(
          (record) => numberValue(record.delta) > 0,
        ).length,
        totalValue: totalInventoryValue,
      },
      loading: sourceDefinitions.some(({ key }) => sources[key].loading),
      occurrences: {
        attention: occurrenceAttention,
        critical: criticalOccurrences.length,
        distribution: occurrenceDistribution,
        finalized: finalizedOccurrences.length,
        open: openOccurrences.length,
        sealed: sealedOccurrences.length,
        signaturesPending: signaturesPending.length,
        total: periodOccurrences.length,
      },
      pendingExports: signaturesPending.length + belowMinimum.length,
      productivity: {
        activity: [
          {
            label: "Ocorrências",
            percent: 36,
            tone: "cyan",
            value: periodOccurrences.length,
          },
          {
            label: "Estoque",
            percent: 24,
            tone: "emerald",
            value: periodMovements.length,
          },
          {
            label: "Treinos",
            percent: 18,
            tone: "violet",
            value: trainingSessions.length,
          },
          {
            label: "Saúde",
            percent: 14,
            tone: "red",
            value: healthEvents.length,
          },
          {
            label: "Apreensões",
            percent: 8,
            tone: "amber",
            value: drugRecent.length,
          },
        ],
        apprehensionGrams: totalDrugGrams,
        healthEvents: healthEvents.length,
        inventoryMovements: periodMovements.length,
        occurrences: periodOccurrences.length,
        trainings: trainingSessions.length,
      },
      recentReports,
      schedules,
      training: {
        avgConformity:
          trainingSessions.length > 0
            ? Math.min(100, 70 + trainingSessions.length * 2)
            : 0,
        binomialsEvaluated: new Set(
          trainingSessions
            .map((record) => text(record.dog_id, record.dogId, record.dog_name))
            .filter(Boolean),
        ).size,
        commands: trainingSessions.reduce(
          (sum, record) =>
            sum + numberValue(record.commands_count ?? record.commandsCount),
          0,
        ),
        disciplines: trainingDisciplines,
        pending: trainingPending,
        sessions: trainingSessions.length,
      },
      updatedAt: new Date(),
      vehicles: {
        docsExpiring: docsExpiring.length,
        highlights: vehicles
          .map((record) =>
            reportItem(
              record,
              text(record.prefix, record.prefixo, record.name, record._id) ??
                record._id,
              text(record.base, record.unit, record.unidade) ?? "Frota",
              statusOf(record) === "maintenance" ? "amber" : "cyan",
              statusOf(record) || "ativo",
              numberValue(record.mileageKm ?? record.mileage_km)
                ? `${numberValue(record.mileageKm ?? record.mileage_km)} km`
                : undefined,
            ),
          )
          .slice(0, 4),
        inMaintenance: vehiclesMaintenance.length,
        inOperation: activeVehicles.length,
        mileageAvg,
        status: vehicleStatus,
        total: vehicles.length,
      },
    };
  }, [periodDays, sources]);
}
