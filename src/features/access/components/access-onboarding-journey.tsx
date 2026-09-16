"use client";

import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  LoaderCircle,
  Lock,
  ShieldCheck,
  UserCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  assignUserAccessProfile,
  provisionHumanAuth,
  type AccessUser,
} from "@/features/access/data/access-profile-service";
import type { AccessProfile } from "@/lib/permissions/access-control";

interface AccessOnboardingJourneyProps {
  actorRa?: string | null;
  canManageAccess: boolean;
  onClearTarget?: () => void;
  onProfileAssigned?: (profileName: string) => void;
  profiles: AccessProfile[];
  targetRa: string;
  targetUser?: AccessUser;
}

export function AccessOnboardingJourney({
  actorRa,
  canManageAccess,
  onClearTarget,
  onProfileAssigned,
  profiles,
  targetRa,
  targetUser,
}: AccessOnboardingJourneyProps) {
  const [provisioning, setProvisioning] = useState(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [provisionResult, setProvisionResult] = useState<{
    auth_uid: string;
    created: boolean;
    email: string;
    initial_password?: string;
  } | null>(null);

  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    profiles.some((p) => p.id === "operador_k9" && p.status === "active")
      ? "operador_k9"
      : profiles.find((p) => p.status === "active")?.id ?? "",
  );
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [profileAssigned, setProfileAssigned] = useState(false);
  const [assignedProfileName, setAssignedProfileName] = useState<string | null>(null);

  const [copiedPassword, setCopiedPassword] = useState(false);
  const [copiedInstructions, setCopiedInstructions] = useState(false);

  // Se o usuário já possui authUid na base ou foi provisionado nesta sessão
  const hasAuthUid = Boolean(targetUser?.authUid || provisionResult?.auth_uid);
  const canonicalEmail = `${targetRa.toLowerCase()}@gcm.com.br`;

  // Perfis ativos disponíveis para atribuição
  const activeProfiles = profiles.filter((p) => p.status === "active" && !p.ui_hidden);

  async function handleProvisionAuth() {
    if (!canManageAccess || provisioning) return;
    setProvisioning(true);
    setProvisionError(null);
    try {
      const result = await provisionHumanAuth(targetRa);
      setProvisionResult(result);
    } catch (error) {
      setProvisionError(
        error instanceof Error
          ? error.message
          : "Não foi possível provisionar a autenticação deste integrante.",
      );
    } finally {
      setProvisioning(false);
    }
  }

  async function handleAssignProfile() {
    if (!targetUser || !canManageAccess || assigning) return;
    const profileToAssign = activeProfiles.find((p) => p.id === selectedProfileId);
    if (!profileToAssign) {
      setAssignError("Selecione um perfil de acesso válido.");
      return;
    }

    setAssigning(true);
    setAssignError(null);
    try {
      await assignUserAccessProfile(targetUser, profileToAssign, actorRa);
      setProfileAssigned(true);
      setAssignedProfileName(profileToAssign.name);
      onProfileAssigned?.(profileToAssign.name);
    } catch (error) {
      setProfileAssigned(false);
      setAssignError(
        error instanceof Error
          ? error.message
          : "Não foi possível atribuir o perfil de acesso.",
      );
    } finally {
      setAssigning(false);
    }
  }

  function handleCopyPassword(password: string) {
    navigator.clipboard.writeText(password);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  }

  function handleCopyInstructions(password: string) {
    const instructions =
      `Credenciais de acesso ao K9 Ops:\n` +
      `Identificador: ${targetUser?.callsign || targetRa}\n` +
      `Login / E-mail: ${canonicalEmail}\n` +
      `Senha inicial: ${password}\n` +
      `Perfil: ${assignedProfileName || "Configurado"}`;
    navigator.clipboard.writeText(instructions);
    setCopiedInstructions(true);
    setTimeout(() => setCopiedInstructions(false), 2000);
  }

  if (!targetUser) {
    return (
      <div className="rounded-2xl border border-cyan-300/30 bg-cyan-950/20 p-6 text-slate-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LoaderCircle className="h-5 w-5 animate-spin text-cyan-300" />
            <span className="text-sm font-medium">
              Localizando integrante com RA <strong className="font-mono text-white">{targetRa}</strong>...
            </span>
          </div>
          {onClearTarget ? (
            <Button
              className="h-8 px-3 text-xs text-slate-400 hover:text-white"
              onClick={onClearTarget}
              variant="ghost"
            >
              Cancelar
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      aria-label="Jornada de Configuração de Acesso"
      className="relative overflow-hidden rounded-2xl border border-cyan-300/30 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 p-6 shadow-2xl shadow-cyan-950/40"
      data-testid="access-onboarding-journey"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge tone="cyan">Onboarding de Acesso</Badge>
            <span className="text-xs font-mono text-slate-400">RA {targetRa}</span>
          </div>
          <h2 className="text-xl font-black text-white">
            Configuração de Acesso: {targetUser.callsign || targetUser.fullName || targetRa}
          </h2>
          <p className="text-xs text-slate-400">
            Jornada sequencial: Cadastro de pessoal ➔ Provisionamento Auth ➔ Atribuição de perfil ➔ Senha inicial.
          </p>
        </div>

        {onClearTarget ? (
          <Button
            aria-label="Fechar jornada"
            className="h-8 w-8 rounded-lg border border-white/10 p-0 text-slate-400 hover:bg-white/10 hover:text-white"
            onClick={onClearTarget}
            variant="ghost"
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      {/* Stepper Content */}
      <div className="mt-6 space-y-6">
        {/* Etapa 1: Cadastro no Efetivo */}
        <div className="flex items-start gap-4 rounded-xl border border-emerald-400/20 bg-emerald-950/10 p-4">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300">
            <UserCheck className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Etapa 1: Cadastro de Pessoal
              </span>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
                <Check className="h-3.5 w-3.5" /> Concluído
              </span>
            </div>
            <p className="mt-1 text-sm font-semibold text-white">
              {targetUser.fullName} {targetUser.callsign ? `(${targetUser.callsign})` : ""}
            </p>
            <p className="text-xs text-slate-400">
              RA <span className="font-mono text-slate-200">{targetUser.ra}</span> · E-mail institucional de login:{" "}
              <span className="font-mono text-slate-200">{canonicalEmail}</span>
            </p>
          </div>
        </div>

        {/* Etapa 2: Provisionamento Auth */}
        <div
          className={`flex items-start gap-4 rounded-xl border p-4 transition-colors ${
            hasAuthUid
              ? "border-emerald-400/20 bg-emerald-950/10"
              : "border-cyan-300/30 bg-cyan-950/20"
          }`}
        >
          <div
            className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
              hasAuthUid
                ? "bg-emerald-400/20 text-emerald-300"
                : "bg-cyan-300/20 text-cyan-200"
            }`}
          >
            <KeyRound className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-bold uppercase tracking-wider ${
                  hasAuthUid ? "text-emerald-400" : "text-cyan-300"
                }`}
              >
                Etapa 2: Provisionamento de Autenticação
              </span>
              {hasAuthUid ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
                  <Check className="h-3.5 w-3.5" /> Concluído
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-amber-300">Pendente</span>
              )}
            </div>

            {hasAuthUid ? (
              <div className="mt-1">
                <p className="text-sm font-semibold text-white">
                  Identidade de acesso vinculada no Firebase Auth
                </p>
                <p className="text-xs text-slate-400">
                  UID: <span className="font-mono text-slate-300">{targetUser.authUid || provisionResult?.auth_uid}</span>
                  {provisionResult?.created ? (
                    <span className="ml-2 font-bold text-cyan-300">(Conta criada agora)</span>
                  ) : (
                    <span className="ml-2 font-semibold text-slate-400">(Conta preexistente vinculada)</span>
                  )}
                </p>
              </div>
            ) : (
              <div className="mt-1 space-y-3">
                <p className="text-xs leading-5 text-slate-300">
                  Cria a identidade institucional no Firebase Auth associada ao RA {targetRa} com uma senha inicial segura. A conta inicia temporariamente desativada até a confirmação cadastral.
                </p>
                {provisionError ? (
                  <div className="flex items-center gap-2 rounded-lg border border-red-400/30 bg-red-950/40 p-2.5 text-xs text-red-200">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                    <span>{provisionError}</span>
                  </div>
                ) : null}
                <Button
                  className="h-9 px-3 bg-cyan-300 text-slate-950 hover:bg-cyan-200 font-bold text-xs"
                  disabled={provisioning || !canManageAccess}
                  onClick={handleProvisionAuth}
                >
                  {provisioning ? (
                    <>
                      <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                      Provisionando autenticação...
                    </>
                  ) : (
                    <>
                      <KeyRound className="mr-2 h-4 w-4" />
                      Provisionar autenticação
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Etapa 3: Atribuição de Perfil de Acesso */}
        <div
          className={`flex items-start gap-4 rounded-xl border p-4 transition-colors ${
            profileAssigned
              ? "border-emerald-400/20 bg-emerald-950/10"
              : hasAuthUid
                ? "border-cyan-300/30 bg-cyan-950/20"
                : "border-white/5 bg-white/[0.02] opacity-60"
          }`}
        >
          <div
            className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
              profileAssigned
                ? "bg-emerald-400/20 text-emerald-300"
                : hasAuthUid
                  ? "bg-cyan-300/20 text-cyan-200"
                  : "bg-white/10 text-slate-400"
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-bold uppercase tracking-wider ${
                  profileAssigned
                    ? "text-emerald-400"
                    : hasAuthUid
                      ? "text-cyan-300"
                      : "text-slate-400"
                }`}
              >
                Etapa 3: Atribuição de Perfil de Acesso
              </span>
              {profileAssigned ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
                  <Check className="h-3.5 w-3.5" /> Concluído
                </span>
              ) : hasAuthUid ? (
                <span className="text-[11px] font-semibold text-amber-300">Aguardando atribuição</span>
              ) : (
                <span className="text-[11px] text-slate-500">Bloqueado</span>
              )}
            </div>

            {profileAssigned ? (
              <div className="mt-1">
                <p className="text-sm font-semibold text-white">
                  Perfil atribuído: <span className="text-emerald-300 font-bold">{assignedProfileName}</span>
                </p>
                <p className="text-xs text-slate-400">
                  Custom claims e escopo administrativo atualizados com sucesso no servidor.
                </p>
              </div>
            ) : hasAuthUid ? (
              <div className="mt-2 space-y-3">
                <p className="text-xs leading-5 text-slate-300">
                  Selecione o perfil operacional ou administrativo que rege os privilégios deste integrante:
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {activeProfiles.map((p) => {
                    const isSelected = selectedProfileId === p.id;
                    return (
                      <button
                        className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                          isSelected
                            ? "border-cyan-300 bg-cyan-300/10 text-white shadow-[0_0_12px_rgba(77,208,225,0.15)]"
                            : "border-white/10 bg-slate-900/60 text-slate-300 hover:border-white/20"
                        }`}
                        key={p.id}
                        onClick={() => setSelectedProfileId(p.id)}
                        type="button"
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="font-bold text-xs text-white">{p.name}</span>
                          <span className="text-[10px] font-mono uppercase text-cyan-300">{p.level}</span>
                        </div>
                        <span className="mt-1 text-[11px] text-slate-400 line-clamp-2">{p.description}</span>
                      </button>
                    );
                  })}
                </div>

                {assignError ? (
                  <div className="flex items-center gap-2 rounded-lg border border-red-400/30 bg-red-950/40 p-2.5 text-xs text-red-200">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                    <span>{assignError}</span>
                  </div>
                ) : null}

                <Button
                  className="h-9 px-3 bg-cyan-300 text-slate-950 hover:bg-cyan-200 font-bold text-xs"
                  disabled={assigning || !canManageAccess}
                  onClick={handleAssignProfile}
                >
                  {assigning ? (
                    <>
                      <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                      Atribuindo perfil...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Atribuir perfil e concluir acesso
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <p className="mt-1 text-xs text-slate-500">
                Provisione a autenticação na Etapa 2 antes de definir o perfil de acesso.
              </p>
            )}
          </div>
        </div>

        {/* Etapa 4: Credencial Inicial (Aparece SOMENTE após atribuição bem-sucedida) */}
        {profileAssigned ? (
          <div
            className="rounded-xl border border-cyan-300/40 bg-slate-900/90 p-5 shadow-lg shadow-cyan-950/30"
            data-testid="credentials-presentation-card"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-200">
                Etapa 4: Apresentação da Credencial Inicial
              </h3>
            </div>
            <p className="mt-1 text-xs text-slate-300">
              Onboarding concluído com sucesso. Entregue os dados de acesso inicial abaixo ao integrante.
            </p>

            <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/80 p-4 space-y-3">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Login / E-mail institucional
                </span>
                <p className="mt-0.5 font-mono text-sm font-bold text-white">{canonicalEmail}</p>
              </div>

              {provisionResult?.initial_password ? (
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Senha inicial
                  </span>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex-1 rounded-lg border border-cyan-300/20 bg-cyan-950/30 px-3 py-2 font-mono text-sm font-bold text-cyan-200 select-all">
                      {provisionResult.initial_password}
                    </div>
                    <Button
                      className="h-9 shrink-0 border-white/10 hover:bg-white/10 text-white text-xs px-3"
                      onClick={() => handleCopyPassword(provisionResult.initial_password!)}
                      type="button"
                      variant="secondary"
                    >
                      {copiedPassword ? (
                        <>
                          <Check className="mr-1 h-3.5 w-3.5 text-emerald-400" />
                          Copiada
                        </>
                      ) : (
                        <>
                          <Copy className="mr-1 h-3.5 w-3.5" />
                          Copiar senha inicial
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="mt-2 text-[11px] text-amber-300/90">
                    Atenção: Esta <strong>senha inicial</strong> foi gerada exclusivamente para este cadastro. Ela não será exibida novamente após fechar esta tela.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs text-slate-400">
                  <p className="flex items-center gap-1.5 text-slate-300 font-semibold">
                    <Lock className="h-3.5 w-3.5 text-cyan-300" />
                    Conta de autenticação preexistente
                  </p>
                  <p className="mt-1 text-[11px]">
                    A conta Auth deste integrante já existia previamente e foi vinculada ao cadastro. Caso o integrante não se recorde da senha, utilize o botão de Redefinição Administrativa de Senha.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {provisionResult?.initial_password ? (
                <Button
                  className="h-9 px-3 bg-cyan-300 text-slate-950 hover:bg-cyan-200 font-bold text-xs"
                  onClick={() => handleCopyInstructions(provisionResult.initial_password!)}
                  type="button"
                >
                  {copiedInstructions ? (
                    <>
                      <Check className="mr-1.5 h-4 w-4 text-slate-950" />
                      Instruções copiadas!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1.5 h-4 w-4" />
                      Copiar instruções de acesso
                    </>
                  )}
                </Button>
              ) : null}

              <Link
                className="inline-flex h-9 items-center justify-center rounded-lg border border-white/15 bg-white/5 px-4 text-xs font-semibold text-white hover:bg-white/10 transition-colors"
                href={`/humans/${encodeURIComponent(targetRa)}`}
              >
                Ir para o cadastro do integrante
              </Link>

              {onClearTarget ? (
                <Button
                  className="h-9 px-3 text-xs text-slate-400 hover:text-white"
                  onClick={onClearTarget}
                  type="button"
                  variant="ghost"
                >
                  Concluir e voltar à lista
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
