import type { AuthProfile } from "@/features/auth/providers/auth-provider";

import { saveNewK9V1 as saveNewK9 } from "@/features/effective/data/k9-admin-service";

import type { K9CreateFormValues } from "./k9-create-types";

/** Narrow CREATE V1 adapter; Edit remains on the legacy save path. */
export async function saveNewK9V1({
  photoFile,
  profile,
  values,
}: {
  photoFile: File | null;
  profile: AuthProfile;
  values: K9CreateFormValues;
}) {
  try {
    return await saveNewK9({ photoFile, profile, values });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const normalized = message.toLowerCase();

    if (normalized.includes("already exists") || normalized.includes("duplicate")) {
      throw new Error("Essa matrícula já está cadastrada.");
    }
    if (normalized.includes("permission") || normalized.includes("unauthenticated")) {
      throw new Error("Seu perfil não tem permissão para cadastrar K9.");
    }
    if (normalized.includes("upload") || normalized.includes("storage")) {
      throw new Error("Não foi possível enviar a foto. Tente outro arquivo.");
    }

    throw new Error("Não foi possível cadastrar o K9. Tente novamente.");
  }
}
