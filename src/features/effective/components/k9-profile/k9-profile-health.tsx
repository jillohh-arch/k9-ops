"use client";

import {
  ExternalLink,
  FileText,
  HeartPulse,
  Pill,
  Plus,
  Scale,
  Stethoscope,
  Syringe,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "@/components/charts/lazy-recharts";

import { StatusPill } from "@/features/effective/components/effective-ui";
import {
  profileRecordDate,
  profileText,
  type ProfileRecord,
} from "@/features/effective/hooks/use-k9-profile-data";
import type { HealthHubSection } from "@/features/health/components/health-event-hub";
import { cn } from "@/lib/utils";

import {
  dateLabel,
  eventTitle,
  SectionCard,
  vaccineState,
  type HealthTab,
  type ProfileView,
} from "./k9-profile-types";

export function K9ProfileHealth({
  canWriteHealth,
  onOpenHub,
  view,
  weightChartData,
  weightDomain,
}: {
  canWriteHealth: boolean;
  onOpenHub: (section: HealthHubSection) => void;
  view: ProfileView;
  weightChartData: { date: string; fullDate?: string; weight: number }[];
  weightDomain: [number, number];
}) {
  const [healthTab, setHealthTab] = useState<HealthTab>("overview");

  return (
    <SectionCard className="overflow-hidden p-0" title="">
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
              onClick={() => onOpenHub("clínical")}
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
          <HealthOverview
            canWriteHealth={canWriteHealth}
            onOpenHub={onOpenHub}
            onTabChange={setHealthTab}
            view={view}
          />
        ) : null}

        {healthTab === "vaccines" ? (
          <VaccinesTab
            canWriteHealth={canWriteHealth}
            onOpenHub={onOpenHub}
            vaccines={view.vaccines}
          />
        ) : null}

        {healthTab === "weight" ? (
          <WeightTab
            canWriteHealth={canWriteHealth}
            onOpenHub={onOpenHub}
            view={view}
            weightChartData={weightChartData}
            weightDomain={weightDomain}
          />
        ) : null}

        {healthTab === "clínical" ? (
          <ClínicalTab
            canWriteHealth={canWriteHealth}
            clínicalEvents={view.clínicalEvents}
            onOpenHub={onOpenHub}
          />
        ) : null}

        {healthTab === "documents" ? (
          <DocumentsTab documents={view.documents} />
        ) : null}
      </div>
    </SectionCard>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────

function HealthOverview({
  canWriteHealth,
  onOpenHub,
  onTabChange,
  view,
}: {
  canWriteHealth: boolean;
  onOpenHub: (section: HealthHubSection) => void;
  onTabChange: (tab: HealthTab) => void;
  view: ProfileView;
}) {
  return (
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
            onClick={() => onTabChange("vaccines")}
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
            onClick={() => onTabChange("weight")}
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
              Histórico clínico registrado para este K9.
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
  );
}

// ─── Vaccines Tab ─────────────────────────────────────────────────────────

function VaccinesTab({
  canWriteHealth,
  onOpenHub,
  vaccines,
}: {
  canWriteHealth: boolean;
  onOpenHub: (section: HealthHubSection) => void;
  vaccines: ProfileRecord[];
}) {
  return (
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
            onClick={() => onOpenHub("vaccination")}
            type="button"
          >
            <Plus className="h-4 w-4" />
            Registrar vacina
          </button>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3">
        {vaccines.map((vaccine) => {
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
        {!vaccines.length ? (
          <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center">
            <Syringe className="mx-auto h-10 w-10 text-slate-700" />
            <p className="mt-3 text-sm text-slate-500">
              Nenhuma vacina localizada no prontuário.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Weight Tab ───────────────────────────────────────────────────────────

function WeightTab({
  canWriteHealth,
  onOpenHub,
  view,
  weightChartData,
  weightDomain,
}: {
  canWriteHealth: boolean;
  onOpenHub: (section: HealthHubSection) => void;
  view: ProfileView;
  weightChartData: { date: string; fullDate?: string; weight: number }[];
  weightDomain: [number, number];
}) {
  return (
    <div>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-lg font-black text-white">
            Evolução do peso
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Histórico oficial de pesagens deste K9.
          </p>
        </div>
        {canWriteHealth ? (
          <button
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] px-4 py-2.5 text-sm font-semibold text-cyan-200 hover:bg-cyan-300/[0.12]"
            onClick={() => onOpenHub("weight")}
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
                  tickFormatter={(value: number) => `${value} kg`}
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
                  formatter={(value: number) => [
                    `${Number(value).toFixed(1)} kg`,
                    "Peso",
                  ]}
                  labelFormatter={(_: string, payload: Array<{ payload: { fullDate?: string } }>) =>
                    payload[0]?.payload.fullDate ?? ""
                  }
                />
                <Area
                  dataKey="weight"
                  fill="url(#weightFill)"
                  stroke="#22d3ee"
                  strokeWidth={2.4}
                  type="monotone"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              Sem pesagens registradas.
            </div>
          )}
        </div>
        <div className="space-y-3">
          {view.weights.slice(0, 5).map((weight) => {
            const value = Number(
              weight.weight ?? weight.weightKg ?? weight.value ?? 0,
            );
            const prev = view.weights[view.weights.indexOf(weight) + 1];
            const prevValue = prev
              ? Number(prev.weight ?? prev.weightKg ?? prev.value ?? 0)
              : null;
            const diff =
              prevValue != null && prevValue > 0 ? value - prevValue : null;
            return (
              <article
                className="rounded-xl border border-white/8 bg-white/[0.025] p-3"
                key={weight._id}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-lg font-black text-white">
                    {value.toFixed(1)} kg
                  </p>
                  {diff != null ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold",
                        diff > 0
                          ? "bg-emerald-300/10 text-emerald-200"
                          : diff < 0
                            ? "bg-red-300/10 text-red-200"
                            : "bg-slate-300/10 text-slate-300",
                      )}
                    >
                      {diff > 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : diff < 0 ? (
                        <TrendingDown className="h-3 w-3" />
                      ) : null}
                      {diff > 0 ? "+" : ""}
                      {diff.toFixed(1)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {dateLabel(profileRecordDate(weight))}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Clínical Tab ─────────────────────────────────────────────────────────

function ClínicalTab({
  canWriteHealth,
  clínicalEvents,
  onOpenHub,
}: {
  canWriteHealth: boolean;
  clínicalEvents: ProfileRecord[];
  onOpenHub: (section: HealthHubSection) => void;
}) {
  return (
    <div>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-lg font-black text-white">
            Atendimentos e exames
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Consultas, procedimentos, medicações e observações veterinárias.
          </p>
        </div>
        {canWriteHealth ? (
          <button
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.07] px-4 py-2.5 text-sm font-black text-emerald-100"
            onClick={() => onOpenHub("clínical")}
            type="button"
          >
            <Plus className="h-4 w-4" />
            Registrar atendimento
          </button>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3">
        {clínicalEvents.map((event) => (
          <article
            className="grid gap-4 rounded-2xl border border-white/8 bg-white/[0.025] p-4 lg:grid-cols-[1fr_0.7fr_0.6fr]"
            key={event._id}
          >
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
                <Stethoscope className="h-5 w-5" />
              </span>
              <div>
                <p className="font-black text-white">{eventTitle(event)}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {profileText(event, [
                    "healthObservations",
                    "observations",
                    "notes",
                  ]) ?? "Sem observações"}
                </p>
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-slate-600">
                Profissional
              </p>
              <p className="mt-2 text-sm font-bold text-slate-200">
                {profileText(event, ["vetName", "professionalName"]) ??
                  "Não informado"}
              </p>
              <p className="mt-1 font-mono text-[10px] text-slate-500">
                {profileText(event, [
                  "professionalCrmv",
                  "professionalClinic",
                ]) ?? "Sem CRMV"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-slate-600">
                Data
              </p>
              <p className="mt-2 font-mono text-sm font-bold text-slate-200">
                {dateLabel(profileRecordDate(event))}
              </p>
              {profileText(event, ["medications", "prescription"]) ? (
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-violet-300/10 px-2 py-1 text-[10px] font-bold text-violet-200">
                  <Pill className="h-3 w-3" />
                  Com medicação
                </span>
              ) : null}
            </div>
          </article>
        ))}
        {!clínicalEvents.length ? (
          <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center">
            <Stethoscope className="mx-auto h-10 w-10 text-slate-700" />
            <p className="mt-3 text-sm text-slate-500">
              Nenhum atendimento localizado.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Documents Tab ────────────────────────────────────────────────────────

function DocumentsTab({
  documents,
}: {
  documents: ProfileRecord[];
}) {
  return (
    <div>
      <div>
        <h3 className="text-lg font-black text-white">
          Laudos e documentos
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Atestados, laudos técnicos, certificados e documentos anexados.
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {documents.map((document) => {
          const url =
            profileText(document, ["url", "fileUrl", "link"]) ?? null;
          return (
            <article
              className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"
              key={document._id}
            >
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-300/18 bg-cyan-300/8 text-cyan-200">
                  <FileText className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black text-white">
                    {profileText(document, [
                      "title",
                      "subtype",
                      "documentName",
                    ]) ?? "Documento sem título"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
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
        {!documents.length ? (
          <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center md:col-span-2">
            <FileText className="mx-auto h-10 w-10 text-slate-700" />
            <p className="mt-3 text-sm text-slate-500">
              Nenhum laudo ou documento localizado.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
