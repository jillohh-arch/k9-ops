"use client";

import Image from "next/image";
import {
  Activity,
  AlertCircle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileSignature,
  GraduationCap,
  HeartPulse,
  ListChecks,
  Scale,
  Shield,
  ShieldCheck,
  Stethoscope,
  Syringe,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  collection,
  collectionGroup,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/features/auth/providers/auth-provider";
import {
  isShiftWorkDay,
  subscribeShiftAssignments,
  subscribeShiftGroups,
  type ShiftAssignment as ShiftAssignmentType,
  type ShiftGroup as ShiftGroupType,
} from "@/features/effective/data/shift-group-service";
import {
  useDashboardPeriod,
  type DashboardPeriodDays,
} from "@/features/dashboard/providers/dashboard-period-provider";
import { db } from "@/lib/firebase/client";
import { cn } from "@/lib/utils";

const summaryCardMeta = [
  {
    collection: "dogs",
    label: "Efetivo K9",
    image: "/assets/card_k9.png",
    imageClassName: "right-0 -bottom-2 h-[154px] w-[360px]",
    tone: "cyan",
  },
  {
    collection: "users",
    label: "Efetivo Humano",
    image: "/assets/card_humano.png",
    imageClassName: "right-0 -bottom-2 h-[154px] w-[360px]",
    tone: "emerald",
  },
  {
    collection: "binomials",
    label: "Binômios",
    image: "/assets/card_binomio.png",
    imageClassName: "right-0 -bottom-2 h-[154px] w-[360px]",
    tone: "amber",
  },
  {
    collection: "vehicles",
    label: "Viaturas",
    image: "/assets/card_viatura.png",
    imageClassName: "right-0 -bottom-2 h-[154px] w-[360px]",
    tone: "violet",
  },
] as const;

type DashboardCollectionKey =
  | "activeShifts"
  | "dogs"
  | "users"
  | "vehicleCrews"
  | "vehicles";

type DashboardRecord = Record<string, unknown> & { _id: string };

type DashboardCollectionState = {
  error: string | null;
  loading: boolean;
  records: DashboardRecord[];
};

type DogHealthStatus = {
  dogId: string;
  dogName: string;
  exam: "current" | "due" | "missing";
  issues: Array<{
    detail: string;
    label: string;
    severity: "critical" | "warning" | "missing";
  }>;
  ready: boolean;
  vaccine: "current" | "due_soon" | "overdue" | "missing";
  weight: "in_range" | "out_of_range" | "missing" | "missing_range";
};

type DashboardCollections = Record<
  DashboardCollectionKey,
  DashboardCollectionState
>;

const dashboardCollectionPaths: Array<{
  key: DashboardCollectionKey;
  path: string;
}> = [
  { key: "activeShifts", path: "active_shifts" },
  { key: "dogs", path: "dogs" },
  { key: "users", path: "users" },
  { key: "vehicleCrews", path: "vehicle_crews" },
  { key: "vehicles", path: "vehicles" },
];

function emptyDashboardCollection(): DashboardCollectionState {
  return {
    error: null,
    loading: true,
    records: [],
  };
}

function createDashboardCollections(): DashboardCollections {
  return {
    activeShifts: emptyDashboardCollection(),
    dogs: emptyDashboardCollection(),
    users: emptyDashboardCollection(),
    vehicleCrews: emptyDashboardCollection(),
    vehicles: emptyDashboardCollection(),
  };
}

const drugTiles = [
  {
    label: "Maconha",
    category: "maconha",
    className: "from-emerald-400/30 to-teal-950/72",
    glyph: "ma",
  },
  {
    label: "Cocaina",
    category: "cocaina",
    className: "from-blue-400/28 to-blue-950/70",
    glyph: "co",
  },
  {
    label: "Crack",
    category: "crack",
    className: "from-violet-400/34 to-purple-950/72",
    glyph: "cr",
  },
  {
    label: "Ecstasy",
    category: "ecstasy",
    className: "from-orange-400/34 to-orange-950/72",
    glyph: "ex",
  },
  {
    label: "Outros",
    category: "outros",
    className: "from-slate-400/22 to-slate-950/72",
    glyph: "ot",
  },
];

type DrugCategory = (typeof drugTiles)[number]["category"];

type DrugStats = Record<DrugCategory, number>;

const emptyDrugStats: DrugStats = {
  maconha: 0,
  cocaina: 0,
  crack: 0,
  ecstasy: 0,
  outros: 0,
};

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function drugCategory(type: unknown): DrugCategory {
  const value = normalizeText(type);

  if (value.includes("maconha") || value.includes("cannabis")) {
    return "maconha";
  }

  if (value.includes("cocaina") || value.includes("cocaine")) {
    return "cocaina";
  }

  if (value.includes("crack")) {
    return "crack";
  }

  if (
    value.includes("ecstasy") ||
    value.includes("extasy") ||
    value.includes("mdma")
  ) {
    return "ecstasy";
  }

  return "outros";
}

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return 0;
  }

  const cleaned = value
    .trim()
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");

  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function entryWeightGrams(entry: Record<string, unknown>) {
  if (entry.weight_kg != null || entry.weightKg != null) {
    return parseNumber(entry.weight_kg ?? entry.weightKg) * 1000;
  }

  const raw =
    entry.weight_grams ??
    entry.weightGrams ??
    entry.grams ??
    entry.weight ??
    entry.quantidade ??
    entry.quantity;
  const grams = parseNumber(raw);
  const rawText = normalizeText(raw);
  const unit = normalizeText(entry.unit ?? entry.unidade);

  if (rawText.includes("kg") || unit === "kg" || unit.includes("quilo")) {
    return grams * 1000;
  }

  return grams;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>);
  }

  return [];
}

function drugEntriesFromOccurrence(data: Record<string, unknown>) {
  const details = asRecord(data.details);

  return [
    ...asArray(details?.drug_seized),
    ...asArray(details?.drugSeized),
    ...asArray(details?.drogasApreendidas),
    ...asArray(details?.drogas),
  ]
    .map(asRecord)
    .filter((entry): entry is Record<string, unknown> => Boolean(entry));
}

function formatWeight(grams: number) {
  if (grams <= 0) {
    return "--";
  }

  if (grams < 1000) {
    return `${new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: 0,
    }).format(grams)} g`;
  }

  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(grams / 1000)} kg`;
}

function formatPercent(value: number, total: number) {
  if (total <= 0) {
    return "--";
  }

  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format((value / total) * 100)}%`;
}

function formatCount(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 0,
  }).format(value);
}

function parseBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = normalizeText(value);
    if (["1", "ativo", "active", "sim", "true", "yes"].includes(normalized)) {
      return true;
    }

    if (
      ["0", "false", "inativo", "inactive", "nao", "no"].includes(normalized)
    ) {
      return false;
    }
  }

  return null;
}

function hasValue(value: unknown) {
  return value != null && String(value).trim().length > 0;
}

function isSoftDeleted(record: Record<string, unknown>) {
  const deletedFlag = parseBoolean(
    record.deleted ?? record.is_deleted ?? record.isDeleted ?? record.archived,
  );

  return (
    deletedFlag === true ||
    hasValue(record.deleted_at) ||
    hasValue(record.deletedAt) ||
    hasValue(record.archived_at) ||
    hasValue(record.archivedAt)
  );
}

function visibleRecords(records: DashboardRecord[]) {
  return records.filter((record) => !isSoftDeleted(record));
}

function recordText(record: Record<string, unknown>, fields: string[]) {
  for (const field of fields) {
    const value = record[field];
    if (typeof value === "string" || typeof value === "number") {
      const text = String(value).trim();
      if (text.length > 0) {
        return text;
      }
    }
  }

  return "";
}

function statusOf(record: Record<string, unknown>) {
  return normalizeText(
    record.status ?? record.current_status ?? record.state ?? record.situação,
  );
}

function dateValue(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

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

function occurrenceDate(record: Record<string, unknown>) {
  return dateValue(
    record.started_at ??
      record.startedAt ??
      record.created_at ??
      record.createdAt,
  );
}

function periodStart(days: DashboardPeriodDays) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start;
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

function dogIdentity(record: Record<string, unknown>) {
  return recordText(record, ["dogId", "dog_id", "_dogId", "_id"]);
}

function dogName(record: Record<string, unknown>) {
  return recordText(record, ["name", "nome", "dogName", "dog_name"]) || "K9";
}

function healthEventType(record: Record<string, unknown>) {
  const explicitType = normalizeText(record.type);
  if (explicitType) {
    return explicitType;
  }

  const legacy = normalizeText(record.logType);
  if (legacy.includes("vacin")) {
    return "vaccination";
  }
  if (legacy.includes("exame")) {
    return "exam";
  }

  return legacy;
}

function healthEventDate(record: Record<string, unknown>) {
  return dateValue(
    record.date ??
      record.event_date ??
      record.eventDate ??
      record.created_at ??
      record.createdAt,
  );
}

function healthEventDueDate(record: Record<string, unknown>) {
  return dateValue(record.nextDueDate ?? record.next_due_date);
}

function weightRecordDate(record: Record<string, unknown>) {
  return dateValue(
    record.measured_at ??
      record.measuredAt ??
      record.created_at ??
      record.createdAt,
  );
}

function weightRecordValue(record: Record<string, unknown>) {
  return parseNumber(
    record.weight_kg ?? record.weightKg ?? record.weight ?? record.peso,
  );
}

function dogIdealWeightRange(record: Record<string, unknown>) {
  const min = parseNumber(
    record.idealWeightMin ?? record.ideal_weight_min ?? record.peso_mínimo,
  );
  const max = parseNumber(
    record.idealWeightMax ?? record.ideal_weight_max ?? record.peso_máximo,
  );

  return min > 0 && max >= min ? { max, min } : null;
}

function daysFromToday(date: Date) {
  const difference = date.getTime() - startOfToday().getTime();
  return Math.ceil(difference / 86_400_000);
}

function occurrenceNature(record: Record<string, unknown>) {
  return (
    recordText(record, [
      "type_name",
      "typeName",
      "nature_name",
      "nature",
      "natureza",
      "type_code",
    ]) || "Não informada"
  );
}

function hasAuditAction(
  record: Record<string, unknown>,
  expectedAction: string,
) {
  const normalizedExpected = normalizeText(expectedAction);

  return asArray(record.audit_trail).some((rawEntry) => {
    const entry = asRecord(rawEntry);
    return entry != null && normalizeText(entry.action) === normalizedExpected;
  });
}

function dashboardDateLabel() {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

function isActiveRecord(record: Record<string, unknown>) {
  if (isSoftDeleted(record)) {
    return false;
  }

  const active = parseBoolean(
    record.active ?? record.is_active ?? record.isActive,
  );
  if (active === false) {
    return false;
  }

  const status = statusOf(record);
  if (!status) {
    return true;
  }

  return ![
    "aposentado",
    "arquivado",
    "deleted",
    "encerrado",
    "ended",
    "excluido",
    "finalizado",
    "inactive",
    "inativo",
    "licenca",
  ].includes(status);
}

function isK9Instructor(record: Record<string, unknown>) {
  const roles = asArray(record.roles).map(normalizeText);

  return (
    record.is_k9_instructor === true ||
    record.training_instructor === true ||
    normalizeText(record.training_role) === "instrutor_k9" ||
    normalizeText(record.role) === "instrutor_k9" ||
    roles.includes("instrutor_k9")
  );
}

function isActiveShift(record: Record<string, unknown>) {
  if (isSoftDeleted(record)) {
    return false;
  }

  const status = statusOf(record);
  if (status) {
    return ["active", "ativo", "em_andamento"].includes(status);
  }

  return (
    parseBoolean(record.active) !== false &&
    !hasValue(record.endedAt) &&
    !hasValue(record.ended_at)
  );
}

function isActiveVehicleCrew(record: Record<string, unknown>) {
  if (isSoftDeleted(record)) {
    return false;
  }

  const status = statusOf(record);
  if (status) {
    return ["active", "ativo", "titular"].includes(status);
  }

  return parseBoolean(record.active) === true && !hasValue(record.ended_at);
}

function hasDogAndHandler(record: Record<string, unknown>) {
  return (
    hasValue(record.dogId ?? record.service_dog_id) &&
    hasValue(record.handlerId ?? record.titular_handler_id ?? record.handler_id)
  );
}

function vehicleIdentity(record: Record<string, unknown>) {
  return recordText(record, [
    "vehicle_id",
    "vehicleId",
    "vehicle_prefix",
    "vehiclePrefix",
    "prefix",
    "vehicle_label",
    "label",
  ]);
}

function toneClasses(tone: string) {
  const tones: Record<string, string> = {
    amber: "border-amber-300/25 bg-amber-300/10 text-amber-200",
    blue: "border-blue-300/25 bg-blue-300/10 text-blue-200",
    cyan: "border-cyan-300/25 bg-cyan-300/10 text-cyan-200",
    emerald: "border-emerald-300/25 bg-emerald-300/10 text-emerald-200",
    red: "border-red-300/25 bg-red-300/10 text-red-200",
    violet: "border-violet-300/25 bg-violet-300/10 text-violet-200",
  };

  return tones[tone] ?? tones.cyan;
}

// ─── Profile Detection ─────────────────────────────────────────────────────────

type UserProfile = "operador" | "instrutor" | "gestor" | "admin";

function detectUserProfile(profile: {
  isK9Instructor?: boolean;
  roles?: string[];
  claims?: Record<string, unknown>;
}): UserProfile {
  const roles = profile.roles ?? [];
  const claims = profile.claims ?? {};
  const isInstructor = profile.isK9Instructor === true || roles.includes("instrutor_k9") || claims.instrutor_k9 === true;
  const isAdmin = roles.includes("admin") || roles.includes("administrador") || claims.admin === true;
  const isGestor = roles.some((r) => ["gestor", "comando", "subinspetor", "inspetor", "coordenador"].includes(r));

  if (isAdmin) return "admin";
  if (isGestor) return "gestor";
  if (isInstructor) return "instrutor";
  return "operador";
}

function ProfileBadge({ profile }: { profile: UserProfile }) {
  const config = {
    operador: { label: "Operador K9", tone: "blue" as const, icon: Users },
    instrutor: { label: "Instrutor K9", tone: "cyan" as const, icon: GraduationCap },
    gestor: { label: "Gestor / Comando", tone: "amber" as const, icon: BarChart3 },
    admin: { label: "Administrador", tone: "violet" as const, icon: Shield },
  }[profile];

  const Icon = config.icon;

  return (
    <div className={cn("inline-flex items-center gap-2 rounded-xl border px-3 py-1.5", toneClasses(config.tone))}>
      <Icon className="h-4 w-4" />
      <span className="text-xs font-semibold">{config.label}</span>
    </div>
  );
}

function DashboardGlyph({
  glyph,
  tone = "cyan",
  className,
}: {
  glyph: string;
  tone?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border font-mono text-[11px] font-black uppercase tracking-[0.14em] shadow-[inset_0_0_22px_rgba(255,255,255,0.04)]",
        toneClasses(tone),
        className,
      )}
    >
      <span className="absolute inset-2 rounded-xl border border-current/18" />
      <span className="absolute -right-3 -top-3 h-8 w-8 rounded-full bg-current/10 blur-md" />
      <span className="relative">{glyph}</span>
    </span>
  );
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const { periodDays, periodLabel } = useDashboardPeriod();
  const warName = profile?.displayName?.trim() || "Operador";
  const userProfile = detectUserProfile({
    isK9Instructor: profile?.isK9Instructor,
    roles: profile?.roles,
    claims: profile?.claims,
  });
  const [occurrences, setOccurrences] = useState<DashboardCollectionState>(
    () => emptyDashboardCollection(),
  );
  const [notifications, setNotifications] = useState<DashboardCollectionState>(
    () => emptyDashboardCollection(),
  );
  const [promotionRequests, setPromotionRequests] =
    useState<DashboardCollectionState>(() => emptyDashboardCollection());
  const [healthEvents, setHealthEvents] = useState<DashboardCollectionState>(
    () => emptyDashboardCollection(),
  );
  const [weightRecords, setWeightRecords] =
    useState<DashboardCollectionState>(() => emptyDashboardCollection());
  const [dashboardCollections, setDashboardCollections] =
    useState<DashboardCollections>(() => createDashboardCollections());
  const [shiftGroups, setShiftGroups] = useState<ShiftGroupType[]>([]);
  const [shiftAssignments, setShiftAssignments] = useState<ShiftAssignmentType[]>([]);

  useEffect(() => {
    const unsubscribes = dashboardCollectionPaths.map(({ key, path }) =>
      onSnapshot(
        collection(db, path),
        (snapshot) => {
          const records = snapshot.docs.map((documentSnapshot) => ({
            ...documentSnapshot.data(),
            _id: documentSnapshot.id,
          }));

          setDashboardCollections((current) => ({
            ...current,
            [key]: {
              error: null,
              loading: false,
              records,
            },
          }));
        },
        (error) => {
          setDashboardCollections((current) => ({
            ...current,
            [key]: {
              ...current[key],
              error: error.message,
              loading: false,
            },
          }));
        },
      ),
    );

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  useEffect(() => {
    const unsubGroups = subscribeShiftGroups(setShiftGroups);
    const unsubAssignments = subscribeShiftAssignments(setShiftAssignments);
    return () => {
      unsubGroups();
      unsubAssignments();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "occurrences"),
      (snapshot) => {
        const records = snapshot.docs.map((documentSnapshot) => ({
          ...documentSnapshot.data(),
          _id: documentSnapshot.id,
        }));

        setOccurrences({
          error: null,
          loading: false,
          records,
        });
      },
      (error) => {
        setOccurrences((current) => ({
          ...current,
          error: error.message,
          loading: false,
        }));
      },
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (dashboardCollections.dogs.loading) {
      return;
    }

    const dogIds = visibleRecords(dashboardCollections.dogs.records)
      .filter(isActiveRecord)
      .map(dogIdentity)
      .filter(Boolean);

    if (dogIds.length === 0) {
      const emptyStateTimer = window.setTimeout(() => {
        setHealthEvents({ error: null, loading: false, records: [] });
        setWeightRecords({ error: null, loading: false, records: [] });
      }, 0);
      return () => window.clearTimeout(emptyStateTimer);
    }

    // QW-6: Replaced N+1 (2 listeners per dog) with 2 collectionGroup queries.
    // 2 listeners regardless of dog count vs. 2*N listeners previously.
    // Filter by dogId in memory using a Set for O(1) lookups.
    const dogIdSet = new Set(dogIds);
    const healthByDog = new Map<string, DashboardRecord[]>();
    const weightsByDog = new Map<string, DashboardRecord[]>();
    let healthError: string | null = null;
    let weightError: string | null = null;

    const updateHealth = () =>
      setHealthEvents({
        error: healthError,
        loading: false,
        records: Array.from(healthByDog.values()).flat(),
      });
    const updateWeight = () =>
      setWeightRecords({
        error: weightError,
        loading: false,
        records: Array.from(weightsByDog.values()).flat(),
      });

    const unsubHealth = onSnapshot(
      collectionGroup(db, "health_events"),
      (snapshot) => {
        healthByDog.clear();
        for (const docSnap of snapshot.docs) {
          const dogId = dogIdentity(docSnap.data());
          if (dogId && dogIdSet.has(dogId)) {
            healthByDog.set(dogId, [
              ...(healthByDog.get(dogId) ?? []),
              { ...docSnap.data(), _dogId: dogId, _id: docSnap.id },
            ]);
          }
        }
        healthError = null;
        updateHealth();
      },
      (error) => {
        healthError = error.message;
        updateHealth();
      },
    );

    const unsubWeight = onSnapshot(
      collectionGroup(db, "weight_records"),
      (snapshot) => {
        weightsByDog.clear();
        for (const docSnap of snapshot.docs) {
          const dogId = dogIdentity(docSnap.data());
          if (dogId && dogIdSet.has(dogId)) {
            weightsByDog.set(dogId, [
              ...(weightsByDog.get(dogId) ?? []),
              { ...docSnap.data(), _dogId: dogId, _id: docSnap.id },
            ]);
          }
        }
        weightError = null;
        updateWeight();
      },
      (error) => {
        weightError = error.message;
        updateWeight();
      },
    );

    return () => {
      unsubHealth();
      unsubWeight();
    };
  }, [dashboardCollections.dogs.loading, dashboardCollections.dogs.records]);

  useEffect(() => {
    const ra = profile?.ra?.trim();
    if (!ra) {
      return;
    }

    return onSnapshot(
      collection(db, "notifications", ra, "items"),
      (snapshot) => {
        setNotifications({
          error: null,
          loading: false,
          records: snapshot.docs.map((documentSnapshot) => ({
            ...documentSnapshot.data(),
            _id: documentSnapshot.id,
          })),
        });
      },
      (error) => {
        setNotifications({
          error: error.message,
          loading: false,
          records: [],
        });
      },
    );
  }, [profile?.ra]);

  useEffect(() => {
    const ra = profile?.ra?.trim();
    if (!ra) {
      return;
    }

    const requestsQuery = profile?.isK9Instructor
      ? collection(db, "promotion_requests")
      : query(
          collection(db, "promotion_requests"),
          where("requester_ra", "==", ra),
        );

    return onSnapshot(
      requestsQuery,
      (snapshot) => {
        setPromotionRequests({
          error: null,
          loading: false,
          records: snapshot.docs.map((documentSnapshot) => ({
            ...documentSnapshot.data(),
            _id: documentSnapshot.id,
          })),
        });
      },
      (error) => {
        setPromotionRequests({
          error: error.message,
          loading: false,
          records: [],
        });
      },
    );
  }, [profile?.isK9Instructor, profile?.ra]);

  const periodOccurrences = useMemo(() => {
    const start = periodStart(periodDays);

    return visibleRecords(occurrences.records).filter((record) => {
      const date = occurrenceDate(record);
      return date != null && date >= start;
    });
  }, [occurrences.records, periodDays]);
  const drugStats = useMemo(() => {
    const nextStats: DrugStats = { ...emptyDrugStats };

    for (const occurrence of periodOccurrences) {
      for (const entry of drugEntriesFromOccurrence(occurrence)) {
        const type = entry.type ?? entry.tipo ?? entry.name ?? entry.nome;
        const category = drugCategory(type);
        nextStats[category] += entryWeightGrams(entry);
      }
    }

    return nextStats;
  }, [periodOccurrences]);
  const isLoadingDrugs = occurrences.loading;
  const drugStatsError = occurrences.error;
  const totalDrugGrams = useMemo(
    () => Object.values(drugStats).reduce((sum, value) => sum + value, 0),
    [drugStats],
  );
  const activeDrugCategories = useMemo(
    () => Object.values(drugStats).filter((value) => value > 0).length,
    [drugStats],
  );
  const visibleDrugTiles = useMemo(() => {
    if (isLoadingDrugs) {
      return drugTiles.slice(0, 3);
    }

    return drugTiles.filter((tile) => drugStats[tile.category] > 0);
  }, [drugStats, isLoadingDrugs]);
  const occurrenceMetrics = useMemo(() => {
    const finalizedStatuses = new Set(["finalized", "finalized_with_pending"]);
    const openStatuses = new Set(["in_progress", "finalizing"]);
    const natureCounts = new Map<string, number>();

    for (const occurrence of periodOccurrences) {
      const nature = occurrenceNature(occurrence);
      natureCounts.set(nature, (natureCounts.get(nature) ?? 0) + 1);
    }

    const natures = Array.from(natureCounts.entries())
      .map(([label, value]) => ({
        label,
        value,
        percent:
          periodOccurrences.length > 0
            ? (value / periodOccurrences.length) * 100
            : 0,
      }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
      .slice(0, 4);

    return {
      awaitingSignatures: periodOccurrences.filter(
        (occurrence) => statusOf(occurrence) === "awaiting_signatures",
      ).length,
      finalized: periodOccurrences.filter((occurrence) =>
        finalizedStatuses.has(statusOf(occurrence)),
      ).length,
      natures,
      open: periodOccurrences.filter((occurrence) =>
        openStatuses.has(statusOf(occurrence)),
      ).length,
      total: periodOccurrences.length,
    };
  }, [periodOccurrences]);
  const pendingMetrics = useMemo(() => {
    const allOccurrences = visibleRecords(occurrences.records);
    const awaitingSignatureOccurrences = allOccurrences.filter(
      (occurrence) => statusOf(occurrence) === "awaiting_signatures",
    );
    const finalizingOccurrences = allOccurrences.filter(
      (occurrence) => statusOf(occurrence) === "finalizing",
    );
    const finalizedWithPending = allOccurrences.filter(
      (occurrence) => statusOf(occurrence) === "finalized_with_pending",
    );
    const personalActions = visibleRecords(notifications.records).filter(
      (notification) =>
        parseBoolean(notification.action_required) === true &&
        !hasValue(notification.resolved_at) &&
        !hasValue(notification.resolvedAt) &&
        !hasValue(notification.archived_at),
    );
    const pendingPromotions = visibleRecords(promotionRequests.records).filter(
      (request) => statusOf(request) === "pending",
    );

    return {
      awaitingSignatureOccurrences: awaitingSignatureOccurrences.length,
      finalizedWithPending: finalizedWithPending.length,
      finalizingOccurrences: finalizingOccurrences.length,
      pendingPromotions: pendingPromotions.length,
      personalActions: personalActions.length,
    };
  }, [
    notifications.records,
    occurrences.records,
    promotionRequests.records,
  ]);
  const integrityMetrics = useMemo(() => {
    const allOccurrences = visibleRecords(occurrences.records);
    const finalized = allOccurrences.filter((occurrence) =>
      ["finalized", "finalized_with_pending"].includes(statusOf(occurrence)),
    );
    const sealed = finalized.filter((occurrence) => {
      const hash = recordText(occurrence, ["integrity_hash", "hash"]);
      return hash.length === 64;
    });
    const awaitingSignatures = allOccurrences.filter(
      (occurrence) => statusOf(occurrence) === "awaiting_signatures",
    );
    const correctionsInProgress = allOccurrences.filter((occurrence) => {
      const status = statusOf(occurrence);
      return (
        ["in_progress", "finalizing"].includes(status) &&
        hasAuditAction(occurrence, "reverted_to_draft")
      );
    });
    const versions = [1, 2, 3, 4].map((version) => ({
      version,
      count: sealed.filter(
        (occurrence) =>
          Math.round(
            parseNumber(occurrence.hash_version ?? occurrence.hashVersion ?? 1),
          ) === version,
      ).length,
    }));

    return {
      awaitingSignatures: awaitingSignatures.length,
      correctionsInProgress: correctionsInProgress.length,
      coverage:
        finalized.length > 0 ? (sealed.length / finalized.length) * 100 : 0,
      finalized: finalized.length,
      sealed: sealed.length,
      versions,
    };
  }, [occurrences.records]);
  const healthMetrics = useMemo(() => {
    const activeDogs = visibleRecords(
      dashboardCollections.dogs.records,
    ).filter(isActiveRecord);
    const activeHealthEvents = visibleRecords(healthEvents.records);
    const activeWeightRecords = visibleRecords(weightRecords.records);
    const healthByDog = new Map<string, DashboardRecord[]>();
    const weightsByDog = new Map<string, DashboardRecord[]>();

    for (const event of activeHealthEvents) {
      const dogId = dogIdentity(event);
      if (!dogId) continue;
      healthByDog.set(dogId, [...(healthByDog.get(dogId) ?? []), event]);
    }

    for (const record of activeWeightRecords) {
      const dogId = dogIdentity(record);
      if (!dogId) continue;
      weightsByDog.set(dogId, [...(weightsByDog.get(dogId) ?? []), record]);
    }

    const statuses: DogHealthStatus[] = activeDogs.map((dog) => {
      const dogId = dogIdentity(dog);
      const events = healthByDog.get(dogId) ?? [];
      const vaccines = events
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
      const vaccineDueDate = latestVaccine
        ? latestVaccine.dueAt ?? addDays(latestVaccine.appliedAt, 365)
        : snapshotVaccineDate
          ? addDays(snapshotVaccineDate, 365)
          : null;
      const vaccineDays = vaccineDueDate ? daysFromToday(vaccineDueDate) : null;
      const vaccine: DogHealthStatus["vaccine"] =
        vaccineDays == null
          ? "missing"
          : vaccineDays < 0
            ? "overdue"
            : vaccineDays <= 30
              ? "due_soon"
              : "current";

      const dogWeights = [...(weightsByDog.get(dogId) ?? [])]
        .filter((record) => weightRecordDate(record) != null)
        .sort(
          (a, b) =>
            (weightRecordDate(b)?.getTime() ?? 0) -
            (weightRecordDate(a)?.getTime() ?? 0),
        );
      const latestWeight = dogWeights[0];
      const weightValue = latestWeight
        ? weightRecordValue(latestWeight)
        : null;
      const range = dogIdealWeightRange(dog);
      const weight: DogHealthStatus["weight"] =
        latestWeight == null || weightValue == null || weightValue <= 0
          ? "missing"
          : range == null
            ? "missing_range"
            : weightValue >= range.min && weightValue <= range.max
              ? "in_range"
              : "out_of_range";

      const exams = events
        .filter((event) => healthEventType(event) === "exam")
        .map(healthEventDate)
        .filter((date): date is Date => date != null)
        .sort((a, b) => b.getTime() - a.getTime());
      const latestExam = exams[0];
      const examAgeDays = latestExam
        ? Math.floor(
            (startOfToday().getTime() - latestExam.getTime()) / 86_400_000,
          )
        : null;
      const exam: DogHealthStatus["exam"] =
        examAgeDays == null
          ? "missing"
          : examAgeDays >= 180
            ? "due"
            : "current";
      const issues: DogHealthStatus["issues"] = [];

      if (vaccine === "overdue") {
        issues.push({
          detail: `dose vencida há ${formatCount(Math.abs(vaccineDays ?? 0))} dia(s)`,
          label: "Vacina vencida",
          severity: "critical",
        });
      } else if (vaccine === "due_soon") {
        issues.push({
          detail: `próxima dose em ${formatCount(vaccineDays ?? 0)} dia(s)`,
          label: "Vacina a vencer",
          severity: "warning",
        });
      } else if (vaccine === "missing") {
        issues.push({
          detail: "nenhuma vacinação localizada",
          label: "Sem registro de vacina",
          severity: "missing",
        });
      }

      if (weight === "out_of_range" && range && weightValue != null) {
        issues.push({
          detail: `${weightValue.toFixed(1)} kg; faixa ${range.min.toFixed(1)}-${range.max.toFixed(1)} kg`,
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
          detail: "cadastre mínimo e máximo ideais",
          label: "Faixa ideal ausente",
          severity: "missing",
        });
      }

      if (exam === "due" && examAgeDays != null) {
        issues.push({
          detail:
            examAgeDays >= 365
              ? `último exame há ${formatCount(examAgeDays)} dias`
              : `revisar periodicidade; ${formatCount(examAgeDays)} dias`,
          label: examAgeDays >= 365 ? "Exame atrasado" : "Exame a revisar",
          severity: examAgeDays >= 365 ? "critical" : "warning",
        });
      }

      return {
        dogId,
        dogName: dogName(dog),
        exam,
        issues,
        ready: vaccine === "current" && weight === "in_range",
        vaccine,
        weight,
      };
    });
    const severityOrder = { critical: 3, warning: 2, missing: 1 };
    const attention = statuses
      .filter((status) => status.issues.length > 0)
      .sort((a, b) => {
        const aSeverity = Math.max(
          ...a.issues.map((issue) => severityOrder[issue.severity]),
        );
        const bSeverity = Math.max(
          ...b.issues.map((issue) => severityOrder[issue.severity]),
        );
        return bSeverity - aSeverity || a.dogName.localeCompare(b.dogName);
      })
      .slice(0, 4);
    const periodHealthEvents = activeHealthEvents.filter((event) => {
      const eventDate = healthEventDate(event);
      return eventDate != null && eventDate >= periodStart(periodDays);
    });

    return {
      attention,
      critical: statuses.filter((status) =>
        status.issues.some((issue) => issue.severity === "critical"),
      ).length,
      incomplete: statuses.filter(
        (status) =>
          status.vaccine === "missing" ||
          status.weight === "missing" ||
          status.weight === "missing_range",
      ).length,
      outOfRangeWeight: statuses.filter(
        (status) => status.weight === "out_of_range",
      ).length,
      periodEvents: periodHealthEvents.length,
      ready: statuses.filter((status) => status.ready).length,
      total: statuses.length,
      vaccinesDueSoon: statuses.filter(
        (status) => status.vaccine === "due_soon",
      ).length,
      vaccinesOverdue: statuses.filter(
        (status) => status.vaccine === "overdue",
      ).length,
    };
  }, [
    dashboardCollections.dogs.records,
    healthEvents.records,
    periodDays,
    weightRecords.records,
  ]);
  const summaryCards = useMemo(() => {
    const dogRecords = visibleRecords(dashboardCollections.dogs.records);
    const activeDogs = dogRecords.filter(isActiveRecord);
    const userRecords = visibleRecords(dashboardCollections.users.records);
    const activeUsers = userRecords.filter(isActiveRecord);
    const instructors = userRecords.filter(isK9Instructor);
    const activeShifts =
      dashboardCollections.activeShifts.records.filter(isActiveShift);
    const activeVehicleCrews =
      dashboardCollections.vehicleCrews.records.filter(isActiveVehicleCrew);
    const activeBinomials = activeShifts.filter(hasDogAndHandler);
    const vehicleRecords = visibleRecords(dashboardCollections.vehicles.records)
      .filter(isActiveRecord);
    const vehiclesInUse = new Set(
      [...activeShifts, ...activeVehicleCrews]
        .map(vehicleIdentity)
        .filter(Boolean),
    );

    const metrics = {
      binomials: {
        detail:
          activeVehicleCrews.length > 0
            ? `${formatCount(activeVehicleCrews.length)} guarnições em viatura`
            : `${formatCount(activeShifts.length)} turnos ativos`,
        error:
          dashboardCollections.activeShifts.error ??
          dashboardCollections.vehicleCrews.error,
        loading:
          dashboardCollections.activeShifts.loading ||
          dashboardCollections.vehicleCrews.loading,
        value:
          activeBinomials.length > 0
            ? activeBinomials.length
            : activeVehicleCrews.length,
      },
      dogs: {
        detail: `${formatCount(activeDogs.length)} ativos`,
        error: dashboardCollections.dogs.error,
        loading: dashboardCollections.dogs.loading,
        value: dogRecords.length,
      },
      users: {
        detail:
          instructors.length > 0
            ? `${formatCount(instructors.length)} instrutores K9`
            : `${formatCount(activeUsers.length)} ativos`,
        error: dashboardCollections.users.error,
        loading: dashboardCollections.users.loading,
        value: userRecords.length,
      },
      vehicles: {
        detail: `${formatCount(vehiclesInUse.size)} em uso agora`,
        error:
          dashboardCollections.vehicles.error ??
          dashboardCollections.activeShifts.error,
        loading:
          dashboardCollections.vehicles.loading ||
          dashboardCollections.activeShifts.loading,
        value:
          vehicleRecords.length > 0 ? vehicleRecords.length : vehiclesInUse.size,
      },
    };

    return summaryCardMeta.map((card) => {
      const metric = metrics[card.collection];

      return {
        ...card,
        detail: metric.error ? "falha ao carregar" : metric.detail,
        value: metric.loading
          ? "..."
          : metric.error
            ? "--"
            : formatCount(metric.value),
      };
    });
  }, [dashboardCollections]);
  const healthLoading =
    dashboardCollections.dogs.loading ||
    healthEvents.loading ||
    weightRecords.loading;
  const healthError =
    dashboardCollections.dogs.error ??
    healthEvents.error ??
    weightRecords.error;
  const readinessPercent =
    healthMetrics.total > 0
      ? Math.round((healthMetrics.ready / healthMetrics.total) * 100)
      : 0;

  const onDutyToday = useMemo(() => {
    const today = new Date();
    const activeGroups = shiftGroups.filter((g) => isShiftWorkDay(g, today));
    const users = visibleRecords(dashboardCollections.users.records);

    return activeGroups.map((group) => {
      const memberIds = shiftAssignments
        .filter((a) => a.shiftGroupId === group.id && a.active)
        .map((a) => a.userId);
      const members = memberIds
        .map((uid) => {
          const user = users.find(
            (u) =>
              u._id === uid ||
              (u as Record<string, unknown>).ra === uid ||
              (u as Record<string, unknown>).uid === uid,
          );
          return user
            ? recordText(user as Record<string, unknown>, [
                "warName",
                "war_name",
                "displayName",
                "display_name",
                "name",
                "nome",
              ]) || uid
            : uid;
        })
        .sort((a, b) => a.localeCompare(b));

      return {
        group,
        members,
        startHour: group.expectedStartHour,
        endHour: group.expectedEndHour,
      };
    });
  }, [shiftGroups, shiftAssignments, dashboardCollections.users.records]);

  return (
    <div className="space-y-5">
      <section>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white">
              Bom dia, {warName}
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Resumo administrativo da unidade K9 -{" "}
              <span className="text-cyan-300" suppressHydrationWarning>
                {dashboardDateLabel()}.
              </span>
            </p>
          </div>
          <div className="hidden lg:block">
            <ProfileBadge profile={userProfile} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {summaryCards.map((card) => (
          <article
            className="relative min-h-[154px] overflow-hidden rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5 pr-28 shadow-[0_24px_80px_rgba(0,0,0,0.26)]"
            key={card.label}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(77,208,225,0.12),transparent_34%)]" />
            <div
              className={cn(
                "pointer-events-none absolute opacity-50 mix-blend-screen [filter:drop-shadow(0_0_28px_rgba(34,211,238,0.24))] [mask-image:linear-gradient(90deg,transparent,transparent_8%,black_34%,black_92%,transparent)]",
                card.imageClassName,
              )}
            >
              <Image
                alt=""
                className="object-contain object-right-bottom"
                fill
                priority={card.collection === "dogs"}
                sizes="220px"
                src={card.image}
                unoptimized
              />
            </div>
            <div className="relative z-10">
              <p className="font-semibold text-slate-100">{card.label}</p>
              <p className="mt-7 font-mono text-4xl font-black text-white">
                {card.value}
              </p>
              <p className="mt-2 text-sm text-slate-400">{card.detail}</p>
            </div>
          </article>
        ))}
      </section>

      {onDutyToday.length > 0 && (
        <section className="rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-white">
                GCMs de serviço hoje
              </h2>
              <p className="mt-0.5 text-sm text-slate-400">
                Agentes escalados para os turnos do dia.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {onDutyToday.map(({ group, members, startHour, endHour }) => (
              <div
                key={group.id}
                className="rounded-2xl border border-cyan-200/10 bg-white/[0.03] p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-white">{group.name}</p>
                  <Badge tone={group.type === "operational" ? "cyan" : "slate"}>
                    {String(startHour).padStart(2, "0")}h–{String(endHour).padStart(2, "0")}h
                  </Badge>
                </div>
                {members.length > 0 ? (
                  <ul className="mt-3 space-y-1.5">
                    {members.map((name) => (
                      <li
                        key={name}
                        className="flex items-center gap-2 text-sm text-slate-300"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        {name}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    Nenhum agente vinculado.
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid items-start gap-4 2xl:grid-cols-[1.25fr_0.75fr]">
        <article className="rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
                  <CalendarDays className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    Ocorrências do período
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-400">
                    Volume, andamento e naturezas registradas.
                  </p>
                </div>
              </div>
            </div>

            <Badge tone="cyan">{periodLabel}</Badge>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Registradas",
                value: occurrenceMetrics.total,
                detail: "no período",
                icon: ListChecks,
                tone: "cyan",
              },
              {
                label: "Finalizadas",
                value: occurrenceMetrics.finalized,
                detail: "concluidas",
                icon: CheckCircle2,
                tone: "emerald",
              },
              {
                label: "Em andamento",
                value: occurrenceMetrics.open,
                detail: "abertas ou finalizando",
                icon: Activity,
                tone: "blue",
              },
              {
                label: "Assinaturas",
                value: occurrenceMetrics.awaitingSignatures,
                detail: "aguardando equipe",
                icon: FileSignature,
                tone: "amber",
              },
            ].map((metric) => (
              <div
                className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"
                key={metric.label}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-300">
                    {metric.label}
                  </p>
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg border",
                      toneClasses(metric.tone),
                    )}
                  >
                    <metric.icon className="h-4 w-4" />
                  </span>
                </div>
                <p className="mt-4 font-mono text-3xl font-black text-white">
                  {occurrences.loading
                    ? "..."
                    : occurrences.error
                      ? "--"
                      : formatCount(metric.value)}
                </p>
                <p className="mt-1 text-xs text-slate-500">{metric.detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 border-t border-white/8 pt-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                Principais naturezas
              </p>
              <span className="text-xs text-slate-500">
                ate 4 naturezas
              </span>
            </div>

            {occurrenceMetrics.natures.length > 0 ? (
              <div className="grid gap-x-5 gap-y-3 md:grid-cols-2">
                {occurrenceMetrics.natures.map((nature) => (
                  <div key={nature.label}>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="truncate font-semibold text-slate-300">
                        {nature.label}
                      </span>
                      <span className="font-mono text-cyan-200">
                        {formatCount(nature.value)}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-white/[0.055]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-400/80 to-blue-400/70"
                        style={{ width: `${Math.max(7, nature.percent)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-500">
                Nenhuma ocorrência registrada neste período.
              </p>
            )}
          </div>

          {occurrences.error ? (
            <p className="mt-4 text-xs text-red-200/80">
              Não foi possível carregar ocorrências: {occurrences.error}
            </p>
          ) : null}
        </article>

        <article className="rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-300/10 text-amber-200">
                  <AlertCircle className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    Pendências abertas
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-400">
                    Itens que ainda exigem acompanhamento.
                  </p>
                </div>
              </div>
            </div>
            <Badge tone={pendingMetrics.personalActions > 0 ? "yellow" : "slate"}>
              {notifications.loading
                ? "..."
                : `${formatCount(pendingMetrics.personalActions)} pessoais`}
            </Badge>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              {
                label: "Aguardando assinaturas",
                value: pendingMetrics.awaitingSignatureOccurrences,
                detail: "ocorrências em rodada de assinatura",
                icon: FileSignature,
                tone: "amber",
                loading: occurrences.loading,
                error: occurrences.error,
              },
              {
                label: "Em finalização",
                value: pendingMetrics.finalizingOccurrences,
                detail:
                  pendingMetrics.finalizedWithPending > 0
                    ? `${formatCount(pendingMetrics.finalizedWithPending)} finalizada(s) com pendencia`
                    : "rascunhos ainda não selados",
                icon: Clock3,
                tone: "blue",
                loading: occurrences.loading,
                error: occurrences.error,
              },
              {
                label: "Minhas ações",
                value: pendingMetrics.personalActions,
                detail: "convites, assinaturas e avaliações",
                icon: ListChecks,
                tone: "red",
                loading: notifications.loading,
                error: notifications.error,
              },
              {
                label: profile?.isK9Instructor
                  ? "Evoluções para avaliar"
                  : "Minhas evoluções pendentes",
                value: pendingMetrics.pendingPromotions,
                detail: profile?.isK9Instructor
                  ? "solicitações aguardando instrutor"
                  : "solicitações aguardando decisão",
                icon: GraduationCap,
                tone: "violet",
                loading: promotionRequests.loading,
                error: promotionRequests.error,
              },
            ].map((pending) => (
              <div
                className="flex items-center gap-4 rounded-2xl border border-white/8 bg-white/[0.025] p-4"
                key={pending.label}
              >
                <span
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border",
                    toneClasses(pending.tone),
                  )}
                >
                  <pending.icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-bold text-white">
                      {pending.label}
                    </p>
                    <span className="font-mono text-2xl font-black text-white">
                      {pending.loading
                        ? "..."
                        : pending.error
                          ? "--"
                          : formatCount(pending.value)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {pending.error ? "dados indisponíveis" : pending.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs leading-5 text-slate-500">
            Pendências pessoais respeitam as permissões do usuário logado.
            Indicadores de ocorrência representam toda a unidade.
          </p>
        </article>
      </section>

      <section>
        <article className="overflow-hidden rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
          <div className="flex flex-col justify-between gap-4 border-b border-white/8 p-5 md:flex-row md:items-start">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
                <HeartPulse className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-white">
                  Saúde e prontidão K9
                </h2>
                <p className="mt-0.5 text-sm text-slate-400">
                  Vacinas, pesagem canônica e exames dos caes ativos.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={healthMetrics.critical > 0 ? "red" : "green"}>
                {healthLoading
                  ? "..."
                  : healthError
                    ? "dados indisponíveis"
                    : `${formatCount(healthMetrics.critical)} críticos`}
              </Badge>
              <Badge tone="cyan">
                {healthLoading
                  ? "..."
                  : `${formatCount(healthMetrics.periodEvents)} registros em ${periodLabel.toLowerCase()}`}
              </Badge>
            </div>
          </div>

          <div className="grid 2xl:grid-cols-[0.95fr_1.05fr]">
            <div className="border-b border-white/8 p-5 2xl:border-r 2xl:border-b-0">
              <div className="rounded-2xl border border-emerald-300/15 bg-gradient-to-br from-emerald-300/[0.08] to-cyan-300/[0.025] p-5">
                <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200/70">
                      Prontos por evidência
                    </p>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="font-mono text-5xl font-black text-white">
                        {healthLoading
                          ? "..."
                          : healthError
                            ? "--"
                            : formatCount(healthMetrics.ready)}
                      </span>
                      <span className="font-mono text-lg text-slate-400">
                        / {healthLoading ? "..." : formatCount(healthMetrics.total)}
                      </span>
                    </div>
                    <p className="mt-2 max-w-md text-xs leading-5 text-slate-400">
                      Critério: vacinação vigente e último peso de
                      weight_records dentro da faixa ideal cadastrada.
                    </p>
                  </div>
                  <p className="font-mono text-3xl font-black text-emerald-300">
                    {healthLoading || healthError
                      ? "--"
                      : `${formatCount(readinessPercent)}%`}
                  </p>
                </div>
                <div className="mt-4 h-2 rounded-full bg-black/25">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300 shadow-[0_0_20px_rgba(52,211,153,0.35)]"
                    style={{ width: `${readinessPercent}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  {
                    detail: "exigem regularização",
                    icon: Syringe,
                    label: "Vacinas vencidas",
                    tone: "red",
                    value: healthMetrics.vaccinesOverdue,
                  },
                  {
                    detail: "nos próximos 30 dias",
                    icon: CalendarDays,
                    label: "Vacinas a vencer",
                    tone: "amber",
                    value: healthMetrics.vaccinesDueSoon,
                  },
                  {
                    detail: "fora do intervalo ideal",
                    icon: Scale,
                    label: "Peso em atenção",
                    tone: "blue",
                    value: healthMetrics.outOfRangeWeight,
                  },
                  {
                    detail: "vacina, peso ou faixa ausente",
                    icon: Stethoscope,
                    label: "Dados incompletos",
                    tone: "violet",
                    value: healthMetrics.incomplete,
                  },
                ].map((metric) => (
                  <div
                    className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-4"
                    key={metric.label}
                  >
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                        toneClasses(metric.tone),
                      )}
                    >
                      <metric.icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-bold text-white">
                          {metric.label}
                        </p>
                        <span className="font-mono text-2xl font-black text-white">
                          {healthLoading
                            ? "..."
                            : healthError
                              ? "--"
                              : formatCount(metric.value)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {metric.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-white">
                    K9 que exigem atenção
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Ate 4 prioridades clínicas ou lacunas de cadastro.
                  </p>
                </div>
                <Badge tone="slate">{healthMetrics.attention.length} exibidos</Badge>
              </div>

              {healthLoading ? (
                <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-500">
                  Carregando prontuários...
                </div>
              ) : healthError ? (
                <div className="mt-4 rounded-2xl border border-red-300/15 bg-red-300/[0.04] p-5 text-sm text-red-200/80">
                  Não foi possível carregar os dados de saúde: {healthError}
                </div>
              ) : healthMetrics.attention.length > 0 ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {healthMetrics.attention.map((dog) => {
                    const primary = dog.issues[0];
                    const isCritical = dog.issues.some(
                      (issue) => issue.severity === "critical",
                    );
                    const hasWarning = dog.issues.some(
                      (issue) => issue.severity === "warning",
                    );

                    return (
                      <div
                        className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"
                        key={dog.dogId}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-bold text-white">
                              {dog.dogName}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {dog.issues.length} ponto(s) para revisar
                            </p>
                          </div>
                          <Badge
                            tone={
                              isCritical
                                ? "red"
                                : hasWarning
                                  ? "yellow"
                                  : "slate"
                            }
                          >
                            {isCritical
                              ? "crítico"
                              : hasWarning
                                ? "atenção"
                                : "cadastro"}
                          </Badge>
                        </div>
                        <div className="mt-4 flex gap-3">
                          <AlertCircle
                            className={cn(
                              "mt-0.5 h-4 w-4 shrink-0",
                              isCritical
                                ? "text-red-300"
                                : hasWarning
                                  ? "text-amber-300"
                                  : "text-slate-400",
                            )}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-200">
                              {primary.label}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              {primary.detail}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.04] p-5 text-sm text-emerald-200/80">
                  Nenhuma pendência calculável nos prontuários ativos.
                </div>
              )}

              <p className="mt-4 text-xs leading-5 text-slate-500">
                A prontidão e um indicador administrativo. A avaliação clínica
                continua pertencendo ao profissional responsável.
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className="grid items-start gap-4 2xl:grid-cols-[1.35fr_0.95fr]">
        <article className="rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <h2 className="text-lg font-bold text-white">
                Drogas apreendidas por tipo
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Distribuição total de apreensões no período selecionado.
              </p>
            </div>
            <div className="min-w-[170px] rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.07] px-4 py-3 text-right shadow-[inset_0_0_24px_rgba(34,211,238,0.05),0_0_28px_rgba(34,211,238,0.06)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/60">
                Total apreendido
              </p>
              <p className="mt-1 font-mono text-3xl font-black leading-none text-cyan-300 drop-shadow-[0_0_14px_rgba(34,211,238,0.28)]">
                {isLoadingDrugs ? "..." : formatWeight(totalDrugGrams)}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                {drugStatsError
                  ? "Falha ao carregar"
                  : `${activeDrugCategories} categorias`}
              </p>
            </div>
          </div>

          {visibleDrugTiles.length > 0 ? (
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {visibleDrugTiles.map((tile) => {
                const grams = drugStats[tile.category];
                const share =
                  totalDrugGrams > 0
                    ? Math.max(8, (grams / totalDrugGrams) * 100)
                    : 0;

                return (
                  <div
                    className={cn(
                      "relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br p-4",
                      tile.className,
                    )}
                    key={tile.label}
                  >
                    <div className="relative flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {tile.label}
                        </p>
                        <p className="mt-2 font-mono text-2xl font-black text-white">
                          {isLoadingDrugs ? "..." : formatWeight(grams)}
                        </p>
                      </div>
                      <DashboardGlyph
                        className="h-9 w-9 rounded-xl bg-black/12 text-[9px] text-cyan-100/70"
                        glyph={tile.glyph}
                        tone="cyan"
                      />
                    </div>
                    <div className="relative mt-4">
                      <div className="h-2 rounded-full bg-black/25">
                        <div
                          className="h-full rounded-full bg-cyan-200/80 shadow-[0_0_18px_rgba(103,232,249,0.35)]"
                          style={{ width: `${share}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-cyan-50/70">
                        {formatPercent(grams, totalDrugGrams)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-cyan-200/16 bg-black/10 p-5 text-sm text-slate-400">
              Nenhuma apreensão de droga registrada no período.
            </div>
          )}
          {drugStatsError ? (
            <p className="mt-3 text-xs text-red-200/80">
              Não foi possível ler ocorrências: {drugStatsError}
            </p>
          ) : null}
        </article>

        <article className="rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">
                Integridade institucional
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Cobertura de selo, assinaturas e correções em curso.
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-2xl font-black text-cyan-300">
                {occurrences.loading
                  ? "..."
                  : occurrences.error
                    ? "--"
                    : `${new Intl.NumberFormat("pt-BR", {
                        maximumFractionDigits: 0,
                      }).format(integrityMetrics.coverage)}%`}
              </p>
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                cobertura de selo
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {[
              {
                label: "Ocorrências seladas",
                value: integrityMetrics.sealed,
                detail: `${formatCount(integrityMetrics.finalized)} finalizada(s)`,
                tone: "violet",
                icon: ShieldCheck,
              },
              {
                label: "Aguardando assinatura",
                value: integrityMetrics.awaitingSignatures,
                detail: "rodadas ainda abertas",
                tone: "amber",
                icon: FileSignature,
              },
              {
                label: "Correções em curso",
                value: integrityMetrics.correctionsInProgress,
                detail: "devolvidas para ajuste",
                tone: "red",
                icon: AlertCircle,
              },
            ].map((item) => (
              <div
                className={cn(
                  "rounded-2xl border bg-white/[0.035] p-5",
                  toneClasses(item.tone),
                )}
                key={item.label}
              >
                <item.icon className="h-7 w-7" />
                <p className="mt-5 font-mono text-4xl font-black text-white">
                  {occurrences.loading
                    ? "..."
                    : occurrences.error
                      ? "--"
                      : formatCount(item.value)}
                </p>
                <p className="mt-3 text-sm font-semibold text-white">
                  {item.label}
                </p>
                <p className="mt-1 text-xs text-slate-400">{item.detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 border-t border-white/8 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                  Versoes de hash aplicadas
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Presença do selo; a validação criptográfica completa ocorre no
                  verificador.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {integrityMetrics.versions.map((version) => (
                  <span
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 font-mono text-xs",
                      version.count > 0
                        ? "border-cyan-300/20 bg-cyan-300/10 text-cyan-200"
                        : "border-white/8 bg-white/[0.025] text-slate-600",
                    )}
                    key={version.version}
                  >
                    v{version.version} ·{" "}
                    {occurrences.loading
                      ? "..."
                      : formatCount(version.count)}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {occurrences.error ? (
            <p className="mt-4 text-xs text-red-200/80">
              Não foi possível carregar os indicadores de integridade:{" "}
              {occurrences.error}
            </p>
          ) : null}
        </article>
      </section>

      {/* Produtividade para Gestores e Admins */}
      {(userProfile === "gestor" || userProfile === "admin") && (
        <section>
          <article className="overflow-hidden rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
            <div className="flex items-center gap-3 border-b border-white/8 p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
                <TrendingUp className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-white">
                  Painel de Gestão
                </h2>
                <p className="mt-0.5 text-sm text-slate-400">
                  Visão executiva para comandantes e gestores
                </p>
              </div>
              <Badge tone="green" className="ml-auto">
                Gestor
              </Badge>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-3">
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4">
                <div className="flex items-center gap-2 text-emerald-300">
                  <ShieldCheck className="h-5 w-5" />
                  <p className="text-sm font-semibold">Índice de Conformidade</p>
                </div>
                <p className="mt-3 font-mono text-3xl font-black text-white">
                  {readinessPercent}%
                </p>
                <p className="mt-1 text-xs text-slate-400">prontidão operacional</p>
              </div>
              <div className="rounded-2xl border border-blue-400/20 bg-blue-400/[0.05] p-4">
                <div className="flex items-center gap-2 text-blue-300">
                  <BarChart3 className="h-5 w-5" />
                  <p className="text-sm font-semibold">Taxa de Finalização</p>
                </div>
                <p className="mt-3 font-mono text-3xl font-black text-white">
                  {occurrenceMetrics.total > 0
                    ? Math.round((occurrenceMetrics.finalized / occurrenceMetrics.total) * 100)
                    : 0}%
                </p>
                <p className="mt-1 text-xs text-slate-400">ocorrências concluídas</p>
              </div>
              <div className="rounded-2xl border border-violet-400/20 bg-violet-400/[0.05] p-4">
                <div className="flex items-center gap-2 text-violet-300">
                  <Shield className="h-5 w-5" />
                  <p className="text-sm font-semibold">Integridade</p>
                </div>
                <p className="mt-3 font-mono text-3xl font-black text-white">
                  {new Intl.NumberFormat("pt-BR", {
                    maximumFractionDigits: 0,
                  }).format(integrityMetrics.coverage)}%
                </p>
                <p className="mt-1 text-xs text-slate-400">documentos selados</p>
              </div>
            </div>
            <div className="border-t border-white/8 px-5 py-4">
              <p className="text-xs text-slate-500">
                Acesse relatórios completos em{" "}
                <a href="/reports" className="text-cyan-300 hover:underline">
                  Relatórios
                </a>{" "}
                para análises detalhadas.
              </p>
            </div>
          </article>
        </section>
      )}

    </div>
  );
}
