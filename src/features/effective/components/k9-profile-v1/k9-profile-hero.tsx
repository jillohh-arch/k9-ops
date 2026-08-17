"use client";

import { Dog, Pencil, UserRound, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { K9ProfileBinomialContext } from "@/features/effective/hooks/use-k9-profile-context";
import type { EffectiveDog } from "@/features/effective/hooks/use-effective-data";
import type { buildK9ProfileStatus } from "@/features/effective/lib/k9-profile-status";
import { cn } from "@/lib/utils";

import { ProfileField, ProfilePill } from "./k9-profile-ui";

const NOT_INFORMED = "Não informado";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export type K9ProfileHeroProps = {
  ageYears: number | null;
  binomialContext: K9ProfileBinomialContext;
  canEdit: boolean;
  dog: EffectiveDog;
  editHref: string;
  specialtyLabels: string[];
  status: ReturnType<typeof buildK9ProfileStatus>;
};

/**
 * Hero do Perfil K9.
 *
 * Três zonas no desktop: foto dominante / identidade / binômio atual.
 * A situação operacional aparece como pill acima do nome — e é a única
 * classificação exibida aqui, para não competir com os cards de status da
 * Visão Geral, onde administrativo e clínico são declarados separadamente.
 */
export function K9ProfileHero({
  ageYears,
  binomialContext,
  canEdit,
  dog,
  editHref,
  specialtyLabels,
  status,
}: K9ProfileHeroProps) {
  const birthLabel = dog.dateOfBirth
    ? `${dateFormatter.format(dog.dateOfBirth)}${
        ageYears == null ? "" : ` (${ageYears} anos)`
      }`
    : NOT_INFORMED;

  return (
    <section
      aria-labelledby="k9-profile-name"
      className="relative overflow-hidden rounded-3xl border border-cyan-200/15 bg-[#081320]/95 shadow-[0_28px_90px_rgba(0,0,0,0.35)]"
    >
      {/*
        As três zonas exigem largura real para não comprimir a identidade.
        Medições com a sidebar aberta (container útil entre parênteses):
          1280 (899px)  → foto 340 + binômio 320 deixava 239px para o nome;
          1440 (1059px) → três zonas cabem, identidade fica com ~450px;
          1920 (1539px) → três zonas folgadas, identidade com ~930px.
        Por isso o corte usa o breakpoint `wide` (1440, registrado em
        globals.css) e não o `2xl` (1536) do Tailwind: com 2xl, a resolução de
        1440 cairia em duas colunas e o hero passaria de 730px de altura.
      */}
      <div className="grid gap-0 lg:grid-cols-[minmax(260px,300px)_minmax(0,1fr)] wide:grid-cols-[minmax(290px,320px)_minmax(0,1fr)_minmax(260px,290px)]">
        {/* Zona 1 — foto. */}
        <div className="relative h-[300px] w-full overflow-hidden border-b border-white/[0.06] sm:h-[360px] lg:h-full lg:min-h-[420px] lg:border-b-0 lg:border-r">
          {dog.profileImageUrl ? (
            <Image
              alt={`Foto de ${dog.name}`}
              /*
                As fotos do canil são retratos verticais (a do Bono é 3072×4080,
                proporção 0,75) enquadrando o cão de corpo inteiro. Como o slot
                tem proporção próxima (~0,8), o `object-cover` puro recortava
                menos de 10% da altura: o resultado era uma foto cadastral com
                muito gramado e pouca presença do animal.

                A ampliação tem origem no topo do quadro, então cresce para
                baixo: a borda superior da foto continua visível e orelhas/
                cabeça não podem ser cortadas — o que sai do quadro é a parte
                inferior (patas/gramado). Medido no Bono: sem escala, 99% da
                altura ficava visível (corpo inteiro); com 1.4, ~70%, chegando
                a cabeça + peito.

                Aplicada só a partir de `lg`, onde o slot é retrato e recorta
                pouco. Em telas estreitas o slot é paisagem e o `object-cover`
                já recorta para a faixa superior; ampliar ali apertaria demais.

                A escala é uniforme (não deforma) e não há regra por dogId:
                fotos já enquadradas de perto apenas ficam levemente maiores.
              */
              className="object-cover object-top lg:scale-[1.4]"
              fill
              priority
              sizes="(min-width: 1440px) 320px, (min-width: 1024px) 300px, 100vw"
              src={dog.profileImageUrl}
              // Origem no topo: o zoom cresce para baixo e preserva a cabeça.
              style={{ transformOrigin: "top center" }}
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_50%_28%,rgba(34,211,238,0.14),transparent_62%)]">
              <div className="flex flex-col items-center gap-2 text-cyan-200/45">
                <Dog aria-hidden className="h-16 w-16" />
                <span className="text-[11px] font-bold uppercase tracking-[0.18em]">
                  Sem foto cadastrada
                </span>
              </div>
            </div>
          )}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#081320] via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-[#081320]/70"
          />
        </div>

        {/*
          Zona 2 — identidade.

          `justify-center` no desktop: a coluna é mais alta que o conteúdo (a
          foto define ~420px), e com alinhamento ao topo sobrava um vazio grande
          embaixo. Centralizar verticalmente encosta a identidade na foto e
          elimina o miolo vazio sem inventar conteúdo.
        */}
        <div className="flex min-w-0 flex-col p-5 sm:p-6 lg:justify-center">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <ProfilePill
              label={status.operational.label}
              tone={status.operational.tone}
            />
            <div className="flex shrink-0 items-center gap-2">
              {canEdit ? (
                <Link
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-bold text-slate-300 transition hover:border-cyan-300/30 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
                  href={editHref}
                >
                  <Pencil aria-hidden className="h-3.5 w-3.5" />
                  Editar perfil
                </Link>
              ) : null}
              {/*
                O mockup traz um menu "Ações". Não existe nenhuma ação de perfil
                real além de editar nesta rodada, então o botão não é criado:
                seção 10 proíbe botão decorativo.
              */}
            </div>
          </div>

          {/* Nome domina a zona; `leading-[0.95]` fecha o espaço sob a linha. */}
          <h1
            className="mt-3 truncate text-4xl font-black leading-[0.95] tracking-tight text-white sm:text-5xl wide:text-6xl"
            id="k9-profile-name"
          >
            {dog.name}
          </h1>
          <p className="mt-1.5 text-sm font-medium text-slate-400">
            {dog.breed ?? "Raça não informada"}
          </p>

          {/* Régua fina acima dos metadados: separa identidade de cadastro sem
              acrescentar um card. */}
          <div
            aria-hidden
            className="mt-4 h-px w-full bg-gradient-to-r from-cyan-300/20 to-transparent"
          />

          <dl className="mt-3.5 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-3 wide:grid-cols-5">
            <ProfileField
              label="Matrícula"
              mono
              value={dog.registrationNumber ?? NOT_INFORMED}
            />
            <ProfileField label="Nascimento" value={birthLabel} />
            <ProfileField label="Sexo" value={dog.sex ?? NOT_INFORMED} />
            <ProfileField label="Cor" value={dog.color ?? NOT_INFORMED} />
            <ProfileField
              label="Microchip"
              mono
              value={dog.microchip ?? NOT_INFORMED}
            />
          </dl>

          <div className="mt-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
              Especialidades
            </h2>
            {specialtyLabels.length ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {specialtyLabels.map((label) => (
                  <li
                    className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-1.5 text-xs font-semibold text-cyan-200"
                    key={label}
                  >
                    {label}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-slate-400">
                Nenhuma especialidade registrada
              </p>
            )}
          </div>
        </div>

        {/* Zona 3 — binômio atual. */}
        {/*
          Quando o binômio desce para a própria faixa (abaixo de 2xl) ele
          ocupa as duas colunas, mas o card recebe um teto de largura para não
          virar uma barra esticada de ponta a ponta.
        */}
        <div className="border-t border-white/[0.06] p-5 sm:p-6 lg:col-span-2 wide:col-span-1 wide:border-l wide:border-t-0">
          <div className="lg:max-w-[420px] wide:max-w-none">
            <HeroBinomialCard context={binomialContext} status={status} />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroBinomialCard({
  context,
  status,
}: {
  context: K9ProfileBinomialContext;
  status: ReturnType<typeof buildK9ProfileStatus>;
}) {
  const { binomial, conductor, isLegacyFallback } = context;
  const hasAny = Boolean(binomial || conductor);

  /*
    O título acompanha a autoridade do dado:
    - com vínculo ativo real em `binomials` → "Binômio atual";
    - só com referência cadastral no K9 → "Condutor de referência".
    Chamar o fallback de "binômio atual" afirmaria um vínculo que não existe.
  */
  const title = binomial ? "Binômio atual" : "Condutor de referência";

  return (
    <div className="flex h-full flex-col rounded-2xl border border-white/[0.08] bg-[#0c182a]/70 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
          {title}
        </h2>
        {isLegacyFallback ? (
          // Origem do dado dita em linguagem institucional, sem citar schema.
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Referência cadastral
          </span>
        ) : null}
      </div>

      {!hasAny ? (
        <p className="mt-3 text-xs leading-relaxed text-slate-400">
          Sem binômio ativo registrado para este K9.
        </p>
      ) : (
        <>
          <div className="mt-3.5 flex items-start gap-3">
            <div className="relative h-[56px] w-[56px] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-cyan-300/[0.055]">
              {conductor?.photoUrl ? (
                <Image
                  alt={`Foto de ${conductor.callsign}`}
                  className="object-cover"
                  fill
                  sizes="56px"
                  src={conductor.photoUrl}
                  unoptimized
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-cyan-200/45">
                  <UserRound aria-hidden className="h-6 w-6" />
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-black leading-tight text-white">
                {conductor?.callsign ?? binomial?.handlerName ?? NOT_INFORMED}
              </p>
              <p className="mt-1 font-mono text-[11px] font-semibold text-slate-400">
                MAT. {conductor?.ra ?? binomial?.handlerRa ?? NOT_INFORMED}
              </p>
              <span
                className={cn(
                  "mt-2 inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold",
                  status.shift.tone === "green"
                    ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200"
                    : "border-slate-400/20 bg-slate-400/[0.08] text-slate-400",
                )}
              >
                {status.shift.label}
              </span>
            </div>
          </div>

          {/*
            "Vínculo desde" só faz sentido quando existe vínculo. No fallback
            cadastral o campo é omitido em vez de exibir "Não informado", que
            insinuaria um vínculo sem data.

            "Função" (do mockup) não é renderizada: `users.accessLevel` é perfil
            de autorização com fallback "Operador", não função operacional —
            exibi-la afirmaria algo que o dado não sustenta.
          */}
          {binomial ? (
            <dl className="mt-4">
              <ProfileField
                label="Vínculo desde"
                value={
                  binomial.startAt
                    ? dateFormatter.format(binomial.startAt)
                    : NOT_INFORMED
                }
              />
            </dl>
          ) : null}

          {isLegacyFallback ? (
            // Nenhum path/coleção interna na superfície: só o que o dado
            // significa para quem opera.
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
              Condutor indicado no cadastro do K9. Não há binômio ativo
              registrado.
            </p>
          ) : null}
        </>
      )}

      <div className="mt-auto pt-4">
        {binomial ? (
          <Link
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-300/[0.08] px-3 py-2.5 text-xs font-bold text-cyan-200 transition hover:border-cyan-300/40 hover:bg-cyan-300/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
            href={`/binomials/${encodeURIComponent(binomial.id)}`}
          >
            <Users aria-hidden className="h-4 w-4" />
            Ver perfil do binômio
          </Link>
        ) : (
          // Sem vínculo real não há destino: a ação fica desabilitada em vez
          // de apontar para uma rota inexistente. O texto não cita coleção.
          <button
            aria-label="Ver perfil do binômio — indisponível: sem binômio ativo"
            className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5 text-xs font-bold text-slate-600"
            disabled
            title="Sem binômio ativo registrado para este K9"
            type="button"
          >
            <Users aria-hidden className="h-4 w-4" />
            Ver perfil do binômio
          </button>
        )}
      </div>
    </div>
  );
}
