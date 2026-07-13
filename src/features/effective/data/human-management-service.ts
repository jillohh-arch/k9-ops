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

export async function resetHumanPassword(
  ra: string,
): Promise<{ success: boolean; message: string; temporaryPassword?: string }> {
  try {
    const result = await callAdminResetHumanPassword({ ra });
    const temporaryPassword = result.data.temporary_password;

    const actor = currentActorInfo();
    await appendAuditTrail(ra, {
      action: "password_reset",
      actor_ra: actor.ra,
      actor_name: actor.name,
      details: {},
    });

    return {
      success: true,
      message: "Nova senha temporária gerada com sucesso.",
      temporaryPassword,
    };
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code: unknown }).code)
        : "";
    const message =
      code === "functions/not-found" || code === "functions/unimplemented"
        ? "Função de reset ainda não disponível no servidor."
        : "Falha ao gerar nova senha. Tente novamente.";
    return { success: false, message };
  }
}
