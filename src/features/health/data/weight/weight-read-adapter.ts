/**
 * Adapter central de leitura de Pesagem.
 *
 * Reproduz semanticamente `weight_assessment_read_adapter.dart` (Mobile,
 * commit 6e6733eb).
 *
 * Contrato:
 * - opera em EXATAMENTE UM documento por chamada;
 * - invoca o parser central e classifica o status;
 * - preserva `valid` mesmo sem autoria canônica (`recorder == null`);
 * - nunca inventa autoria e nunca expõe `legacyActorReference` / RA;
 * - NÃO seleciona peso atual, não ordena coleções e não oferece fallback:
 *   essa política pertence ao WEIGHT-01D-C, onde a ordem documental real e o
 *   tratamento de malformed/unsupported anteriores ao primeiro válido podem
 *   ser decididos com as superfícies em vista;
 * - não consulta, não escreve, não loga;
 * - sem dependência de React ou Firebase.
 *
 * `malformed` e `unsupported` são bloqueadores de leitura: não produzem
 * aggregate e nunca devem promover um registro anterior a peso atual.
 */

import type {
  WeightAssessment,
  WeightCompatibilityMetadata,
  WeightOfficialDetails,
  WeightRecorder,
} from "../../domain/weight/weight-assessment";
import type { WeightDocumentDiagnosticCode } from "../../domain/weight/weight-diagnostics";
import type {
  ParsedWeightEnum,
  WeightAssessmentStatus,
  WeightBcsSource,
  WeightEquipmentState,
  WeightInformationSource,
  WeightLocation,
  WeightMeasurementCondition,
  WeightReadingQuality,
  WeightRecordType,
} from "../../domain/weight/weight-enums";
import {
  CANONICAL_WEIGHT_COLLECTION,
  parseWeightDocument,
} from "../../domain/weight/weight-document-parser";

// ─── Representação pública ─────────────────────────────────────────────────

/**
 * Enum público de pesagem.
 *
 * Fronteira deliberadamente mais estreita que `ParsedWeightEnum`: nunca carrega
 * `raw`. `known` expõe apenas o valor canônico; `unknown`/`absent` expõem só o
 * estado. O raw de um enum desconhecido — que pode conter e-mail, RA ou token
 * de um campo inválido — permanece exclusivamente no aggregate bruto do parser.
 */
export type PublicParsedWeightEnum<T extends string> =
  | { readonly state: "known"; readonly value: T }
  | { readonly state: "unknown" }
  | { readonly state: "absent" };

/** BCS público: valor factual e source já reduzido a enum público. */
export type PublicWeightBodyConditionScore = {
  readonly value: 1 | 2 | 3 | 4 | 5;
  readonly source: PublicParsedWeightEnum<WeightBcsSource>;
};

/** Detalhes oficiais públicos: todos os enums sem `raw`. */
export type PublicWeightOfficialDetails = {
  readonly informationSource: PublicParsedWeightEnum<WeightInformationSource>;
  readonly location: PublicParsedWeightEnum<WeightLocation>;
  readonly measurementCondition: PublicParsedWeightEnum<WeightMeasurementCondition>;
  readonly equipmentState: PublicParsedWeightEnum<WeightEquipmentState>;
  readonly readingQuality: PublicParsedWeightEnum<WeightReadingQuality>;
  readonly bodyConditionScore: PublicWeightBodyConditionScore | null;
  readonly locationOtherDescription: string | null;
  readonly conditionOtherDescription: string | null;
  readonly scaleIdentifier: string | null;
};

/**
 * Metadata de compatibilidade entregue aos readers.
 *
 * Derivada de `WeightCompatibilityMetadata` por omissão de
 * `legacyActorReference` e de `diagnostics`: o pseudo-identificador legado (RA)
 * e os objetos completos de diagnostic — que carregam `safeRaw` e `field` —
 * existem apenas na metadata interna do domínio. A superfície pública reduz os
 * diagnostics a códigos técnicos em `diagnosticCodes`. O tipo — não só a
 * implementação — impede a reintrodução acidental de qualquer um dos campos.
 */
export type PublicWeightCompatibilityMetadata = Omit<
  WeightCompatibilityMetadata,
  "legacyActorReference" | "diagnostics"
> & {
  readonly diagnosticCodes: readonly WeightDocumentDiagnosticCode[];
};

/**
 * Aggregate de pesagem entregue aos readers.
 *
 * Sem metadata legada interna e com todos os enums (`recordType`,
 * `originRecordType`, `status`, e os aninhados em `officialDetails`) reduzidos
 * à forma pública sem `raw`.
 */
export type PublicWeightAssessment = Omit<
  WeightAssessment,
  | "compatibility"
  | "recordType"
  | "originRecordType"
  | "status"
  | "officialDetails"
> & {
  readonly recordType: PublicParsedWeightEnum<WeightRecordType>;
  readonly originRecordType: PublicParsedWeightEnum<WeightRecordType>;
  readonly status: PublicParsedWeightEnum<WeightAssessmentStatus>;
  readonly officialDetails: PublicWeightOfficialDetails | null;
  readonly compatibility: PublicWeightCompatibilityMetadata;
};

export type WeightReadKind =
  | "valid"
  | "invalidated"
  | "malformed"
  | "unsupported";

export type WeightReadResult =
  | {
      readonly kind: "valid";
      readonly assessment: PublicWeightAssessment;
      readonly diagnostics: readonly WeightDocumentDiagnosticCode[];
    }
  | {
      readonly kind: "invalidated";
      readonly assessment: PublicWeightAssessment;
      readonly diagnostics: readonly WeightDocumentDiagnosticCode[];
    }
  | {
      readonly kind: "malformed";
      readonly assessment: null;
      readonly diagnostics: readonly WeightDocumentDiagnosticCode[];
    }
  | {
      readonly kind: "unsupported";
      readonly assessment: null;
      readonly schemaVersion: number;
      readonly diagnostics: readonly WeightDocumentDiagnosticCode[];
    };

export type ReadWeightDocumentInput = {
  readonly documentId: string;
  readonly dogId: string;
  readonly data: unknown;
  readonly sourceCollection?: string;
};

// ─── Sanitização ───────────────────────────────────────────────────────────

/**
 * Reduz um enum do domínio à forma pública, descartando `raw`.
 *
 * `known` preserva só o valor canônico; `unknown`/`absent` preservam só o
 * estado. O raw nunca é substituído por token, hash ou placeholder: ele
 * simplesmente não existe na representação pública.
 */
function publicEnum<T extends string>(
  parsed: ParsedWeightEnum<T>,
): PublicParsedWeightEnum<T> {
  if (parsed.state === "known") {
    return Object.freeze({ state: "known", value: parsed.value });
  }
  if (parsed.state === "unknown") {
    return Object.freeze({ state: "unknown" });
  }
  return Object.freeze({ state: "absent" });
}

/** Detalhes oficiais públicos: enums reduzidos, fatos preservados. */
function publicOfficialDetails(
  details: WeightOfficialDetails,
): PublicWeightOfficialDetails {
  const bcs = details.bodyConditionScore;
  return Object.freeze({
    bodyConditionScore:
      bcs === null
        ? null
        : Object.freeze({ source: publicEnum(bcs.source), value: bcs.value }),
    conditionOtherDescription: details.conditionOtherDescription,
    equipmentState: publicEnum(details.equipmentState),
    informationSource: publicEnum(details.informationSource),
    location: publicEnum(details.location),
    locationOtherDescription: details.locationOtherDescription,
    measurementCondition: publicEnum(details.measurementCondition),
    readingQuality: publicEnum(details.readingQuality),
    scaleIdentifier: details.scaleIdentifier,
  });
}

/**
 * Cópia readonly da metadata, sem `legacyActorReference` nem os objetos
 * completos de diagnostic.
 *
 * Construção explícita e exaustiva: um campo novo no domínio provoca erro de
 * tipo aqui em vez de vazar silenciosamente para os readers. Os diagnostics
 * são reduzidos a códigos técnicos, descartando `field` e `safeRaw`.
 */
function publicCompatibility(
  compatibility: WeightCompatibilityMetadata,
): PublicWeightCompatibilityMetadata {
  return Object.freeze({
    derivedFields: compatibility.derivedFields,
    diagnosticCodes: Object.freeze(
      compatibility.diagnostics.map((diagnostic) => diagnostic.code),
    ),
    orderingFallbackAt: compatibility.orderingFallbackAt,
    persistedSchemaVersion: compatibility.persistedSchemaVersion,
    schemaVersionDerived: compatibility.schemaVersionDerived,
    sourceShape: compatibility.sourceShape,
  });
}

/**
 * Cópia readonly do aggregate para consumo público.
 *
 * Não muta o aggregate original produzido pelo parser: os fatos são copiados
 * por referência para uma nova estrutura congelada, a metadata interna é
 * substituída pela versão sanitizada e todos os enums são reduzidos à forma
 * pública sem `raw`.
 */
function publicAssessment(assessment: WeightAssessment): PublicWeightAssessment {
  return Object.freeze({
    attachmentReferences: assessment.attachmentReferences,
    clinicalLinks: assessment.clinicalLinks,
    compatibility: publicCompatibility(assessment.compatibility),
    context: assessment.context,
    dogId: assessment.dogId,
    entityId: assessment.entityId,
    measuredAt: assessment.measuredAt,
    notes: assessment.notes,
    officialDetails:
      assessment.officialDetails === null
        ? null
        : publicOfficialDetails(assessment.officialDetails),
    originRecordType: publicEnum(assessment.originRecordType),
    recordedAt: assessment.recordedAt,
    recorder: assessment.recorder,
    recordType: publicEnum(assessment.recordType),
    revision: assessment.revision,
    schemaVersion: assessment.schemaVersion,
    status: publicEnum(assessment.status),
    weightKg: assessment.weightKg,
  });
}

// ─── Leitura ───────────────────────────────────────────────────────────────

/**
 * Lê um documento de `weight_records` e classifica o resultado.
 *
 * Status `valid` conhecido ⇒ `valid`. Status `invalidated` ⇒ `invalidated`,
 * excluído das superfícies ordinárias sem bloquear a leitura. Documento
 * ilegível ⇒ `malformed`. Schema futuro ⇒ `unsupported`.
 */
export function readWeightDocument(
  input: ReadWeightDocumentInput,
): WeightReadResult {
  const parsed = parseWeightDocument({
    data: input.data,
    dogId: input.dogId,
    entityId: input.documentId,
    sourceCollection: input.sourceCollection ?? CANONICAL_WEIGHT_COLLECTION,
  });

  const diagnostics = Object.freeze(
    parsed.diagnostics.map((diagnostic) => diagnostic.code),
  );

  if (parsed.kind === "malformed") {
    return { assessment: null, diagnostics, kind: "malformed" };
  }
  if (parsed.kind === "unsupported") {
    return {
      assessment: null,
      diagnostics,
      kind: "unsupported",
      schemaVersion: parsed.schemaVersion,
    };
  }

  const assessment = publicAssessment(parsed.assessment);
  const status = parsed.assessment.status;
  const isKnownValid = status.state === "known" && status.value === "valid";

  if (isKnownValid) {
    return { assessment, diagnostics, kind: "valid" };
  }

  // `invalidated` conhecido. Status não classificável já foi rejeitado como
  // malformed pelo parser target v2, portanto nunca alcança este ponto como
  // se fosse válido.
  return { assessment, diagnostics, kind: "invalidated" };
}

/**
 * Autoria factual apresentável.
 *
 * Retorna `null` quando não há `recorder` canônico — shapes legados
 * reconhecidos permanecem válidos e renderizáveis com autoria ausente. O RA
 * legado não existe nesta representação e portanto não pode ser usado aqui.
 */
export function presentableRecorder(
  assessment: PublicWeightAssessment,
): WeightRecorder | null {
  return assessment.recorder;
}
