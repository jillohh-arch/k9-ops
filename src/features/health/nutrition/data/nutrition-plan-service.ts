import {
  MealPeriod,
  NutritionPlanStatus,
  FirestoreMealScheduleSlot,
  FirestoreSupplementRegimen,
  FirestoreNutritionPlanDoc,
  FirestoreLegacyPlanDoc,
  RecordedBy,
  MealScheduleSlot,
  NutritionPlanSupplementRegimen,
  NutritionPlan,
  LegacyNutritionPlanView,
  NutritionPlanState,
} from "../types";

/**
 * Parses a Firestore date, ISO string, number, or object with seconds/nanoseconds (duck-typed Firestore Timestamp).
 */
export function parseDateTime(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;

    // Duck typing for a Firestore Timestamp (.toDate())
    if (typeof (obj as { toDate?: unknown }).toDate === "function") {
      const d = (obj as { toDate: () => unknown }).toDate();
      return d instanceof Date && !isNaN(d.getTime()) ? d : null;
    }

    // Object with seconds and nanoseconds
    const seconds = obj.seconds !== undefined ? obj.seconds : obj._seconds;
    const nanoseconds = obj.nanoseconds !== undefined ? obj.nanoseconds : (obj._nanoseconds ?? 0);
    if (
      typeof seconds === "number" &&
      isFinite(seconds) &&
      typeof nanoseconds === "number" &&
      isFinite(nanoseconds)
    ) {
      return new Date(seconds * 1000 + nanoseconds / 1000000);
    }
  }
  return null;
}

/**
 * Validates and parses the RecordedBy auditor identity.
 */
export function parseRecordedBy(raw: unknown): RecordedBy | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const uid = typeof obj.uid === "string" ? obj.uid.trim() : typeof obj.id === "string" ? obj.id.trim() : "";
  const name = typeof obj.name === "string" ? obj.name.trim() : "";
  const internalRole = typeof obj.internal_role === "string" ? obj.internal_role.trim() : typeof obj.role === "string" ? obj.role.trim() : "";

  if (!uid || !name || !internalRole) return null;
  return { uid, name, internalRole };
}

/**
 * Explicit defensive parser for canonical 'nutrition_plans' Firestore documents.
 */
export function parseNutritionPlan(
  id: string,
  dogId: string,
  data: FirestoreNutritionPlanDoc
): NutritionPlan {
  const foodType = typeof data.food_type === "string" ? data.food_type.trim() : "";
  if (!foodType) {
    throw new Error("food_type é obrigatório");
  }

  const amountGramsPerDay = Number(data.amount_grams_per_day);
  if (isNaN(amountGramsPerDay) || !isFinite(amountGramsPerDay) || amountGramsPerDay <= 0) {
    throw new Error("amount_grams_per_day deve ser finito e maior que zero");
  }

  const mealsPerDay = Number(data.meals_per_day);
  if (isNaN(mealsPerDay) || !isFinite(mealsPerDay) || mealsPerDay <= 0 || !Number.isInteger(mealsPerDay)) {
    throw new Error("meals_per_day inválido");
  }

  const validFrom = parseDateTime(data.valid_from);
  if (!validFrom) {
    throw new Error("valid_from é obrigatório");
  }

  const validUntilRaw = data.valid_until;
  const validUntil = validUntilRaw !== undefined && validUntilRaw !== null ? parseDateTime(validUntilRaw) : undefined;
  if (validUntilRaw !== undefined && validUntilRaw !== null && !validUntil) {
    throw new Error("valid_until inválido");
  }

  if (validUntil && validUntil <= validFrom) {
    throw new Error("valid_until deve ser estritamente posterior a valid_from");
  }

  const timezone = typeof data.timezone === "string" && data.timezone.trim() ? data.timezone.trim() : "America/Sao_Paulo";
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
  } catch {
    throw new Error(`timezone "${timezone}" não é reconhecido pela base IANA`);
  }

  const status = data.status as NutritionPlanStatus;
  if (status !== "active" && status !== "superseded" && status !== "cancelled") {
    throw new Error(`status de plano inválido: ${data.status}`);
  }

  const recordedBy = parseRecordedBy(data.recorded_by);
  if (!recordedBy) {
    throw new Error("recorded_by é obrigatório");
  }

  const schemaVersion = Number(data.schema_version);
  if (isNaN(schemaVersion) || !isFinite(schemaVersion) || schemaVersion <= 0 || !Number.isInteger(schemaVersion)) {
    throw new Error("schema_version inválido");
  }

  const revision = Number(data.revision);
  if (isNaN(revision) || !isFinite(revision) || revision < 1 || !Number.isInteger(revision)) {
    throw new Error("revision inválido");
  }

  // Parse meal_schedule
  const mealSchedule: MealScheduleSlot[] = [];
  if (data.meal_schedule !== undefined && data.meal_schedule !== null) {
    if (!Array.isArray(data.meal_schedule)) {
      throw new Error("meal_schedule deve ser array");
    }
    const seenSlotIds = new Set<string>();
    for (let i = 0; i < data.meal_schedule.length; i++) {
      const slot = data.meal_schedule[i];
      if (!slot || typeof slot !== "object") {
        throw new Error(`meal_schedule[${i}] deve ser map`);
      }
      const slotObj = slot as FirestoreMealScheduleSlot;
      const slotId = typeof slotObj.id === "string" ? slotObj.id.trim() : "";
      if (!slotId) {
        throw new Error(`meal_schedule[${i}].id ausente`);
      }
      if (seenSlotIds.has(slotId)) {
        throw new Error(`meal_schedule.id duplicado: ${slotId}`);
      }
      seenSlotIds.add(slotId);

      const period = slotObj.period as MealPeriod;
      if (
        period !== "morning" &&
        period !== "afternoon" &&
        period !== "evening" &&
        period !== "night" &&
        period !== "extra"
      ) {
        throw new Error(`meal_schedule[${i}].period inválido`);
      }

      const scheduledTime = typeof slotObj.scheduled_time === "string" ? slotObj.scheduled_time.trim() : "";
      if (!scheduledTime || !/^\d{2}:\d{2}$/.test(scheduledTime)) {
        throw new Error(`meal_schedule[${i}].scheduled_time ausente ou com formato inválido`);
      }

      const targetGrams = Number(slotObj.target_grams);
      if (isNaN(targetGrams) || !isFinite(targetGrams) || targetGrams <= 0) {
        throw new Error(`meal_schedule[${i}].target_grams ausente ou inválido`);
      }

      mealSchedule.push({
        id: slotId,
        period,
        scheduledTime,
        targetGrams,
      });
    }
  }

  // Parse supplements
  const supplements: NutritionPlanSupplementRegimen[] = [];
  if (data.supplements !== undefined && data.supplements !== null) {
    if (!Array.isArray(data.supplements)) {
      throw new Error("supplements deve ser array");
    }
    for (let i = 0; i < data.supplements.length; i++) {
      const supp = data.supplements[i];
      if (!supp || typeof supp !== "object") {
        throw new Error(`supplements[${i}] deve ser map`);
      }
      const suppObj = supp as FirestoreSupplementRegimen;
      const id = typeof suppObj.id === "string" ? suppObj.id.trim() : "";
      const name = typeof suppObj.name === "string" ? suppObj.name.trim() : "";
      const dose = typeof suppObj.dose === "string" ? suppObj.dose.trim() : "";
      const unit = typeof suppObj.unit === "string" ? suppObj.unit.trim() : "";
      const frequency = typeof suppObj.frequency === "string" ? suppObj.frequency.trim() : "";

      if (!id || !name || !dose || !unit || !frequency) {
        throw new Error("supplement regimen incompleto (id/name/dose/unit/frequency)");
      }

      const validFromSupp = suppObj.valid_from !== undefined && suppObj.valid_from !== null ? parseDateTime(suppObj.valid_from) : undefined;
      const validUntilSupp = suppObj.valid_until !== undefined && suppObj.valid_until !== null ? parseDateTime(suppObj.valid_until) : undefined;

      supplements.push({
        id,
        name,
        dose,
        unit,
        frequency,
        instructions: typeof suppObj.instructions === "string" ? suppObj.instructions.trim() : undefined,
        validFrom: validFromSupp || undefined,
        validUntil: validUntilSupp || undefined,
      });
    }
  }

  const hydrationMl = data.hydration_ml !== undefined && data.hydration_ml !== null ? Number(data.hydration_ml) : undefined;
  if (hydrationMl !== undefined && (isNaN(hydrationMl) || !isFinite(hydrationMl) || hydrationMl < 0)) {
    throw new Error("hydration_ml deve ser finito e não negativo");
  }

  const specialInstructions = typeof data.special_instructions === "string" ? data.special_instructions.trim() : undefined;

  const attachmentRefs: string[] = [];
  if (Array.isArray(data.attachment_refs)) {
    for (const ref of data.attachment_refs) {
      if (typeof ref === "string" && ref.trim()) {
        attachmentRefs.push(ref.trim());
      }
    }
  }

  return {
    id,
    dogId,
    foodType,
    amountGramsPerDay,
    mealsPerDay,
    mealSchedule,
    validFrom,
    validUntil: validUntil || undefined,
    timezone,
    recordedBy,
    status,
    schemaVersion,
    revision,
    hydrationMl: hydrationMl !== undefined ? hydrationMl : undefined,
    specialInstructions,
    professional: data.professional && typeof data.professional === "object" ? (data.professional as Record<string, unknown>) : undefined,
    sourceDocument: data.source_document && typeof data.source_document === "object" ? (data.source_document as Record<string, unknown>) : undefined,
    attachmentRefs: attachmentRefs.length ? attachmentRefs : undefined,
    supplements: supplements.length ? supplements : undefined,
    legacySource: typeof data.legacy_source === "string" ? data.legacy_source.trim() : undefined,
    legacyId: typeof data.legacy_id === "string" ? data.legacy_id.trim() : undefined,
  };
}

/**
 * Parser for legacy plans mapping either 'nutritional_prescriptions' or 'nutrition_prescriptions' documents.
 */
export function parseLegacyNutritionPlan(
  sourceId: string,
  dogId: string,
  data: FirestoreLegacyPlanDoc,
  legacySource: string
): LegacyNutritionPlanView {
  const foodTypeKeys = ["food_type", "foodType", "racao", "food"];
  let foodType = "";
  for (const k of foodTypeKeys) {
    const val = (data as unknown as Record<string, unknown>)[k];
    if (typeof val === "string" && val) {
      foodType = val.trim();
      break;
    }
  }
  if (!foodType) {
    throw new Error("Tipo de alimento ausente");
  }

  const amountKeys = ["amount_grams_per_day", "amountGramsPerDay", "daily_amount"];
  let amount: number | null = null;
  for (const k of amountKeys) {
    const val = (data as unknown as Record<string, unknown>)[k];
    if (typeof val === "number" && isFinite(val) && val > 0) {
      amount = val;
      break;
    } else if (typeof val === "string") {
      const parsed = parseFloat(val.replace(",", "."));
      if (!isNaN(parsed) && isFinite(parsed) && parsed > 0) {
        amount = parsed;
        break;
      }
    }
  }
  if (amount === null) {
    throw new Error("Quantidade inválida");
  }

  const mealsKeys = ["meals_per_day", "mealsPerDay", "meals"];
  let meals: number | null = null;
  for (const k of mealsKeys) {
    const val = (data as unknown as Record<string, unknown>)[k];
    if (typeof val === "number" && isFinite(val) && val > 0) {
      meals = Math.floor(val);
      break;
    } else if (typeof val === "string") {
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed) && isFinite(parsed) && parsed > 0) {
        meals = parsed;
        break;
      }
    }
  }
  if (meals === null) {
    throw new Error("meals_per_day inválido");
  }

  const vigentFromRaw = data.vigent_from ?? data.vigentFrom ?? data.valid_from ?? data.created_at;
  const vigentFrom = parseDateTime(vigentFromRaw);
  if (!vigentFrom) {
    throw new Error("Data vigent_from inválida");
  }

  const vigentUntilRaw = data.vigent_until ?? data.vigentUntil ?? data.valid_until;
  const vigentUntil = vigentUntilRaw !== undefined && vigentUntilRaw !== null ? parseDateTime(vigentUntilRaw) : undefined;

  const hydrationMlRaw = data.hydration_ml;
  let hydrationMl: number | undefined;
  if (hydrationMlRaw !== undefined && hydrationMlRaw !== null) {
    if (typeof hydrationMlRaw === "number" && isFinite(hydrationMlRaw) && hydrationMlRaw >= 0) {
      hydrationMl = hydrationMlRaw;
    } else if (typeof hydrationMlRaw === "string") {
      const parsed = parseFloat(hydrationMlRaw.replace(",", "."));
      if (!isNaN(parsed) && isFinite(parsed) && parsed >= 0) {
        hydrationMl = parsed;
      }
    }
  }

  const notesKeys = ["special_instructions", "notes", "observations"];
  let notes: string | undefined;
  for (const k of notesKeys) {
    const val = (data as unknown as Record<string, unknown>)[k];
    if (typeof val === "string" && val) {
      notes = val.trim();
      break;
    }
  }

  const professionalNameKeys = ["vet_name", "professional_name", "vetName"];
  let professionalName: string | undefined;
  for (const k of professionalNameKeys) {
    const val = (data as unknown as Record<string, unknown>)[k];
    if (typeof val === "string" && val) {
      professionalName = val.trim();
      break;
    }
  }

  const professionalCrmvKeys = ["vet_crmv", "crmv", "professional_crmv"];
  let professionalCrmv: string | undefined;
  for (const k of professionalCrmvKeys) {
    const val = (data as unknown as Record<string, unknown>)[k];
    if (typeof val === "string" && val) {
      professionalCrmv = val.trim();
      break;
    }
  }

  const rawStatus = typeof data.status === "string" && data.status ? data.status.trim() : undefined;

  return {
    id: sourceId,
    dogId,
    foodType,
    amountGramsPerDay: amount,
    mealsPerDay: meals,
    vigentFrom,
    vigentUntil: vigentUntil || undefined,
    hydrationMl,
    notes,
    professionalName,
    professionalCrmv,
    rawStatus,
    legacySource,
    legacyId: sourceId,
  };
}

interface ConsolidationInput {
  dogId: string;
  canonicalPlans: NutritionPlan[];
  legacyPrimary: LegacyNutritionPlanView[];
  legacyFallback: LegacyNutritionPlanView[];
  canonicalError: string | null;
  parsingErrors: Array<{
    documentId: string;
    error: string;
    collection: string;
    rawStatus?: string;
  }>;
}

/**
 * Pure consolidation logic (deterministic merge) enforcing cascaded fallbacks,
 * fail-closed on malformed/error plans, and integrity conflict checks.
 */
export function consolidateActivePlan({
  dogId,
  canonicalPlans,
  legacyPrimary,
  legacyFallback,
  canonicalError,
  parsingErrors,
}: ConsolidationInput): NutritionPlanState {

  // 1. Fail-closed: Se a consulta canônica falhou no Firestore, não podemos de forma alguma ocultar com legado.
  if (canonicalError !== null) {
    return {
      status: "error",
      reason: "firestore-read-error",
      dogId,
      activePlan: null,
      plans: canonicalPlans,
      legacyPlan: null,
      error: canonicalError,
      integrityConflict: null,
      parsingErrors,
    };
  }

  // Filtramos os planos canônicos parseados com sucesso que estão ativos
  const activeCanonicalPlans = canonicalPlans.filter((p) => p.status === "active");

  // 2. Fail-closed: Se houver qualquer erro de parsing na coleção canônica de planos ativos (ou planos que possam ser ativos),
  // nós NÃO podemos fazer fallback para o legado, pois não temos a garantia de que existem zero planos ativos.
  const hasMalformedCanonicalActive = parsingErrors.some(
    (err) => err.collection === "nutrition_plans" && (err.rawStatus === "active" || err.rawStatus === undefined)
  );

  if (hasMalformedCanonicalActive) {
    return {
      status: "degraded",
      reason: "malformed-canonical-document",
      dogId,
      activePlan: null,
      plans: canonicalPlans,
      legacyPlan: null,
      error: "Documento canônico ativo inválido ou malformado impedindo verificação de integridade",
      integrityConflict: null,
      parsingErrors,
    };
  }

  // 3. Checagem de múltiplos planos ativos canônicos (conflito de integridade)
  if (activeCanonicalPlans.length > 1) {
    const activeIds = activeCanonicalPlans.map((p) => p.id);
    return {
      status: "conflict",
      reason: "multiple-active-plans",
      dogId,
      activePlan: null,
      plans: canonicalPlans,
      legacyPlan: null,
      error: `Conflito de integridade: existem ${activeCanonicalPlans.length} planos ativos para este cão`,
      integrityConflict: {
        message: `Existem múltiplos planos ativos (${activeIds.join(", ")}) para o cão ${dogId}`,
        activePlansCount: activeCanonicalPlans.length,
        activePlanIds: activeIds,
      },
      parsingErrors,
    };
  }

  // 4. Se houver exatamente 1 plano ativo canônico (estado canônico perfeito)
  if (activeCanonicalPlans.length === 1) {
    const activePlan = activeCanonicalPlans[0];
    const hasAnyCanonicalParsingError = parsingErrors.some((err) => err.collection === "nutrition_plans");
    return {
      status: hasAnyCanonicalParsingError ? "degraded" : "canonical",
      reason: hasAnyCanonicalParsingError ? "partial-parsing-errors" : undefined,
      dogId,
      activePlan,
      plans: canonicalPlans,
      legacyPlan: null,
      error: null,
      integrityConflict: null,
      parsingErrors,
    };
  }

  // 5. Se chegamos aqui, temos com segurança 0 planos canônicos ativos.
  // Iniciamos a cascata de fallbacks legados.

  // Helper para buscar o plano legado mais recente de uma lista
  const findLatestLegacy = (views: LegacyNutritionPlanView[]): LegacyNutritionPlanView | null => {
    if (views.length === 0) return null;
    return views.reduce((latest, current) => {
      const timeDiff = current.vigentFrom.getTime() - latest.vigentFrom.getTime();
      if (timeDiff > 0) return current;
      if (timeDiff === 0) {
        // Desempate estável por ID
        return current.id < latest.id ? current : latest;
      }
      return latest;
    });
  };

  // Avaliação do Legado Primário: nutritional_prescriptions
  const hasPrimaryLegacyDocs = parsingErrors.some((err) => err.collection === "nutritional_prescriptions") || legacyPrimary.length > 0;

  if (hasPrimaryLegacyDocs) {
    const hasPrimaryParsingFailure = parsingErrors.some((err) => err.collection === "nutritional_prescriptions");
    if (hasPrimaryParsingFailure) {
      // Se houver planos no legado primário, mas eles falharem no parsing, não podemos fazer fallback para o secundário.
      return {
        status: "degraded",
        reason: "malformed-primary-legacy",
        dogId,
        activePlan: null,
        plans: canonicalPlans,
        legacyPlan: null,
        error: "Prescrições legadas primárias inválidas ou malformadas",
        integrityConflict: null,
        parsingErrors,
      };
    }

    const latestPrimary = findLatestLegacy(legacyPrimary);
    if (latestPrimary) {
      return {
        status: "legacy",
        dogId,
        activePlan: latestPrimary,
        plans: canonicalPlans,
        legacyPlan: latestPrimary,
        error: null,
        integrityConflict: null,
        parsingErrors,
      };
    }
  }

  // Avaliação do Legado Fallback/Secundário: nutrition_prescriptions
  const hasFallbackLegacyDocs = parsingErrors.some((err) => err.collection === "nutrition_prescriptions") || legacyFallback.length > 0;

  if (hasFallbackLegacyDocs) {
    const hasFallbackParsingFailure = parsingErrors.some((err) => err.collection === "nutrition_prescriptions");
    if (hasFallbackParsingFailure) {
      return {
        status: "degraded",
        reason: "malformed-secondary-legacy",
        dogId,
        activePlan: null,
        plans: canonicalPlans,
        legacyPlan: null,
        error: "Prescrições legadas secundárias inválidas ou malformadas",
        integrityConflict: null,
        parsingErrors,
      };
    }

    const latestFallback = findLatestLegacy(legacyFallback);
    if (latestFallback) {
      return {
        status: "legacy",
        dogId,
        activePlan: latestFallback,
        plans: canonicalPlans,
        legacyPlan: latestFallback,
        error: null,
        integrityConflict: null,
        parsingErrors,
      };
    }
  }

  // 6. Vazio total
  const hasAnyParsingError = parsingErrors.length > 0;
  return {
    status: hasAnyParsingError ? "degraded" : "empty",
    reason: hasAnyParsingError ? "partial-parsing-errors" : undefined,
    dogId,
    activePlan: null,
    plans: canonicalPlans,
    legacyPlan: null,
    error: hasAnyParsingError ? "Ocorreram erros no parsing de documentos parciais" : null,
    integrityConflict: null,
    parsingErrors,
  };
}
