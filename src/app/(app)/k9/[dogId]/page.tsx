"use client";

import {
  Activity,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Dog,
  ExternalLink,
  FileText,
  HeartPulse,
  IdCard,
  Pencil,
  Pill,
  Plus,
  Scale,
  ShieldCheck,
  Stethoscope,
  Syringe,
  Target,
  TrendingDown,
  TrendingUp,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useAccessControl } from "@/features/access/providers/access-control-provider";
import {
  DataState,
  EntityImage,
  StatusPill,
} from "@/features/effective/components/effective-ui";
import {
  profileDate,
  profileNumber,
  profileRecordDate,
  profileText,
  useK9ProfileData,
  type ProfileRecord,
} from "@/features/effective/hooks/use-k9-profile-data";
import { specialtyLabel } from "@/features/effective/hooks/use-effective-data";
import { canônicalModality } from "@/features/effective/lib/k9-modalities";
import {
  HealthEventHub,
  type HealthHubSection,
} from "@/features/health/components/health-event-hub";
import { paths } from "@/lib/routes/paths";
import { db } from "@/lib/firebase/client";
import { doc, getDoc } from "firebase/firestore";
import { cn } from "@/lib/utils";

type TimelineItem = {
  category: "health" | "occurrence" | "training" | "weight" | "document";
  date: Date;
  detail: string;
  id: string;
  title: string;
};

type HealthTab =
  | "clínical"
  | "documents"
  | "overview"
  | "vaccines"
  | "weight";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function normalized(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function firstDate(record: Record<string, unknown> | null, keys: string[]) {
  if (!record) return null;
  for (const key of keys) {
    const parsed = profileDate(record[key]);
    if (parsed) return parsed;
  }
  return null;
}

function ageLabel(date: Date | null) {
  if (!date) return "Não informada";
  const now = new Date();
  let years = now.getFullYear() - date.getFullYear();
  let months = now.getMonth() - date.getMonth();
  if (now.getDate() < date.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return `${Math.max(0, years)} ano(s) e ${Math.max(0, months)} mes(es)`;
}

function dateLabel(date: Date | null) {
  return date ? dateFormatter.format(date) : "Não informado";
}

function eventType(record: ProfileRecord) {
  const explicit = normalized(profileText(record, ["type"]));
  if (explicit) return explicit;
  const legacy = normalized(profileText(record, ["logType"]));
  if (legacy.includes("vacin")) return "vaccination";
  if (legacy.includes("exame")) return "exam";
  return legacy || "other";
}

function eventTitle(record: ProfileRecord) {
  const type = eventType(record);
  const subtype = profileText(record, ["subtype", "title", "name"]);
  const labels: Record<string, string> = {
    antiparasitic: "Antiparasitario",
    consultation: "Consulta",
    exam: "Exame",
    medication: "Medicação",
    other: "Evento de saúde",
    surgery: "Cirurgia",
    symptom: "Sintoma",
    vaccination: "Vacina",
  };
  return subtype ? `${labels[type] ?? "Saúde"}: ${subtype}` : labels[type] ?? type;
}

function sessionTitle(record: ProfileRecord) {
  return (
    profileText(record, [
      "trainingType",
      "training_type",
      "specialty",
      "type",
      "activityType",
    ]) ?? "Sessão de treino"
  ).replaceAll("_", " ");
}

function occurrenceTitle(record: ProfileRecord) {
  return (
    profileText(record, [
      "type_name",
      "typeName",
      "nature_name",
      "nature",
      "type_code",
    ]) ?? "Ocorrência"
  );
}

function occurrenceStatus(record: ProfileRecord) {
  const status = normalized(profileText(record, ["status"]));
  if (["finalized", "finalized_with_pending", "sealed"].includes(status)) {
    return "Finalizada";
  }
  if (status === "awaiting_signatures") return "Aguardando assinaturas";
  return status ? status.replaceAll("_", " ") : "Registrada";
}

function specialtyStatus(record: ProfileRecord) {
  const status = normalized(profileText(record, ["status", "state"]));
  if (["operational", "operacional"].includes(status)) {
    return { label: "Operacional", tone: "green" as const };
  }
  if (["in_formation", "formation", "em_formacao"].includes(status)) {
    return { label: "Em formação", tone: "blue" as const };
  }
  if (["maintenance", "manutenção"].includes(status)) {
    return { label: "Manutenção", tone: "amber" as const };
  }
  return { label: "Não iniciada", tone: "slate" as const };
}

function dogStatus(dog: ProfileRecord, specialties: ProfileRecord[]) {
  const status = normalized(profileText(dog, ["status", "situação"]));
  if (!["ativo", "active", ""].includes(status)) {
    return { label: profileText(dog, ["status"]) ?? "Fora de operação", tone: "violet" as const };
  }
  if (
    specialties.some((specialty) =>
      ["operational", "operacional"].includes(
        normalized(profileText(specialty, ["status"])),
      ),
    )
  ) {
    return { label: "Operacional", tone: "green" as const };
  }
  if (
    specialties.some((specialty) =>
      ["in_formation", "formation", "em_formacao"].includes(
        normalized(profileText(specialty, ["status"])),
      ),
    )
  ) {
    return { label: "Em formação", tone: "blue" as const };
  }
  return { label: "Ativo", tone: "slate" as const };
}

function weightValue(record: ProfileRecord | null) {
  return profileNumber(record, ["weight_kg", "weightKg", "weight", "peso"]);
}

function recordUrl(record: ProfileRecord) {
  return profileText(record, [
    "url",
    "downloadUrl",
    "download_url",
    "documentUrl",
    "document_url",
    "attachmentUrl",
  ]);
}

function vaccineState(record: ProfileRecord) {
  const dueDate = firstDate(record, [
    "nextDueDate",
    "next_due_date",
    "due_at",
    "dueAt",
  ]);
  if (!dueDate) {
    return {
      dueDate: null,
      label: "Prazo não informado",
      tone: "slate" as const,
    };
  }
  const days = Math.ceil(
    (dueDate.getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000,
  );
  if (days < 0) {
    return { dueDate, label: "Vencida", tone: "amber" as const };
  }
  if (days <= 30) {
    return { dueDate, label: "Vence em breve", tone: "amber" as const };
  }
  return { dueDate, label: "Em dia", tone: "green" as const };
}

function MetricCard({
  detail,
  icon: Icon,
  label,
  tone,
  value,
}: {
  detail: string;
  icon: typeof Activity;
  label: string;
  tone: "cyan" | "green" | "blue" | "violet";
  value: string;
}) {
  const tones = {
    blue: "border-blue-300/20 bg-blue-300/10 text-blue-200",
    cyan: "border-cyan-300/20 bg-cyan-300/10 text-cyan-200",
    green: "border-emerald-300/20 bg-emerald-300/10 text-emerald-200",
    violet: "border-violet-300/20 bg-violet-300/10 text-violet-200",
  };
  return (
    <article className="rounded-2xl border border-white/9 bg-[#0b1628]/82 p-4">
      <div className="flex items-center gap-4">
        <span
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border",
            tones[tone],
          )}
        >
          <Icon className="h-6 w-6" />
        </span>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="mt-1 font-mono text-2xl font-black text-white">{value}</p>
          <p className="mt-1 text-[11px] text-slate-500">{detail}</p>
        </div>
      </div>
    </article>
  );
}

function SectionCard({
  children,
  className,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.2)]",
        className,
      )}
    >
      {title ? <h2 className="text-sm font-black text-white">{title}</h2> : null}
      {children}
    </section>
  );
}

export default function K9ProfilePage() {
  const { can } = useAccessControl();
  const params = useParams<{ dogId: string }>();
  const dogId = decodeURIComponent(params.dogId ?? "");
  const data = useK9ProfileData(dogId);
  const [conductor, setConductor] = useState<ProfileRecord | null>(null);
  const [healthTab, setHealthTab] = useState<HealthTab>("overview");
  const [healthHubOpen, setHealthHubOpen] = useState(false);
  const [healthHubSection, setHealthHubSection] =
    useState<HealthHubSection>("vaccination");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // QW-2: Fetch the single conductor document instead of subscribing to
  // the entire users collection. conductorRa is read from the dog record.
  useEffect(() => {
    const ra = profileText(data.dog, [
      "conductorRa",
      "conductor_ra",
      "handlerId",
      "handler_id",
    ]);
    if (!ra) {
      setConductor(null);
      return;
    }
    getDoc(doc(db, "users", ra)).then((snap) => {
      if (snap.exists()) {
        setConductor({ ...snap.data(), _id: snap.id, _source: "users" });
      } else {
        setConductor(null);
      }
    });
  }, [data.dog]);

  const view = useMemo(() => {
    if (!data.dog) return null;
    const dog = data.dog;
    const specialtiesByModality = new Map<string, ProfileRecord>();
    for (const specialty of data.specialties) {
      const modality =
        profileText(specialty, ["type", "modality", "name"]) ?? specialty._id;
      specialtiesByModality.set(
        canônicalModality(modality),
        specialty,
      );
    }
    for (const progress of data.trainingProgress) {
      const modality =
        profileText(progress, ["modality", "type", "name"]) ?? progress._id;
      const key = canônicalModality(modality);
      specialtiesByModality.set(key, {
        ...(specialtiesByModality.get(key) ?? {}),
        ...progress,
        _id: progress._id,
        _source: progress._source,
        modality,
      });
    }
    const specialtyRecords = Array.from(specialtiesByModality.values());
    const conductorRa = profileText(dog, [
      "conductorRa",
      "conductor_ra",
      "handlerId",
      "handler_id",
    ]);
    // conductor is now fetched via useEffect (QW-2 fix) — do not re-find here
    const weights = [...data.weightRecords].sort(
      (a, b) =>
        (profileRecordDate(b)?.getTime() ?? 0) -
        (profileRecordDate(a)?.getTime() ?? 0),
    );
    const latestWeight = weights[0] ?? null;
    const canônicalWeight = weightValue(latestWeight);
    const currentWeight = canônicalWeight ?? profileNumber(dog, ["weight"]);
    const idealMin = profileNumber(dog, ["idealWeightMin", "ideal_weight_min"]);
    const idealMax = profileNumber(dog, ["idealWeightMax", "ideal_weight_max"]);
    const weightState =
      canônicalWeight == null
        ? { label: "Sem pesagem canônica", tone: "violet" as const }
        : idealMin == null || idealMax == null
          ? { label: "Faixa ideal ausente", tone: "amber" as const }
          : canônicalWeight >= idealMin && canônicalWeight <= idealMax
            ? { label: "Dentro da faixa ideal", tone: "green" as const }
            : { label: "Fora da faixa ideal", tone: "amber" as const };

    const healthEvents = [...data.healthEvents].sort(
      (a, b) =>
        (profileRecordDate(b)?.getTime() ?? 0) -
        (profileRecordDate(a)?.getTime() ?? 0),
    );
    const vaccines = healthEvents.filter(
      (record) => eventType(record) === "vaccination",
    );
    const clínicalEvents = healthEvents.filter(
      (record) => eventType(record) !== "vaccination",
    );
    const latestVaccine = vaccines[0] ?? null;
    const vaccineDate =
      (latestVaccine && profileRecordDate(latestVaccine)) ||
      firstDate(dog, ["lastVaccineDate", "last_vaccine_date"]);
    const explicitDue =
      latestVaccine &&
      firstDate(latestVaccine, ["nextDueDate", "next_due_date"]);
    const vaccineDue = explicitDue;
    const vaccineDays = vaccineDue
      ? Math.ceil(
          (vaccineDue.getTime() - new Date().setHours(0, 0, 0, 0)) /
            86_400_000,
        )
      : null;
    const vaccineState =
      vaccineDate == null
        ? { label: "Sem registro", tone: "violet" as const }
        : vaccineDays == null
          ? { label: "Prazo não informado", tone: "slate" as const }
        : vaccineDays < 0
          ? { label: "Vencida", tone: "amber" as const }
          : vaccineDays <= 30
            ? { label: "Vence em breve", tone: "amber" as const }
            : { label: "Em dia", tone: "green" as const };

    const sessions = [...data.trainingSessions].sort(
      (a, b) =>
        (profileRecordDate(b)?.getTime() ?? 0) -
        (profileRecordDate(a)?.getTime() ?? 0),
    );
    const occurrences = [...data.occurrences].sort(
      (a, b) =>
        (profileRecordDate(b)?.getTime() ?? 0) -
        (profileRecordDate(a)?.getTime() ?? 0),
    );
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sessions30 = sessions.filter(
      (record) => (profileRecordDate(record)?.getTime() ?? 0) >= thirtyDaysAgo.getTime(),
    );
    const occurrences30 = occurrences.filter(
      (record) => (profileRecordDate(record)?.getTime() ?? 0) >= thirtyDaysAgo.getTime(),
    );
    const documents = [...data.documents].sort(
      (a, b) =>
        (profileRecordDate(b)?.getTime() ?? 0) -
        (profileRecordDate(a)?.getTime() ?? 0),
    );

    const timeline: TimelineItem[] = [
      ...healthEvents.map((record) => ({
        category: "health" as const,
        date: profileRecordDate(record) ?? new Date(0),
        detail:
          profileText(record, [
            "healthObservations",
            "professionalClinic",
            "vetName",
          ]) ?? "Registro de saúde",
        id: `health:${record._id}`,
        title: eventTitle(record),
      })),
      ...weights.map((record) => ({
        category: "weight" as const,
        date: profileRecordDate(record) ?? new Date(0),
        detail: `${weightValue(record)?.toFixed(1) ?? "--"} kg`,
        id: `weight:${record._id}`,
        title: "Pesagem registrada",
      })),
      ...sessions.map((record) => ({
        category: "training" as const,
        date: profileRecordDate(record) ?? new Date(0),
        detail:
          profileText(record, ["location", "local", "result", "status"]) ??
          "Sessão registrada",
        id: `training:${record._source}:${record._id}`,
        title: sessionTitle(record),
      })),
      ...occurrences.map((record) => ({
        category: "occurrence" as const,
        date: profileRecordDate(record) ?? new Date(0),
        detail: occurrenceStatus(record),
        id: `occurrence:${record._id}`,
        title: occurrenceTitle(record),
      })),
      ...documents.map((record) => ({
        category: "document" as const,
        date: profileRecordDate(record) ?? new Date(0),
        detail: profileText(record, ["tipo", "type", "emissor"]) ?? "Documento",
        id: `document:${record._source}:${record._id}`,
        title: profileText(record, ["nome", "name", "title"]) ?? "Documento anexado",
      })),
    ]
      .filter((item) => item.date.getTime() > 0)
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 7);

    return {
      conductor,
      conductorRa,
      canônicalWeight,
      clínicalEvents,
      currentWeight,
      dog,
      documents,
      healthEvents,
      idealMax,
      idealMin,
      latestVaccine,
      occurrences,
      occurrences30,
      sessions,
      sessions30,
      specialtyRecords,
      timeline,
      vaccines,
      vaccineDate,
      vaccineDue,
      vaccineState,
      weights,
      weightState,
    };
    // conductor is a useState variable; re-run when it arrives from getDoc
  }, [conductor, data]);

  if (data.loading && !data.dog) {
    return <DataState error={null} loading noun="o perfil do K9" />;
  }

  if (data.error && !data.dog) {
    return <DataState error={data.error} loading={false} noun="o perfil do K9" />;
  }

  if (!view) {
    return (
      <div className="space-y-5">
        <Link
          className="inline-flex items-center gap-2 text-sm font-bold text-cyan-300"
          href={paths.k9}
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao efetivo K9
        </Link>
        <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center">
          <Dog className="mx-auto h-12 w-12 text-slate-600" />
          <h1 className="mt-4 text-xl font-black text-white">K9 não localizado</h1>
          <p className="mt-2 text-sm text-slate-500">
            O documento dogs/{dogId} não existe ou não está acessível.
          </p>
        </div>
      </div>
    );
  }

  const dog = view.dog;
  const name = profileText(dog, ["name", "nome"]) ?? "K9";
  const breed = profileText(dog, ["breed", "raça"]) ?? "Raça não informada";
  const sex = profileText(dog, ["sex", "sexo"]) ?? "Sexo não informado";
  const birthDate = firstDate(dog, ["dateOfBirth", "date_of_birth"]);
  const registration =
    profileText(dog, [
      "matrícula",
      "registrationNumber",
      "registration_number",
      "rga",
    ]) ?? dogId;
  const imageUrl = profileText(dog, [
    "profileImageUrl",
    "profile_image_url",
    "photoUrl",
    "image_url",
  ]);
  const microchip = profileText(dog, ["microchip"]);
  const color = profileText(dog, ["cor", "color"]);
  const status = dogStatus(dog, view.specialtyRecords);
  const conductorName =
    profileText(view.conductor, [
      "callsign",
      "callSign",
      "nome_guerra",
      "name",
    ]) ??
    view.conductorRa ??
    "Não vinculado";
  const conductorPhoto = profileText(view.conductor, [
    "photoUrl",
    "photo_url",
    "image_url",
  ]);
  const lastExam =
    view.healthEvents.find((record) => eventType(record) === "exam") ?? null;
  const lastExamDate = lastExam ? profileRecordDate(lastExam) : null;
  const timelineIcons = {
    document: FileText,
    health: HeartPulse,
    occurrence: ShieldCheck,
    training: Target,
    weight: Scale,
  };
  const timelineTones = {
    document: "text-amber-200 bg-amber-300/10 border-amber-300/20",
    health: "text-emerald-200 bg-emerald-300/10 border-emerald-300/20",
    occurrence: "text-blue-200 bg-blue-300/10 border-blue-300/20",
    training: "text-violet-200 bg-violet-300/10 border-violet-300/20",
    weight: "text-cyan-200 bg-cyan-300/10 border-cyan-300/20",
  };
  const canEditK9 = can("k9", "edit");
  const canWriteHealth = can("health", "create") || can("health", "edit");
  const weightChartData = [...view.weights]
    .reverse()
    .map((record) => {
      const date = profileRecordDate(record);
      return {
        date: date ? dateFormatter.format(date) : "--",
        fullDate: date ? dateTimeFormatter.format(date) : "Data não informada",
        weight: weightValue(record),
      };
    })
    .filter(
      (item): item is { date: string; fullDate: string; weight: number } =>
        item.weight != null,
    );
  const weightValues = weightChartData.map((item) => item.weight);
  const weightDomainValues = [
    ...weightValues,
    ...(view.idealMin == null ? [] : [view.idealMin]),
    ...(view.idealMax == null ? [] : [view.idealMax]),
  ];
  const weightDomain =
    weightDomainValues.length > 0
      ? [
          Math.max(0, Math.floor(Math.min(...weightDomainValues) - 1)),
          Math.ceil(Math.max(...weightDomainValues) + 1),
        ]
      : [0, 40];
  const previousWeight =
    view.weights.length > 1 ? weightValue(view.weights[1]) : null;
  const weightDelta =
    view.canônicalWeight != null && previousWeight != null
      ? view.canônicalWeight - previousWeight
      : null;

  function openHealthHub(section: HealthHubSection) {
    setSaveMessage(null);
    setHealthHubSection(section);
    setHealthHubOpen(true);
  }

  return (
    <div className="space-y-5">
      {data.error ? (
        <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3 text-xs text-amber-100/80">
          O cadastro principal foi carregado, mas uma fonte complementar nao
          respondeu: {data.error}
        </div>
      ) : null}

      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <Link
            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-300"
            href={paths.k9}
          >
            <ArrowLeft className="h-4 w-4" />
            Efetivo K9
          </Link>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-white">
            Perfil do K9
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Cadastro, formação, saúde e atividade operacional em uma única visão.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEditK9 ? (
            <Link
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] px-4 py-2 text-xs font-bold text-cyan-200 transition hover:bg-cyan-300/[0.12]"
              href={`/k9/${encodeURIComponent(dogId)}/edit`}
            >
              <Pencil className="h-4 w-4" />
              Editar cadastro
            </Link>
          ) : null}
          <span className="rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2 text-xs font-semibold text-slate-400">
            Perfil consultivo
          </span>
          <StatusPill label={status.label} tone={status.tone} />
        </div>
      </div>

      <section className="relative overflow-hidden rounded-3xl border border-cyan-200/15 bg-[#0a172a]/90 p-5 shadow-[0_28px_90px_rgba(0,0,0,0.26)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,rgba(34,211,238,0.12),transparent_32%),linear-gradient(125deg,transparent_62%,rgba(59,130,246,0.08))]" />
        <div className="relative grid gap-6 lg:grid-cols-[210px_1fr]">
          <EntityImage
            alt={name}
            className="h-[210px] w-full"
            fallback={Dog}
            src={imageUrl}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-4xl font-black text-white">{name}</h2>
              <StatusPill label={status.label} tone={status.tone} />
            </div>
            <p className="mt-2 font-mono text-sm font-bold text-cyan-300">
              MAT. {registration}
            </p>
            <div className="mt-5 grid gap-4 border-y border-white/8 py-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { icon: Dog, label: "Raça", value: breed },
                { icon: IdCard, label: "Sexo", value: sex },
                { icon: CalendarDays, label: "Idade", value: ageLabel(birthDate) },
                {
                  icon: Scale,
                  label: "Peso atual",
                  value:
                    view.currentWeight == null
                      ? "Sem registro"
                      : `${view.currentWeight.toFixed(1)} kg`,
                },
              ].map((item) => (
                <div className="flex items-center gap-3" key={item.label}>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.045] text-cyan-200">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                      {item.label}
                    </p>
                    <p className="mt-1 truncate text-sm font-bold text-slate-200">
                      {item.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {view.specialtyRecords.length ? (
                view.specialtyRecords.map((specialty) => (
                  <span
                    className="rounded-lg border border-blue-300/20 bg-blue-300/8 px-3 py-1.5 text-xs font-semibold text-blue-200"
                    key={specialty._id}
                  >
                    {specialtyLabel(
                      profileText(specialty, ["modality", "type", "name"]) ??
                        specialty._id,
                    )}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-500">
                  Nenhuma especialidade ativa registrada.
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <MetricCard
          detail="status derivado de vacina e próxima dose"
          icon={Syringe}
          label="Vacinação"
          tone="green"
          value={view.vaccineState.label}
        />
        <MetricCard
          detail={view.weightState.label}
          icon={Scale}
          label="Peso canonico"
          tone="cyan"
          value={
            view.canônicalWeight == null
              ? "--"
              : `${view.canônicalWeight.toFixed(1)} kg`
          }
        />
        <MetricCard
          detail="sessões registradas nos últimos 30 dias"
          icon={Target}
          label="Treinos recentes"
          tone="violet"
          value={String(view.sessions30.length)}
        />
        <MetricCard
          detail="ocorrências vinculadas nos últimos 30 dias"
          icon={ShieldCheck}
          label="Missoes recentes"
          tone="blue"
          value={String(view.occurrences30.length)}
        />
      </section>

      {saveMessage ? (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.06] px-4 py-3 text-sm text-emerald-100">
          <span>{saveMessage}</span>
          <button
            className="text-xs font-black uppercase tracking-[0.14em] text-emerald-200"
            onClick={() => setSaveMessage(null)}
            type="button"
          >
            Fechar
          </button>
        </div>
      ) : null}

      <div className="grid gap-5 2xl:grid-cols-4">
        <SectionCard title="Resumo do K9">
          <dl className="mt-4 space-y-3 text-xs">
            {[
              ["Identificação", registration],
              ["Microchip", microchip ?? "Não informado"],
              ["Nascimento", dateLabel(birthDate)],
              ["Pelagem", color ?? "Não informada"],
              ["Situação cadastral", profileText(dog, ["status"]) ?? "Ativo"],
            ].map(([label, value]) => (
              <div className="flex justify-between gap-4" key={label}>
                <dt className="text-slate-500">{label}</dt>
                <dd className="text-right font-semibold text-slate-200">{value}</dd>
              </div>
            ))}
          </dl>
        </SectionCard>

        <SectionCard title="Saúde por evidência">
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-xs text-slate-300">
                  <Syringe className="h-4 w-4 text-emerald-300" />
                  Vacinação
                </span>
                <StatusPill
                  label={view.vaccineState.label}
                  tone={view.vaccineState.tone}
                />
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                Última: {dateLabel(view.vaccineDate)} - Próxima:{" "}
                {dateLabel(view.vaccineDue)}
              </p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-xs text-slate-300">
                  <Scale className="h-4 w-4 text-cyan-300" />
                  Faixa de peso
                </span>
                <StatusPill
                  label={view.weightState.label}
                  tone={view.weightState.tone}
                />
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                Ideal:{" "}
                {view.idealMin != null && view.idealMax != null
                  ? `${view.idealMin.toFixed(1)}-${view.idealMax.toFixed(1)} kg`
                  : "não cadastrada"}
              </p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Stethoscope className="h-4 w-4 text-blue-300" />
                Último exame
              </div>
              <p className="mt-2 text-sm font-bold text-white">
                {lastExam
                  ? profileText(lastExam, ["subtype", "title"]) ?? "Exame registrado"
                  : "Sem exame localizado"}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {dateLabel(lastExamDate)}
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Especialidades operacionais">
          <div className="mt-4 space-y-3">
            {view.specialtyRecords.length ? (
              view.specialtyRecords.map((specialty) => {
                const presentation = specialtyStatus(specialty);
                const currentModule = profileText(specialty, [
                  "current_module",
                  "currentModule",
                  "phase",
                ]);
                return (
                  <div
                    className="rounded-xl border border-white/8 bg-white/[0.025] p-3"
                    key={specialty._id}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-slate-200">
                        {specialtyLabel(
                          profileText(specialty, ["modality", "type", "name"]) ??
                            specialty._id,
                        )}
                      </p>
                      <StatusPill
                        label={presentation.label}
                        tone={presentation.tone}
                      />
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">
                      {currentModule
                        ? `Módulo/fase atual: ${currentModule}`
                        : "Estado lido do cadastro da especialidade"}
                    </p>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-500">
                Nenhuma especialidade cadastrada.
              </p>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Condutor vinculado">
          <div className="mt-4 flex items-center gap-4">
            <EntityImage
              alt={conductorName}
              className="h-20 w-20 shrink-0 rounded-full"
              fallback={UserRound}
              src={conductorPhoto}
            />
            <div className="min-w-0">
              <p className="truncate text-lg font-black text-white">
                {conductorName}
              </p>
              <p className="mt-1 font-mono text-xs text-slate-500">
                RA {view.conductorRa ?? "--"}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                {profileText(view.conductor, ["unit", "unidade"]) ??
                  "Unidade não informada"}
              </p>
            </div>
          </div>
          <div className="mt-5 rounded-xl border border-white/8 bg-white/[0.025] p-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
              Natureza do vínculo
            </p>
            <p className="mt-2 text-xs font-semibold text-slate-300">
              Condutor titular registrado em dogs.conductorRa
            </p>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        className="overflow-hidden p-0"
        title=""
      >
        <div className="border-b border-white/8 px-5 pt-5">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
                <HeartPulse className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-xl font-black text-white">
                  Prontuário clínico
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Vacinas, pesagem canônica e evidências de saúde do K9.
                </p>
              </div>
            </div>
            {canWriteHealth ? (
              <button
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-[0_0_24px_rgba(77,208,225,0.24)] transition hover:bg-cyan-200"
                onClick={() => openHealthHub("clínical")}
                type="button"
              >
                <Plus className="h-4 w-4" />
                Registrar evento
              </button>
            ) : null}
          </div>

          <div className="mt-5 flex gap-1 overflow-x-auto">
            {[
              { id: "overview" as const, label: "Resumo" },
              {
                id: "vaccines" as const,
                label: `Vacinas (${view.vaccines.length})`,
              },
              {
                id: "weight" as const,
                label: `Peso (${view.weights.length})`,
              },
              {
                id: "clínical" as const,
                label: `Atendimentos (${view.clínicalEvents.length})`,
              },
              {
                id: "documents" as const,
                label: `Documentos (${view.documents.length})`,
              },
            ].map((tab) => (
              <button
                className={cn(
                  "whitespace-nowrap border-b-2 px-4 py-3 text-sm font-black transition",
                  healthTab === tab.id
                    ? "border-cyan-300 text-cyan-100"
                    : "border-transparent text-slate-500 hover:text-slate-300",
                )}
                key={tab.id}
                onClick={() => setHealthTab(tab.id)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5">
          {healthTab === "overview" ? (
            <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="grid gap-4 sm:grid-cols-2">
                <article className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.055] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-300/10 text-emerald-200">
                      <Syringe className="h-5 w-5" />
                    </span>
                    <StatusPill
                      label={view.vaccineState.label}
                      tone={view.vaccineState.tone}
                    />
                  </div>
                  <p className="mt-4 text-xs uppercase tracking-[0.14em] text-slate-500">
                    Carteira de vacinação
                  </p>
                  <p className="mt-2 text-2xl font-black text-white">
                    {view.vaccines.length} registro(s)
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Próxima dose: {dateLabel(view.vaccineDue)}
                  </p>
                  <button
                    className="mt-4 text-xs font-black text-cyan-200"
                    onClick={() => setHealthTab("vaccines")}
                    type="button"
                  >
                    Ver carteira completa
                  </button>
                </article>

                <article className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.055] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-300/10 text-cyan-200">
                      <Scale className="h-5 w-5" />
                    </span>
                    <StatusPill
                      label={view.weightState.label}
                      tone={view.weightState.tone}
                    />
                  </div>
                  <p className="mt-4 text-xs uppercase tracking-[0.14em] text-slate-500">
                    Peso atual
                  </p>
                  <p className="mt-2 font-mono text-2xl font-black text-white">
                    {view.canônicalWeight == null
                      ? "--"
                      : `${view.canônicalWeight.toFixed(1)} kg`}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Ideal:{" "}
                    {view.idealMin != null && view.idealMax != null
                      ? `${view.idealMin.toFixed(1)} a ${view.idealMax.toFixed(1)} kg`
                      : "faixa não cadastrada"}
                  </p>
                  <button
                    className="mt-4 text-xs font-black text-cyan-200"
                    onClick={() => setHealthTab("weight")}
                    type="button"
                  >
                    Ver evolução do peso
                  </button>
                </article>
              </div>

              <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-white">
                      Últimas evidências clínicas
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Registros reais da subcoleção health_events.
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 px-3 py-1 font-mono text-xs text-slate-400">
                    {view.healthEvents.length} eventos
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  {view.healthEvents.slice(0, 4).map((event) => (
                    <article
                      className="flex items-center gap-3 rounded-xl border border-white/7 bg-white/[0.025] p-3"
                      key={event._id}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-300/10 text-emerald-200">
                        <HeartPulse className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-200">
                          {eventTitle(event)}
                        </p>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {profileText(event, [
                            "vetName",
                            "professionalClinic",
                            "healthObservations",
                          ]) ?? "Sem complemento informado"}
                        </p>
                      </div>
                      <span className="font-mono text-[10px] text-slate-600">
                        {dateLabel(profileRecordDate(event))}
                      </span>
                    </article>
                  ))}
                  {!view.healthEvents.length ? (
                    <p className="py-8 text-center text-sm text-slate-500">
                      Nenhum evento clínico localizado.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {healthTab === "vaccines" ? (
            <div>
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-lg font-black text-white">
                    Carteira de vacinação
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Aplicação, validade e responsabilidade profissional.
                  </p>
                </div>
                {canWriteHealth ? (
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.07] px-4 py-2.5 text-sm font-black text-emerald-100"
                    onClick={() => openHealthHub("vaccination")}
                    type="button"
                  >
                    <Plus className="h-4 w-4" />
                    Registrar vacina
                  </button>
                ) : null}
              </div>

              <div className="mt-5 grid gap-3">
                {view.vaccines.map((vaccine) => {
                  const state = vaccineState(vaccine);
                  return (
                    <article
                      className="grid gap-4 rounded-2xl border border-white/8 bg-white/[0.025] p-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr_auto]"
                      key={vaccine._id}
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
                          <Syringe className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="font-black text-white">
                            {profileText(vaccine, [
                              "subtype",
                              "vaccineName",
                              "vaccine_name",
                              "title",
                            ]) ?? "Vacina sem nome"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Aplicada em {dateLabel(profileRecordDate(vaccine))}
                          </p>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.14em] text-slate-600">
                          Próxima dose
                        </p>
                        <p className="mt-2 font-mono text-sm font-bold text-slate-200">
                          {dateLabel(state.dueDate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.14em] text-slate-600">
                          Responsável
                        </p>
                        <p className="mt-2 text-sm font-bold text-slate-200">
                          {profileText(vaccine, ["vetName"]) ?? "Não informado"}
                        </p>
                        <p className="mt-1 font-mono text-[10px] text-slate-500">
                          {profileText(vaccine, ["professionalCrmv"]) ??
                            profileText(vaccine, ["professionalClinic"]) ??
                            "Sem CRMV/clínica"}
                        </p>
                      </div>
                      <div className="lg:text-right">
                        <StatusPill label={state.label} tone={state.tone} />
                      </div>
                    </article>
                  );
                })}
                {!view.vaccines.length ? (
                  <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center">
                    <Syringe className="mx-auto h-10 w-10 text-slate-700" />
                    <p className="mt-3 text-sm text-slate-500">
                      Nenhuma vacina localizada no prontuário.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {healthTab === "weight" ? (
            <div>
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-lg font-black text-white">
                    Evolução do peso
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Serie canônica de dogs/{dogId}/weight_records.
                  </p>
                </div>
                {canWriteHealth ? (
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] px-4 py-2.5 text-sm font-semibold text-cyan-200 hover:bg-cyan-300/[0.12]"
                    onClick={() => openHealthHub("weight")}
                    type="button"
                  >
                    <Plus className="h-4 w-4" />
                    Registrar pesagem
                  </button>
                ) : null}
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_280px]">
                <div className="min-h-[340px] rounded-2xl border border-cyan-300/12 bg-black/15 p-4">
                  {weightChartData.length ? (
                    <ResponsiveContainer height={300} width="100%">
                      <AreaChart data={weightChartData}>
                        <defs>
                          <linearGradient id="weightFill" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.38} />
                            <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          stroke="rgba(148,163,184,0.08)"
                          vertical={false}
                        />
                        <XAxis
                          axisLine={false}
                          dataKey="date"
                          tick={{ fill: "#64748b", fontSize: 11 }}
                          tickLine={false}
                        />
                        <YAxis
                          axisLine={false}
                          domain={weightDomain}
                          tick={{ fill: "#64748b", fontSize: 11 }}
                          tickFormatter={(value) => `${value} kg`}
                          tickLine={false}
                          width={56}
                        />
                        {view.idealMin != null && view.idealMax != null ? (
                          <ReferenceArea
                            fill="#34d399"
                            fillOpacity={0.08}
                            stroke="#34d399"
                            strokeDasharray="4 4"
                            strokeOpacity={0.35}
                            y1={view.idealMin}
                            y2={view.idealMax}
                          />
                        ) : null}
                        <Tooltip
                          contentStyle={{
                            background: "#081426",
                            border: "1px solid rgba(34,211,238,0.2)",
                            borderRadius: "12px",
                            color: "#e2e8f0",
                          }}
                          formatter={(value) => [
                            `${Number(value).toFixed(1)} kg`,
                            "Peso",
                          ]}
                          labelFormatter={(_, payload) =>
                            payload[0]?.payload.fullDate ?? ""
                          }
                        />
                        <Area
                          dataKey="weight"
                          fill="url(#weightFill)"
                          stroke="#22d3ee"
                          strokeWidth={3}
                          type="monotone"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-[300px] flex-col items-center justify-center text-center">
                      <Scale className="h-10 w-10 text-slate-700" />
                      <p className="mt-3 text-sm text-slate-500">
                        Nenhuma pesagem canônica localizada.
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                  <article className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                    <p className="text-xs text-slate-500">Peso atual</p>
                    <p className="mt-2 font-mono text-2xl font-black text-white">
                      {view.canônicalWeight == null
                        ? "--"
                        : `${view.canônicalWeight.toFixed(1)} kg`}
                    </p>
                    {weightDelta != null ? (
                      <p
                        className={cn(
                          "mt-2 flex items-center gap-1 text-xs font-bold",
                          weightDelta > 0
                            ? "text-amber-200"
                            : weightDelta < 0
                              ? "text-emerald-200"
                              : "text-slate-400",
                        )}
                      >
                        {weightDelta > 0 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : weightDelta < 0 ? (
                          <TrendingDown className="h-4 w-4" />
                        ) : null}
                        {weightDelta === 0
                          ? "Sem variação"
                          : `${weightDelta > 0 ? "+" : ""}${weightDelta.toFixed(1)} kg`}
                      </p>
                    ) : null}
                  </article>
                  <article className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                    <p className="text-xs text-slate-500">Faixa ideal</p>
                    <p className="mt-2 font-mono text-lg font-black text-white">
                      {view.idealMin != null && view.idealMax != null
                        ? `${view.idealMin.toFixed(1)}-${view.idealMax.toFixed(1)} kg`
                        : "Não cadastrada"}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      Parâmetro administrativo do cadastro.
                    </p>
                  </article>
                  <article className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                    <p className="text-xs text-slate-500">Histórico</p>
                    <p className="mt-2 font-mono text-2xl font-black text-white">
                      {view.weights.length}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      pesagem(ns) preservada(s)
                    </p>
                  </article>
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-white/8">
                {view.weights.slice(0, 8).map((record, index) => (
                  <div
                    className="grid gap-2 border-b border-white/7 bg-white/[0.018] px-4 py-3 last:border-b-0 sm:grid-cols-[8rem_1fr_auto]"
                    key={record._id}
                  >
                    <span className="font-mono text-xs text-slate-500">
                      {dateLabel(profileRecordDate(record))}
                    </span>
                    <span className="text-sm text-slate-400">
                      {profileText(record, ["context"])?.replaceAll("_", " ") ??
                        "Contexto não informado"}
                      {index === 0 ? " - registro atual" : ""}
                    </span>
                    <span className="font-mono text-sm font-black text-white">
                      {weightValue(record)?.toFixed(1) ?? "--"} kg
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {healthTab === "clínical" ? (
            <div>
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-lg font-black text-white">
                    Atendimentos e tratamentos
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Exames, consultas, medicações e demais eventos clínicos.
                  </p>
                </div>
                {canWriteHealth ? (
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-300/20 bg-blue-300/[0.07] px-4 py-2.5 text-sm font-black text-blue-100"
                    onClick={() => openHealthHub("clínical")}
                    type="button"
                  >
                    <Plus className="h-4 w-4" />
                    Registrar atendimento
                  </button>
                ) : null}
              </div>

              <div className="mt-5 grid gap-3">
                {view.clínicalEvents.map((event) => {
                  const type = eventType(event);
                  const dueDate = firstDate(event, [
                    "nextDueDate",
                    "next_due_date",
                    "due_at",
                    "dueAt",
                  ]);
                  const attachmentUrl = recordUrl(event);
                  const EventIcon =
                    type === "medication" || type === "antiparasitic"
                      ? Pill
                      : Stethoscope;
                  return (
                    <article
                      className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"
                      key={event._id}
                    >
                      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-300/20 bg-blue-300/10 text-blue-200">
                            <EventIcon className="h-5 w-5" />
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-black text-white">
                                {eventTitle(event)}
                              </p>
                              <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                                {type.replaceAll("_", " ")}
                              </span>
                            </div>
                            <p className="mt-1 font-mono text-xs text-slate-500">
                              {dateLabel(profileRecordDate(event))}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {dueDate ? (
                            <span className="rounded-xl border border-amber-300/15 bg-amber-300/[0.055] px-3 py-2 text-xs text-amber-100">
                              Retorno:{" "}
                              <strong className="font-mono">
                                {dateLabel(dueDate)}
                              </strong>
                            </span>
                          ) : null}
                          {attachmentUrl ? (
                            <a
                              className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-300/[0.12]"
                              href={attachmentUrl}
                              rel="noreferrer"
                              target="_blank"
                            >
                              <ExternalLink className="h-4 w-4" />
                              Abrir anexo
                            </a>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 border-t border-white/7 pt-4 md:grid-cols-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-600">
                            Profissional
                          </p>
                          <p className="mt-1 text-sm font-bold text-slate-300">
                            {profileText(event, ["vetName"]) ?? "Não informado"}
                          </p>
                          <p className="mt-1 font-mono text-[10px] text-slate-500">
                            {profileText(event, ["professionalCrmv"]) ??
                              "CRMV não informado"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-600">
                            Clínica / unidade
                          </p>
                          <p className="mt-1 text-sm font-bold text-slate-300">
                            {profileText(event, ["professionalClinic"]) ??
                              "Não informada"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-600">
                            Observações
                          </p>
                          <p className="mt-1 text-sm leading-5 text-slate-400">
                            {profileText(event, ["healthObservations"]) ??
                              "Nenhuma observação registrada."}
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                })}
                {!view.clínicalEvents.length ? (
                  <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center">
                    <Stethoscope className="mx-auto h-10 w-10 text-slate-700" />
                    <p className="mt-3 text-sm text-slate-500">
                      Nenhum atendimento clínico localizado.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {healthTab === "documents" ? (
            <div>
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-lg font-black text-white">
                    Laudos e documentos
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Arquivos preservados no prontuário e fontes legadas.
                  </p>
                </div>
                {canWriteHealth ? (
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300/20 bg-amber-300/[0.07] px-4 py-2.5 text-sm font-black text-amber-100"
                    onClick={() => openHealthHub("document")}
                    type="button"
                  >
                    <Plus className="h-4 w-4" />
                    Anexar documento
                  </button>
                ) : null}
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {view.documents.map((document) => {
                  const url = recordUrl(document);
                  return (
                    <article
                      className="flex min-h-36 flex-col justify-between rounded-2xl border border-white/8 bg-white/[0.025] p-4"
                      key={`${document._source}:${document._id}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-300/10 text-amber-200">
                          <FileText className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="break-words font-black text-white">
                            {profileText(document, [
                              "nome",
                              "name",
                              "title",
                              "fileName",
                            ]) ?? "Documento sem nome"}
                          </p>
                          <p className="mt-1 text-xs capitalize text-slate-500">
                            {profileText(document, [
                              "tipo",
                              "type",
                              "category",
                            ]) ?? "documento"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-5 flex items-end justify-between gap-3 border-t border-white/7 pt-3">
                        <div>
                          <p className="text-xs text-slate-500">
                            {profileText(document, ["emissor", "issuer"]) ??
                              "Emissor não informado"}
                          </p>
                          <p className="mt-1 font-mono text-[10px] text-slate-600">
                            {dateLabel(profileRecordDate(document))}
                          </p>
                        </div>
                        {url ? (
                          <a
                            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-300/[0.12]"
                            href={url}
                            rel="noreferrer"
                            target="_blank"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Abrir
                          </a>
                        ) : (
                          <span className="text-xs font-bold text-slate-600">
                            Sem arquivo
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })}
                {!view.documents.length ? (
                  <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center md:col-span-2">
                    <FileText className="mx-auto h-10 w-10 text-slate-700" />
                    <p className="mt-3 text-sm text-slate-500">
                      Nenhum laudo ou documento localizado.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </SectionCard>

      <div className="grid gap-5 2xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard title="Treinos recentes">
          <div className="mt-4 grid gap-3">
            {view.sessions.slice(0, 6).map((session) => (
              <article
                className="grid gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-4 md:grid-cols-[9rem_1fr_auto]"
                key={`${session._source}:${session._id}`}
              >
                <div>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                    Data
                  </p>
                  <p className="mt-1 font-mono text-xs text-slate-300">
                    {dateLabel(profileRecordDate(session))}
                  </p>
                </div>
                <div>
                  <p className="font-bold capitalize text-white">
                    {sessionTitle(session)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {profileText(session, ["location", "local"]) ??
                      "Local não informado"}
                  </p>
                </div>
                <div className="md:text-right">
                  <p className="text-xs font-bold capitalize text-cyan-100">
                    {profileText(session, ["result", "status", "phase"]) ??
                      "Registrado"}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-slate-500">
                    {profileText(session, [
                      "handlerId",
                      "handler_id",
                      "conductor",
                      "conductor_ra",
                    ]) ?? "--"}
                  </p>
                </div>
              </article>
            ))}
            {!view.sessions.length ? (
              <p className="py-8 text-center text-sm text-slate-500">
                Nenhuma sessão de treino localizada.
              </p>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard title="Linha do tempo recente">
          <div className="relative mt-4 space-y-4 before:absolute before:bottom-3 before:left-[17px] before:top-3 before:w-px before:bg-cyan-300/18">
            {view.timeline.map((item) => {
              const Icon = timelineIcons[item.category];
              return (
                <div className="relative flex gap-3" key={item.id}>
                  <span
                    className={cn(
                      "z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                      timelineTones[item.category],
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1 border-b border-white/7 pb-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-bold text-slate-200">{item.title}</p>
                      <span className="font-mono text-[10px] text-slate-600">
                        {dateTimeFormatter.format(item.date)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs capitalize text-slate-500">
                      {item.detail}
                    </p>
                  </div>
                </div>
              );
            })}
            {!view.timeline.length ? (
              <p className="pl-12 text-sm text-slate-500">
                Nenhum evento recente localizado.
              </p>
            ) : null}
          </div>
        </SectionCard>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/8 bg-[#0b1628]/70 p-4">
          <p className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <ClipboardCheck className="h-4 w-4 text-cyan-300" />
            Registros consolidados
          </p>
          <p className="mt-3 font-mono text-2xl font-black text-white">
            {data.healthEvents.length +
              data.weightRecords.length +
              data.trainingSessions.length +
              data.occurrences.length}
          </p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-[#0b1628]/70 p-4">
          <p className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <FileText className="h-4 w-4 text-amber-300" />
            Documentos
          </p>
          <p className="mt-3 font-mono text-2xl font-black text-white">
            {data.documents.length}
          </p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-[#0b1628]/70 p-4">
          <p className="flex items-center gap-2 text-xs font-bold text-slate-300">
            {view.vaccineState.tone === "green" &&
            view.weightState.tone === "green" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
            ) : (
              <CircleAlert className="h-4 w-4 text-amber-300" />
            )}
            Evidência administrativa
          </p>
          <p className="mt-3 text-sm font-bold text-white">
            {view.vaccineState.tone === "green" &&
            view.weightState.tone === "green"
              ? "Vacina e peso em conformidade"
              : "Há dados de saúde a revisar"}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Indicador administrativo; não substitui avaliação veterinária.
          </p>
        </div>
      </section>

      <HealthEventHub
        dogs={[{ dogId, dogName: name }]}
        initialDogId={dogId}
        initialSection={healthHubSection}
        key={`${dogId}:${healthHubSection}`}
        onClose={() => setHealthHubOpen(false)}
        onSaved={setSaveMessage}
        open={healthHubOpen}
      />
    </div>
  );
}
