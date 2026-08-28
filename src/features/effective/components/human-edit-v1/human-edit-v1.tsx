"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleAlert, Loader, UserRound } from "lucide-react";

import { useAccessControl } from "@/features/access/providers/access-control-provider";
import { loadHumanForEdit } from "@/features/effective/data/human-edit-service";
import { paths } from "@/lib/routes/paths";

import {
  HumanEditArchivedState,
  HumanEditConflictNotice,
} from "./human-edit-conflict";
import {
  HumanEditContactNotes,
  HumanEditFunctionalData,
  HumanEditIdentification,
  type HumanEditFieldErrors,
} from "./human-edit-fields";
import { HumanEditSaveError, saveHumanEdit } from "./human-edit-save";
import {
  HUMAN_EDIT_FIELDS,
  HumanEditError,
  type HumanEditField,
  type HumanEditPersonnel,
} from "./human-edit-types";

/**
 * Human Edit V1 — tela de edição de PESSOAL.
 *
 * Consome as três autoridades congeladas e não reinventa nenhuma delas:
 *   B2 `loadHumanForEdit`  → baseline / versionToken / archived
 *   A1 (via C1)            → diff / clear / campos obrigatórios
 *   C1 `saveHumanEdit`     → no-op, payload, categorias de erro
 *
 * Esta tela NÃO chama o callable B1 diretamente, NÃO monta payload, NÃO
 * interpreta a prose do backend. `PRECONDITION_FAILED` é resolvido re-lendo
 * via B2: archived vira estado arquivado, ativo vira CONFLITO com o rascunho
 * preservado. Sem retry, sem merge, sem overwrite silencioso.
 *
 * Escopo: apenas os 12 campos de pessoal. Acesso, autenticação, formação,
 * vínculos e foto são gerenciados em seus próprios módulos.
 */

type LoadState =
  | "loading"
  | "ready"
  | "missing"
  | "archived"
  | "error"
  | "denied";

/**
 * Janela em que o sucesso confirmado fica visível antes da navegação para o
 * perfil. Curta o suficiente para não parecer travamento, longa o suficiente
 * para ser lida e anunciada por leitor de tela.
 */
const SUCCESS_NAVIGATION_DELAY_MS = 1000;

function profilePath(ra: string) {
  return `${paths.humans}/${encodeURIComponent(ra)}`;
}

/** Validação de UI para os dois obrigatórios; A1/C1 seguem sendo definitivos. */
function validateRequired(values: HumanEditPersonnel): HumanEditFieldErrors {
  const errors: HumanEditFieldErrors = {};
  if (!values.fullName.trim()) errors.fullName = "Informe o nome completo.";
  if (!values.callsign.trim()) errors.callsign = "Informe o nome de guerra.";
  return errors;
}

export function HumanEditV1({ ra }: { ra: string }) {
  const router = useRouter();
  const { can } = useAccessControl();
  const canEditHuman = can("humans", "edit");

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [baseline, setBaseline] = useState<HumanEditPersonnel | null>(null);
  const [draft, setDraft] = useState<HumanEditPersonnel | null>(null);
  const [versionToken, setVersionToken] = useState<number | null>(null);
  const [errors, setErrors] = useState<HumanEditFieldErrors>({});
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  /**
   * Transição de SUCESSO CONFIRMADO: só vira `true` depois que C1 resolveu sem
   * erro. Nunca em load, validação, conflito ou qualquer categoria de falha.
   */
  const [saved, setSaved] = useState(false);
  const [showDirtyConfirm, setShowDirtyConfirm] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  /**
   * Trava de submit. Cobre DOIS intervalos contíguos: o save em voo E a janela
   * de sucesso até a navegação. Nunca é liberada no caminho de sucesso, de modo
   * que a proteção contra duplo submit não abre uma brecha de ~1s.
   */
  const submitLockRef = useRef(false);
  /** Um único timer governa a navegação de sucesso. */
  const successTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    // Sem humans.edit: NÃO carrega. A supressão do load precede a leitura de
    // users/{ra} — a autoridade de permissão participa da lista de dependências,
    // então uma transição false→true religa o carregamento autorizado, e um
    // true→false em voo é neutralizado pelo cleanup (`active = false`). O estado
    // "não permitido" já é resolvido em tempo de render (early return abaixo),
    // então aqui basta não ler — sem setState síncrono no corpo do effect.
    if (!canEditHuman) {
      return () => {
        active = false;
      };
    }
    async function load() {
      setLoadState("loading");
      try {
        const loaded = await loadHumanForEdit(ra);
        if (!active) return;
        if (!loaded) {
          setLoadState("missing");
          return;
        }
        setBaseline(loaded.baseline);
        setDraft({ ...loaded.baseline });
        setVersionToken(loaded.versionToken);
        setErrors({});
        setConflict(false);
        setLoadState(loaded.archived ? "archived" : "ready");
      } catch {
        // Falha de leitura NUNCA é "não encontrado": estados distintos.
        if (active) setLoadState("error");
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [ra, reloadKey, canEditHuman]);

  /** Dirty cobre exatamente os 12 campos de pessoal — nada de acesso/Auth/foto. */
  const isDirty = useMemo(() => {
    if (!draft || !baseline) return false;
    return HUMAN_EDIT_FIELDS.some(
      (key) => draft[key].trim() !== baseline[key].trim(),
    );
  }, [baseline, draft]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      // Após um save CONFIRMADO o rascunho segue "sujo" contra o baseline lido
      // (o baseline não é reescrito localmente), então avisar "não salvo" na
      // janela de sucesso seria enganoso. A proteção normal de edição continua
      // intacta: só o pós-sucesso é suprimido.
      if (isDirty && !saved) {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, saved]);

  /** Timer de sucesso não sobrevive ao unmount — nem navega, nem seta estado. */
  useEffect(() => {
    return () => {
      if (successTimerRef.current !== null) {
        window.clearTimeout(successTimerRef.current);
        successTimerRef.current = null;
      }
    };
  }, []);

  const setField = useCallback((key: HumanEditField, value: string) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setErrors((current) => ({ ...current, [key]: undefined, form: undefined }));
  }, []);

  /**
   * Saída controlada por esta tela. Um rascunho sujo nunca é descartado em
   * silêncio. Links de sidebar/topbar estão fora do controle deste componente
   * e permanecem uma limitação herdada da arquitetura.
   */
  function handleCancel() {
    // Durante a janela de sucesso, Cancelar não pode criar uma segunda
    // navegação nem um fluxo de descarte contraditório.
    if (submitLockRef.current) return;
    if (!isDirty) {
      router.push(profilePath(ra));
      return;
    }
    setShowDirtyConfirm(true);
  }

  function confirmDiscard() {
    setShowDirtyConfirm(false);
    router.push(profilePath(ra));
  }

  /** Reload EXPLÍCITO do conflito: adota a versão do servidor e some o rascunho. */
  async function handleConflictReload() {
    try {
      const current = await loadHumanForEdit(ra);
      if (!current) {
        setConflict(false);
        setLoadState("missing");
        return;
      }
      setBaseline(current.baseline);
      setDraft({ ...current.baseline });
      setVersionToken(current.versionToken);
      setErrors({});
      setConflict(false);
      setLoadState(current.archived ? "archived" : "ready");
    } catch {
      // Recarregar falhou: mantém o conflito e o rascunho na tela.
      setErrors((prev) => ({
        ...prev,
        form: "Não foi possível recarregar o cadastro. Tente novamente.",
      }));
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitLockRef.current) return;
    if (!canEditHuman) {
      setErrors({ form: "Seu perfil não permite editar este integrante." });
      return;
    }
    if (!draft || !baseline) return;

    const nextErrors = validateRequired(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    submitLockRef.current = true;
    setSaving(true);
    setConflict(false);
    try {
      // C1 decide no-op × payload; a UI não monta request nem chama B1.
      await saveHumanEdit({ ra, baseline, current: draft, versionToken });
      // Sucesso CONFIRMADO. A trava de submit NÃO é liberada aqui: ela segue
      // valendo por toda a janela de sucesso até a navegação, então nenhum
      // segundo save cabe entre a resolução e o `router.push`.
      setSaving(false);
      setSaved(true);
      scheduleSuccessNavigation();
    } catch (error) {
      // Somente falha devolve o formulário ao usuário.
      submitLockRef.current = false;
      setSaving(false);
      await handleSaveError(error);
    }
  }

  /**
   * Agenda a navegação pós-sucesso. Idempotente por construção: só é chamada no
   * caminho de sucesso, que é alcançável uma única vez por causa da trava de
   * submit, e ainda assim recusa agendar um segundo timer.
   */
  function scheduleSuccessNavigation() {
    if (successTimerRef.current !== null) return;
    successTimerRef.current = window.setTimeout(() => {
      successTimerRef.current = null;
      router.push(profilePath(ra));
    }, SUCCESS_NAVIGATION_DELAY_MS);
  }

  /**
   * `PRECONDITION_FAILED` cobre concorrência obsoleta E registro arquivado, de
   * modo que a distinção vem de RE-LER o estado atual (B2) — nunca de casar
   * texto da mensagem do backend.
   */
  async function handleSaveError(error: unknown) {
    const typed =
      error instanceof HumanEditSaveError
        ? error
        : error instanceof HumanEditError
          ? new HumanEditSaveError("INVALID_ARGUMENT", error.message)
          : new HumanEditSaveError(
              "UNKNOWN",
              "Não foi possível salvar as alterações.",
            );

    if (typed.category === "PRECONDITION_FAILED") {
      try {
        const current = await loadHumanForEdit(ra);
        if (!current) {
          setLoadState("missing");
          return;
        }
        if (current.archived) {
          setLoadState("archived");
          return;
        }
      } catch {
        // Re-leitura falhou: cai no conflito, que preserva o rascunho.
      }
      // Rascunho, baseline e versionToken permanecem INTOCADOS.
      setConflict(true);
      return;
    }

    switch (typed.category) {
      case "UNAUTHENTICATED":
        setErrors({
          form: "Sua sessão expirou. Entre novamente para continuar.",
        });
        return;
      case "PERMISSION_DENIED":
        setErrors({ form: "Seu perfil não permite editar este integrante." });
        return;
      case "INVALID_ARGUMENT":
        setErrors({
          form: "Não foi possível salvar: revise os campos do cadastro.",
        });
        return;
      case "NOT_FOUND":
        setErrors({ form: "Integrante não encontrado." });
        return;
      default:
        setErrors({
          form: "Não foi possível salvar as alterações. Tente novamente.",
        });
    }
  }

  if (!canEditHuman) {
    return (
      <section
        className="rounded-2xl border border-cyan-200/12 bg-[#0b1628]/82 p-6"
        role="alert"
      >
        <h2 className="text-lg font-black tracking-tight text-white">
          Edição não permitida
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
          Seu perfil de acesso não permite editar os dados de pessoal deste
          integrante.
        </p>
      </section>
    );
  }

  if (loadState === "loading") {
    return (
      <div className="flex h-96 items-center justify-center" role="status">
        <Loader aria-hidden className="h-6 w-6 animate-spin text-cyan-300" />
        <span className="ml-3 text-sm text-slate-400">
          Carregando cadastro…
        </span>
      </div>
    );
  }

  if (loadState === "missing") {
    return (
      <section
        className="rounded-2xl border border-cyan-200/12 bg-[#0b1628]/82 p-6"
        role="alert"
      >
        <h2 className="text-lg font-black tracking-tight text-white">
          Integrante não localizado para edição.
        </h2>
      </section>
    );
  }

  if (loadState === "error") {
    return (
      <section
        className="rounded-2xl border border-red-300/25 bg-red-300/[0.07] p-6"
        role="alert"
      >
        <h2 className="text-lg font-black tracking-tight text-white">
          Falha ao carregar o cadastro.
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Não foi possível ler os dados deste integrante.
        </p>
        <button
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-slate-300 transition hover:border-cyan-300/30 hover:text-cyan-100"
          onClick={() => setReloadKey((key) => key + 1)}
          type="button"
        >
          Tentar novamente
        </button>
      </section>
    );
  }

  if (loadState === "archived") {
    return <HumanEditArchivedState ra={ra} />;
  }

  if (!draft) return null;

  return (
    <>
      <form className="space-y-6" noValidate onSubmit={handleSubmit}>
        <header className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-200">
            <UserRound aria-hidden className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-black tracking-tight text-white">
              Editar integrante
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-400">
              Dados funcionais e administrativos de pessoal. Acesso,
              autenticação, formação e vínculos são gerenciados em seus próprios
              módulos.
            </p>
          </div>
        </header>

        {saved ? (
          <div
            aria-live="polite"
            className="rounded-2xl border border-green-400/25 bg-green-400/10 px-4 py-3 text-sm text-green-200"
            role="status"
          >
            Alterações salvas com sucesso.
          </div>
        ) : null}

        {conflict ? (
          <HumanEditConflictNotice onReload={handleConflictReload} />
        ) : null}

        {errors.form ? (
          <div
            className="flex items-start gap-2 rounded-2xl border border-red-300/25 bg-red-300/[0.07] p-4"
            role="alert"
          >
            <CircleAlert
              aria-hidden
              className="mt-0.5 h-4 w-4 shrink-0 text-red-300"
            />
            <p className="text-sm text-red-100">{errors.form}</p>
          </div>
        ) : null}

        <section className="rounded-2xl border border-cyan-200/12 bg-[#0b1628]/82 p-6">
          <h2 className="mb-4 text-xs font-black uppercase tracking-wider text-cyan-200/80">
            Identificação
          </h2>
          <HumanEditIdentification
            errors={errors}
            onChange={setField}
            ra={ra}
            values={draft}
          />
        </section>

        <section className="rounded-2xl border border-cyan-200/12 bg-[#0b1628]/82 p-6">
          <h2 className="mb-4 text-xs font-black uppercase tracking-wider text-cyan-200/80">
            Dados funcionais
          </h2>
          <HumanEditFunctionalData
            errors={errors}
            onChange={setField}
            values={draft}
          />
        </section>

        <section className="rounded-2xl border border-cyan-200/12 bg-[#0b1628]/82 p-6">
          <h2 className="mb-4 text-xs font-black uppercase tracking-wider text-cyan-200/80">
            Contato e observações
          </h2>
          <HumanEditContactNotes
            errors={errors}
            onChange={setField}
            values={draft}
          />
        </section>

        <div className="flex flex-wrap gap-3">
          <button
            className="rounded-xl border border-slate-400/20 bg-slate-400/[0.08] px-5 py-2.5 text-xs font-bold text-slate-300 transition hover:bg-slate-400/[0.15] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={saved}
            onClick={handleCancel}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-5 py-2.5 text-xs font-bold text-cyan-100 transition hover:bg-cyan-300/[0.16] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={saving || saved || !isDirty}
            type="submit"
          >
            {saving ? "Salvando…" : "Salvar alterações"}
          </button>
        </div>
      </form>

      {showDirtyConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div
            aria-labelledby="human-edit-discard-title"
            aria-modal="true"
            className="w-full max-w-sm rounded-2xl border border-amber-300/20 bg-[#0b1628] p-6 shadow-2xl"
            role="dialog"
          >
            <h2
              className="text-lg font-black text-white"
              id="human-edit-discard-title"
            >
              Descartar alterações?
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Há alterações não salvas neste cadastro.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                className="flex-1 rounded-xl border border-slate-400/20 bg-slate-400/[0.08] px-4 py-2.5 text-xs font-bold text-slate-300 transition hover:bg-slate-400/[0.15]"
                onClick={() => setShowDirtyConfirm(false)}
                type="button"
              >
                Continuar editando
              </button>
              <button
                className="flex-1 rounded-xl border border-amber-300/25 bg-amber-300/10 px-4 py-2.5 text-xs font-bold text-amber-200 transition hover:bg-amber-300/[0.15]"
                onClick={confirmDiscard}
                type="button"
              >
                Descartar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
