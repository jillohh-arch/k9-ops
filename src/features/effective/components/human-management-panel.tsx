"use client";

import {
  Check,
  Copy,
  KeyRound,
  LoaderCircle,
  ShieldAlert,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  UserX,
  UserCheck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAccessControl } from "@/features/access/providers/access-control-provider";
import { useAccessProfiles } from "@/features/access/hooks/use-access-profiles";
import { unassignUserAccessProfile } from "@/features/access/data/access-profile-service";
import { useAuth } from "@/features/auth/providers/auth-provider";
import { resolveHumanAccessReadModel } from "@/features/effective/lib/human-access-read-model";
import { defaultAccessProfiles } from "@/lib/permissions/access-control";
import { paths } from "@/lib/routes/paths";
import { cn } from "@/lib/utils";
import {
  deactivateHumanLifecycle,
  isHumanLifecycleActive,
  LIFECYCLE_MIN_REASON_LENGTH,
  reactivateHumanLifecycle,
  type HumanLifecycleError,
  type HumanLifecycleRecord,
} from "@/features/effective/data/human-lifecycle-service";
import {
  getUserRoles,
  resetHumanPassword,
  toggleInstructorRole,
} from "@/features/effective/data/human-management-service";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type HumanManagementPanelProps = {
  ra: string;
  /**
   * Documento canonico de `users/{ra}` observado pela pagina via onSnapshot.
   *
   * E a MESMA versao que alimenta o estado exibido e o `expectedUpdatedAt` da
   * mutation, o que elimina a segunda autoridade de `active` que o painel
   * mantinha via `getUserStatus`. Sem leitura propria: o painel nao consulta
   * Firestore.
   */
  record?: HumanLifecycleRecord;
  userName?: string;
};

// ---------------------------------------------------------------------------
// Feedback banner
// ---------------------------------------------------------------------------

/** Liga a explicacao do early self-guard ao botao via aria-describedby. */
const SELF_GUARD_HINT_ID = "human-lifecycle-self-guard-hint";

type FeedbackType = "success" | "error" | "info";

function Feedback({
  message,
  type,
}: {
  message: string | null;
  type: FeedbackType;
}) {
  if (!message) return null;

  const colorMap: Record<FeedbackType, string> = {
    success: "border-green-400/25 bg-green-400/10 text-green-200",
    error: "border-red-400/25 bg-red-400/10 text-red-200",
    info: "border-cyan-300/25 bg-cyan-300/10 text-cyan-200",
  };

  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${colorMap[type]}`}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function HumanManagementPanel({
  ra,
  record,
  userName,
}: HumanManagementPanelProps) {
  const router = useRouter();
  const { can } = useAccessControl();
  const { profile } = useAuth();

  /**
   * Autoridades SEPARADAS (contrato A1 + W1).
   *
   * O painel antes usava um unico gate `access.edit` para tudo, o que era amplo
   * demais para lifecycle e, pior, excluia o `gestor` — que possui
   * `humans.archive` e nao conseguia desativar ninguem. Agora cada secao
   * respeita a sua propria capability.
   */
  const canManageLifecycle = can("humans", "archive");
  const canManageAccess = can("access", "edit");

  /**
   * Estado de lifecycle derivado do snapshot recebido — nao de uma leitura
   * propria. Botao exibido e token de OCC vem da mesma versao do documento.
   */
  const userActive = isHumanLifecycleActive(record);

  /**
   * Early guard de auto-desativacao. O backend permanece a autoridade
   * (`SELF_DEACTIVATION_FORBIDDEN`); isto apenas evita uma ida de rede com erro
   * previsivel. Quando o RA do usuario logado nao pode ser resolvido, NAO
   * adivinhamos: a acao segue habilitada e o servidor decide.
   */
  const currentRa = typeof profile?.ra === "string" ? profile.ra.trim() : "";
  const isSelf = currentRa.length > 0 && currentRa === ra.trim();

  const { profiles: availableProfiles } = useAccessProfiles();
  const accessModel = useMemo(
    () =>
      resolveHumanAccessReadModel(
        record,
        availableProfiles.length ? availableProfiles : defaultAccessProfiles,
      ),
    [record, availableProfiles],
  );

  // State
  const [isInstructor, setIsInstructor] = useState(false);
  const [deactivateReason, setDeactivateReason] = useState("");
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  /**
   * Carregamento das roles de instrutor (dominio de ACESSO).
   *
   * Inicia `true` somente quando ha algo a carregar. Quem tem apenas
   * `humans.archive` nunca dispara esse fetch e nao deve ver spinner: o estado
   * de lifecycle vem do snapshot, nao de leitura propria.
   */
  const [rolesLoading, setRolesLoading] = useState(canManageAccess);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    message: string;
    type: FeedbackType;
  } | null>(null);

  // Dialogs
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [reactivateDialogOpen, setReactivateDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [unassignDialogOpen, setUnassignDialogOpen] = useState(false);

  // Nova senha temporária gerada pelo reset
  const [newTemporaryPassword, setNewTemporaryPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Feedback with auto-dismiss
  const showFeedback = useCallback((message: string, type: FeedbackType) => {
    setFeedback({ message, type });
    if (type === "success" || type === "info") {
      setTimeout(() => setFeedback(null), 5000);
    }
  }, []);

  /**
   * Carrega SOMENTE o que pertence ao dominio de acesso (roles de instrutor).
   *
   * O status de lifecycle deixou de ser lido aqui: vem do snapshot da pagina.
   * Sem `access.edit` nao ha nada a carregar, porque a unica secao que usa este
   * dado e a de Permissoes e Roles.
   */
  useEffect(() => {
    // Sem `access.edit` nao ha carregamento a fazer. O early return e
    // deliberado: `react-hooks/set-state-in-effect` e ERROR neste repo, entao o
    // estado de carregamento e DERIVADO (ver `loading` abaixo), nunca setado
    // sincronamente no corpo do efeito.
    if (!ra || !canManageAccess) return;

    async function load() {
      setRolesLoading(true);
      try {
        const roles = await getUserRoles(ra);
        setIsInstructor(
          roles.includes("instrutor_k9") ||
            roles.includes("instrutor") ||
            roles.includes("adestrador"),
        );
      } catch {
        showFeedback("Falha ao carregar dados do usuário.", "error");
      } finally {
        setRolesLoading(false);
      }
    }

    load();
  }, [ra, canManageAccess, showFeedback]);

  /** Sem nenhuma das duas autoridades o painel inteiro nao existe. */
  if (!canManageLifecycle && !canManageAccess) return null;

  // ----- Handlers -----

  async function handleToggleInstructor() {
    setActionLoading("instructor");
    setFeedback(null);
    try {
      const next = !isInstructor;
      await toggleInstructorRole(ra, next);
      setIsInstructor(next);
      showFeedback(
        next
          ? "Role de instrutor atribuída com sucesso."
          : "Role de instrutor removida com sucesso.",
        "success",
      );
    } catch {
      showFeedback("Falha ao alterar role de instrutor.", "error");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUnassignProfile() {
    setActionLoading("unassign");
    setFeedback(null);
    try {
      await unassignUserAccessProfile(ra, profile?.ra ?? null);
      setUnassignDialogOpen(false);
      showFeedback(
        "Perfil de acesso desvinculado com sucesso. O acesso base agora está Não provisionado.",
        "success",
      );
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : "Falha ao desvincular perfil de acesso.";
      showFeedback(msg, "error");
    } finally {
      setActionLoading(null);
    }
  }

  /**
   * Resolve a mensagem descritiva e acionável para erros de lifecycle.
   */
  function resolveLifecycleErrorMessage(error: unknown): string {
    if (error && typeof error === "object") {
      const category = (error as { category?: unknown }).category;
      if (typeof category === "string") {
        switch (category) {
          case "ALREADY_IN_STATE":
            return "O estado deste agente já está atualizado. Nenhuma alteração era necessária.";
          case "ACTIVE_SHIFT":
            return "Não é possível desativar este agente enquanto houver turno ativo. Regularize o turno primeiro.";
          case "STALE_WRITE":
            return "Este cadastro foi alterado por outra sessão. Nada foi sobrescrito — revise os dados atualizados antes de tentar novamente.";
          case "SELF_DEACTIVATION_FORBIDDEN":
            return "Não é possível desativar o seu próprio cadastro.";
          case "PERMISSION_DENIED":
            return "Seu perfil não permite alterar o estado de agentes.";
          case "NOT_FOUND":
            return "Cadastro não encontrado.";
          case "AUTH_IDENTITY_BROKEN":
            return "O vínculo com a conta de acesso deste agente está inconsistente. Regularize o provisionamento antes de alterar o estado.";
          case "AUTH_APPLIED_AUDIT_FAILED":
            return "O acesso do agente foi suspenso, mas não foi possível registrar a auditoria. Confira os dados atualizados antes de nova ação.";
          case "AUTH_ENABLE_REVERTED_AUDIT_FAILED":
            return "Não foi possível concluir a reativação do acesso. A alteração foi revertida e a conta permanece bloqueada. Confira os dados atualizados.";
          case "COMPENSATION_FAILED":
            return "A operação não pôde ser concluída com segurança e o estado pode estar inconsistente. Confira os dados atualizados antes de qualquer nova ação.";
          case "INVALID_INPUT":
            return (error as { message?: string }).message || "Dados inválidos para alterar o estado do agente.";
          default:
            return (error as { message?: string }).message || "Falha ao alterar o estado do agente.";
        }
      }
    }
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return "Falha ao alterar o estado do agente.";
  }

  /**
   * Feedback de erro de lifecycle.
   *
   * A categoria vem de `details.reason`, e a distincao mais importante e entre
   * "nada aconteceu" e "o acesso FOI suspenso, mas a auditoria falhou". Dizer
   * "nao foi possivel desativar" no segundo caso levaria o operador a acreditar
   * que a pessoa continua com acesso.
   */
  function showLifecycleError(error: HumanLifecycleError) {
    const message = resolveLifecycleErrorMessage(error);
    const type: FeedbackType =
      error?.category === "ALREADY_IN_STATE" ? "info" : "error";
    showFeedback(message, type);
  }

  async function handleDeactivate() {
    if (deactivateReason.trim().length < LIFECYCLE_MIN_REASON_LENGTH) return;
    if (actionLoading) return;
    setActionLoading("deactivate");
    setFeedback(null);
    setDeactivateError(null);
    try {
      // O backend escreve o lifecycle canonico (active/status/deleted_*) e
      // audita no servidor. O painel nao escreve Firestore e nao sintetiza
      // estado: o onSnapshot da pagina refletira a mudanca.
      const result = await deactivateHumanLifecycle({
        ra,
        reason: deactivateReason,
        record,
      });
      setDeactivateDialogOpen(false);
      setDeactivateReason("");
      setDeactivateError(null);
      router.refresh();
      showFeedback(
        result.authState === "not_provisioned"
          ? "Agente desativado. Não havia conta de acesso provisionada para suspender."
          : result.reconciliationOnly
            ? "Acesso do agente suspenso. O cadastro já estava inativo."
            : "Agente desativado com sucesso.",
        "success",
      );
    } catch (error) {
      const message = resolveLifecycleErrorMessage(error);
      setDeactivateError(message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReactivate() {
    if (actionLoading) return;
    setActionLoading("reactivate");
    setFeedback(null);
    try {
      // `reason` e OMITIDO no V1 — nunca enviado como string vazia.
      const result = await reactivateHumanLifecycle({ ra, record });
      setReactivateDialogOpen(false);
      router.refresh();
      showFeedback(
        result.authState === "not_provisioned"
          ? "Agente reativado. Não há conta de acesso provisionada — o acesso depende de provisionamento."
          : result.reconciliationOnly
            ? "Acesso do agente restabelecido. O cadastro já estava ativo."
            : "Agente reativado com sucesso.",
        "success",
      );
    } catch (error) {
      showLifecycleError(error as HumanLifecycleError);
    } finally {
      setActionLoading(null);
    }
  }

  async function handlePasswordReset() {
    setActionLoading("reset");
    setFeedback(null);
    try {
      const result = await resetHumanPassword(ra);
      setResetDialogOpen(false);
      if (result.success && result.temporaryPassword) {
        setNewTemporaryPassword(result.temporaryPassword);
        setCopied(false);
      } else {
        showFeedback(result.message, "error");
      }
    } catch {
      showFeedback("Falha ao gerar nova senha. Tente novamente.", "error");
    } finally {
      setActionLoading(null);
    }
  }

  function handleCopyPassword() {
    if (!newTemporaryPassword) return;
    navigator.clipboard.writeText(newTemporaryPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  /*
    Spinner apenas enquanto as roles de ACESSO carregam. Quem tem somente
    `humans.archive` nao espera nada: o estado de lifecycle ja veio no snapshot.
  */
  if (rolesLoading) {
    return (
      <section className="rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5">
        <h2 className="text-sm font-black text-white">Gestão de Acesso</h2>
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Carregando...
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5">
      <h2 className="flex items-center gap-2 text-sm font-black text-white">
        <ShieldCheck className="h-4 w-4 text-cyan-300" />
        Gestão de Acesso
      </h2>

      {feedback ? (
        <div className="mt-4">
          <Feedback message={feedback.message} type={feedback.type} />
        </div>
      ) : null}

      {/* ------ Permissões e Roles ------ (autoridade: access.edit) */}
      {canManageAccess ? (
      <div className="mt-5 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Permissões e Roles
        </h3>

        <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-4 w-4 text-amber-300" />
            <div>
              <p className="text-sm font-semibold text-slate-100">
                Instrutor K9
              </p>
              <p className="text-xs text-slate-500">
                Permite acesso a funcionalidades de instrução e treinamento
              </p>
            </div>
          </div>
          <button
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-50"
            disabled={actionLoading === "instructor"}
            onClick={handleToggleInstructor}
            type="button"
            aria-label={
              isInstructor ? "Remover role de instrutor" : "Atribuir role de instrutor"
            }
          >
            {actionLoading === "instructor" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : isInstructor ? (
              <ToggleRight className="h-4 w-4 text-green-400" />
            ) : (
              <ToggleLeft className="h-4 w-4 text-slate-500" />
            )}
            {isInstructor ? "Ativo" : "Inativo"}
          </button>
        </div>

        {/* Perfil de Acesso */}
        <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-4 w-4 text-cyan-300" />
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-100">
                  {accessModel.profileName ?? (accessModel.status === "unprovisioned" ? "Não provisionado" : accessModel.detail)}
                </p>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                    accessModel.status === "configured"
                      ? "border-green-400/20 bg-green-400/10 text-green-300"
                      : accessModel.status === "incomplete"
                        ? "border-amber-400/20 bg-amber-400/10 text-amber-300"
                        : "border-slate-500/20 bg-slate-500/10 text-slate-400",
                  )}
                >
                  {accessModel.statusLabel}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {accessModel.status === "configured"
                  ? "Autoridade base atribuída via perfil de acesso."
                  : accessModel.status === "incomplete"
                    ? "Referência de acesso inconsistente ou não localizada."
                    : "Sem perfil base de acesso vinculado."}
              </p>
            </div>
          </div>

          {accessModel.hasAccess || accessModel.profileId ? (
            <button
              className="rounded-lg border border-red-400/20 bg-red-400/[0.06] px-3 py-2 text-sm font-medium text-red-300 transition hover:bg-red-400/[0.12] disabled:opacity-50"
              disabled={!!actionLoading || !userActive}
              onClick={() => setUnassignDialogOpen(true)}
              title={
                !userActive
                  ? "Reative o integrante antes de alterar o perfil de acesso."
                  : undefined
              }
              type="button"
            >
              <span className="flex items-center gap-2">
                {actionLoading === "unassign" ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <UserX className="h-4 w-4" />
                )}
                Desvincular perfil
              </span>
            </button>
          ) : (
            <Link
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-300/25 bg-cyan-300/[0.08] px-3 py-2 text-xs font-bold text-cyan-200 transition hover:bg-cyan-300/[0.16]"
              href={paths.access}
            >
              Atribuir em Acessos
            </Link>
          )}
        </div>
      </div>
      ) : null}

      {/* ------ Desativar / Reativar ------ (autoridade: humans.archive) */}
      {canManageLifecycle ? (
      <div className="mt-5 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Status do Agente
        </h3>

        {userActive ? (
          <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
            <div className="flex items-center gap-3">
              <UserCheck className="h-4 w-4 text-green-400" />
              <div>
                <p className="text-sm font-semibold text-slate-100">
                  Agente ativo
                </p>
                {/*
                  Early guard de auto-desativacao: a acao permanece VISIVEL e
                  apenas desabilitada, e a razao e TEXTO PERCEPTIVEL — nao
                  apenas `title`, que e invisivel para teclado e touch.
                  O backend continua sendo a autoridade.

                  A subcopy permanente descreve APENAS o estado de LIFECYCLE.
                  Ela nao pode afirmar nada sobre acesso: `active` nao prova
                  que exista conta de autenticacao ou perfil provisionado — um
                  Personnel sem Auth e sem `access_profile_id` e ativo e nao
                  possui acesso algum. Quem fala de acesso e o banner especifico
                  da operacao, que le `authState` do backend.
                */}
                <p
                  className={
                    isSelf
                      ? "text-xs text-amber-200/85"
                      : "text-xs text-slate-500"
                  }
                  id={isSelf ? SELF_GUARD_HINT_ID : undefined}
                >
                  {isSelf
                    ? "Você não pode desativar seu próprio cadastro."
                    : "O agente está ativo no cadastro operacional."}
                </p>
              </div>
            </div>
            <button
              aria-describedby={isSelf ? SELF_GUARD_HINT_ID : undefined}
              className="rounded-lg border border-red-400/20 bg-red-400/[0.06] px-3 py-2 text-sm font-medium text-red-300 transition hover:bg-red-400/[0.12] disabled:opacity-50"
              disabled={!!actionLoading || isSelf}
              onClick={() => {
                setDeactivateError(null);
                setDeactivateDialogOpen(true);
              }}
              title={
                isSelf
                  ? "Você não pode desativar seu próprio cadastro."
                  : undefined
              }
              type="button"
            >
              <span className="flex items-center gap-2">
                <UserX className="h-4 w-4" />
                Desativar
              </span>
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-xl border border-red-400/15 bg-red-400/[0.04] px-4 py-3">
            <div className="flex items-center gap-3">
              <UserX className="h-4 w-4 text-red-400" />
              <div>
                <p className="text-sm font-semibold text-red-200">
                  Agente desativado
                </p>
                {/* Mesma regra da subcopy ativa: lifecycle, nunca acesso. */}
                <p className="text-xs text-slate-500">
                  O agente está desativado no cadastro operacional.
                </p>
              </div>
            </div>
            {/* Reativar passa por confirmacao explicita (W1); sem motivo. */}
            <button
              className="rounded-lg border border-green-400/20 bg-green-400/[0.06] px-3 py-2 text-sm font-medium text-green-300 transition hover:bg-green-400/[0.12] disabled:opacity-50"
              disabled={!!actionLoading}
              onClick={() => setReactivateDialogOpen(true)}
              type="button"
            >
              <span className="flex items-center gap-2">
                {actionLoading === "reactivate" ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <UserCheck className="h-4 w-4" />
                )}
                Reativar
              </span>
            </button>
          </div>
        )}
      </div>
      ) : null}

      {/* ------ Reset de Senha ------ (autoridade: access.edit) */}
      {canManageAccess ? (
      <div className="mt-5 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Credenciais
        </h3>

        <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
          <div className="flex items-center gap-3">
            <KeyRound className="h-4 w-4 text-cyan-300" />
            <div>
              <p className="text-sm font-semibold text-slate-100">
                Nova senha temporária
              </p>
              <p className="text-xs text-slate-500">
                Gera uma nova senha para o agente fazer login
              </p>
            </div>
          </div>
          <button
            className="rounded-lg border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-300/[0.12] disabled:opacity-50"
            disabled={!!actionLoading}
            onClick={() => setResetDialogOpen(true)}
            type="button"
          >
            <span className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              Gerar senha
            </span>
          </button>
        </div>
      </div>
      ) : null}

      {/* ------ Dialog: Desativar ------ */}
      {deactivateDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1b2a] p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Desativar agente</h3>
            {/*
              Mesma fronteira da subcopy permanente: a DESATIVACAO e certa, a
              suspensao de acesso e CONDICIONAL. Espelha o modal de Reativar —
              um Personnel sem conta provisionada nao tem acesso a suspender, e
              prometer isso seria falso justamente no caso do fixture 990011.
              A condicional e textual: o painel NAO consulta Auth nem
              `access_profile_id` para decidir a copy.
            */}
            <p className="mt-2 text-sm text-slate-400">
              Esta ação desativa o agente{userName ? ` ${userName}` : ""} (RA:{" "}
              {ra}) no cadastro operacional. Caso exista conta de acesso
              provisionada, o acesso ao sistema será suspenso. Informe o motivo
              da desativação.
            </p>

            {deactivateError ? (
              <div className="mt-4">
                <Feedback message={deactivateError} type="error" />
              </div>
            ) : null}

            <label className="mt-4 block text-xs font-semibold text-slate-300" htmlFor="deactivate-reason">
              Motivo (mínimo 5 caracteres)
            </label>
            <textarea
              id="deactivate-reason"
              className="mt-1 h-20 w-full resize-none rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-white/[0.05]"
              onChange={(event) => {
                setDeactivateReason(event.target.value);
                if (deactivateError) setDeactivateError(null);
              }}
              placeholder="Informe o motivo da desativação"
              value={deactivateReason}
            />
            <div className="mt-5 flex gap-3">
              <button
                className="flex-1 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] px-4 py-3 text-sm font-semibold text-cyan-200 hover:bg-cyan-300/[0.12] disabled:opacity-50"
                disabled={Boolean(actionLoading)}
                onClick={() => {
                  setDeactivateDialogOpen(false);
                  setDeactivateReason("");
                  setDeactivateError(null);
                }}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="flex-1 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm font-bold text-red-200 hover:bg-red-400/[0.18] disabled:opacity-50"
                disabled={
                  deactivateReason.trim().length <
                    LIFECYCLE_MIN_REASON_LENGTH ||
                  !!actionLoading
                }
                onClick={handleDeactivate}
                type="button"
              >
                {actionLoading === "deactivate"
                  ? "Desativando..."
                  : "Desativar agente"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ------ Dialog: Reativar ------ */}
      {reactivateDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1b2a] p-6 shadow-2xl">
            <UserCheck className="h-7 w-7 text-green-400" />
            <h3 className="mt-3 text-lg font-bold text-white">
              Reativar agente
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              Esta ação devolve o agente{userName ? ` ${userName}` : ""} (RA:{" "}
              {ra}) ao estado ativo. Caso exista conta de acesso provisionada, o
              acesso ao sistema será restabelecido.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                className="flex-1 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] px-4 py-3 text-sm font-semibold text-cyan-200 hover:bg-cyan-300/[0.12]"
                onClick={() => setReactivateDialogOpen(false)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="flex-1 rounded-xl border border-green-400/25 bg-green-400/10 px-4 py-3 text-sm font-bold text-green-200 hover:bg-green-400/[0.18] disabled:opacity-50"
                disabled={!!actionLoading}
                onClick={handleReactivate}
                type="button"
              >
                {actionLoading === "reactivate"
                  ? "Reativando..."
                  : "Reativar agente"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ------ Dialog: Confirmar reset ------ */}
      {resetDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1b2a] p-6 shadow-2xl">
            <KeyRound className="h-7 w-7 text-cyan-300" />
            <h3 className="mt-3 text-lg font-bold text-white">
              Gerar nova senha temporária
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              Será gerada uma nova senha para o agente
              {userName ? ` ${userName}` : ""} (RA: {ra}). A senha anterior será
              invalidada imediatamente.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                className="flex-1 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] px-4 py-3 text-sm font-semibold text-cyan-200 hover:bg-cyan-300/[0.12]"
                onClick={() => setResetDialogOpen(false)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="flex-1 rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-3 text-sm font-bold text-cyan-100 hover:bg-cyan-300/[0.18] disabled:opacity-50"
                disabled={actionLoading === "reset"}
                onClick={handlePasswordReset}
                type="button"
              >
                {actionLoading === "reset" ? (
                  <span className="flex items-center justify-center gap-2">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Gerando...
                  </span>
                ) : (
                  "Confirmar"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ------ Modal: Exibir nova senha ------ */}
      {newTemporaryPassword ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5">
          <div className="w-full max-w-md rounded-3xl border border-cyan-300/25 bg-[#091525] p-6 shadow-2xl">
            <KeyRound className="h-8 w-8 text-cyan-300" />
            <h3 className="mt-4 text-xl font-black text-white">
              Nova senha gerada
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              Entregue esta senha ao agente{userName ? ` ${userName}` : ""}. Ela
              não será exibida novamente.
            </p>
            <div className="mt-5 flex items-center gap-3 rounded-xl border border-cyan-300/20 bg-black/25 p-4">
              <span className="flex-1 font-mono text-lg font-black text-cyan-200">
                {newTemporaryPassword}
              </span>
              <button
                className="shrink-0 rounded-lg border border-cyan-300/25 bg-cyan-300/10 p-2 text-cyan-200 transition hover:bg-cyan-300/20"
                onClick={handleCopyPassword}
                title="Copiar senha"
                type="button"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-300" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
            {copied ? (
              <p className="mt-2 text-center text-xs text-emerald-300">
                Senha copiada!
              </p>
            ) : null}
            <button
              className="mt-5 w-full rounded-xl bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-200"
              onClick={() => setNewTemporaryPassword(null)}
              type="button"
            >
              Fechar
            </button>
          </div>
        </div>
      ) : null}

      {/* ------ Dialog: Desvincular Perfil ------ */}
      {unassignDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1b2a] p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">
              Desvincular perfil de acesso
            </h3>
            <p className="mt-2 text-sm text-slate-300">
              Tem certeza de que deseja remover o perfil de acesso de{" "}
              <strong className="text-white">{userName || `RA ${ra}`}</strong> (RA {ra})?
            </p>

            <div className="mt-4 space-y-2 rounded-xl border border-white/8 bg-white/[0.02] p-3 text-xs text-slate-400">
              <p>
                <strong className="text-slate-300">• Perfil atual:</strong>{" "}
                {accessModel.profileName ?? accessModel.detail}
              </p>
              <p>
                <strong className="text-slate-300">• Acesso base:</strong> Passará para{" "}
                <span className="font-semibold text-cyan-200">Não provisionado</span>.
              </p>
              <p>
                <strong className="text-slate-300">• Integrante (Lifecycle):</strong> O cadastro no efetivo{" "}
                <span className="text-slate-200">não é desativado</span>.
              </p>
              <p>
                <strong className="text-slate-300">• Instrutor K9:</strong> A qualificação funcional{" "}
                <span className="text-slate-200">permanece preservada</span> independentemente.
              </p>
              <p>
                <strong className="text-slate-300">• Autenticação (Auth):</strong> A conta do usuário{" "}
                <span className="text-slate-200">não é excluída</span>.
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/5"
                disabled={actionLoading === "unassign"}
                onClick={() => setUnassignDialogOpen(false)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                disabled={actionLoading === "unassign"}
                onClick={handleUnassignProfile}
                type="button"
              >
                {actionLoading === "unassign" ? (
                  <span className="flex items-center gap-2">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Desvinculando...
                  </span>
                ) : (
                  "Confirmar desvinculação"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
