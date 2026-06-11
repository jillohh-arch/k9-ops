"use client";

import { collection, onSnapshot } from "firebase/firestore";
import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import type { DashboardPeriodDays } from "@/features/dashboard/providers/dashboard-period-provider";
import { db } from "@/lib/firebase/client";

type RawRecord = Record<string, unknown> & { _id: string };

type CollectionState = {
  error: string | null;
  loading: boolean;
  records: RawRecord[];
};

type CenterCollectionKey =
  | "activeShifts"
  | "dogs"
  | "inventoryItems"
  | "occurrences"
  | "users"
  | "vehicleCrews"
  | "vehicles";

type CenterCollections = Record<CenterCollectionKey, CollectionState>;

export type OperationStatusTone =
  | "amber"
  | "blue"
  | "cyan"
  | "emerald"
  | "red"
  | "slate"
  | "violet";

export type OperationSummary = {
  activeBinomials: number;
  activeCrews: number;
  activeVehicles: number;
  apprehensionsToday: number;
  criticalOccurrences: number;
  immediateAttention: number;
  openOccurrences: number;
  signaturesPending: number;
  vehiclesInUse: number;
};

export type OperationOccurrence = {
  code: string;
  date: Date | null;
  dogName: string | null;
  handlerName: string | null;
  id: string;
  isCritical: boolean;
  location: string;
  nature: string;
  priorityLabel: string;
  priorityTone: OperationStatusTone;
  status: string;
  tone: OperationStatusTone;
  vehicleLabel: string | null;
};

export type OperationAttention = {
  action: string;
  detail: string;
  id: string;
  label: string;
  severity: "critical" | "warning" | "info";
  source: string;
};

export type OperationNatureStat = {
  label: string;
  percent: number;
  tone: OperationStatusTone;
  value: number;
};

export type OperationTimelineItem = {
  at: Date | null;
  detail: string;
  id: string;
  label: string;
  source: string;
  tone: OperationStatusTone;
};

export type OperationIntegrity = {
  awaitingSignatures: number;
  correctionsOpen: number;
  coverage: number;
  finalized: number;
  sealed: number;
};

export type OperationQueueItem = {
  category: string;
  detail: string;
  id: string;
  label: string;
  tone: OperationStatusTone;
};

export type OperationalCenterData = {
  attention: OperationAttention[];
  distribution: {
    total: number;
    types: OperationNatureStat[];
  };
  errors: string[];
  integrity: OperationIntegrity;
  loading: boolean;
  managerQueue: OperationQueueItem[];
  occurrences: OperationOccurrence[];
  recentRecords: OperationTimelineItem[];
  summary: OperationSummary;
};

const centerCollectionPaths: Array<{
  key: CenterCollectionKey;
  path: string;
}> = [
  { key: "activeShifts", path: "active_shifts" },
  { key: "dogs", path: "dogs" },
  { key: "inventoryItems", path: "inventory_items" },
  { key: "occurrences", path: "occurrences" },
  { key: "users", path: "users" },
  { key: "vehicleCrews", path: "vehicle_crews" },
  { key: "vehicles", path: "vehicles" },
];

const distributionTones: OperationStatusTone[] = [
  "cyan",
  "blue",
  "amber",
  "violet",
  "emerald",
];

function emptyCollection(): CollectionState {
  return {
    error: null,
    loading: true,
    records: [],
  };
}

function createCollections(): CenterCollections {
  return {
    activeShifts: emptyCollection(),
    dogs: emptyCollection(),
    inventoryItems: emptyCollection(),
    occurrences: emptyCollection(),
    users: emptyCollection(),
    vehicleCrews: emptyCollection(),
    vehicles: emptyCollection(),
  };
}

function subscribeCollection(
  path: string,
  setter: Dispatch<SetStateAction<CollectionState>>,
) {
  return onSnapshot(
    collection(db, path),
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
      setter({
        error: error.message,
        loading: false,
        records: [],
      });
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

function isToday(value: Date | null) {
  if (!value) return false;

  const now = new Date();
  return (
    value.getFullYear() === now.getFullYear() &&
    value.getMonth() === now.getMonth() &&
    value.getDate() === now.getDate()
  );
}

function isDeleted(record: RawRecord) {
  return (
    record.deleted_at != null ||
    record.deletedAt != null ||
    record.archived_at != null ||
    booleanValue(record.deleted, false)
  );
}

function visibleRecords(records: RawRecord[]) {
  return records.filter((record) => !isDeleted(record));
}

function statusOf(record: RawRecord) {
  return normalized(record.status ?? record.situacao ?? record.state);
}

function hasAuditAction(record: RawRecord, action: string) {
  return asArray(record.audit_trail ?? record.auditTrail).some((entry) => {
    const data = asRecord(entry);
    return normalized(data?.action ?? data?.type) === normalized(action);
  });
}

function isActiveRecord(record: RawRecord) {
  const status = statusOf(record);

  if (status) {
    return [
      "active",
      "ativo",
      "available",
      "disponivel",
      "em servico",
      "em_servico",
      "operational",
      "operacional",
    ].includes(status);
  }

  return booleanValue(record.active, true);
}

function isActiveShift(record: RawRecord) {
  const status = statusOf(record);

  if (
    [
      "closed",
      "encerrado",
      "finalized",
      "finalizado",
      "inactive",
      "inativo",
    ].includes(status)
  ) {
    return false;
  }

  return booleanValue(record.active, true) && !isDeleted(record);
}

function isActiveCrew(record: RawRecord) {
  const status = statusOf(record);

  if (["closed", "encerrado", "inactive", "inativo"].includes(status)) {
    return false;
  }

  return booleanValue(record.active, true) && !isDeleted(record);
}

function vehicleIdentity(record: RawRecord | null | undefined) {
  if (!record) return null;

  return text(
    record.prefix,
    record.prefixo,
    record.name,
    record.label,
    record.plate,
    record.placa,
    record._id,
  );
}

function dogName(record: RawRecord | null | undefined) {
  return text(record?.name, record?.nome, record?._id);
}

function userName(record: RawRecord | null | undefined) {
  return text(
    record?.callsign,
    record?.callSign,
    record?.nome_guerra,
    record?.nome,
    record?.name,
    record?._id,
  );
}

function occurrenceDate(record: RawRecord) {
  return dateValue(
    record.started_at ??
      record.startedAt ??
      record.created_at ??
      record.createdAt ??
      record.date,
  );
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
    ) ?? "Ocorrencia sem natureza"
  );
}

function occurrenceCode(record: RawRecord) {
  return text(record.number, record.code, record.protocol, record._id) ?? record._id;
}

function occurrenceLocation(record: RawRecord) {
  const details = asRecord(record.details);
  const location = asRecord(record.location);

  return (
    text(
      record.location_label,
      record.locationLabel,
      record.address,
      record.bairro,
      details?.location,
      details?.address,
      details?.bairro,
      location?.address,
      location?.bairro,
      location?.name,
    ) ?? "Local nao informado"
  );
}

function occurrencePriority(record: RawRecord): {
  isCritical: boolean;
  label: string;
  tone: OperationStatusTone;
} {
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
      "critico",
      "risco elevado",
      "risco alto",
      "grave",
    ].includes(value)
  ) {
    return { isCritical: true, label: "Critica", tone: "red" };
  }

  if (["high", "alta", "alto"].includes(value)) {
    return { isCritical: false, label: "Alta", tone: "amber" };
  }

  if (["medium", "media", "medio"].includes(value)) {
    return { isCritical: false, label: "Media", tone: "amber" };
  }

  if (["low", "baixa", "baixo"].includes(value)) {
    return { isCritical: false, label: "Baixa", tone: "blue" };
  }

  return { isCritical: false, label: "Media", tone: "amber" };
}

function occurrenceTone(status: string, isCritical: boolean): OperationStatusTone {
  if (isCritical) {
    return "red";
  }

  if (["awaiting_signatures", "signature_pending"].includes(status)) {
    return "amber";
  }

  if (["finalizing", "draft", "rascunho"].includes(status)) {
    return "violet";
  }

  if (["in_progress", "open", "em_andamento"].includes(status)) {
    return "cyan";
  }

  return "slate";
}

function isOpenOccurrence(record: RawRecord) {
  const status = statusOf(record);

  return [
    "awaiting_signatures",
    "draft",
    "em_andamento",
    "finalizing",
    "in_progress",
    "open",
    "signature_pending",
  ].includes(status);
}

function isSignaturePending(record: RawRecord) {
  const status = statusOf(record);
  return ["awaiting_signatures", "signature_pending"].includes(status);
}

function isFinalized(record: RawRecord) {
  return ["finalized", "finalized_with_pending"].includes(statusOf(record));
}

function inventoryStatus(record: RawRecord) {
  return normalized(record.status);
}

function isInventoryCritical(record: RawRecord) {
  const status = inventoryStatus(record);

  if (["expired", "low_stock", "out_of_stock"].includes(status)) {
    return true;
  }

  const quantity = Number(record.current_quantity ?? record.currentQuantity);
  const minimum = Number(record.minimum_quantity ?? record.minimumQuantity);

  return Number.isFinite(quantity) && Number.isFinite(minimum) && quantity <= minimum;
}

function drugEntriesFromOccurrence(record: RawRecord) {
  const details = asRecord(record.details);

  return [
    ...asArray(details?.drug_seized),
    ...asArray(details?.drugSeized),
    ...asArray(details?.drogasApreendidas),
    ...asArray(details?.drogas),
  ].filter((entry) => asRecord(entry) != null);
}

function lookupById(records: RawRecord[]) {
  return new Map(records.map((record) => [record._id, record]));
}

function lookupUsers(records: RawRecord[]) {
  const entries = records.flatMap((record) => {
    const ra = text(record.ra, record.id, record._id);
    return ra ? [[ra, record] as const] : [];
  });

  return new Map(entries);
}

function mapOccurrence(
  record: RawRecord,
  dogs: Map<string, RawRecord>,
  users: Map<string, RawRecord>,
  vehicles: Map<string, RawRecord>,
): OperationOccurrence {
  const status = statusOf(record) || "open";
  const dogId = text(record.dog_id, record.dogId, record.service_dog_id);
  const handlerRa = text(
    record.handler_ra,
    record.handlerRa,
    record.conductor_ra,
    record.created_by_ra,
    record.createdByRa,
  );
  const vehicleId = text(record.vehicle_id, record.vehicleId, record.vtr_id);
  const priority = occurrencePriority(record);

  return {
    code: occurrenceCode(record),
    date: occurrenceDate(record),
    dogName: dogId ? dogName(dogs.get(dogId)) ?? `K9 ${dogId}` : null,
    handlerName: handlerRa
      ? userName(users.get(handlerRa)) ?? `RA ${handlerRa}`
      : null,
    id: record._id,
    isCritical: priority.isCritical,
    location: occurrenceLocation(record),
    nature: occurrenceNature(record),
    priorityLabel: priority.label,
    priorityTone: priority.tone,
    status,
    tone: occurrenceTone(status, priority.isCritical),
    vehicleLabel: vehicleId ? vehicleIdentity(vehicles.get(vehicleId)) : null,
  };
}

function byNewestDate<T extends { date?: Date | null; at?: Date | null }>(
  a: T,
  b: T,
) {
  const left = a.date ?? a.at;
  const right = b.date ?? b.at;
  return (right?.getTime() ?? 0) - (left?.getTime() ?? 0);
}

function buildNatureStats(records: RawRecord[]): OperationNatureStat[] {
  const counts = new Map<string, number>();

  for (const record of records) {
    const nature = occurrenceNature(record);
    counts.set(nature, (counts.get(nature) ?? 0) + 1);
  }

  const total = records.length;

  return Array.from(counts.entries())
    .map(([label, value], index) => ({
      label,
      percent: total > 0 ? (value / total) * 100 : 0,
      tone: distributionTones[index % distributionTones.length],
      value,
    }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, 5);
}

export function useOperationalCenterData(
  periodDays: DashboardPeriodDays,
): OperationalCenterData {
  const [collections, setCollections] = useState(createCollections);

  useEffect(() => {
    const unsubscribes = centerCollectionPaths.map(({ key, path }) =>
      subscribeCollection(path, (nextState) => {
        setCollections((current) => {
          const nextValue =
            typeof nextState === "function" ? nextState(current[key]) : nextState;

          return {
            ...current,
            [key]: nextValue,
          };
        });
      }),
    );

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  return useMemo<OperationalCenterData>(() => {
    const allOccurrences = visibleRecords(collections.occurrences.records);
    const dogs = visibleRecords(collections.dogs.records);
    const users = visibleRecords(collections.users.records);
    const vehicles = visibleRecords(collections.vehicles.records);
    const dogMap = lookupById(dogs);
    const userMap = lookupUsers(users);
    const vehicleMap = lookupById(vehicles);

    const periodFrom = periodStart(periodDays);
    const periodOccurrences = allOccurrences.filter((record) => {
      const date = occurrenceDate(record);
      return date != null && date >= periodFrom;
    });

    const activeShifts = visibleRecords(collections.activeShifts.records).filter(
      isActiveShift,
    );
    const activeCrews = visibleRecords(collections.vehicleCrews.records).filter(
      isActiveCrew,
    );

    const openOccurrences = allOccurrences
      .filter(isOpenOccurrence)
      .map((record) => mapOccurrence(record, dogMap, userMap, vehicleMap))
      .sort(byNewestDate);

    const criticalOccurrences = openOccurrences.filter(
      (occurrence) => occurrence.isCritical,
    );

    const signaturePending = allOccurrences.filter(isSignaturePending);
    const criticalInventory = visibleRecords(collections.inventoryItems.records).filter(
      isInventoryCritical,
    );

    const apprehensionsToday = allOccurrences
      .filter((record) => isToday(occurrenceDate(record)))
      .reduce(
        (total, record) => total + drugEntriesFromOccurrence(record).length,
        0,
      );

    const finalized = allOccurrences.filter(isFinalized);
    const sealed = finalized.filter((occurrence) => {
      const hash = text(occurrence.integrity_hash, occurrence.hash);
      return hash?.length === 64;
    });
    const correctionsOpen = allOccurrences.filter((occurrence) => {
      const status = statusOf(occurrence);
      return (
        ["in_progress", "finalizing"].includes(status) &&
        hasAuditAction(occurrence, "reverted_to_draft")
      );
    });

    const attention: OperationAttention[] = [
      ...criticalOccurrences.slice(0, 3).map((occurrence) => ({
        action: "Critico",
        detail: `${occurrence.location}. Acompanhar evolucao.`,
        id: `critical-${occurrence.id}`,
        label: `${occurrence.code} - ${occurrence.nature}`,
        severity: "critical" as const,
        source: "Ocorrencia",
      })),
      ...openOccurrences
        .filter((occurrence) =>
          ["awaiting_signatures", "signature_pending"].includes(occurrence.status),
        )
        .slice(0, 3)
        .map((occurrence) => ({
          action: "Atencao",
          detail: "Documento pronto para assinatura do responsavel.",
          id: `signature-${occurrence.id}`,
          label: `${occurrence.code} - aguardando assinatura`,
          severity: "warning" as const,
          source: "Assinatura",
        })),
      ...openOccurrences
        .filter((occurrence) => occurrence.status === "finalizing")
        .slice(0, 2)
        .map((occurrence) => ({
          action: "Informar",
          detail: "Ocorrencia em finalizacao sem selo institucional.",
          id: `finalizing-${occurrence.id}`,
          label: `${occurrence.code} - em finalizacao`,
          severity: "info" as const,
          source: "Finalizacao",
        })),
    ].slice(0, 5);

    const recentRecords: OperationTimelineItem[] = [
      ...openOccurrences.slice(0, 5).map((occurrence) => ({
        at: occurrence.date,
        detail: occurrence.vehicleLabel ?? "App Mobile",
        id: `occurrence-${occurrence.id}`,
        label: `${occurrence.code} finalizada`.replace("finalizada", formatStatus(occurrence.status)),
        source: "Ocorrencia",
        tone: occurrence.tone,
      })),
      ...activeShifts.slice(0, 5).map((shift) => {
        const dogId =
          text(shift.service_dog_id, shift.dogId, shift.currentDogId, shift.dog_id) ??
          "";
        const handlerRa =
          text(shift.handlerId, shift.handler_id, shift.ra, shift.conductor_ra) ??
          "";
        const dog = dogName(dogMap.get(dogId)) ?? "K9";
        const handler = userName(userMap.get(handlerRa)) ?? "Condutor";

        return {
          at: dateValue(shift.startedAt ?? shift.started_at ?? shift.created_at),
          detail: "Turno ativo",
          id: `shift-${shift._id}`,
          label: `${dog} - ${handler}`,
          source: "Turno",
          tone: "emerald" as const,
        };
      }),
      ...criticalInventory.slice(0, 3).map((item) => ({
        at: dateValue(item.updated_at ?? item.updatedAt ?? item.last_movement_at),
        detail: text(item.status) ?? "Estoque",
        id: `inventory-${item._id}`,
        label: text(item.name, item.item_name, item._id) ?? item._id,
        source: "Estoque",
        tone: "amber" as const,
      })),
    ]
      .sort(byNewestDate)
      .slice(0, 6);

    const managerQueue: OperationQueueItem[] = [
      ...criticalInventory.slice(0, 2).map((item) => ({
        category: "Estoque",
        detail: text(item.status) ?? "Abaixo do minimo",
        id: `queue-inventory-${item._id}`,
        label: text(item.name, item.item_name, item._id) ?? item._id,
        tone:
          inventoryStatus(item) === "out_of_stock"
            ? ("red" as const)
            : ("amber" as const),
      })),
      ...signaturePending.slice(0, 2).map((occurrence) => ({
        category: "Operacional",
        detail: "Aguardando assinatura",
        id: `queue-signature-${occurrence._id}`,
        label: `${occurrenceCode(occurrence)} aguardando assinatura`,
        tone: "amber" as const,
      })),
      ...correctionsOpen.slice(0, 2).map((occurrence) => ({
        category: "Auditoria",
        detail: "Devolvida para ajuste",
        id: `queue-correction-${occurrence._id}`,
        label: `${occurrenceCode(occurrence)} com correcao aberta`,
        tone: "violet" as const,
      })),
      ...criticalOccurrences.slice(0, 2).map((occurrence) => ({
        category: "Operacional",
        detail: `${occurrence.location}`,
        id: `queue-critical-${occurrence.id}`,
        label: `${occurrence.code} risco elevado`,
        tone: "red" as const,
      })),
    ].slice(0, 4);

    const vehiclesInUse = new Set(
      activeShifts
        .map((shift) => text(shift.vehicle_id, shift.vehicleId))
        .filter((value): value is string => Boolean(value)),
    ).size;

    const integrity: OperationIntegrity = {
      awaitingSignatures: signaturePending.length,
      correctionsOpen: correctionsOpen.length,
      coverage: finalized.length > 0 ? (sealed.length / finalized.length) * 100 : 0,
      finalized: finalized.length,
      sealed: sealed.length,
    };

    const summary: OperationSummary = {
      activeBinomials: activeShifts.length,
      activeCrews: activeCrews.length,
      activeVehicles: vehicles.filter(isActiveRecord).length,
      apprehensionsToday,
      criticalOccurrences: criticalOccurrences.length,
      immediateAttention: attention.length,
      openOccurrences: openOccurrences.length,
      signaturesPending: signaturePending.length,
      vehiclesInUse,
    };

    return {
      attention,
      distribution: {
        total: periodOccurrences.length,
        types: buildNatureStats(periodOccurrences),
      },
      errors: centerCollectionPaths
        .map(({ key, path }) =>
          collections[key].error ? `${path}: ${collections[key].error}` : null,
        )
        .filter((item): item is string => Boolean(item)),
      integrity,
      loading: centerCollectionPaths.some(({ key }) => collections[key].loading),
      managerQueue,
      occurrences: openOccurrences,
      recentRecords,
      summary,
    };
  }, [collections, periodDays]);
}

function formatStatus(value: string) {
  return value.replaceAll("_", " ");
}
