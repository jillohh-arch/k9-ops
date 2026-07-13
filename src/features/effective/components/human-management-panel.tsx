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
import { useCallback, useEffect, useState } from "react";

import { useAccessControl } from "@/features/access/providers/access-control-provider";
import {
  deactivateUser,
  getUserRoles,
  getUserStatus,
  reactivateUser,
  resetHumanPassword,
  toggleInstructorRole,
} from "@/features/effective/data/human-management-service";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type HumanManagementPanelProps = {
  ra: string;
  userName?: string;
};

// ---------------------------------------------------------------------------
// Feedback banner
// ---------------------------------------------------------------------------

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

export function HumanManagementPanel({ ra, userName }: HumanManagementPanelProps) {
  const { can } = useAccessControl();
  const canManageAccess = can("access", "edit");

  // State
  const [isInstructor, setIsInstructor] = useState(false);
  const [userActive, setUserActive] = useState(true);
  const [deactivateReason, setDeactivateReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    message: string;
    type: FeedbackType;
  } | null>(null);

  // Dialogs
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

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

  // Load user data
  useEffect(() => {
    if (!ra || !canManageAccess) return;

    async function load() {
      setLoading(true);
      try {
        const [roles, status] = await Promise.all([
          getUserRoles(ra),
          getUserStatus(ra),
        ]);
        setIsInstructor(
          roles.includes("instrutor_k9") ||
            roles.includes("instrutor") ||
            roles.includes("adestrador"),
        );
        setUserActive(status.active);
      } catch {
        showFeedback("Falha ao carregar dados do usuário.", "error");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [ra, canManageAccess, showFeedback]);

  // Guard: only show for users with permission
  if (!canManageAccess) return null;

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

  async function handleDeactivate() {
    if (deactivateReason.trim().length < 5) return;
    setActionLoading("deactivate");
    setFeedback(null);
    try {
      await deactivateUser(ra, deactivateReason.trim());
      setUserActive(false);
      setDeactivateDialogOpen(false);
      setDeactivateReason("");
      showFeedback("Agente desativado com sucesso.", "success");
    } catch {
      showFeedback("Falha ao desativar agente.", "error");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReactivate() {
    setActionLoading("reactivate");
    setFeedback(null);
    try {
      await reactivateUser(ra);
      setUserActive(true);
      showFeedback("Agente reativado com sucesso.", "success");
    } catch {
      showFeedback("Falha ao reativar agente.", "error");
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

  if (loading) {
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

      {/* ------ Permissões e Roles ------ */}
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
      </div>

      {/* ------ Desativar / Reativar ------ */}
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
                <p className="text-xs text-slate-500">
                  O agente possui acesso normal ao sistema
                </p>
              </div>
            </div>
            <button
              className="rounded-lg border border-red-400/20 bg-red-400/[0.06] px-3 py-2 text-sm font-medium text-red-300 transition hover:bg-red-400/[0.12] disabled:opacity-50"
              disabled={!!actionLoading}
              onClick={() => setDeactivateDialogOpen(true)}
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
                <p className="text-xs text-slate-500">
                  O acesso ao sistema está suspenso
                </p>
              </div>
            </div>
            <button
              className="rounded-lg border border-green-400/20 bg-green-400/[0.06] px-3 py-2 text-sm font-medium text-green-300 transition hover:bg-green-400/[0.12] disabled:opacity-50"
              disabled={actionLoading === "reactivate"}
              onClick={handleReactivate}
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

      {/* ------ Reset de Senha ------ */}
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

      {/* ------ Dialog: Desativar ------ */}
      {deactivateDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1b2a] p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Desativar agente</h3>
            <p className="mt-2 text-sm text-slate-400">
              Esta ação suspende o acesso do agente{userName ? ` ${userName}` : ""} (RA: {ra}) ao sistema.
              Informe o motivo da desativação.
            </p>
            <label className="mt-4 block text-xs font-semibold text-slate-300" htmlFor="deactivate-reason">
              Motivo (mínimo 5 caracteres)
            </label>
            <textarea
              id="deactivate-reason"
              className="mt-1 h-20 w-full resize-none rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-white/[0.05]"
              onChange={(event) => setDeactivateReason(event.target.value)}
              placeholder="Informe o motivo da desativação"
              value={deactivateReason}
            />
            <div className="mt-5 flex gap-3">
              <button
                className="flex-1 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] px-4 py-3 text-sm font-semibold text-cyan-200 hover:bg-cyan-300/[0.12]"
                onClick={() => {
                  setDeactivateDialogOpen(false);
                  setDeactivateReason("");
                }}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="flex-1 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm font-bold text-red-200 hover:bg-red-400/[0.18] disabled:opacity-50"
                disabled={
                  deactivateReason.trim().length < 5 ||
                  actionLoading === "deactivate"
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
    </section>
  );
}
