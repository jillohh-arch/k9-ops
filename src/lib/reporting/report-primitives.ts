import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import { generateQrMatrix } from './qr-matrix';
import {
  hexToRgb,
  REPORT_COLORS_RGB,
  REPORT_PAGE_METRICS,
  REPORT_TONE_COLORS,
  REPORT_TYPOGRAPHY,
  type ReportTone,
} from './report-tokens';
import {
  resolveBrandingScenario,
  type AttachmentItemData,
  type AuditData,
  type DataTableData,
  type EntityIdentityData,
  type EvidenceItemData,
  type MetricCardData,
  type ObservationBlockData,
  type ReportBranding,
  type ReportMetadata,
  type SignatureData,
  type StatusBadgeData,
  type SummaryCardData,
  type TimelineNodeData,
} from './report-types';

/**
 * Contexto de renderização mantendo coordenadas do cursor e métricas de página.
 */
export class ReportRenderContext {
  public doc: jsPDF;
  public orientation: 'portrait' | 'landscape';
  public pageWidth: number;
  public pageHeight: number;
  public marginLeft: number;
  public marginRight: number;
  public marginTop: number;
  public marginBottom: number;
  public contentWidth: number;
  public y: number;

  constructor(doc: jsPDF, orientation: 'portrait' | 'landscape' = 'portrait') {
    this.doc = doc;
    this.orientation = orientation;
    this.pageWidth = doc.internal.pageSize.getWidth();
    this.pageHeight = doc.internal.pageSize.getHeight();

    const metrics =
      orientation === 'portrait'
        ? REPORT_PAGE_METRICS.portrait
        : REPORT_PAGE_METRICS.landscape;

    this.marginLeft = metrics.marginsMm.left;
    this.marginRight = metrics.marginsMm.right;
    this.marginTop = metrics.marginsMm.top;
    this.marginBottom = metrics.marginsMm.bottom;
    this.contentWidth = this.pageWidth - this.marginLeft - this.marginRight;
    this.y = this.marginTop;
  }

  /**
   * Verifica se há espaço para o elemento. Se não houver, quebra a página
   * e reseta o cursor vertical com cabeçalho compacto opcional.
   */
  public checkPageBreak(
    neededHeightMm: number,
    onNewPage?: (ctx: ReportRenderContext) => void,
  ): boolean {
    if (this.y + neededHeightMm > this.pageHeight - this.marginBottom) {
      this.doc.addPage();
      this.y = this.marginTop;
      if (onNewPage) {
        onNewPage(this);
      }
      return true;
    }
    return false;
  }
}

// ===========================================================================
// HELPERS DE ASPECT RATIO E CONTAIN
// ===========================================================================

/**
 * Deriva a proporção de aspecto (ar = largura / altura) de um slot de imagem.
 * - Se `image.aspectRatio` existir, usa-o.
 * - Se `image.width` e `image.height` existirem, deriva `ar = image.width / image.height`.
 * - Se nenhum existir ou se o valor resultante for inválido (<= 0 ou não finito), adota o fallback limpo (default 1.0).
 */
export function resolveImageAspectRatio(
  image?: { aspectRatio?: number; width?: number; height?: number } | null,
  fallback = 1.0,
): number {
  const safeFallback =
    Number.isFinite(fallback) && fallback > 0 ? fallback : 1.0;

  let resolved: number | undefined;

  if (
    image?.aspectRatio !== undefined &&
    Number.isFinite(image.aspectRatio) &&
    image.aspectRatio > 0
  ) {
    resolved = image.aspectRatio;
  } else if (
    image?.width !== undefined &&
    image?.height !== undefined &&
    Number.isFinite(image.width) &&
    Number.isFinite(image.height) &&
    image.width > 0 &&
    image.height > 0
  ) {
    resolved = image.width / image.height;
  }

  if (resolved !== undefined && Number.isFinite(resolved) && resolved > 0) {
    return resolved;
  }

  return safeFallback;
}

/**
 * Aplica a fórmula canônica de `contain`:
 * if (maxW / ar <= maxH) {
 *   renderW = maxW;
 *   renderH = maxW / ar;
 * } else {
 *   renderH = maxH;
 *   renderW = maxH * ar;
 * }
 */
export function fitDimensionsContain(
  maxW: number,
  maxH: number,
  aspectRatio: number,
): { renderW: number; renderH: number } {
  const ar =
    Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1.0;
  if (maxW / ar <= maxH) {
    return {
      renderW: maxW,
      renderH: maxW / ar,
    };
  } else {
    return {
      renderH: maxH,
      renderW: maxH * ar,
    };
  }
}

/**
 * Calcula dimensões contidas (`contain`) para um asset de imagem dentro dos limites `maxW` x `maxH`.
 */
export function calculateContainedDimensions(
  maxW: number,
  maxH: number,
  image?: { aspectRatio?: number; width?: number; height?: number } | null,
  fallbackAr = 1.0,
): { renderW: number; renderH: number } {
  const ar = resolveImageAspectRatio(image, fallbackAr);
  return fitDimensionsContain(maxW, maxH, ar);
}

// ===========================================================================
// 1. BRANDING SLOTS
// ===========================================================================

/**
 * Renderiza o slot oficial da marca K9 Ops.
 *
 * Dimensões máximas: 28x12mm, contain, safe area 2mm.
 * Fallback textual limpo "K9 Ops".
 * REGRA ESTRITA: NUNCA gera logotipo sintético (sem círculo ciano inventado).
 */
export function renderProductMark(
  ctx: ReportRenderContext,
  x: number,
  y: number,
  branding: ReportBranding = {},
): number {
  const { doc } = ctx;
  const maxW = REPORT_PAGE_METRICS.brandingSlots.productMark.maxWidthMm;
  const maxH = REPORT_PAGE_METRICS.brandingSlots.productMark.maxHeightMm;
  const safeArea = REPORT_PAGE_METRICS.brandingSlots.productMark.safeAreaMm;

  if (branding.productMarkImage?.dataUrl || branding.productMarkImage?.base64) {
    const imgData =
      branding.productMarkImage.dataUrl ??
      `data:image/png;base64,${branding.productMarkImage.base64}`;
    const format = branding.productMarkImage.format ?? 'PNG';

    const usableMaxW = Math.max(0, maxW - safeArea * 2);
    const usableMaxH = Math.max(0, maxH - safeArea * 2);

    const { renderW, renderH } = calculateContainedDimensions(
      usableMaxW,
      usableMaxH,
      branding.productMarkImage,
      1.0,
    );

    const posX = x + safeArea;
    const posY = y + safeArea;

    doc.addImage(imgData, format, posX, posY, renderW, renderH);
    return Math.max(renderH + safeArea * 2, 10);
  }

  // Fallback textual oficial alinhado no centro vertical com compensação de baseline de 11pt
  const fallbackText = branding.textualFallback ?? 'K9 Ops';
  doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...REPORT_COLORS_RGB.accent);
  doc.text(fallbackText, x + safeArea, y + (maxH / 2) + 2);

  return 10;
}

/**
 * Renderiza o slot da marca do emissor institucional.
 *
 * Dimensões máximas: 18x18mm, contain, safe area 2mm.
 */
export function renderInstitutionalIssuerMark(
  ctx: ReportRenderContext,
  x: number,
  y: number,
  branding: ReportBranding = {},
): number {
  const { doc } = ctx;
  const maxW = REPORT_PAGE_METRICS.brandingSlots.institutionalIssuerMark.maxWidthMm;
  const maxH = REPORT_PAGE_METRICS.brandingSlots.institutionalIssuerMark.maxHeightMm;
  const safeArea = REPORT_PAGE_METRICS.brandingSlots.institutionalIssuerMark.safeAreaMm;

  if (
    branding.institutionalIssuerMarkImage?.dataUrl ||
    branding.institutionalIssuerMarkImage?.base64
  ) {
    const imgData =
      branding.institutionalIssuerMarkImage.dataUrl ??
      `data:image/png;base64,${branding.institutionalIssuerMarkImage.base64}`;
    const format = branding.institutionalIssuerMarkImage.format ?? 'PNG';

    const usableMaxW = Math.max(0, maxW - safeArea * 2);
    const usableMaxH = Math.max(0, maxH - safeArea * 2);

    const { renderW, renderH } = calculateContainedDimensions(
      usableMaxW,
      usableMaxH,
      branding.institutionalIssuerMarkImage,
      1.0,
    );

    const posX = x + safeArea;
    const posY = y + safeArea;

    doc.addImage(imgData, format, posX, posY, renderW, renderH);
    return Math.max(renderH + safeArea * 2, 14);
  }

  return 0;
}

/**
 * Linha de Branding com resolução dos 4 cenários:
 * 1. productMarkOnly
 * 2. institutionalIssuerMarkOnly
 * 3. both
 * 4. neither
 */
export function renderBrandingRow(
  ctx: ReportRenderContext,
  branding: ReportBranding = {},
): number {
  const scenario = resolveBrandingScenario(branding);
  let heightUsed = 0;

  switch (scenario) {
    case 'both': {
      const productH = renderProductMark(ctx, ctx.marginLeft, ctx.y, branding);
      const issuerW = REPORT_PAGE_METRICS.brandingSlots.institutionalIssuerMark.maxWidthMm;
      const issuerX = ctx.pageWidth - ctx.marginRight - issuerW;
      const issuerH = renderInstitutionalIssuerMark(ctx, issuerX, ctx.y, branding);
      heightUsed = Math.max(productH, issuerH);
      break;
    }
    case 'productMarkOnly': {
      heightUsed = renderProductMark(ctx, ctx.marginLeft, ctx.y, branding);
      break;
    }
    case 'institutionalIssuerMarkOnly': {
      heightUsed = renderInstitutionalIssuerMark(ctx, ctx.marginLeft, ctx.y, branding);
      break;
    }
    case 'neither': {
      heightUsed = 0;
      break;
    }
  }

  if (heightUsed > 0) {
    ctx.y += heightUsed + 4;
  }
  return heightUsed;
}

// ===========================================================================
// 2. STATUS BADGE
// ===========================================================================

/**
 * Renderiza o StatusBadge canônico com alto contraste e acessibilidade.
 * Utiliza exclusivamente os 6 tons genéricos de ReportTone.
 */
export function renderStatusBadge(
  ctx: ReportRenderContext,
  x: number,
  y: number,
  badge: StatusBadgeData,
): number {
  const { doc } = ctx;
  const tone = REPORT_TONE_COLORS[badge.tone];
  const bgRgb = hexToRgb(tone.background);
  const borderRgb = hexToRgb(tone.border);
  const textRgb = hexToRgb(tone.text);
  const accentRgb = hexToRgb(tone.accent);

  doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'bold');
  doc.setFontSize(7.5);
  const labelText = badge.label.toUpperCase();
  const textW = doc.getTextWidth(labelText);
  const badgeW = textW + 12;
  const badgeH = 5.5;

  // Caixa do badge
  doc.setFillColor(...bgRgb);
  doc.setDrawColor(...borderRgb);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, badgeW, badgeH, 1, 1, 'FD');

  // Ponto colorido indicador
  doc.setFillColor(...accentRgb);
  doc.circle(x + 3, y + badgeH / 2, 1, 'F');

  // Texto
  doc.setTextColor(...textRgb);
  doc.text(labelText, x + 5.5, y + 4);

  return badgeW;
}

// ===========================================================================
// 3. CABEÇALHOS (HEADERS)
// ===========================================================================

export function formatDateTime(val: Date | string): string {
  const d = typeof val === 'string' ? new Date(val) : val;
  if (isNaN(d.getTime())) return String(val);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Cabeçalho Institucional / Legal: variante formal.
 */
export function renderInstitutionalHeader(
  ctx: ReportRenderContext,
  options: {
    title: string;
    subtitle?: string;
    organization?: string;
    metadata: ReportMetadata;
    branding?: ReportBranding;
  },
): void {
  const { doc } = ctx;

  // Branding
  renderBrandingRow(ctx, options.branding);

  // Organização (se houver)
  if (options.organization) {
    doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...REPORT_COLORS_RGB.textSecondary);
    doc.text(options.organization.toUpperCase(), ctx.marginLeft, ctx.y);
    ctx.y += 4.5;
  }

  // Título
  doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...REPORT_COLORS_RGB.textPrimary);
  doc.text(options.title, ctx.marginLeft, ctx.y + 1);
  ctx.y += 7;

  // Subtítulo
  if (options.subtitle) {
    doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...REPORT_COLORS_RGB.textMuted);
    doc.text(options.subtitle, ctx.marginLeft, ctx.y);
    ctx.y += 5;
  }

  // Linha de Metadados
  renderMetadataRow(ctx, options.metadata);

  // Linha divisória
  doc.setDrawColor(...REPORT_COLORS_RGB.borderStrong);
  doc.setLineWidth(0.3);
  doc.line(ctx.marginLeft, ctx.y, ctx.pageWidth - ctx.marginRight, ctx.y);
  ctx.y += 6;
}

/**
 * Cabeçalho Padrão / Analítico: variante analítica e operacional.
 */
export function renderStandardReportHeader(
  ctx: ReportRenderContext,
  options: {
    title: string;
    category?: string;
    subtitle?: string;
    metadata: ReportMetadata;
    branding?: ReportBranding;
  },
): void {
  const { doc } = ctx;

  // Branding
  renderBrandingRow(ctx, options.branding);

  // Categoria
  if (options.category) {
    doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...REPORT_COLORS_RGB.accent);
    doc.text(options.category.toUpperCase(), ctx.marginLeft, ctx.y);
    ctx.y += 4;
  }

  // Título
  doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...REPORT_COLORS_RGB.textPrimary);
  doc.text(options.title, ctx.marginLeft, ctx.y + 1);
  ctx.y += 8;

  // Subtítulo
  if (options.subtitle) {
    doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...REPORT_COLORS_RGB.textSecondary);
    doc.text(options.subtitle, ctx.marginLeft, ctx.y);
    ctx.y += 5;
  }

  // Linha de Metadados
  renderMetadataRow(ctx, options.metadata);

  // Linha divisória
  doc.setDrawColor(...REPORT_COLORS_RGB.borderSoft);
  doc.setLineWidth(0.4);
  doc.line(ctx.marginLeft, ctx.y, ctx.pageWidth - ctx.marginRight, ctx.y);
  ctx.y += 6;
}

/**
 * Cabeçalho Compacto de Continuação para páginas 2..N.
 */
export function renderCompactContinuationHeader(
  ctx: ReportRenderContext,
  options: {
    title: string;
    documentId?: string;
  },
): void {
  const { doc } = ctx;
  doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...REPORT_COLORS_RGB.textSecondary);
  doc.text(options.title, ctx.marginLeft, ctx.y);

  if (options.documentId) {
    doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfMono, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...REPORT_COLORS_RGB.textMuted);
    const idText = `ID: ${options.documentId}`;
    const idW = doc.getTextWidth(idText);
    doc.text(idText, ctx.pageWidth - ctx.marginRight - idW, ctx.y);
  }

  ctx.y += 3;
  doc.setDrawColor(...REPORT_COLORS_RGB.borderSoft);
  doc.setLineWidth(0.2);
  doc.line(ctx.marginLeft, ctx.y, ctx.pageWidth - ctx.marginRight, ctx.y);
  ctx.y += 5;
}

// ===========================================================================
// 4. METADADOS
// ===========================================================================

export function renderMetadataRow(
  ctx: ReportRenderContext,
  metadata: ReportMetadata,
): void {
  const { doc } = ctx;
  let currX = ctx.marginLeft;
  const baseY = ctx.y;

  function renderItem(label: string, value: string, isMono = false) {
    doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...REPORT_COLORS_RGB.textMuted);
    doc.text(label.toUpperCase(), currX, baseY);

    doc.setFont(
      isMono ? REPORT_TYPOGRAPHY.fontFamilies.pdfMono : REPORT_TYPOGRAPHY.fontFamilies.pdfSans,
      isMono ? 'normal' : 'bold',
    );
    doc.setFontSize(8.5);
    doc.setTextColor(...REPORT_COLORS_RGB.textPrimary);
    doc.text(value, currX, baseY + 4);

    const w = Math.max(doc.getTextWidth(label), doc.getTextWidth(value));
    currX += w + 8;
  }

  // GENERATED_AT universalmente obrigatório
  renderItem('EMISSÃO', formatDateTime(metadata.generatedAt), true);

  // DOCUMENT_ID condicional
  if (metadata.documentId) {
    renderItem('ID DO DOCUMENTO', metadata.documentId, true);
  }

  if (metadata.operatorName) {
    renderItem('OPERADOR', metadata.operatorName);
  }

  if (metadata.callsign) {
    renderItem('PREFIXO', metadata.callsign, true);
  }

  if (metadata.period) {
    renderItem('PERÍODO', metadata.period);
  }

  if (metadata.dogIdentity) {
    renderItem('K9', metadata.dogIdentity);
  }

  ctx.y += 8;
}

// ===========================================================================
// 5. PRIMITIVAS DE CONTEÚDO
// ===========================================================================

/**
 * Bloco de Identidade Formal K9 ou Humana.
 */
export function renderEntityIdentityBlock(
  ctx: ReportRenderContext,
  data: EntityIdentityData,
): void {
  ctx.checkPageBreak(30);
  const { doc } = ctx;
  const startY = ctx.y;
  const blockW = ctx.contentWidth;

  // Caixa delimitadora base
  doc.setFillColor(...REPORT_COLORS_RGB.surface);
  doc.setDrawColor(...REPORT_COLORS_RGB.borderSoft);
  doc.setLineWidth(0.3);

  // Título e subtítulo
  doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...REPORT_COLORS_RGB.textPrimary);
  doc.text(data.title, ctx.marginLeft + 4, startY + 6);

  let innerY = startY + 6;
  if (data.subtitle) {
    innerY += 4.5;
    doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...REPORT_COLORS_RGB.textMuted);
    doc.text(data.subtitle, ctx.marginLeft + 4, innerY);
  }

  // Badge no canto direito se houver
  if (data.statusLabel && data.statusTone) {
    renderStatusBadge(
      ctx,
      ctx.pageWidth - ctx.marginRight - 35,
      startY + 3,
      { label: data.statusLabel, tone: data.statusTone },
    );
  }

  innerY += 4;
  // Linha sutil separando os campos
  doc.setDrawColor(...REPORT_COLORS_RGB.borderSoft);
  doc.setLineWidth(0.2);
  doc.line(ctx.marginLeft + 4, innerY, ctx.pageWidth - ctx.marginRight - 4, innerY);
  innerY += 4;

  // Campos em linha / colunas
  let fieldX = ctx.marginLeft + 4;
  for (const field of data.fields) {
    doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...REPORT_COLORS_RGB.textMuted);
    doc.text(field.label.toUpperCase(), fieldX, innerY);

    doc.setFont(
      field.isMonospace ? REPORT_TYPOGRAPHY.fontFamilies.pdfMono : REPORT_TYPOGRAPHY.fontFamilies.pdfSans,
      'bold',
    );
    doc.setFontSize(8.5);
    doc.setTextColor(...REPORT_COLORS_RGB.textPrimary);
    doc.text(field.value, fieldX, innerY + 3.8);

    const w = Math.max(doc.getTextWidth(field.label), doc.getTextWidth(field.value));
    fieldX += Math.max(w + 12, 35);
  }

  const totalH = innerY + 7 - startY;
  doc.roundedRect(ctx.marginLeft, startY, blockW, totalH, 1.5, 1.5, 'S');
  ctx.y = startY + totalH + 5;
}

/**
 * Card de Resumo / Alerta em destaque.
 */
export function renderSummaryCard(
  ctx: ReportRenderContext,
  data: SummaryCardData,
): void {
  ctx.checkPageBreak(25);
  const { doc } = ctx;
  const startY = ctx.y;
  const cardW = ctx.contentWidth;
  const tone = REPORT_TONE_COLORS[data.tone ?? 'neutral'];
  const borderRgb = hexToRgb(tone.border);
  const accentRgb = hexToRgb(tone.accent);

  let innerY = startY + 5;

  // Título com ponto indicador
  doc.setFillColor(...accentRgb);
  doc.circle(ctx.marginLeft + 5, innerY - 1, 1.2, 'F');

  doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...REPORT_COLORS_RGB.textPrimary);
  doc.text(data.title, ctx.marginLeft + 9, innerY);
  innerY += 4.5;

  // Descrição
  if (data.description) {
    doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...REPORT_COLORS_RGB.textSecondary);
    const splitDesc = doc.splitTextToSize(data.description, cardW - 14);
    doc.text(splitDesc, ctx.marginLeft + 9, innerY);
    innerY += splitDesc.length * 3.8;
  }

  // Tópicos
  if (data.bulletItems && data.bulletItems.length > 0) {
    for (const item of data.bulletItems) {
      doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...accentRgb);
      doc.text('•', ctx.marginLeft + 9, innerY);

      doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'normal');
      doc.setTextColor(...REPORT_COLORS_RGB.textSecondary);
      const splitItem = doc.splitTextToSize(item, cardW - 18);
      doc.text(splitItem, ctx.marginLeft + 13, innerY);
      innerY += splitItem.length * 3.6;
    }
  }

  const totalH = innerY + 2 - startY;

  // Fundo e borda uniforme
  doc.setFillColor(...REPORT_COLORS_RGB.surfaceSubtle);
  doc.setDrawColor(...borderRgb);
  doc.setLineWidth(0.3);
  doc.roundedRect(ctx.marginLeft, startY, cardW, totalH, 1.5, 1.5, 'FD');

  // Redesenha conteúdo acima do fundo preenchido
  innerY = startY + 5;
  doc.setFillColor(...accentRgb);
  doc.circle(ctx.marginLeft + 5, innerY - 1, 1.2, 'F');

  doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...REPORT_COLORS_RGB.textPrimary);
  doc.text(data.title, ctx.marginLeft + 9, innerY);
  innerY += 4.5;

  if (data.description) {
    doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...REPORT_COLORS_RGB.textSecondary);
    const splitDesc = doc.splitTextToSize(data.description, cardW - 14);
    doc.text(splitDesc, ctx.marginLeft + 9, innerY);
    innerY += splitDesc.length * 3.8;
  }

  if (data.bulletItems) {
    for (const item of data.bulletItems) {
      doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...accentRgb);
      doc.text('•', ctx.marginLeft + 9, innerY);

      doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'normal');
      doc.setTextColor(...REPORT_COLORS_RGB.textSecondary);
      const splitItem = doc.splitTextToSize(item, cardW - 18);
      doc.text(splitItem, ctx.marginLeft + 13, innerY);
      innerY += splitItem.length * 3.6;
    }
  }

  ctx.y = startY + totalH + 5;
}

/**
 * Card de Métrica / KPI.
 */
export function renderMetricCard(
  ctx: ReportRenderContext,
  x: number,
  y: number,
  width: number,
  data: MetricCardData,
): number {
  const { doc } = ctx;
  const cardH = 20;
  const tone = REPORT_TONE_COLORS[data.tone ?? 'neutral'];
  const accentRgb = hexToRgb(tone.accent);

  doc.setFillColor(...REPORT_COLORS_RGB.surface);
  doc.setDrawColor(...REPORT_COLORS_RGB.borderSoft);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, width, cardH, 1.5, 1.5, 'FD');

  // Label
  doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...REPORT_COLORS_RGB.textMuted);
  doc.text(data.label.toUpperCase(), x + 4, y + 5);

  // Valor
  doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...REPORT_COLORS_RGB.textPrimary);
  const valStr = String(data.value);
  doc.text(valStr, x + 4, y + 13);
  const valW = doc.getTextWidth(valStr);

  // Unidade
  if (data.unit) {
    doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...REPORT_COLORS_RGB.textMuted);
    doc.text(data.unit, x + 5 + valW, y + 13);
  }

  // Tendência
  if (data.trend) {
    doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...accentRgb);
    doc.text(data.trend, x + 4, y + 17.5);
  }

  return cardH;
}

/**
 * Seção de Informações com título destacado.
 */
export function renderInformationSection(
  ctx: ReportRenderContext,
  title: string,
  renderChildren: () => void,
): void {
  ctx.checkPageBreak(15);
  const { doc } = ctx;

  // Linha indicadora e título
  doc.setFillColor(...REPORT_COLORS_RGB.accent);
  doc.roundedRect(ctx.marginLeft, ctx.y - 1, 1.5, 4.5, 0.5, 0.5, 'F');

  doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...REPORT_COLORS_RGB.textPrimary);
  doc.text(title, ctx.marginLeft + 3.5, ctx.y + 3);

  ctx.y += 5.5;
  doc.setDrawColor(...REPORT_COLORS_RGB.borderSoft);
  doc.setLineWidth(0.3);
  doc.line(ctx.marginLeft, ctx.y, ctx.pageWidth - ctx.marginRight, ctx.y);
  ctx.y += 4;

  renderChildren();
}

/**
 * Linha do Tempo Operacional (Timeline).
 */
export function renderTimelineSection(
  ctx: ReportRenderContext,
  nodes: TimelineNodeData[],
): void {
  const { doc } = ctx;

  for (const node of nodes) {
    ctx.checkPageBreak(12);
    const startY = ctx.y;
    const tone = REPORT_TONE_COLORS[node.tone ?? 'info'];
    const accentRgb = hexToRgb(tone.accent);

    // Timestamp
    const timeText =
      node.timeLabel ?? (node.timestamp ? formatDateTime(node.timestamp) : '');
    doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfMono, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...REPORT_COLORS_RGB.textMuted);
    doc.text(timeText, ctx.marginLeft, startY + 3);

    // Ponto indicador
    const dotX = ctx.marginLeft + 32;
    doc.setFillColor(...accentRgb);
    doc.circle(dotX, startY + 2, 1.2, 'F');

    // Título e descrição
    doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...REPORT_COLORS_RGB.textPrimary);
    doc.text(node.title, dotX + 4, startY + 3);

    let descH = 0;
    if (node.description) {
      doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...REPORT_COLORS_RGB.textSecondary);
      const splitDesc = doc.splitTextToSize(
        node.description,
        ctx.contentWidth - 40,
      );
      doc.text(splitDesc, dotX + 4, startY + 6.5);
      descH = splitDesc.length * 3.2;
    }

    ctx.y = startY + Math.max(7, 4 + descH);
  }
  ctx.y += 3;
}

/**
 * Tabela de Dados via jspdf-autotable com repetição de cabeçalho,
 * zebra rows (surfaceSubtle) e alinhamentos estritos.
 */
export function renderDataTable(
  ctx: ReportRenderContext,
  data: DataTableData,
): void {
  const headers = data.columns.map((c) => c.header.toUpperCase());
  const rows = data.rows.map((row) =>
    data.columns.map((col) => String(row[col.key] ?? '')),
  );

  const columnStyles: Record<number, Record<string, unknown>> = {};
  data.columns.forEach((col, idx) => {
    columnStyles[idx] = {
      halign: col.alignment ?? 'left',
      font: col.isMonospace ? REPORT_TYPOGRAPHY.fontFamilies.pdfMono : REPORT_TYPOGRAPHY.fontFamilies.pdfSans,
      cellWidth: col.width ? col.width : 'auto',
    };
  });

  autoTable(ctx.doc, {
    startY: ctx.y,
    head: [headers],
    body: rows,
    theme: 'plain',
    showHead: 'everyPage',
    margin: { left: ctx.marginLeft, right: ctx.marginRight },
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      textColor: REPORT_COLORS_RGB.textPrimary,
      lineColor: REPORT_COLORS_RGB.borderSoft,
      lineWidth: 0.15,
      font: REPORT_TYPOGRAPHY.fontFamilies.pdfSans,
    },
    headStyles: {
      fillColor: REPORT_COLORS_RGB.surfaceSubtle,
      textColor: REPORT_COLORS_RGB.textSecondary,
      fontStyle: 'bold',
      lineColor: REPORT_COLORS_RGB.borderSoft,
      lineWidth: 0.2,
    },
    alternateRowStyles: {
      fillColor: REPORT_COLORS_RGB.surfaceSubtle,
    },
    columnStyles,
  });

  const lastTable = (ctx.doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable;
  ctx.y = (lastTable?.finalY ?? ctx.y) + 5;
}

/**
 * Bloco de Evidência com PRESERVAÇÃO ESTRITA de proporção (aspect ratio contain)
 * e agrupamento inseparável de imagem + legenda (keep-together).
 *
 * Paridade cross-runtime: se item.image não tiver dataUrl nem base64, o bloco
 * é omitido graciosamente sem desenhar caixa vazia e sem deslocar o cursor vertical.
 */
export function renderEvidenceBlock(
  ctx: ReportRenderContext,
  item: EvidenceItemData,
): void {
  // FINDING-02: Paridade cross-runtime com Mobile — omite se não houver payload
  if (!item?.image?.dataUrl && !item?.image?.base64) {
    return;
  }

  const maxH = 55; // altura máxima para evidência em mm
  const maxW = Math.min(ctx.contentWidth, 90);

  // FINDING-01: Derivação canônica de aspect ratio e contain sem distorção
  const { renderW, renderH } = calculateContainedDimensions(
    maxW,
    maxH,
    item.image,
    4 / 3,
  );

  const neededSpace = renderH + 15;
  ctx.checkPageBreak(neededSpace);

  const { doc } = ctx;
  const startY = ctx.y;

  const boxW = ctx.contentWidth;
  const totalBoxH = renderH + 14;

  // Caixa externa
  doc.setFillColor(...REPORT_COLORS_RGB.surfaceSubtle);
  doc.setDrawColor(...REPORT_COLORS_RGB.borderSoft);
  doc.setLineWidth(0.2);
  doc.roundedRect(ctx.marginLeft, startY, boxW, totalBoxH, 1, 1, 'FD');

  // Imagem centralizada
  const imgX = ctx.marginLeft + (boxW - renderW) / 2;
  const imgY = startY + 3;

  const imgData =
    item.image.dataUrl ?? `data:image/png;base64,${item.image.base64}`;
  doc.addImage(imgData, item.image.format ?? 'PNG', imgX, imgY, renderW, renderH);

  // Legenda inseparável logo abaixo da imagem
  const capY = imgY + renderH + 4;
  doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...REPORT_COLORS_RGB.textSecondary);
  doc.text(item.caption, ctx.marginLeft + 4, capY);

  if (item.timestamp || item.metadata) {
    const metaStr = [item.timestamp, item.metadata].filter(Boolean).join(' · ');
    doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfMono, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...REPORT_COLORS_RGB.textMuted);
    doc.text(metaStr, ctx.marginLeft + 4, capY + 3.5);
  }

  ctx.y = startY + totalBoxH + 5;
}

/**
 * Bloco de Anexos.
 */
export function renderAttachmentBlock(
  ctx: ReportRenderContext,
  attachments: AttachmentItemData[],
): void {
  const { doc } = ctx;

  for (const att of attachments) {
    ctx.checkPageBreak(8);
    const itemH = 6.5;

    doc.setFillColor(...REPORT_COLORS_RGB.surfaceSubtle);
    doc.setDrawColor(...REPORT_COLORS_RGB.borderSoft);
    doc.setLineWidth(0.2);
    doc.roundedRect(ctx.marginLeft, ctx.y, ctx.contentWidth, itemH, 1, 1, 'FD');

    doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...REPORT_COLORS_RGB.textPrimary);
    const fileLabel = `[ANEXO] ${att.fileName}`;
    doc.text(fileLabel, ctx.marginLeft + 3, ctx.y + 4.2);

    if (att.fileSize) {
      doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...REPORT_COLORS_RGB.textMuted);
      const labelW = doc.getTextWidth(fileLabel);
      doc.text(`(${att.fileSize})`, ctx.marginLeft + 4 + labelW, ctx.y + 4.2);
    }

    if (att.hash) {
      doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfMono, 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...REPORT_COLORS_RGB.textMuted);
      const hashW = doc.getTextWidth(att.hash);
      doc.text(att.hash, ctx.pageWidth - ctx.marginRight - hashW - 3, ctx.y + 4.2);
    }

    ctx.y += itemH + 2;
  }
}

/**
 * Bloco de Observações.
 */
export function renderObservationBlock(
  ctx: ReportRenderContext,
  data: ObservationBlockData,
): void {
  const { doc } = ctx;
  const splitText = doc.splitTextToSize(data.text, ctx.contentWidth - 8);
  const boxH = splitText.length * 3.6 + 10;

  ctx.checkPageBreak(boxH);
  const startY = ctx.y;

  doc.setFillColor(...REPORT_COLORS_RGB.surfaceSubtle);
  doc.setDrawColor(...REPORT_COLORS_RGB.borderSoft);
  doc.setLineWidth(0.25);
  doc.roundedRect(ctx.marginLeft, startY, ctx.contentWidth, boxH, 1.5, 1.5, 'FD');

  doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...REPORT_COLORS_RGB.textMuted);
  doc.text((data.title ?? 'Observações').toUpperCase(), ctx.marginLeft + 4, startY + 4.5);

  doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...REPORT_COLORS_RGB.textPrimary);
  doc.text(splitText, ctx.marginLeft + 4, startY + 8.5);

  ctx.y = startY + boxH + 5;
}

// ===========================================================================
// 6. ASSINATURAS E AUDITORIA
// ===========================================================================

export function renderSignatureBlock(
  ctx: ReportRenderContext,
  x: number,
  y: number,
  width: number,
  signature: SignatureData,
): number {
  const { doc } = ctx;
  const centerX = x + width / 2;

  // Linha de assinatura
  const lineW = Math.min(width * 0.8, 55);
  doc.setDrawColor(...REPORT_COLORS_RGB.borderStrong);
  doc.setLineWidth(0.3);
  doc.line(centerX - lineW / 2, y, centerX + lineW / 2, y);

  // Nome
  doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...REPORT_COLORS_RGB.textPrimary);
  doc.text(signature.name, centerX, y + 4, { align: 'center' });

  // Cargo / Função
  doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...REPORT_COLORS_RGB.textSecondary);
  doc.text(signature.role, centerX, y + 7.5, { align: 'center' });

  // Identificador (se houver)
  if (signature.identifier) {
    doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfMono, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...REPORT_COLORS_RGB.textMuted);
    doc.text(signature.identifier, centerX, y + 10.5, { align: 'center' });
  }

  return 14;
}

/**
 * Co-Assinaturas alinhadas com proteção contra quebra isolada.
 */
export function renderCoSignatureBlock(
  ctx: ReportRenderContext,
  signatures: SignatureData[],
): void {
  ctx.checkPageBreak(25);
  ctx.y += 8;

  const count = signatures.length;
  const colW = ctx.contentWidth / count;

  let maxY = ctx.y;
  for (let i = 0; i < count; i++) {
    const colX = ctx.marginLeft + i * colW;
    const h = renderSignatureBlock(ctx, colX, ctx.y, colW, signatures[i]);
    maxY = Math.max(maxY, ctx.y + h);
  }

  ctx.y = maxY + 6;
}

/**
 * Bloco de Auditoria e Integridade com QR Code vetorial e hash.
 *
 * Agnóstico a provedor (NÃO gera nem assume rotas como `/v/[id]`).
 */
export function renderAuditBlock(
  ctx: ReportRenderContext,
  audit: AuditData,
): void {
  ctx.checkPageBreak(25);
  const { doc } = ctx;
  const startY = ctx.y;
  const blockW = ctx.contentWidth;
  const blockH = 22;

  // Caixa de fundo
  doc.setFillColor(...REPORT_COLORS_RGB.surfaceSubtle);
  doc.setDrawColor(...REPORT_COLORS_RGB.borderSoft);
  doc.setLineWidth(0.3);
  doc.roundedRect(ctx.marginLeft, startY, blockW, blockH, 1.5, 1.5, 'FD');

  // Desenho do QR Code
  const qrSize = 16;
  const qrX = ctx.marginLeft + 3;
  const qrY = startY + (blockH - qrSize) / 2;

  // Fundo branco do QR
  doc.setFillColor(255, 255, 255);
  doc.rect(qrX - 0.5, qrY - 0.5, qrSize + 1, qrSize + 1, 'F');

  try {
    const matrix = generateQrMatrix(audit.verificationUrl);
    const modCount = matrix.length;
    const modSize = qrSize / modCount;

    doc.setFillColor(0, 0, 0);
    for (let r = 0; r < modCount; r++) {
      for (let c = 0; c < modCount; c++) {
        if (matrix[r][c]) {
          doc.rect(qrX + c * modSize, qrY + r * modSize, modSize, modSize, 'F');
        }
      }
    }
  } catch {
    // Fallback caso a URL seja excepcionalmente longa
    doc.setDrawColor(0, 0, 0);
    doc.rect(qrX, qrY, qrSize, qrSize, 'S');
    doc.setFontSize(6);
    doc.text('QR CODE', qrX + 2, qrY + 8);
  }

  // Textos de integridade
  const textX = qrX + qrSize + 4;
  let textY = startY + 4.5;

  doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...REPORT_COLORS_RGB.accent);
  doc.text('VERIFICAÇÃO DOCUMENTAL E INTEGRIDADE', textX, textY);
  textY += 3.5;

  doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...REPORT_COLORS_RGB.textSecondary);
  doc.text('Para verificar a autenticidade e integridade deste documento, acesse:', textX, textY);
  textY += 3;

  doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfMono, 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...REPORT_COLORS_RGB.accent);
  doc.text(audit.verificationUrl, textX, textY);
  textY += 3.5;

  doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...REPORT_COLORS_RGB.textMuted);
  const algoText = `${audit.algorithm}: `;
  doc.text(algoText, textX, textY);
  const algoW = doc.getTextWidth(algoText);

  doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfMono, 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(...REPORT_COLORS_RGB.textPrimary);
  doc.text(audit.hash, textX + algoW, textY);

  if (audit.documentId) {
    textY += 2.8;
    doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfMono, 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...REPORT_COLORS_RGB.textMuted);
    doc.text(`ID Canônico: ${audit.documentId}`, textX, textY);
  }

  ctx.y = startY + blockH + 5;
}

// ===========================================================================
// 7. RODAPÉ E PAGINAÇÃO
// ===========================================================================

/**
 * Renderiza o rodapé em todas as páginas do documento com paginação "Página X de Y".
 */
export function renderReportFooter(
  doc: jsPDF,
  options: {
    title: string;
    documentId?: string;
    disclaimer?: string;
    margins?: { left: number; right: number; bottom: number };
  },
): void {
  const pageCount = doc.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const left = options.margins?.left ?? 15;
  const right = options.margins?.right ?? 12;
  const footerY = pageH - 8;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Linha divisória
    doc.setDrawColor(...REPORT_COLORS_RGB.borderSoft);
    doc.setLineWidth(0.2);
    doc.line(left, footerY - 3, pageW - right, footerY - 3);

    // Título e documento
    doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...REPORT_COLORS_RGB.textSecondary);
    let leftText = `K9 Ops · ${options.title}`;
    if (options.documentId) {
      leftText += ` · ID: ${options.documentId}`;
    }
    doc.text(leftText, left, footerY);

    if (options.disclaimer) {
      doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...REPORT_COLORS_RGB.textMuted);
      doc.text(options.disclaimer, left, footerY + 3);
    }

    // Paginação
    doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfMono, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...REPORT_COLORS_RGB.textMuted);
    const pageStr = `Página ${i} de ${pageCount}`;
    const pageWStr = doc.getTextWidth(pageStr);
    doc.text(pageStr, pageW - right - pageWStr, footerY);
  }
}

/**
 * Cabeçalho Tático K9 Ops V2 (Dark Navy #0A1A24).
 * Adota a linguagem visual e hierarquia aprovada para a família de relatórios.
 */
export function renderDarkTacticalHeader(
  ctx: ReportRenderContext,
  options: {
    title: string;
    subtitle?: string;
    organization?: string;
    category?: string;
    motto?: string;
    metadata: ReportMetadata;
    branding?: ReportBranding;
    statusLabel?: string;
    statusTone?: ReportTone;
  },
): void {
  ctx.checkPageBreak(38);
  const { doc } = ctx;
  const startY = ctx.y;
  const headerW = ctx.contentWidth;
  const totalH = 34; // Altura compacta elegante em mm

  // Fundo Dark Navy
  doc.setFillColor(...REPORT_COLORS_RGB.darkNavy);
  doc.roundedRect(ctx.marginLeft, startY, headerW, totalH, 2, 2, 'F');

  const padX = 6;
  let currY = startY + 6;

  // 1. Linha Superior: Logo oficial K9 Ops + Nome da marca + Categoria (à esquerda) | Motto / Organização (à direita)
  const leftX = ctx.marginLeft + padX;
  let textStartX = leftX;

  // Se houver imagem do ProductMark (logo oficial):
  const brandSlot = options.branding?.productMarkImage;
  if (brandSlot?.dataUrl || brandSlot?.base64) {
    const imgData = brandSlot.dataUrl ?? `data:image/png;base64,${brandSlot.base64}`;
    const format = brandSlot.format ?? 'PNG';
    const logoMaxW = 14;
    const logoMaxH = 16;
    const { renderW, renderH } = calculateContainedDimensions(
      logoMaxW,
      logoMaxH,
      brandSlot,
      818 / 952,
    );
    doc.addImage(imgData, format, leftX, currY - 2.5, renderW, renderH);
    textStartX = leftX + renderW + 4;
  }

  // "K9 OPS®"
  doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...REPORT_COLORS_RGB.surface);
  doc.text('K9 OPS®', textStartX, currY + 2.5);
  const brandW = doc.getTextWidth('K9 OPS®');

  // "SISTEMA DE GESTÃO CANINA"
  doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...REPORT_COLORS_RGB.cyanAccent);
  doc.text('SISTEMA DE GESTÃO CANINA', textStartX, currY + 6);

  // Badge da categoria (ao lado da marca)
  if (options.category) {
    const catX = textStartX + brandW + 5;
    const catText = options.category.toUpperCase();
    doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'bold');
    doc.setFontSize(6.8);
    const catW = doc.getTextWidth(catText) + 6;
    doc.setFillColor(...REPORT_COLORS_RGB.darkNavySurface);
    doc.setDrawColor(...REPORT_COLORS_RGB.darkNavyBorder);
    doc.setLineWidth(0.2);
    doc.roundedRect(catX, currY - 1, catW, 4.5, 1, 1, 'FD');
    doc.setTextColor(...REPORT_COLORS_RGB.cyanAccent);
    doc.text(catText, catX + 3, currY + 2.2);
  }

  // Motto / Organização no topo à direita
  const mottoText = (
    options.organization ||
    options.motto ||
    'DISCIPLINA · PROTEÇÃO · RESULTADO'
  ).toUpperCase();
  doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...REPORT_COLORS_RGB.textMuted);
  const mottoW = doc.getTextWidth(mottoText);
  doc.text(mottoText, ctx.pageWidth - ctx.marginRight - padX - mottoW, currY + 2.5);

  currY += 9;

  // 2. Linha do Título Principal e Status Badge
  doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...REPORT_COLORS_RGB.surface);
  doc.text(options.title.toUpperCase(), leftX, currY + 2);

  if (options.subtitle) {
    doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...REPORT_COLORS_RGB.cyanAccent);
    doc.text(options.subtitle, leftX, currY + 6);
  }

  if (options.statusLabel && options.statusTone) {
    renderStatusBadge(
      ctx,
      ctx.pageWidth - ctx.marginRight - padX - 35,
      currY - 1,
      { label: options.statusLabel, tone: options.statusTone },
    );
  }

  currY += 8;

  // 3. Barra de Metadados em Dark Navy Surface
  const barY = currY;
  const barH = 5.5;
  const barW = headerW - padX * 2;
  doc.setFillColor(...REPORT_COLORS_RGB.darkNavySurface);
  doc.roundedRect(leftX, barY, barW, barH, 1, 1, 'F');

  let metaX = leftX + 4;
  function drawMeta(label: string, val: string, isMono = false) {
    doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(...REPORT_COLORS_RGB.textMuted);
    const lbl = label.toUpperCase() + ': ';
    doc.text(lbl, metaX, barY + 3.8);
    metaX += doc.getTextWidth(lbl);

    doc.setFont(
      isMono ? REPORT_TYPOGRAPHY.fontFamilies.pdfMono : REPORT_TYPOGRAPHY.fontFamilies.pdfSans,
      isMono ? 'normal' : 'bold',
    );
    doc.setFontSize(7.2);
    doc.setTextColor(...REPORT_COLORS_RGB.surface);
    doc.text(val, metaX, barY + 3.8);
    metaX += doc.getTextWidth(val) + 6;
  }

  drawMeta('EMISSÃO', formatDateTime(options.metadata.generatedAt), true);

  if (options.metadata.period) {
    drawMeta('PERÍODO', options.metadata.period);
  }

  if (options.metadata.documentId) {
    drawMeta('ID', options.metadata.documentId, true);
  }

  // Linha de acento decorativa inferior (ciano e escuro)
  const lineY = startY + totalH - 1.2;
  doc.setFillColor(...REPORT_COLORS_RGB.cyanAccent);
  doc.rect(ctx.marginLeft + 6, lineY, Math.min(60, headerW / 3), 1.2, 'F');
  doc.setFillColor(...REPORT_COLORS_RGB.accent);
  doc.rect(ctx.marginLeft + 6 + Math.min(60, headerW / 3), lineY, 30, 1.2, 'F');

  ctx.y = startY + totalH + 5;
}

/**
 * Cabeçalho Tático Compacto para páginas de continuação (2..N).
 */
export function renderDarkCompactContinuationHeader(
  ctx: ReportRenderContext,
  options: {
    title: string;
    documentId?: string;
    branding?: ReportBranding;
  },
): void {
  const { doc } = ctx;
  const h = 6;
  const startY = ctx.y;
  const left = ctx.marginLeft;
  const w = ctx.contentWidth;

  doc.setFillColor(...REPORT_COLORS_RGB.darkNavy);
  doc.roundedRect(left, startY, w, h, 1, 1, 'F');

  let textX = left + 3;
  const brandSlot = options.branding?.productMarkImage;
  if (brandSlot?.dataUrl || brandSlot?.base64) {
    const imgData = brandSlot.dataUrl ?? `data:image/png;base64,${brandSlot.base64}`;
    const format = brandSlot.format ?? 'PNG';
    doc.addImage(imgData, format, textX, startY + 0.8, 4, 4.4);
    textX += 6;
  }

  doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...REPORT_COLORS_RGB.cyanAccent);
  doc.text('K9 OPS® · ', textX, startY + 4.2);
  textX += doc.getTextWidth('K9 OPS® · ');

  doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'bold');
  doc.setTextColor(...REPORT_COLORS_RGB.surface);
  doc.text(options.title.toUpperCase(), textX, startY + 4.2);

  if (options.documentId) {
    doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfMono, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...REPORT_COLORS_RGB.textMuted);
    const idText = `ID: ${options.documentId}`;
    const idW = doc.getTextWidth(idText);
    doc.text(idText, ctx.pageWidth - ctx.marginRight - idW - 3, startY + 4.2);
  }

  ctx.y = startY + h + 4;
}

/**
 * Rodapé Tático K9 Ops V2 (Dark Navy #0A1A24).
 */
export function renderDarkReportFooter(
  doc: jsPDF,
  options: {
    title: string;
    documentId?: string;
    margins?: { left: number; right: number; bottom: number };
  },
): void {
  const pageCount = doc.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const left = options.margins?.left ?? 12;
  const right = options.margins?.right ?? 12;
  const barH = 5.5;
  const barY = pageH - barH - 3;
  const barW = pageW - left - right;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Barra Dark Navy
    doc.setFillColor(...REPORT_COLORS_RGB.darkNavy);
    doc.roundedRect(left, barY, barW, barH, 1, 1, 'F');

    // Texto K9 OPS à esquerda
    doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...REPORT_COLORS_RGB.cyanAccent);
    doc.text('K9 OPS®', left + 3, barY + 3.8);
    const k9w = doc.getTextWidth('K9 OPS®');

    doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'normal');
    doc.setTextColor(...REPORT_COLORS_RGB.surfaceSubtle);
    let titleStr = ` · ${options.title}`;
    if (options.documentId) {
      titleStr += ` · ID: ${options.documentId}`;
    }
    doc.text(titleStr, left + 3 + k9w, barY + 3.8);

    // Paginação à direita
    doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfMono, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...REPORT_COLORS_RGB.surfaceSubtle);
    const pageStr = `Página ${i} de ${pageCount}`;
    const pageWStr = doc.getTextWidth(pageStr);
    doc.text(pageStr, left + barW - pageWStr - 3, barY + 3.8);
  }
}

/**
 * Título de Seção Estilizado com badge de código tático e acento ciano.
 * O subtítulo é posicionado abaixo do título para eliminar qualquer risco de colisão horizontal.
 */
export function renderStyledSectionTitle(
  ctx: ReportRenderContext,
  title: string,
  options: {
    codeText?: string;
    subtitle?: string;
  } = {},
): void {
  const hasSubtitle = Boolean(options.subtitle);
  ctx.checkPageBreak(hasSubtitle ? 18 : 14);
  const { doc } = ctx;
  const startY = ctx.y;

  let titleX = ctx.marginLeft;

  if (options.codeText) {
    const codeW = doc.getTextWidth(options.codeText) + 6;
    doc.setFillColor(...REPORT_COLORS_RGB.darkNavy);
    doc.roundedRect(ctx.marginLeft, startY - 0.5, codeW, 5, 1, 1, 'F');
    doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...REPORT_COLORS_RGB.cyanAccent);
    doc.text(options.codeText, ctx.marginLeft + 3, startY + 3.2);
    titleX = ctx.marginLeft + codeW + 4;
  } else {
    doc.setFillColor(...REPORT_COLORS_RGB.accent);
    doc.roundedRect(ctx.marginLeft, startY - 0.5, 2, 5, 0.5, 0.5, 'F');
    titleX = ctx.marginLeft + 5;
  }

  // Título da seção em negrito
  doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...REPORT_COLORS_RGB.textPrimary);
  doc.text(title.toUpperCase(), titleX, startY + 3.5);

  let lineY = startY + 6.5;

  // Subtítulo posicionado abaixo do título (evita colisão ou truncamento)
  if (options.subtitle) {
    doc.setFont(REPORT_TYPOGRAPHY.fontFamilies.pdfSans, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...REPORT_COLORS_RGB.textMuted);
    const maxSubW = ctx.pageWidth - ctx.marginRight - titleX;
    const splitSub = doc.splitTextToSize(options.subtitle, maxSubW);
    doc.text(splitSub, titleX, startY + 7.5);
    lineY = startY + 7.5 + (splitSub.length - 1) * 3.2 + 2.5;
  }

  // Linha separadora horizontal
  doc.setDrawColor(...REPORT_COLORS_RGB.borderSoft);
  doc.setLineWidth(0.2);
  doc.line(ctx.marginLeft, lineY, ctx.pageWidth - ctx.marginRight, lineY);

  ctx.y = lineY + 3.5;
}

/**
 * Renderiza uma linha de MetricCards distribuídos uniformemente ao longo da largura útil.
 */
export function renderMetricCardRow(
  ctx: ReportRenderContext,
  cards: MetricCardData[],
  gapMm = 3,
): void {
  ctx.checkPageBreak(25);
  const totalW = ctx.contentWidth;
  const count = cards.length;
  if (count === 0) return;

  const cardW = (totalW - (count - 1) * gapMm) / count;
  let currX = ctx.marginLeft;
  let maxH = 0;

  for (const card of cards) {
    const h = renderMetricCard(ctx, currX, ctx.y, cardW, card);
    maxH = Math.max(maxH, h);
    currX += cardW + gapMm;
  }

  ctx.y += maxH + 4;
}
