import { jsPDF } from 'jspdf';

import {
  renderAttachmentBlock,
  renderAuditBlock,
  renderCoSignatureBlock,
  renderDataTable,
  renderEntityIdentityBlock,
  renderEvidenceBlock,
  renderInformationSection,
  renderInstitutionalHeader,
  renderObservationBlock,
  renderReportFooter,
  renderStandardReportHeader,
  renderSummaryCard,
  renderTimelineSection,
  ReportRenderContext,
} from './report-primitives';
import {
  ARCHETYPE_CONFIGS,
  type AttachmentItemData,
  type AuditData,
  type DataTableData,
  type EntityIdentityData,
  type EvidenceItemData,
  type ObservationBlockData,
  type PageOrientation,
  type ReportArchetype,
  type ReportArchetypeConfig,
  type ReportBranding,
  type ReportMetadata,
  type SignatureData,
  type SummaryCardData,
  type TimelineNodeData,
} from './report-types';

export interface ReportTemplateBuilderOptions {
  title: string;
  subtitle?: string;
  organization?: string;
  category?: string;
  disclaimer?: string;
  metadata: ReportMetadata;
  branding?: ReportBranding;
  archetypeConfig?: ReportArchetypeConfig;
}

/**
 * Orquestrador de relatórios baseado no K9 Ops Report Design System V1 para Web.
 *
 * Suporta os 5 arquétipos frozen, paginação automática A4, cabeçalhos de continuação
 * e rodapés canônicos "Página X de Y".
 */
export class ReportTemplateBuilder {
  public title: string;
  public subtitle?: string;
  public organization?: string;
  public category?: string;
  public disclaimer?: string;
  public metadata: ReportMetadata;
  public branding: ReportBranding;
  public archetypeConfig: ReportArchetypeConfig;

  private operations: Array<(ctx: ReportRenderContext) => void> = [];

  constructor(options: ReportTemplateBuilderOptions) {
    this.title = options.title;
    this.subtitle = options.subtitle;
    this.organization = options.organization;
    this.category = options.category;
    this.disclaimer = options.disclaimer;
    this.metadata = options.metadata;
    this.branding = options.branding ?? {};
    this.archetypeConfig =
      options.archetypeConfig ?? ARCHETYPE_CONFIGS.operational;
  }

  public static forArchetype(
    archetype: ReportArchetype,
    options: Omit<ReportTemplateBuilderOptions, 'archetypeConfig'> & {
      orientationOverride?: PageOrientation;
    },
  ): ReportTemplateBuilder {
    const config = { ...ARCHETYPE_CONFIGS[archetype] };
    if (options.orientationOverride) {
      config.orientation = options.orientationOverride;
    }

    return new ReportTemplateBuilder({
      ...options,
      archetypeConfig: config,
    });
  }

  public addEntityIdentity(data: EntityIdentityData): this {
    this.operations.push((ctx) => renderEntityIdentityBlock(ctx, data));
    return this;
  }

  public addSummary(data: SummaryCardData): this {
    this.operations.push((ctx) => renderSummaryCard(ctx, data));
    return this;
  }

  public addInformationSection(title: string, fn: (ctx: ReportRenderContext) => void): this {
    this.operations.push((ctx) => {
      renderInformationSection(ctx, title, () => fn(ctx));
    });
    return this;
  }

  public addTimeline(nodes: TimelineNodeData[]): this {
    this.operations.push((ctx) => renderTimelineSection(ctx, nodes));
    return this;
  }

  public addDataTable(data: DataTableData): this {
    this.operations.push((ctx) => renderDataTable(ctx, data));
    return this;
  }

  public addEvidence(item: EvidenceItemData): this {
    this.operations.push((ctx) => renderEvidenceBlock(ctx, item));
    return this;
  }

  public addAttachments(attachments: AttachmentItemData[]): this {
    this.operations.push((ctx) => renderAttachmentBlock(ctx, attachments));
    return this;
  }

  public addObservations(data: ObservationBlockData): this {
    this.operations.push((ctx) => renderObservationBlock(ctx, data));
    return this;
  }

  public addSignatures(signatures: SignatureData[]): this {
    this.operations.push((ctx) => renderCoSignatureBlock(ctx, signatures));
    return this;
  }

  public addAudit(audit: AuditData): this {
    this.operations.push((ctx) => renderAuditBlock(ctx, audit));
    return this;
  }

  public addCustom(fn: (ctx: ReportRenderContext) => void): this {
    this.operations.push(fn);
    return this;
  }

  /**
   * Constrói e retorna o documento jsPDF finalizado.
   */
  public build(): jsPDF {
    const doc = new jsPDF({
      orientation: this.archetypeConfig.orientation,
      unit: 'mm',
      format: 'a4',
    });

    const ctx = new ReportRenderContext(doc, this.archetypeConfig.orientation);

    // 1. Cabeçalho Primário da Página 1
    if (this.archetypeConfig.headerVariant === 'institutional') {
      renderInstitutionalHeader(ctx, {
        title: this.title,
        subtitle: this.subtitle,
        organization: this.organization,
        metadata: this.metadata,
        branding: this.branding,
      });
    } else {
      renderStandardReportHeader(ctx, {
        title: this.title,
        category: this.category,
        subtitle: this.subtitle,
        metadata: this.metadata,
        branding: this.branding,
      });
    }

    // 2. Executa operações do corpo do relatório
    for (const op of this.operations) {
      op(ctx);
    }

    // 3. Rodapés e paginação universal em todas as páginas
    renderReportFooter(doc, {
      title: this.title,
      documentId: this.metadata.documentId,
      disclaimer: this.disclaimer,
      margins: {
        left: ctx.marginLeft,
        right: ctx.marginRight,
        bottom: ctx.marginBottom,
      },
    });

    return doc;
  }

  /**
   * Retorna os bytes em formato Uint8Array.
   */
  public getBuffer(): Uint8Array {
    const doc = this.build();
    const arrayBuffer = doc.output('arraybuffer');
    return new Uint8Array(arrayBuffer);
  }

  /**
   * Retorna o PDF em formato Blob.
   */
  public getBlob(): Blob {
    const doc = this.build();
    return doc.output('blob');
  }
}
