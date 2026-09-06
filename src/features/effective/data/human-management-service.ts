"use client";

import { doc, getDoc, updateDoc, arrayUnion, Timestamp } from "firebase/firestore";

import { auth, db } from "@/lib/firebase/client";
import {
  callAdminResetHumanPassword,
  callSetK9InstructorRole,
} from "@/lib/firebase/functions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UserRole = "instrutor_k9" | "operador_k9" | "gestor" | "administrador";

export type DeactivationPayload = {
  ra: string;
  reason: string;
};

export type AuditEntry = {
  action: string;
  actor_ra: string;
  actor_name: string;
  details: Record<string, unknown>;
  performed_at: Timestamp;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function currentActorInfo() {
  const user = auth.currentUser;
  const ra = user?.email?.replace(/@.*$/, "") ?? "unknown";
  const name = user?.displayName ?? ra;
  return { ra, name };
}

async function appendAuditTrail(userRa: string, entry: Omit<AuditEntry, "performed_at">) {
  const ref = doc(db, "users", userRa);
  await updateDoc(ref, {
    audit_trail: arrayUnion({
      ...entry,
      performed_at: Timestamp.now(),
    }),
    updated_at: Timestamp.now(),
  });
}

// ---------------------------------------------------------------------------
// 1. Roles
// ---------------------------------------------------------------------------

export async function toggleInstructorRole(ra: string, enabled: boolean) {
  await callSetK9InstructorRole({ ra, enabled });

  const actor = currentActorInfo();
  await appendAuditTrail(ra, {
    action: enabled ? "role_assigned" : "role_removed",
    actor_ra: actor.ra,
    actor_name: actor.name,
    details: { role: "instrutor_k9", enabled },
  });
}

export async function setUserRoles(ra: string, roles: UserRole[]) {
  const ref = doc(db, "users", ra);
  await updateDoc(ref, {
    roles,
    updated_at: Timestamp.now(),
  });

  const actor = currentActorInfo();
  await appendAuditTrail(ra, {
    action: "roles_updated",
    actor_ra: actor.ra,
    actor_name: actor.name,
    details: { roles },
  });
}

export async function getUserRoles(ra: string): Promise<string[]> {
  const ref = doc(db, "users", ra);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return [];
  const data = snapshot.data();
  if (Array.isArray(data.roles)) return data.roles as string[];
  return [];
}

// ---------------------------------------------------------------------------
// 2. Deactivate / Reactivate
// ---------------------------------------------------------------------------

export async function deactivateUser(ra: string, reason: string) {
  const actor = currentActorInfo();
  const ref = doc(db, "users", ra);

  await updateDoc(ref, {
    active: false,
    deactivated_at: Timestamp.now(),
    deactivated_by: actor.ra,
    deactivate_reason: reason,
    updated_at: Timestamp.now(),
  });

  await appendAuditTrail(ra, {
    action: "user_deactivated",
    actor_ra: actor.ra,
    actor_name: actor.name,
    details: { reason },
  });
}

export async function reactivateUser(ra: string) {
  const actor = currentActorInfo();
  const ref = doc(db, "users", ra);

  await updateDoc(ref, {
    active: true,
    deactivated_at: null,
    deactivated_by: null,
    deactivate_reason: null,
    reactivated_at: Timestamp.now(),
    reactivated_by: actor.ra,
    updated_at: Timestamp.now(),
  });

  await appendAuditTrail(ra, {
    action: "user_reactivated",
    actor_ra: actor.ra,
    actor_name: actor.name,
    details: {},
  });
}

export async function getUserStatus(ra: string) {
  const ref = doc(db, "users", ra);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return { active: true, reason: null };
  const data = snapshot.data();
  return {
    active: data.active !== false,
    reason: (data.deactivate_reason as string) ?? null,
  };
}

// ---------------------------------------------------------------------------
// 3. Password Reset
// ---------------------------------------------------------------------------

function callableCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function callableReason(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const details = (error as { details?: unknown }).details;
  if (typeof details !== "object" || details === null) return null;
  const reason = (details as { reason?: unknown }).reason;
  return typeof reason === "string" && reason.length > 0 ? reason : null;
}

export async function resetHumanPassword(
  ra: string,
): Promise<{ success: boolean; message: string; temporaryPassword?: string }> {
  try {
    const result = await callAdminResetHumanPassword({ ra });
    const temporaryPassword = result.data.temporary_password;

    return {
      success: true,
      message: "Nova senha temporária gerada com sucesso.",
      temporaryPassword,
    };
  } catch (error) {
    const code = callableCode(error) ?? "";
    const reason = callableReason(error);

    let message = "Falha ao gerar nova senha. Tente novamente.";

    if (reason === "AUTH_IDENTITY_NOT_FOUND") {
      message = "Conta de acesso não encontrada para este agente no provedor de autenticação.";
    } else if (code.endsWith("permission-denied") || reason === "PERMISSION_DENIED") {
      message = "Você não tem permissão para redefinir a senha deste agente.";
    } else if (code.endsWith("unauthenticated") || reason === "UNAUTHENTICATED") {
      message = "Sessão expirada ou não autenticada. Faça login novamente.";
    } else if (code.endsWith("invalid-argument") || reason === "INVALID_ARGUMENT") {
      message = "Identificador de agente inválido.";
    } else if (reason === "NOT_FOUND") {
      message = "Cadastro do agente não encontrado.";
    } else if (code === "functions/not-found" || code === "functions/unimplemented") {
      message = "Função de reset ainda não disponível no servidor.";
    }

    return { success: false, message };
  }
}
