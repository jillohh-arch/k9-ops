"use client";

import { collection, onSnapshot, type Query } from "firebase/firestore";
import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import type { DashboardPeriodDays } from "@/features/dashboard/providers/dashboard-period-provider";
import { db } from "@/lib/firebase/client";

export type HealthTone =
  | "amber"
  | "blue"
  | "cyan"
  | "emerald"
  | "red"
  | "slate"
  | "violet";

type RawRecord = Record<string, unknown> & {
  _dogId?: string;
  _id: string;
  _path?: string;
};

type SourceState = {
  error: string | null;
  loading: boolean;
  records: RawRecord[];
};

export type HealthIssue = {
  detail: string;
  label: string;
  severity: "critical" | "missing" | "warning";
};

export type HealthDogSummary = {
  documentsCount: number;
  dogId: string;
  dogName: string;
  eventsCount: number;
  exam: "current" | "due" | "missing";
  idealRange: { max: number; min: number } | null;
  issues: HealthIssue[];
  latestExamAt: Date | null;
  latestVaccineAt: Date | null;
  latestVaccineDueAt: Date | null;
  latestWeightAt: Date | null;
  latestWeightKg: number | null;
  photoUrl: string | null;
  ready: boolean;
  status: string;
  vaccine: "current" | "due_soon" | "missing" | "overdue";
  weight: "in_range" | "missing" | "missing_range" | "out_of_range";
};

export type HealthEventSummary = {
  date: Date | null;
  detail: string;
  dogId: string | null;
  dogName: string;
  dueAt: Date | null;
  id: string;
  label: string;
  sourcePath: string | null;
  tone: HealthTone;
  type: string;
};

export type HealthDocumentSummary = {
  date: Date | null;
  dogId: string | null;
  dogName: string;
  id: string;
  title: string;
  type: string;
  url: string | null;
};

export type HealthData = {
  attention: HealthDogSummary[];
  documents: HealthDocumentSummary[];
  dogs: HealthDogSummary[];
  errors: string[];
  loading: boolean;
  metrics: {
    critical: number;
    documents: number;
    examsDue: number;
    incomplete: number;
    periodEvents: number;
    ready: number;
    readyPercent: number;
    total: number;
    vaccinesDueSoon: number;
    vaccinesOverdue: number;
    weightAttention: number;
  };
  recentEvents: HealthEventSummary[];
  upcoming: HealthEventSummary[];
};

const emptySource: SourceState = {
  error: null,
  loading: true,
  records: [],
};

function metadataFromPath(path: string) {
  const segments = path.split("/");
  const dogIndex = segments.indexOf("dogs");
  return {
    dogId: dogIndex >= 0 ? segments[dogIndex + 1] : undefined,
  };
}

function subscribeQuery(
  ref: Query,
  setter: Dispatch<SetStateAction<SourceState>>,
) {
  return onSnapshot(
    ref,
    (snapshot) => {
      setter({
        error: null,
        loading: false,
        records: snapshot.docs.map((item) => {
          const path = item.ref.path;
          const metadata = metadataFromPath(path);
          return {
            ...item.data(),
            _dogId: metadata.dogId,
            _id: item.id,
            _path: path,
          };
        }),
      });
    },
    (error) => {
      setter({ error: error.message, loading: false, records: [] });
    },
  );
}

function subscribeCollection(
  path: string,
  setter: Dispatch<SetStateAction<SourceState>>,
) {
  return subscribeQuery(collection(db, path), setter);
}

function subscribeManyCollections(
  definitions: Array<{ key: string; path: string }>,
  setter: Dispatch<SetStateAction<SourceState>>,
) {
  const groups = new Map<string, RawRecord[]>();
  const pending = new Set(definitions.map((definition) => definition.key));
  const errors = new Map<string, string>();

  if (definitions.length === 0) {
    setter({ error: null, loading: false, records: [] });
    return () => undefined;
  }

  const publish = () => {
    setter({
      error: errors.size ? Array.from(errors.values()).join(" | ") : null,
      loading: pending.size > 0,
      records: Array.from(groups.values()).flat(),
    });
  };

  const unsubscribes = definitions.map((definition) =>
    onSnapshot(
      collection(db, definition.path),
      (snapshot) => {
        groups.set(
          definition.key,
          snapshot.docs.map((item) => {
            const path = item.ref.path;
            const metadata = metadataFromPath(path);
            return {
              ...item.data(),
              _dogId: metadata.dogId,
              _id: item.id,
              _path: path,
            };
          }),
        );
        pending.delete(definition.key);
        errors.delete(definition.key);
        publish();
      },
      (error) => {
        pending.delete(definition.key);
        errors.set(definition.key, `${definition.path}: ${error.message}`);
        publish();
      },
    ),
  );

  return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
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

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(
    value
      .trim()
      .replace(/[^\d,.-]/g, "")
      .replace(/\.(?=\d{3}(\D|$))/g, "")
      .replace(",", "."),
  );
  return Number.isFinite(parsed) ? parsed : null;
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

function isDeleted(record: Record<string, unknown>) {
  return (
    record.deleted_at != null ||
    record.deletedAt != null ||
    record.archived_at != null ||
    booleanValue(record.deleted, false)
  );
}

function isActiveDog(record: RawRecord) {
  if (isDeleted(record)) return false;
  if (booleanValue(record.active ?? record.is_active ?? record.isActive, true) === false) {
    return false;
  }
  const status = normalized(record.status ?? record.situacao);
  return ![
    "aposentado",
    "arquivado",
    "deleted",
    "excluido",
    "inactive",
    "inativo",
    "morto",
  ].includes(status);
}

function dogName(record: RawRecord) {
  return text(record.name, record.nome, record.dogName, record.dog_name) ?? "K9";
}

function dogPhoto(record: RawRecord) {
  return text(
    record.profileImageUrl,
    record.profile_image_url,
    record.photoUrl,
    record.photo_url,
    record.image_url,
  );
}

function dogIdealWeightRange(record: RawRecord) {
  const min = numberValue(
    record.idealWeightMin ?? record.ideal_weight_min ?? record.peso_minimo,
  );
  const max = numberValue(
    record.idealWeightMax ?? record.ideal_weight_max ?? record.peso_maximo,
  );
  return min != null && max != null && min > 0 && max >= min
    ? { max, min }
    : null;
}

function dogIdentity(record: RawRecord) {
  return text(
    record.dogId,
    record.dog_id,
    record.caoId,
    record.cao_id,
    record.service_dog_id,
    record._dogId,
    record._id,
  );
}

function healthEventType(record: RawRecord) {
  const explicit = normalized(
    record.type ?? record.event_type ?? record.eventType ?? record.category,
  );
  if (explicit) return explicit;
  const legacy = normalized(record.logType ?? record.log_type ?? record.tipo);
  if (legacy.includes("vacin")) return "vaccination";
  if (legacy.includes("exame") || legacy.includes("laudo")) return "exam";
  if (legacy.includes("consulta")) return "consultation";
  if (legacy.includes("medic")) return "medication";
  if (legacy.includes("antiparasit")) return "antiparasitic";
  return legacy || "other";
}

function healthEventDate(record: RawRecord) {
  return dateValue(
    record.date ??
      record.event_date ??
      record.eventDate ??
      record.applied_at ??
      record.appliedAt ??
      record.performed_at ??
      record.performedAt ??
      record.created_at ??
      record.createdAt,
  );
}

function healthEventDueDate(record: RawRecord) {
  return dateValue(
    record.nextDueDate ??
      record.next_due_date ??
      record.due_at ??
      record.dueAt ??
      record.valid_until ??
      record.validUntil,
  );
}

function eventLabel(record: RawRecord) {
  const type = healthEventType(record);
  const title = text(
    record.subtype,
    record.title,
    record.name,
    record.nome,
    record.vaccine_name,
    record.vaccineName,
    record.exam_name,
    record.examName,
  );
  const labels: Record<string, string> = {
    antiparasitic: "Antiparasitario",
    consultation: "Consulta",
    exam: "Exame",
    medication: "Medicacao",
    other: "Evento de saude",
    surgery: "Cirurgia",
    symptom: "Sintoma",
    vaccination: "Vacina",
  };
  return title ?? labels[type] ?? type.replaceAll("_", " ");
}

function weightRecordDate(record: RawRecord) {
  return dateValue(
    record.measured_at ??
      record.measuredAt ??
      record.date ??
      record.created_at ??
      record.createdAt,
  );
}

function weightRecordValue(record: RawRecord) {
  return numberValue(
    record.weight_kg ?? record.weightKg ?? record.weight ?? record.peso,
  );
}

function documentDate(record: RawRecord) {
  return dateValue(
    record.date ??
      record.dataUpload ??
      record.uploaded_at ??
      record.uploadedAt ??
      record.created_at ??
      record.createdAt,
  );
}

function documentType(record: RawRecord) {
  return text(record.type, record.tipo, record.category, record.categoria) ?? "documento";
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function periodStart(days: DashboardPeriodDays) {
  const start = startOfToday();
  start.setDate(start.getDate() - (days - 1));
  return start;
}

function daysFromToday(date: Date) {
  return Math.ceil((date.getTime() - startOfToday().getTime()) / 86_400_000);
}

function eventTone(type: string, dueAt: Date | null): HealthTone {
  if (dueAt && daysFromToday(dueAt) < 0) return "red";
  if (dueAt && daysFromToday(dueAt) <= 30) return "amber";
  if (type === "vaccination") return "emerald";
  if (type === "exam") return "violet";
  if (type === "medication" || type === "antiparasitic") return "blue";
  return "cyan";
}

function sortDateDesc(a: Date | null, b: Date | null) {
  return (b?.getTime() ?? 0) - (a?.getTime() ?? 0);
}

export function useHealthData(periodDays: DashboardPeriodDays): HealthData {
  const [dogsState, setDogsState] = useState<SourceState>(emptySource);
  const [rootHealthLogsState, setRootHealthLogsState] =
    useState<SourceState>(emptySource);
  const [healthEventsState, setHealthEventsState] =
    useState<SourceState>(emptySource);
  const [weightRecordsState, setWeightRecordsState] =
    useState<SourceState>(emptySource);
  const [documentsState, setDocumentsState] = useState<SourceState>(emptySource);
  const [rootDocumentsState, setRootDocumentsState] =
    useState<SourceState>(emptySource);

  useEffect(() => {
    const unsubscribes = [
      subscribeCollection("dogs", setDogsState),
      subscribeCollection("health_logs", setRootHealthLogsState),
      subscribeCollection("documentos", setRootDocumentsState),
    ];
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, []);

  const activeDogIds = useMemo(
    () =>
      dogsState.records
        .filter(isActiveDog)
        .map((dog) => dog._id)
        .sort((a, b) => a.localeCompare(b)),
    [dogsState.records],
  );

  useEffect(() => {
    if (dogsState.loading) return;
    return subscribeManyCollections(
      activeDogIds.map((dogId) => ({
        key: dogId,
        path: `dogs/${dogId}/health_events`,
      })),
      setHealthEventsState,
    );
  }, [activeDogIds, dogsState.loading]);

  useEffect(() => {
    if (dogsState.loading) return;
    return subscribeManyCollections(
      activeDogIds.map((dogId) => ({
        key: dogId,
        path: `dogs/${dogId}/weight_records`,
      })),
      setWeightRecordsState,
    );
  }, [activeDogIds, dogsState.loading]);

  useEffect(() => {
    if (dogsState.loading) return;
    return subscribeManyCollections(
      activeDogIds.map((dogId) => ({
        key: dogId,
        path: `dogs/${dogId}/documents`,
      })),
      setDocumentsState,
    );
  }, [activeDogIds, dogsState.loading]);

  return useMemo(() => {
    const activeDogs = dogsState.records
      .filter(isActiveDog)
      .sort((a, b) => dogName(a).localeCompare(dogName(b), "pt-BR"));
    const events = [
      ...healthEventsState.records,
      ...rootHealthLogsState.records,
    ].filter((record) => !isDeleted(record));
    const weights = weightRecordsState.records.filter((record) => !isDeleted(record));
    const documentsRaw = [
      ...documentsState.records,
      ...rootDocumentsState.records,
    ].filter((record) => !isDeleted(record));
    const eventsByDog = new Map<string, RawRecord[]>();
    const weightsByDog = new Map<string, RawRecord[]>();
    const documentsByDog = new Map<string, RawRecord[]>();

    for (const event of events) {
      const dogId = dogIdentity(event);
      if (!dogId) continue;
      eventsByDog.set(dogId, [...(eventsByDog.get(dogId) ?? []), event]);
    }

    for (const record of weights) {
      const dogId = dogIdentity(record);
      if (!dogId) continue;
      weightsByDog.set(dogId, [...(weightsByDog.get(dogId) ?? []), record]);
    }

    for (const document of documentsRaw) {
      const dogId = dogIdentity(document);
      if (!dogId) continue;
      documentsByDog.set(dogId, [...(documentsByDog.get(dogId) ?? []), document]);
    }

    const dogs = activeDogs.map((dog): HealthDogSummary => {
      const dogId = dog._id;
      const dogEvents = eventsByDog.get(dogId) ?? [];
      const dogWeights = (weightsByDog.get(dogId) ?? [])
        .filter((record) => weightRecordDate(record) != null)
        .sort((a, b) => sortDateDesc(weightRecordDate(a), weightRecordDate(b)));
      const dogDocuments = documentsByDog.get(dogId) ?? [];
      const vaccines = dogEvents
        .filter((event) => healthEventType(event) === "vaccination")
        .map((event) => ({
          appliedAt: healthEventDate(event),
          dueAt: healthEventDueDate(event),
        }))
        .filter(
          (event): event is { appliedAt: Date; dueAt: Date | null } =>
            event.appliedAt != null,
        )
        .sort((a, b) => b.appliedAt.getTime() - a.appliedAt.getTime());
      const snapshotVaccineDate = dateValue(
        dog.lastVaccineDate ?? dog.last_vaccine_date,
      );
      const latestVaccine = vaccines[0];
      const latestVaccineDueAt = latestVaccine
        ? latestVaccine.dueAt ?? addDays(latestVaccine.appliedAt, 365)
        : snapshotVaccineDate
          ? addDays(snapshotVaccineDate, 365)
          : null;
      const vaccineDays = latestVaccineDueAt
        ? daysFromToday(latestVaccineDueAt)
        : null;
      const vaccine: HealthDogSummary["vaccine"] =
        vaccineDays == null
          ? "missing"
          : vaccineDays < 0
            ? "overdue"
            : vaccineDays <= 30
              ? "due_soon"
              : "current";

      const latestWeight = dogWeights[0];
      const latestWeightKg = latestWeight ? weightRecordValue(latestWeight) : null;
      const latestWeightAt = latestWeight ? weightRecordDate(latestWeight) : null;
      const idealRange = dogIdealWeightRange(dog);
      const weight: HealthDogSummary["weight"] =
        latestWeight == null || latestWeightKg == null || latestWeightKg <= 0
          ? "missing"
          : idealRange == null
            ? "missing_range"
            : latestWeightKg >= idealRange.min && latestWeightKg <= idealRange.max
              ? "in_range"
              : "out_of_range";

      const exams = dogEvents
        .filter((event) => healthEventType(event) === "exam")
        .map(healthEventDate)
        .filter((date): date is Date => date != null)
        .sort((a, b) => b.getTime() - a.getTime());
      const latestExamAt = exams[0] ?? null;
      const examAgeDays = latestExamAt
        ? Math.floor(
            (startOfToday().getTime() - latestExamAt.getTime()) / 86_400_000,
          )
        : null;
      const exam: HealthDogSummary["exam"] =
        examAgeDays == null
          ? "missing"
          : examAgeDays >= 180
            ? "due"
            : "current";
      const issues: HealthIssue[] = [];

      if (vaccine === "overdue") {
        issues.push({
          detail: `dose vencida ha ${Math.abs(vaccineDays ?? 0)} dia(s)`,
          label: "Vacina vencida",
          severity: "critical",
        });
      } else if (vaccine === "due_soon") {
        issues.push({
          detail: `proxima dose em ${vaccineDays ?? 0} dia(s)`,
          label: "Vacina a vencer",
          severity: "warning",
        });
      } else if (vaccine === "missing") {
        issues.push({
          detail: "nenhuma vacinacao localizada",
          label: "Sem registro de vacina",
          severity: "missing",
        });
      }

      if (weight === "out_of_range" && idealRange && latestWeightKg != null) {
        issues.push({
          detail: `${latestWeightKg.toFixed(1)} kg; faixa ${idealRange.min.toFixed(1)}-${idealRange.max.toFixed(1)} kg`,
          label: "Peso fora da faixa",
          severity: "warning",
        });
      } else if (weight === "missing") {
        issues.push({
          detail: "sem pesagem em weight_records",
          label: "Sem peso canonico",
          severity: "missing",
        });
      } else if (weight === "missing_range") {
        issues.push({
          detail: "cadastre minimo e maximo ideais no perfil K9",
          label: "Faixa ideal ausente",
          severity: "missing",
        });
      }

      if (exam === "due" && examAgeDays != null) {
        issues.push({
          detail:
            examAgeDays >= 365
              ? `ultimo exame ha ${examAgeDays} dias`
              : `revisar periodicidade; ${examAgeDays} dias`,
          label: examAgeDays >= 365 ? "Exame atrasado" : "Exame a revisar",
          severity: examAgeDays >= 365 ? "critical" : "warning",
        });
      }

      return {
        documentsCount: dogDocuments.length,
        dogId,
        dogName: dogName(dog),
        eventsCount: dogEvents.length,
        exam,
        idealRange,
        issues,
        latestExamAt,
        latestVaccineAt: latestVaccine?.appliedAt ?? snapshotVaccineDate,
        latestVaccineDueAt,
        latestWeightAt,
        latestWeightKg,
        photoUrl: dogPhoto(dog),
        ready: vaccine === "current" && weight === "in_range",
        status: text(dog.status, dog.situacao) ?? "Ativo",
        vaccine,
        weight,
      };
    });

    const severityOrder = { critical: 3, warning: 2, missing: 1 };
    const attention = dogs
      .filter((dog) => dog.issues.length > 0)
      .sort((a, b) => {
        const aSeverity = Math.max(
          ...a.issues.map((issue) => severityOrder[issue.severity]),
        );
        const bSeverity = Math.max(
          ...b.issues.map((issue) => severityOrder[issue.severity]),
        );
        return bSeverity - aSeverity || a.dogName.localeCompare(b.dogName);
      });
    const dogNameById = new Map(dogs.map((dog) => [dog.dogId, dog.dogName]));
    const eventSummaries = events
      .map((event): HealthEventSummary => {
        const type = healthEventType(event);
        const dogId = dogIdentity(event);
        const date = healthEventDate(event);
        const dueAt =
          type === "vaccination"
            ? healthEventDueDate(event) ?? (date ? addDays(date, 365) : null)
            : healthEventDueDate(event);
        return {
          date,
          detail:
            text(
              event.notes,
              event.observation,
              event.observations,
              event.healthObservations,
              event.description,
            ) ?? type.replaceAll("_", " "),
          dogId,
          dogName: dogId ? dogNameById.get(dogId) ?? dogId : "K9 nao informado",
          dueAt,
          id: event._id,
          label: eventLabel(event),
          sourcePath: event._path ?? null,
          tone: eventTone(type, dueAt),
          type,
        };
      })
      .sort((a, b) => sortDateDesc(a.date, b.date));

    const start = periodStart(periodDays);
    const upcoming = eventSummaries
      .filter((event) => event.dueAt != null)
      .sort(
        (a, b) =>
          (a.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER) -
          (b.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER),
      )
      .slice(0, 8);
    const documents = documentsRaw
      .map((document): HealthDocumentSummary => {
        const dogId = dogIdentity(document);
        return {
          date: documentDate(document),
          dogId,
          dogName: dogId ? dogNameById.get(dogId) ?? dogId : "K9 nao informado",
          id: document._id,
          title: text(document.title, document.name, document.nome) ?? "Documento",
          type: documentType(document),
          url: text(document.url, document.downloadUrl, document.download_url),
        };
      })
      .sort((a, b) => sortDateDesc(a.date, b.date));
    const ready = dogs.filter((dog) => dog.ready).length;
    const periodEvents = eventSummaries.filter(
      (event) => event.date != null && event.date >= start,
    ).length;
    const errors = [
      dogsState.error,
      rootHealthLogsState.error,
      healthEventsState.error,
      weightRecordsState.error,
      documentsState.error,
      rootDocumentsState.error,
    ].filter((item): item is string => Boolean(item));

    return {
      attention,
      documents,
      dogs,
      errors,
      loading:
        dogsState.loading ||
        rootHealthLogsState.loading ||
        healthEventsState.loading ||
        weightRecordsState.loading ||
        documentsState.loading ||
        rootDocumentsState.loading,
      metrics: {
        critical: dogs.filter((dog) =>
          dog.issues.some((issue) => issue.severity === "critical"),
        ).length,
        documents: documents.length,
        examsDue: dogs.filter((dog) => dog.exam === "due").length,
        incomplete: dogs.filter(
          (dog) =>
            dog.vaccine === "missing" ||
            dog.weight === "missing" ||
            dog.weight === "missing_range",
        ).length,
        periodEvents,
        ready,
        readyPercent: dogs.length > 0 ? Math.round((ready / dogs.length) * 100) : 0,
        total: dogs.length,
        vaccinesDueSoon: dogs.filter((dog) => dog.vaccine === "due_soon").length,
        vaccinesOverdue: dogs.filter((dog) => dog.vaccine === "overdue").length,
        weightAttention: dogs.filter((dog) => dog.weight === "out_of_range").length,
      },
      recentEvents: eventSummaries.slice(0, 10),
      upcoming,
    };
  }, [
    documentsState,
    dogsState,
    healthEventsState,
    periodDays,
    rootDocumentsState,
    rootHealthLogsState,
    weightRecordsState,
  ]);
}
