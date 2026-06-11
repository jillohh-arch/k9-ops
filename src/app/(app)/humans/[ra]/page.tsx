"use client";

import {
  Activity,
  CalendarDays,
  Clock3,
  Dog,
  FileText,
  GraduationCap,
  History,
  MapPin,
  Pencil,
  Plus,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import { useAccessControl } from "@/features/access/providers/access-control-provider";
import {
  HumanMovementDialog,
  HumanRecordDialog,
} from "@/features/effective/components/human-record-dialogs";
import {
  DataState,
  EntityImage,
  StatusPill,
  SummaryCard,
} from "@/features/effective/components/effective-ui";
import {
  humanRecordDate,
  humanText,
  useHumanProfileData,
  type HumanRecord,
} from "@/features/effective/hooks/use-human-profile-data";

function formatDate(date: Date | null, withTime = false) {
  if (!date) return "--";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    ...(withTime ? { timeStyle: "short" as const } : {}),
  }).format(date);
}

function eventPresentation(record: HumanRecord) {
  if (record._source === "trainings") {
    return {
      label:
        humanText(record, "trainingType", "type", "modality") ??
        "Treino registrado",
      tone: "blue" as const,
    };
  }
  if (record._source === "occurrences") {
    return {
      label:
        humanText(record, "type_name", "type_code") ?? "Ocorrencia atendida",
      tone: "violet" as const,
    };
  }
  if (record._source === "effective_movements") {
    return {
      label: humanText(record, "movement_type") ?? "Movimentacao funcional",
      tone: "amber" as const,
    };
  }
  if (record._source === "certifications") {
    return {
      label: humanText(record, "name") ?? "Certificacao registrada",
      tone: "green" as const,
    };
  }
  if (record._source === "documents") {
    return {
      label: humanText(record, "name") ?? "Documento anexado",
      tone: "slate" as const,
    };
  }
  return {
    label:
      humanText(record, "summary", "action", "status") ??
      "Atualizacao operacional",
    tone: "slate" as const,
  };
}

function Panel({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5">
      <h2 className="text-sm font-black text-white">{title}</h2>
      {children}
    </section>
  );
}

export default function HumanProfilePage() {
  const { can } = useAccessControl();
  const params = useParams<{ ra: string }>();
  const ra = decodeURIComponent(params.ra ?? "");
  const data = useHumanProfileData(ra);
  const [dialog, setDialog] = useState<
    "certification" | "document" | "movement" | null
  >(null);
  const userOptions = useMemo(
    () => [
      {
        label:
          humanText(data.user, "callsign", "nomeCompleto", "name") ?? ra,
        value: ra,
      },
    ],
    [data.user, ra],
  );

  if (data.loading || data.error || !data.user) {
    return (
      <DataState
        error={data.error ?? (!data.loading ? "Agente nao localizado." : null)}
        loading={data.loading}
        noun="o perfil humano"
      />
    );
  }

  const user = data.user;
  const callsign =
    humanText(user, "callsign", "callSign", "nome_guerra") ?? ra;
  const fullName = humanText(user, "nomeCompleto", "name", "nome");
  const photo = humanText(user, "photoUrl", "image_url", "profileImageUrl");
  const active =
    user.active !== false &&
    user.deleted_at == null &&
    user.archived_at == null;
  const recentTrainings = data.trainings
    .slice()
    .sort(
      (a, b) =>
        (humanRecordDate(b)?.getTime() ?? 0) -
        (humanRecordDate(a)?.getTime() ?? 0),
    )
    .slice(0, 5);
  const recentEvents = data.events.slice(0, 6);
  const canEditHuman = can("humans", "edit");

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
            Efetivo Humano
          </p>
          <h1 className="mt-1 text-3xl font-black text-white">
            Perfil do agente
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Cadastro, vinculos e historico operacional rastreavel.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {canEditHuman ? (
            <Link
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-300/[0.08] px-4 py-2.5 text-sm font-bold text-cyan-200"
              href={`/humans/${encodeURIComponent(ra)}/edit`}
            >
              <Pencil className="h-4 w-4" /> Editar perfil
            </Link>
          ) : null}
          <Link
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-slate-300"
            href={`/humans/${encodeURIComponent(ra)}/history`}
          >
            <History className="h-4 w-4" /> Ver historico
          </Link>
          {canEditHuman ? (
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-[#041018]"
              onClick={() => setDialog("movement")}
              type="button"
            >
              <Plus className="h-4 w-4" /> Movimentacao
            </button>
          ) : null}
        </div>
      </div>

      <section className="relative overflow-hidden rounded-3xl border border-cyan-200/15 bg-[#0a172a] p-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(34,211,238,0.13),transparent_35%)]" />
        <div className="relative flex flex-col gap-5 lg:flex-row">
          <EntityImage
            alt={callsign}
            className="h-48 w-44 shrink-0"
            fallback={UserRound}
            src={photo}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-3xl font-black text-white">{callsign}</h2>
              <StatusPill
                label={active ? humanText(user, "status") ?? "Ativo" : "Inativo"}
                tone={active ? "green" : "violet"}
              />
              {user.is_k9_instructor === true ? (
                <StatusPill label="Instrutor K9" tone="amber" />
              ) : null}
            </div>
            <p className="mt-2 text-sm text-slate-400">{fullName}</p>
            <div className="mt-6 grid gap-4 border-t border-white/8 pt-5 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["RA", ra],
                [
                  "Funcao",
                  humanText(user, "cargo", "role", "accessLevel") ?? "--",
                ],
                ["Lotacao", humanText(user, "unit", "unidade") ?? "--"],
                ["Equipe", humanText(user, "team", "equipe") ?? "--"],
                [
                  "Posto / Graduacao",
                  humanText(user, "rank", "posto", "graduacao") ?? "--",
                ],
                [
                  "Data de ingresso",
                  humanText(user, "admission_date", "admissionDate") ?? "--",
                ],
                [
                  "Jornada",
                  humanText(user, "shift_label", "shiftLabel") ?? "--",
                ],
                [
                  "Acesso",
                  humanText(user, "accessProfile", "accessLevel") ?? "--",
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                    {label}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-200">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <SummaryCard
          detail="vinculos titulares no cadastro"
          icon={Dog}
          label="K9 vinculados"
          tone="cyan"
          value={String(data.linkedDogs.length)}
        />
        <SummaryCard
          detail="registros encontrados"
          icon={Activity}
          label="Treinos"
          tone="blue"
          value={String(data.trainings.length)}
        />
        <SummaryCard
          detail="participacao principal ou equipe"
          icon={ShieldCheck}
          label="Ocorrencias"
          tone="violet"
          value={String(data.occurrences.length)}
        />
        <SummaryCard
          detail="cursos e habilitacoes"
          icon={GraduationCap}
          label="Certificacoes"
          tone="green"
          value={String(data.certifications.length)}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <Panel title="Resumo funcional">
          <div className="mt-4 space-y-3 text-sm">
            {[
              ["Telefone", humanText(user, "telefone", "phone")],
              [
                "E-mail institucional",
                humanText(user, "institutional_email"),
              ],
              ["CPF / Documento", humanText(user, "cpf", "document")],
              ["Nascimento", humanText(user, "birth_date", "birthDate")],
            ].map(([label, value]) => (
              <div className="flex justify-between gap-4" key={label}>
                <span className="text-slate-500">{label}</span>
                <span className="text-right font-medium text-slate-200">
                  {value ?? "--"}
                </span>
              </div>
            ))}
          </div>
          {humanText(user, "notes", "observacoes") ? (
            <p className="mt-5 border-t border-white/8 pt-4 text-xs leading-5 text-slate-400">
              {humanText(user, "notes", "observacoes")}
            </p>
          ) : null}
        </Panel>

        <Panel title="Escala e disponibilidade">
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.025] p-3">
              <Clock3 className="h-5 w-5 text-cyan-300" />
              <div>
                <p className="text-sm font-bold text-white">
                  {data.activeShift ? "Em turno" : "Sem turno ativo"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {data.activeShift
                    ? humanText(
                        data.activeShift,
                        "vehicle_label",
                        "vehicle_prefix",
                        "shiftId",
                      ) ?? "Turno operacional"
                    : "Disponibilidade depende da escala administrativa."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <CalendarDays className="h-4 w-4 text-cyan-300/60" />
              {humanText(user, "shift_label") ?? "Jornada nao cadastrada"}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <MapPin className="h-4 w-4 text-cyan-300/60" />
              {humanText(user, "unit") ?? "Lotacao nao cadastrada"}
            </div>
          </div>
        </Panel>

        <Panel title="K9 vinculados">
          <div className="mt-4 space-y-3">
            {data.linkedDogs.length ? (
              data.linkedDogs.map((dog) => (
                <Link
                  className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.025] p-3 transition hover:border-cyan-300/25"
                  href={`/k9/${encodeURIComponent(dog._id)}`}
                  key={dog._id}
                >
                  <EntityImage
                    alt={humanText(dog, "name", "nome") ?? dog._id}
                    className="h-14 w-14 shrink-0"
                    fallback={Dog}
                    src={humanText(
                      dog,
                      "profileImageUrl",
                      "profile_image_url",
                    )}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-cyan-200">
                      {humanText(dog, "name", "nome") ?? dog._id}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {humanText(dog, "breed", "raca") ?? "Raca nao informada"}
                    </p>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-sm text-slate-500">Nenhum K9 vinculado.</p>
            )}
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Panel title="Habilitacoes e documentos">
          {canEditHuman ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/20 px-3 py-2 text-xs font-bold text-cyan-200"
                onClick={() => setDialog("certification")}
                type="button"
              >
                <GraduationCap className="h-4 w-4" /> Nova certificacao
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-slate-300"
                onClick={() => setDialog("document")}
                type="button"
              >
                <FileText className="h-4 w-4" /> Novo documento
              </button>
            </div>
          ) : null}
          <div className="mt-4 space-y-2">
            {[...data.certifications, ...data.documents]
              .slice(0, 6)
              .map((record) => (
                <div
                  className="flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-white/[0.025] p-3"
                  key={`${record._source}-${record._id}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">
                      {humanText(record, "name") ?? "Registro sem nome"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {humanText(record, "issuer", "type") ??
                        (record._source === "documents"
                          ? "Documento"
                          : "Certificacao")}
                    </p>
                  </div>
                  <span className="font-mono text-[11px] text-slate-500">
                    {humanText(record, "expires_at") ?? "sem validade"}
                  </span>
                </div>
              ))}
            {!data.certifications.length && !data.documents.length ? (
              <p className="py-4 text-sm text-slate-500">
                Nenhuma certificacao ou documento cadastrado.
              </p>
            ) : null}
          </div>
        </Panel>

        <Panel title="Linha do tempo">
          <div className="mt-4 space-y-3">
            {recentEvents.length ? (
              recentEvents.map((record) => {
                const event = eventPresentation(record);
                return (
                  <div
                    className="grid grid-cols-[12px_1fr_auto] gap-3"
                    key={`${record._source}-${record._id}`}
                  >
                    <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.7)]" />
                    <div>
                      <p className="text-sm font-semibold text-slate-200">
                        {event.label}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {record._source.replaceAll("_", " ")}
                      </p>
                    </div>
                    <StatusPill
                      label={formatDate(humanRecordDate(record))}
                      tone={event.tone}
                    />
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-500">
                Nenhum evento operacional localizado.
              </p>
            )}
          </div>
        </Panel>
      </section>

      <Panel title="Treinos recentes">
        <div className="mt-4 grid gap-3">
          {recentTrainings.length ? (
            recentTrainings.map((training) => (
              <article
                className="grid gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-4 md:grid-cols-[9rem_1fr_auto]"
                key={training._id}
              >
                <p className="font-mono text-xs text-slate-400">
                  {formatDate(humanRecordDate(training))}
                </p>
                <div>
                  <p className="font-bold text-white">
                    {humanText(
                      training,
                      "trainingType",
                      "modality",
                      "type",
                    ) ?? "Treino"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {humanText(training, "location") ?? "Local nao informado"}
                  </p>
                </div>
                <p className="text-sm font-semibold text-cyan-100 md:text-right">
                  K9 {humanText(training, "dogName", "dog_name") ?? "--"}
                </p>
              </article>
            ))
          ) : (
            <p className="text-sm text-slate-500">
              Nenhum treino vinculado ao RA informado.
            </p>
          )}
        </div>
      </Panel>

      {dialog === "certification" || dialog === "document" ? (
        <HumanRecordDialog
          kind={dialog}
          onClose={() => setDialog(null)}
          ra={ra}
        />
      ) : null}
      {dialog === "movement" ? (
        <HumanMovementDialog
          initialRa={ra}
          onClose={() => setDialog(null)}
          users={userOptions}
        />
      ) : null}
    </div>
  );
}
