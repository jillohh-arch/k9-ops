import type { ReportTone } from './report-tokens';

/**
 * Imagem ou artefato em base64/dataURL para renderização nos slots de relatório.
 */
export interface ReportImageSlot {
  dataUrl?: string;
  base64?: string;
  format?: 'PNG' | 'JPEG' | 'WEBP';
  width?: number;
  height?: number;
  aspectRatio?: number;
}

/**
 * 4 cenários canônicos de renderização de branding.
 */
export type BrandingScenario =
  | 'productMarkOnly'
  | 'institutionalIssuerMarkOnly'
  | 'both'
  | 'neither';

/**
 * Configuração dos slots de branding do relatório.
 */
export interface ReportBranding {
  productMarkImage?: ReportImageSlot | null;
  institutionalIssuerMarkImage?: ReportImageSlot | null;
  textualFallback?: string;
  showProductMark?: boolean;
  showInstitutionalIssuerMark?: boolean;
}

/**
 * Resolve o cenário de branding conforme a presença dos slots.
 */
export function resolveBrandingScenario(
  branding: ReportBranding = {},
): BrandingScenario {
  const showProduct = branding.showProductMark ?? true;
  const showIssuer =
    (branding.showInstitutionalIssuerMark ?? true) &&
    Boolean(branding.institutionalIssuerMarkImage);

  if (showProduct && showIssuer) return 'both';
  if (showProduct && !showIssuer) return 'productMarkOnly';
  if (!showProduct && showIssuer) return 'institutionalIssuerMarkOnly';
  return 'neither';
}

/**
 * Metadados do relatório.
 *
 * REGRA CANÔNICA:
 * - `generatedAt` é o ÚNICO metadado universalmente obrigatório.
 * - `documentId` é condicional (apenas quando o documento tem ID canônico).
 * - Campos opcionais sem valor devem ser elegantemente omitidos (SEM 'N/A' automático,
 *   SEM UUIDs sintéticos).
 */
export interface ReportMetadata {
  generatedAt: Date | string;
  documentId?: string;
  operatorName?: string;
  actorRole?: string;
  callsign?: string;
  period?: string;
  dogIdentity?: string;
  additional?: Record<string, string>;
}

/**
 * 5 Arquétipos frozen do K9 Ops Report Design System V1.
 */
export type ReportArchetype =
  | 'institutional'
  | 'operational'
  | 'clinical'
  | 'analytical'
  | 'tabular';

export type HeaderVariant = 'institutional' | 'standard' | 'compact';
export type PageOrientation = 'portrait' | 'landscape';

/**
 * Configuração e capacidades composáveis do arquétipo.
 */
export interface ReportArchetypeConfig {
  archetype: ReportArchetype;
  name: string;
  orientation: PageOrientation;
  headerVariant: HeaderVariant;
  requiresAuditBlock: boolean;
  requiresSignatures: boolean;
  supportsTimeline: boolean;
  supportsIdentityBlock: boolean;
  supportsDataTable: boolean;
}

export const ARCHETYPE_CONFIGS: Record<ReportArchetype, ReportArchetypeConfig> = {
  institutional: {
    archetype: 'institutional',
    name: 'Institucional / Legal',
    orientation: 'portrait',
    headerVariant: 'institutional',
    requiresAuditBlock: true,
    requiresSignatures: true,
    supportsTimeline: false,
    supportsIdentityBlock: true,
    supportsDataTable: true,
  },
  operational: {
    archetype: 'operational',
    name: 'Registro Operacional',
    orientation: 'portrait',
    headerVariant: 'standard',
    requiresAuditBlock: true,
    requiresSignatures: true,
    supportsTimeline: true,
    supportsIdentityBlock: true,
    supportsDataTable: true,
  },
  clinical: {
    archetype: 'clinical',
    name: 'Prontuário Clínico',
    orientation: 'portrait',
    headerVariant: 'standard',
    requiresAuditBlock: false,
    requiresSignatures: true,
    supportsTimeline: true,
    supportsIdentityBlock: true,
    supportsDataTable: true,
  },
  analytical: {
    archetype: 'analytical',
    name: 'Analítico / Gestão',
    orientation: 'portrait',
    headerVariant: 'standard',
    requiresAuditBlock: false,
    requiresSignatures: false,
    supportsTimeline: false,
    supportsIdentityBlock: false,
    supportsDataTable: true,
  },
  tabular: {
    archetype: 'tabular',
    name: 'Tabular / Inventário',
    orientation: 'landscape',
    headerVariant: 'standard',
    requiresAuditBlock: false,
    requiresSignatures: false,
    supportsTimeline: false,
    supportsIdentityBlock: false,
    supportsDataTable: true,
  },
};

// ---------------------------------------------------------------------------
// Modelos das Primitivas de Conteúdo
// ---------------------------------------------------------------------------

export interface EntityIdentityField {
  label: string;
  value: string;
  isMonospace?: boolean;
}

export interface EntityIdentityData {
  title: string;
  subtitle?: string;
  fields: EntityIdentityField[];
  statusLabel?: string;
  statusTone?: ReportTone;
  avatar?: ReportImageSlot;
}

export interface SummaryCardData {
  title: string;
  description?: string;
  bulletItems?: string[];
  tone?: ReportTone;
}

export interface MetricCardData {
  label: string;
  value: string | number;
  unit?: string;
  trend?: string;
  tone?: ReportTone;
}

export interface StatusBadgeData {
  label: string;
  tone: ReportTone;
  iconText?: string;
}

export interface TimelineNodeData {
  timestamp?: Date | string;
  timeLabel?: string;
  title: string;
  description?: string;
  tone?: ReportTone;
}

export type DataTableCellAlignment = 'left' | 'center' | 'right';

export interface DataTableColumn {
  header: string;
  key: string;
  alignment?: DataTableCellAlignment;
  isMonospace?: boolean;
  width?: number; // em mm
}

export interface DataTableData {
  columns: DataTableColumn[];
  rows: Record<string, string | number>[];
}

export interface EvidenceItemData {
  image: ReportImageSlot;
  caption: string;
  timestamp?: string;
  metadata?: string;
}

export interface AttachmentItemData {
  fileName: string;
  fileType?: string;
  fileSize?: string;
  hash?: string;
}

export interface ObservationBlockData {
  text: string;
  title?: string;
}

export interface SignatureData {
  name: string;
  role: string;
  identifier?: string;
}

export interface AuditData {
  verificationUrl: string;
  hash: string;
  algorithm: string;
  documentId?: string;
}
