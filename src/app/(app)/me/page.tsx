"use client";

import {
  Activity,
  CalendarDays,
  Dog,
  FileText,
  HeartPulse,
  KeyRound,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

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
} from "@/features/effective/hooks/use-human-profile-data";
import { useAccessControl } from "@/features/access/providers/access-control-provider";
import { useAuth } from "@/features/auth/providers/auth-provider";
import { paths } from "@/lib/routes/paths";
import { cn } from "@/lib/utils";

type MeTab = "k9" | "trainings" | "occurrences" | "documents";

const meTabs: Array<{
  description: string;
  id: MeTab;
  label: string;
}> = [
  {
    description: "cão vinculado e contexto atual",
    id: "k9",
    label: "K9 vinculado",
  },
  {
    description: "sessões e registros recentes",
    id: "trainings",
    label: "Treinos",
  },
  {
    description: "participações operacionais",
    id: "occurrences",
    label: "Ocorrências",
  },
  {
    description: "arquivos, conta e seguranca",
    id: "documents",
    label: "Documentos",
  },
];

function formatDate(date: Date | null) {
  if (!date) return "--";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date);
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

export default function MePage() {
  const { profile } = useAuth();
  const { can } = useAccessControl();
  const [activeTab, setActiveTab] = useState<MeTab>("k9");
  const canEditHuman = can("humans", "edit");
  const ra = profile?.ra ?? "";
  const data = useHumanProfileData(ra);

  if (!ra) {
    return (
      <DataState
        error="Não foi possível identificar seu RA no token de login."
        loading={false}
        noun="seu perfil"
      />
    );
  }

  if (data.loading || data.error || !data.user) {
    return (
      <DataState
        error={data.error ?? (!data.loading ? "Perfil não localizado." : null)}
        loading={data.loading}
        noun="seu perfil"
      />
    );
  }

  const user = data.user;
  const callsign =
    humanText(user, "callsign", "callSign", "nome_guerra") ??
    profile?.displayName ??
    ra;
  const fullName = humanText(user, "nomeCompleto", "name", "nome");
  const photo =
    humanText(user, "photoUrl", "image_url", "profileImageUrl") ??
    profile?.photoUrl ??
    null;
  const linkedDog = data.linkedDogs[0] ?? null;
  const recentTrainings = data.trainings.slice(0, 4);
  const recentOccurrences = data.occurrences.slice(0, 4);

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
            Area pessoal
          </p>
          <h1 className="mt-1 text-3xl font-black text-white">Meu Perfil</h1>
          <p className="mt-2 text-sm text-slate-400">
            Dados funcionais, K9 vinculado, treinos e ocorrências relacionados
            ao seu RA.
          </p>
        </div>
        {canEditHuman ? (
          <Link
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-300/[0.08] px-4 py-2.5 text-sm font-bold text-cyan-200"
            href={`/humans/${encodeURIComponent(ra)}/edit`}
          >
            <UserRound className="h-4 w-4" />
            Atualizar dados permitidos
          </Link>
        ) : null}
      </div>

      <section className="relative overflow-hidden rounded-3xl border border-cyan-200/15 bg-[#0a172a] p-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(34,211,238,0.13),transparent_35%)]" />
        <div className="relative grid gap-5 xl:grid-cols-[320px_1fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 text-center">
            <EntityImage
              alt={callsign}
              className="mx-auto h-36 w-36 rounded-full"
              fallback={UserRound}
              src={photo}
            />
            <h2 className="mt-4 text-2xl font-black text-white">{callsign}</h2>
            <p className="mt-1 font-mono text-xs text-slate-500">RA {ra}</p>
            <div className="mt-4 flex justify-center gap-2">
              <StatusPill label="Ativo" tone="green" />
              {data.user.is_k9_instructor === true ? (
                <StatusPill label="Instrutor K9" tone="amber" />
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {[
              ["Nome completo", fullName],
              ["Função", humanText(user, "cargo", "role", "accessLevel")],
              ["Lotação", humanText(user, "unit", "unidade", "lotação")],
              ["Equipe", humanText(user, "team", "equipe")],
              ["Perfil de acesso", humanText(user, "accessProfile")],
              ["Telefone", humanText(user, "telefone", "phone")],
              ["E-mail", humanText(user, "institutional_email", "email")],
              ["Jornada", humanText(user, "shift_label", "shiftLabel")],
            ].map(([label, value]) => (
              <div
                className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"
                key={label}
              >
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                  {label}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-200">
                  {value ?? "--"}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <SummaryCard
          detail="vinculados ao seu RA"
          icon={Dog}
          label="K9"
          tone="cyan"
          value={String(data.linkedDogs.length)}
        />
        <SummaryCard
          detail="registros localizados"
          icon={Activity}
          label="Treinos"
          tone="blue"
          value={String(data.trainings.length)}
        />
        <SummaryCard
          detail="participações e conducoes"
          icon={ShieldCheck}
          label="Ocorrências"
          tone="violet"
          value={String(data.occurrences.length)}
        />
        <SummaryCard
          detail="arquivos funcionais"
          icon={FileText}
          label="Documentos"
          tone="green"
          value={String(data.documents.length)}
        />
      </section>

      <nav className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        {meTabs.map((tab) => (
          <button
            className={cn(
              "rounded-2xl border px-4 py-3 text-left transition",
              activeTab === tab.id
                ? "border-cyan-300/35 bg-cyan-300/12 text-cyan-100"
                : "border-white/10 bg-white/[0.035] text-slate-400 hover:border-cyan-300/25 hover:text-slate-100",
            )}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            <span className="block text-sm font-black">{tab.label}</span>
            <span className="mt-1 block text-xs text-slate-500">
              {tab.description}
            </span>
          </button>
        ))}
      </nav>

      {activeTab === "k9" ? (
        <section className="grid gap-5 xl:grid-cols-2">
        <Panel title="K9 vinculado">
          {linkedDog ? (
            <Link
              className="mt-4 flex items-center gap-4 rounded-2xl border border-white/8 bg-white/[0.025] p-4 transition hover:border-cyan-300/25"
              href={`/k9/${encodeURIComponent(linkedDog._id)}`}
            >
              <EntityImage
                alt={humanText(linkedDog, "name", "nome") ?? linkedDog._id}
                className="h-20 w-20 shrink-0"
                fallback={Dog}
                src={humanText(
                  linkedDog,
                  "profileImageUrl",
                  "profile_image_url",
                )}
              />
              <div>
                <p className="text-lg font-black text-cyan-100">
                  {humanText(linkedDog, "name", "nome") ?? linkedDog._id}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {humanText(linkedDog, "breed", "raça") ??
                    "Raça não informada"}
                </p>
                <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-200">
                  <HeartPulse className="h-3.5 w-3.5" />
                  Prontuário disponível
                </p>
              </div>
            </Link>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              Nenhum K9 vinculado ao seu RA no cadastro atual.
            </p>
          )}
        </Panel>

        <Panel title="Seguranca da conta">
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-4">
              <KeyRound className="h-5 w-5 text-cyan-300" />
              <div>
                <p className="text-sm font-bold text-white">
                  Login institucional por RA
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Acesso monitorado por claims e perfil espelhado em users/RA.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-4">
              <CalendarDays className="h-5 w-5 text-cyan-300" />
              <div>
                <p className="text-sm font-bold text-white">
                  Última atualização
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatDate(humanRecordDate(user))}
                </p>
              </div>
            </div>
          </div>
        </Panel>
      </section>
      ) : null}

      {activeTab === "trainings" ? (
        <section className="grid gap-5 xl:grid-cols-2">
        <Panel title="Treinos recentes">
          <div className="mt-4 space-y-3">
            {recentTrainings.length ? (
              recentTrainings.map((record) => (
                <div
                  className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"
                  key={record._id}
                >
                  <p className="font-bold text-white">
                    {humanText(record, "trainingType", "modality", "type") ??
                      "Treino registrado"}
                  </p>
                  <p className="mt-1 font-mono text-xs text-slate-500">
                    {formatDate(humanRecordDate(record))}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">
                Nenhum treino recente vinculado.
              </p>
            )}
          </div>
        </Panel>
        <Panel title="Resumo de treinos">
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
              <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                Total localizado
              </p>
              <p className="mt-2 font-mono text-3xl font-black text-white">
                {data.trainings.length}
              </p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
              <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                Exibidos
              </p>
              <p className="mt-2 font-mono text-3xl font-black text-cyan-200">
                {recentTrainings.length}
              </p>
            </div>
          </div>
        </Panel>
      </section>
      ) : null}

      {activeTab === "occurrences" ? (
        <section className="grid gap-5 xl:grid-cols-2">
        <Panel title="Ocorrências recentes">
          <div className="mt-4 space-y-3">
            {recentOccurrences.length ? (
              recentOccurrences.map((record) => (
                <div
                  className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"
                  key={record._id}
                >
                  <p className="font-bold text-white">
                    {humanText(record, "type_name", "natureza", "status") ??
                      "Ocorrência"}
                  </p>
                  <p className="mt-1 font-mono text-xs text-slate-500">
                    {formatDate(humanRecordDate(record))}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">
                Nenhuma ocorrência recente vinculada.
              </p>
            )}
          </div>
        </Panel>
        <Panel title="Resumo operacional">
          <div className="mt-4 rounded-2xl border border-cyan-300/12 bg-cyan-300/[0.045] p-4 text-sm leading-6 text-slate-400">
            Foram localizadas{" "}
            <span className="font-mono font-black text-cyan-100">
              {data.occurrences.length}
            </span>{" "}
            ocorrências vinculadas ao seu RA por participação, condução ou
            referência documental.
          </div>
        </Panel>
      </section>
      ) : null}

      {activeTab === "documents" ? (
        <section className="grid gap-5 xl:grid-cols-2">
          <Panel title="Documentos funcionais">
            <div className="mt-4 space-y-3">
              {data.documents.length ? (
                data.documents.slice(0, 6).map((record) => (
                  <div
                    className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"
                    key={record._id}
                  >
                    <p className="font-bold text-white">
                      {humanText(record, "title", "name", "type") ??
                        "Documento"}
                    </p>
                    <p className="mt-1 font-mono text-xs text-slate-500">
                      {formatDate(humanRecordDate(record))}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  Nenhum documento funcional vinculado ao seu RA.
                </p>
              )}
            </div>
          </Panel>
          <Panel title="Seguranca da conta">
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                <KeyRound className="h-5 w-5 text-cyan-300" />
                <div>
                  <p className="text-sm font-bold text-white">
                    Login institucional por RA
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Acesso monitorado por claims e perfil espelhado em users/RA.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                <CalendarDays className="h-5 w-5 text-cyan-300" />
                <div>
                  <p className="text-sm font-bold text-white">
                    Última atualização
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDate(humanRecordDate(user))}
                  </p>
                </div>
              </div>
            </div>
          </Panel>
        </section>
      ) : null}

      <div className="rounded-3xl border border-cyan-300/10 bg-cyan-300/[0.045] px-5 py-4 text-sm text-slate-400">
        Dados administrativos sensíveis continuam sob controle dos gestores em{" "}
        <Link className="font-bold text-cyan-200" href={paths.humans}>
          Efetivo Humano
        </Link>
        .
      </div>
    </div>
  );
}
