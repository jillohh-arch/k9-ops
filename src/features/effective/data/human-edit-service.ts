"use client";

import { doc, getDoc } from "firebase/firestore";

import {
  projectHumanEditPersonnel,
  resolveHumanVersionToken,
} from "@/features/effective/components/human-edit-v1/human-edit-adapter";
import type { HumanEditPersonnel } from "@/features/effective/components/human-edit-v1/human-edit-types";
import { db } from "@/lib/firebase/client";

/**
 * Human Edit V1 — carregador READ-ONLY de `users/{ra}`.
 *
 * Uma leitura de documento apenas. Projeta o Personnel pela autoridade
 * congelada (A1) e deriva o token de concorrência pelo mesmo A1 —
 * o serviço NÃO reimplementa nem alias precedence nem `max(updated_at,
 * updatedAt)`. Não salva, não invoca callable, não lê acesso/Auth.
 *
 * `null` = documento inexistente (distinto de um documento existente com
 * campos opcionais vazios, e distinto de uma FALHA de leitura, que propaga).
 */
export type HumanEditLoad = {
  ra: string;
  baseline: HumanEditPersonnel;
  versionToken: number | null;
  archived: boolean;
};

/** Sinais canônicos de ciclo de vida — Personnel/lifecycle, nunca acesso. */
function isArchived(data: Record<string, unknown>): boolean {
  if (data.active === false) return true;
  if (data.deleted_at != null) return true;
  if (data.archived_at != null) return true;
  const status = data.status;
  if (typeof status === "string") {
    const normalized = status
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
    if (normalized === "inactive" || normalized === "inativo") return true;
  }
  return false;
}

/**
 * Lê `users/{ra}` e devolve a visão canônica de Edit, ou `null` se o
 * documento não existir.
 *
 * Uma falha de leitura do Firestore PROPAGA (getDoc rejeita) — nunca é
 * convertida em `null` nem em baseline vazio, para que "não existe" continue
 * distinguível de "não foi possível carregar".
 */
export async function loadHumanForEdit(
  ra: string,
): Promise<HumanEditLoad | null> {
  const snapshot = await getDoc(doc(db, "users", ra));
  if (!snapshot.exists()) return null;

  const data = snapshot.data() as Record<string, unknown>;
  return {
    ra,
    baseline: projectHumanEditPersonnel(data),
    versionToken: resolveHumanVersionToken(data),
    archived: isArchived(data),
  };
}
