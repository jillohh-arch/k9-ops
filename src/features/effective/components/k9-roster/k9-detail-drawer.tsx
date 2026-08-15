"use client";

import {
  CalendarClock,
  Dog,
  Eye,
  FolderOpen,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { EntityImage } from "@/features/effective/components/effective-ui";
import type {
  EffectiveBinomial,
  EffectiveDog,
  EffectiveUser,
} from "@/features/effective/hooks/use-effective-data";
import type { K9RosterDetail } from "@/features/effective/hooks/use-k9-roster-detail";
import {
  K9_READINESS_DETAIL,
  K9_READINESS_LABEL,
  K9_ROSTER_GROUP_LABEL,
  type K9Classification,
} from "@/features/effective/lib/k9-roster-classification";
import { cn } from "@/lib/utils";

const NOT_INFORMED = "Não informado";

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

export type K9DetailDrawerProps = {
  ageYears: number | null;
  /** `true` quando o drawer é overlay (tablet/mobile). */
  asOverlay: boolean;
  binomial: EffectiveBinomial | null;
  classification: K9Classification | null;
  conductor: EffectiveUser | null;
  detail: K9RosterDetail;
  dog: EffectiveDog;
  /** Turno ativo real; nunca inferido da existência de um condutor. */
  hasActiveShift: boolean;
  microchip: string | null;
  onClose: () => void;
  pelage: string | null;
  specialtyLabels: string[];
};

function Field({
  align = "left",
  label,
  value,
}: {
  align?: "left" | "right";
  label: string;
  value: string;
}) {
  return (
    <div className={cn("min-w-0", align === "right" && "text-right")}>
      <dt className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-[13px] font-semibold leading-snug text-slate-100">
        {value}
      </dd>
    </div>
  );
}

/**
 * Bloco do drawer. A separação vem do espaçamento e de um card interno leve,
 * não de uma régua por seção — é o que tira a aparência de formulário.
 */
function Block({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section>
      <h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
        {title}
      </h3>
      <div className="rounded-2xl border border-white/[0.08] bg-[#0c182a]/80 p-3.5 shadow-sm">
        {children}
      </div>
    </section>
  );
}

export function K9DetailDrawer({
  ageYears,
  asOverlay,
  binomial,
  classification,
  conductor,
  detail,
  dog,
  hasActiveShift,
  microchip,
  onClose,
  pelage,
  specialtyLabels,
}: K9DetailDrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape fecha o drawer overlay. No modo inline o conteúdo permanece na
  // página, então não sequestramos a tecla.
  useEffect(() => {
    if (!asOverlay) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [asOverlay, onClose]);

  // Foco controlado: ao abrir como overlay, o foco vai para o botão fechar.
  useEffect(() => {
    if (!asOverlay) return;
    closeRef.current?.focus();
  }, [asOverlay, dog.id]);

  const readinessState = detail.readiness?.state ?? null;
  const groupLabel = classification
    ? K9_ROSTER_GROUP_LABEL[classification.group]
    : null;

  const body = (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col rounded-3xl border border-cyan-200/15 bg-[#081320]/95 shadow-[0_28px_90px_rgba(0,0,0,0.35)]",
        asOverlay && "rounded-none rounded-l-3xl",
      )}
      ref={panelRef}
    >
      <header className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
            Detalhes do K9
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <h2 className="truncate text-2xl font-black leading-none tracking-tight text-white">
              {dog.name}
            </h2>
            {groupLabel ? (
              <span className="rounded-md border border-cyan-300/25 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-bold text-cyan-200">
                {groupLabel}
              </span>
            ) : null}
          </div>
          <p className="mt-1 truncate text-xs font-medium text-slate-400">
            {dog.breed ?? "Raça não informada"}
          </p>
        </div>
        <button
          aria-label="Fechar detalhes do K9"
          className="shrink-0 rounded-xl border border-white/10 bg-white/[0.05] p-2 text-slate-400 transition hover:border-cyan-300/30 hover:bg-white/10 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
          onClick={onClose}
          ref={closeRef}
          type="button"
        >
          <X aria-hidden className="h-4 w-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-5 pb-4 pt-1">
        {detail.error ? (
          <p
            className="rounded-xl border border-red-300/20 bg-red-300/[0.06] p-3 text-xs text-red-200/85"
            role="status"
          >
            Falha ao carregar o detalhe deste K9: {detail.error}
          </p>
        ) : null}

        {/* Identificação: foto com presença dominante (~165px x 180px) e metadados legíveis. */}
        <div className="flex gap-3.5 rounded-2xl border border-white/[0.08] bg-[#0c182a]/80 p-3.5 shadow-sm">
          <EntityImage
            alt={`Foto de ${dog.name}`}
            className="h-[180px] w-[165px] shrink-0 rounded-xl border border-white/10 object-cover shadow-md"
            fallback={Dog}
            src={dog.profileImageUrl}
          />
          <dl className="grid min-w-0 flex-1 content-start gap-2">
            <Field
              label="Matrícula"
              value={dog.registrationNumber ?? NOT_INFORMED}
            />
            <Field
              label="Nascimento"
              value={
                dog.dateOfBirth
                  ? `${dateFormatter.format(dog.dateOfBirth)}${
                      ageYears == null ? "" : ` (${ageYears} anos)`
                    }`
                  : NOT_INFORMED
              }
            />
            <Field label="Sexo" value={dog.sex ?? NOT_INFORMED} />
            <Field label="Cor" value={pelage ?? NOT_INFORMED} />
            <Field label="Microchip" value={microchip ?? NOT_INFORMED} />
          </dl>
        </div>

        <Block title="Binômio atual">
          {binomial || conductor ? (
            <div className="flex items-start gap-3">
              <EntityImage
                alt={
                  conductor
                    ? `Foto de ${conductor.callsign}`
                    : "Condutor sem foto"
                }
                className="h-[56px] w-[56px] shrink-0 rounded-xl border border-white/10 object-cover"
                fallback={UserRound}
                src={conductor?.photoUrl ?? null}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black leading-tight text-white">
                  {conductor?.callsign ??
                    binomial?.handlerName ??
                    NOT_INFORMED}
                </p>
                <p className="mt-1 font-mono text-[11px] font-semibold text-slate-400">
                  MAT. {conductor?.ra ?? binomial?.handlerRa ?? NOT_INFORMED}
                </p>
                {/* Turno só é afirmado a partir de um turno ativo real. */}
                <span
                  className={cn(
                    "mt-2 inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold",
                    hasActiveShift
                      ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200"
                      : "border-slate-400/20 bg-slate-400/[0.08] text-slate-400",
                  )}
                >
                  {hasActiveShift ? "Ativo no turno" : "Sem turno ativo"}
                </span>
              </div>
              <dl className="grid shrink-0 gap-2.5">
                <Field
                  align="right"
                  label="Vínculo desde"
                  value={
                    binomial?.startAt
                      ? dateFormatter.format(binomial.startAt)
                      : NOT_INFORMED
                  }
                />
                {/*
                  O mockup traz "Função" (ex.: Operador K9), mas não existe
                  campo canônico de função operacional em `users`:
                  `accessLevel` é perfil de autorização (e cai para
                  "Operador" por padrão). Exibi-lo aqui afirmaria uma função
                  que o dado não sustenta, então o campo degrada para
                  "Não informado" até haver fonte real.
                */}
                <Field label="Função" value={NOT_INFORMED} />
              </dl>
            </div>
          ) : (
            <p className="text-xs text-slate-400">Sem binômio ativo</p>
          )}
        </Block>

        <Block title="Especialidades">
          {specialtyLabels.length ? (
            <div className="flex flex-wrap gap-1.5">
              {specialtyLabels.map((label) => (
                <span
                  className="rounded-lg border border-cyan-300/20 bg-cyan-300/[0.07] px-2.5 py-1 text-xs font-semibold text-cyan-200"
                  key={label}
                >
                  {label}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">
              Nenhuma especialidade registrada
            </p>
          )}
        </Block>

        <Block title="Resumo de prontidão">
          {detail.loading ? (
            <span
              aria-hidden
              className="block h-12 animate-pulse rounded-xl bg-white/[0.06] motion-reduce:animate-none"
            />
          ) : readinessState ? (
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <ShieldCheck
                  aria-hidden
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    readinessState === "temporarily_unfit"
                      ? "text-red-300"
                      : readinessState === "operational"
                        ? "text-emerald-300"
                        : "text-amber-300",
                  )}
                />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-black leading-snug text-white">
                    {K9_READINESS_LABEL[readinessState]}
                  </p>
                  <p className="truncate text-[11px] text-slate-400">
                    {K9_READINESS_DETAIL[readinessState]}
                  </p>
                </div>
              </div>
              {detail.readiness?.evaluatedAt ? (
                <span className="shrink-0 text-right text-[10px] leading-relaxed text-slate-400">
                  Última avaliação
                  <br />
                  {dateTimeFormatter.format(detail.readiness.evaluatedAt)}
                </span>
              ) : null}
            </div>
          ) : (
            // Fonte Health canônica indisponível nesta branch. Não é
            // `not_evaluated` — é ausência de fonte, e é isso que dizemos.
            // O texto é preservado literalmente; só a apresentação mudou.
            <div className="flex items-center gap-2">
              <ShieldCheck aria-hidden className="h-4 w-4 shrink-0 text-slate-500" />
              <p className="text-xs text-slate-400">Prontidão não disponível</p>
            </div>
          )}
        </Block>

        <Block title="Última atividade">
          {detail.loading ? (
            <span
              aria-hidden
              className="block h-10 animate-pulse rounded-xl bg-white/[0.06] motion-reduce:animate-none"
            />
          ) : detail.lastTrainingSession ? (
            <div className="flex items-start gap-2.5">
              <CalendarClock
                aria-hidden
                className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300/80"
              />
              <div className="min-w-0 flex-1">
                {/* Título dominante; modalidade e data como linha secundária. */}
                <p className="truncate text-[13px] font-bold leading-snug text-slate-100">
                  {detail.lastTrainingSession.title}
                </p>
                <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-slate-400">
                  {detail.lastTrainingSession.modality ? (
                    <span className="truncate">
                      {detail.lastTrainingSession.modality}
                    </span>
                  ) : null}
                  {detail.lastTrainingSession.modality &&
                  detail.lastTrainingSession.date ? (
                    <span aria-hidden className="shrink-0 text-slate-600">
                      ·
                    </span>
                  ) : null}
                  {detail.lastTrainingSession.date ? (
                    <span className="shrink-0">
                      {dateTimeFormatter.format(detail.lastTrainingSession.date)}
                    </span>
                  ) : null}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">
              Nenhuma sessão de treinamento registrada
            </p>
          )}
        </Block>

        {/*
          "Próxima agenda / saúde" não é renderizada: a fonte Health canônica
          não está disponível nesta branch, e o bloco seria necessariamente
          fictício. Ocultar é a opção prevista no contrato.
        */}
      </div>

      <footer className="grid grid-cols-3 gap-2 border-t border-white/[0.08] p-3.5">
        <Link
          className="inline-flex flex-col items-center justify-center gap-1.5 rounded-xl border border-cyan-300/25 bg-cyan-300/[0.08] px-2 py-2.5 text-[11px] font-bold text-cyan-200 transition hover:border-cyan-300/40 hover:bg-cyan-300/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
          href={`/k9/${encodeURIComponent(dog.id)}`}
        >
          <Eye aria-hidden className="h-4 w-4" />
          Ver perfil
        </Link>
        {/*
          "Abrir prontuário": não existe deeplink real para a área Health do
          perfil (as abas clínicas são estado local, sem rota nem âncora). O
          destino canônico mais próximo é o próprio perfil do K9, então a ação
          fica desabilitada em vez de apontar para uma rota fictícia.
        */}
        <button
          aria-label="Abrir prontuário — indisponível: sem rota canônica"
          className="inline-flex cursor-not-allowed flex-col items-center justify-center gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.02] px-2 py-2.5 text-[11px] font-bold text-slate-600"
          disabled
          title="Sem rota canônica para o prontuário nesta versão"
          type="button"
        >
          <FolderOpen aria-hidden className="h-4 w-4" />
          Abrir prontuário
        </button>
        {binomial ? (
          <Link
            className="inline-flex flex-col items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-2.5 text-[11px] font-bold text-slate-300 transition hover:border-cyan-300/30 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
            href={`/binomials/${encodeURIComponent(binomial.id)}`}
          >
            <Users aria-hidden className="h-4 w-4" />
            Ver binômio
          </Link>
        ) : (
          <button
            aria-label="Ver binômio — indisponível: sem binômio ativo"
            className="inline-flex cursor-not-allowed flex-col items-center justify-center gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.02] px-2 py-2.5 text-[11px] font-bold text-slate-600"
            disabled
            title="Sem binômio ativo para este K9"
            type="button"
          >
            <Users aria-hidden className="h-4 w-4" />
            Ver binômio
          </button>
        )}
      </footer>
    </div>
  );

  if (!asOverlay) {
    return (
      <aside
        aria-label={`Detalhes do K9 ${dog.name}`}
        className="sticky top-24 h-[calc(100dvh-8rem)] min-h-0"
      >
        {body}
      </aside>
    );
  }

  return (
    <div className="fixed inset-0 z-40">
      {/*
        O backdrop é atalho de mouse. Fica fora da árvore de acessibilidade
        para não duplicar o nome do botão fechar: quem usa teclado/leitor de
        tela fecha pelo X ou por Escape.
      */}
      <button
        aria-hidden
        className="absolute inset-0 bg-black/62 backdrop-blur-sm"
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
      <aside
        aria-label={`Detalhes do K9 ${dog.name}`}
        aria-modal="true"
        className="absolute inset-y-0 right-0 w-[min(94vw,420px)] p-2"
        role="dialog"
      >
        {body}
      </aside>
    </div>
  );
}
