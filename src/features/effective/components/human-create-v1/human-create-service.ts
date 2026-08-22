/**
 * Human Create V1 — narrow service.
 *
 * Thin I/O seam over the `adminCreateHuman` callable:
 *   form values -> strict wire payload (adapter) -> callable -> {ra, created}.
 *
 * No Storage, no photo, no access provisioning. Kept separate from the form so
 * it can be tested without live Firebase (the test mocks `@/lib/firebase/
 * functions`). Errors are normalized through `mapHumanCreateError`; the
 * response is validated to `{ra, created:true}` before the caller may redirect.
 */

import { callAdminCreateHuman } from "@/lib/firebase/functions";

import {
  HumanCreateError,
  mapHumanCreateError,
  projectHumanCreateRequest,
} from "./human-create-adapter";
import type { HumanCreateFormValues } from "./human-create-types";

export type HumanCreateResult = {
  ra: string;
  created: true;
};

/**
 * Cria o integrante e devolve o RA autoritativo para redirecionamento.
 *
 * Sucesso exige `created === true` E um `ra` não-vazio na resposta. Uma
 * resposta 2xx malformada (sem esses dois) é tratada como falha explícita
 * (nunca degrada em sucesso silencioso), então a UI jamais navega para um
 * perfil que não foi criado.
 */
export async function createHumanV1(
  values: HumanCreateFormValues,
): Promise<HumanCreateResult> {
  const request = projectHumanCreateRequest(values);

  let ra: unknown;
  let created: unknown;
  try {
    const response = await callAdminCreateHuman(request);
    ra = response.data?.ra;
    created = response.data?.created;
  } catch (error) {
    throw mapHumanCreateError(error);
  }

  if (created !== true || typeof ra !== "string" || ra.trim().length === 0) {
    throw new HumanCreateError("INTERNAL", null);
  }

  return { ra, created: true };
}
