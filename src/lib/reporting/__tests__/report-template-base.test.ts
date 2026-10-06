import { describe, expect, it, vi } from 'vitest';
import { jsPDF } from 'jspdf';

import {
  calculateContainedDimensions,
  fitDimensionsContain,
  generateQrMatrix,
  renderEvidenceBlock,
  renderInstitutionalIssuerMark,
  renderProductMark,
  REPORT_COLORS,
  REPORT_PAGE_METRICS,
  REPORT_SPACING,
  REPORT_TONE_COLORS,
  ReportRenderContext,
  ReportTemplateBuilder,
  resolveBrandingScenario,
  resolveImageAspectRatio,
  type ReportTone,
} from '../index';

describe('F70 Design System V1 — Web Tokens', () => {
  it('Cores canônicas estão estritamente congeladas', () => {
    expect(REPORT_COLORS.surface).toBe('#FFFFFF');
    expect(REPORT_COLORS.surfaceSubtle).toBe('#F8FAFC');
    expect(REPORT_COLORS.textPrimary).toBe('#0F172A');
    expect(REPORT_COLORS.textSecondary).toBe('#334155');
    expect(REPORT_COLORS.textMuted).toBe('#64748B');
    expect(REPORT_COLORS.borderSoft).toBe('#E2E8F0');
    expect(REPORT_COLORS.borderStrong).toBe('#94A3B8');
    expect(REPORT_COLORS.accent).toBe('#0A8E9D');
  });

  it('6 tons genéricos de status são expressos sem acoplamento de domínio', () => {
    const tones: ReportTone[] = [
      'positive',
      'attention',
      'critical',
      'neutral',
      'info',
      'unknown',
    ];

    expect(Object.keys(REPORT_TONE_COLORS)).toHaveLength(6);
    for (const tone of tones) {
      const colors = REPORT_TONE_COLORS[tone];
      expect(colors.background).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(colors.border).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(colors.text).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(colors.accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('Escala de espaçamento é em pontos (pt)', () => {
    expect(REPORT_SPACING.xxs).toBe(2);
    expect(REPORT_SPACING.xs).toBe(4);
    expect(REPORT_SPACING.sm).toBe(8);
    expect(REPORT_SPACING.md).toBe(12);
    expect(REPORT_SPACING.lg).toBe(16);
    expect(REPORT_SPACING.xl).toBe(24);
    expect(REPORT_SPACING.xxl).toBe(32);
  });

  it('Métricas de página A4 e limites de slots respeitam requisitos de impressão', () => {
    expect(REPORT_PAGE_METRICS.portrait.widthMm).toBe(210);
    expect(REPORT_PAGE_METRICS.portrait.heightMm).toBe(297);
    expect(REPORT_PAGE_METRICS.portrait.marginsMm.left).toBe(15);
    expect(REPORT_PAGE_METRICS.portrait.marginsMm.top).toBe(12);
    expect(REPORT_PAGE_METRICS.portrait.marginsMm.right).toBe(12);
    expect(REPORT_PAGE_METRICS.portrait.marginsMm.bottom).toBe(12);

    expect(REPORT_PAGE_METRICS.landscape.widthMm).toBe(297);
    expect(REPORT_PAGE_METRICS.landscape.heightMm).toBe(210);
    expect(REPORT_PAGE_METRICS.landscape.marginsMm.left).toBe(12);

    expect(REPORT_PAGE_METRICS.brandingSlots.productMark.maxWidthMm).toBe(28);
    expect(REPORT_PAGE_METRICS.brandingSlots.productMark.maxHeightMm).toBe(12);
    expect(REPORT_PAGE_METRICS.brandingSlots.productMark.safeAreaMm).toBe(2);

    expect(REPORT_PAGE_METRICS.brandingSlots.institutionalIssuerMark.maxWidthMm).toBe(18);
    expect(REPORT_PAGE_METRICS.brandingSlots.institutionalIssuerMark.maxHeightMm).toBe(18);
    expect(REPORT_PAGE_METRICS.brandingSlots.institutionalIssuerMark.safeAreaMm).toBe(2);
  });
});

describe('F70 Design System V1 — Branding Slots & Scenarios', () => {
  it('Resolução correta dos 4 cenários de branding', () => {
    const dummyImage = { base64: 'abc' };

    // 1. Both
    expect(
      resolveBrandingScenario({
        productMarkImage: dummyImage,
        institutionalIssuerMarkImage: dummyImage,
        showProductMark: true,
        showInstitutionalIssuerMark: true,
      }),
    ).toBe('both');

    // 2. ProductMark only
    expect(
      resolveBrandingScenario({
        productMarkImage: dummyImage,
        institutionalIssuerMarkImage: null,
        showProductMark: true,
        showInstitutionalIssuerMark: false,
      }),
    ).toBe('productMarkOnly');

    // 3. InstitutionalIssuerMark only
    expect(
      resolveBrandingScenario({
        productMarkImage: null,
        institutionalIssuerMarkImage: dummyImage,
        showProductMark: false,
        showInstitutionalIssuerMark: true,
      }),
    ).toBe('institutionalIssuerMarkOnly');

    // 4. Neither
    expect(
      resolveBrandingScenario({
        productMarkImage: null,
        institutionalIssuerMarkImage: null,
        showProductMark: false,
        showInstitutionalIssuerMark: false,
      }),
    ).toBe('neither');
  });
});

describe('F70 Design System V1 — QR Matrix Generator', () => {
  it('Gera matriz booleana válida para URLs de verificação', () => {
    const url = 'https://k9ops.com/verificar?doc=RO-K9-2026-0042';
    const matrix = generateQrMatrix(url);

    expect(matrix).toBeInstanceOf(Array);
    expect(matrix.length).toBeGreaterThanOrEqual(21);
    expect(matrix[0].length).toBe(matrix.length);

    // Módulos centrais dos finders devem ser escuros
    expect(matrix[3][3]).toBe(true);
  });
});

describe('F70 Design System V1 — End-to-End PDF Builder Web', () => {
  it('Gera documento PDF válido com todas as primitivas acopladas', () => {
    const now = new Date('2026-10-06T14:30:00Z');

    const builder = new ReportTemplateBuilder({
      title: 'Registro Operacional de Emprego K9',
      category: 'Operacional',
      subtitle: 'Apoio tático em busca de entorpecentes',
      disclaimer: 'Documento oficial gerado eletronicamente.',
      metadata: {
        generatedAt: now,
        documentId: 'RO-K9-2026-0042',
        operatorName: 'GCM 1CL Silva',
        callsign: 'RO-02',
        dogIdentity: 'Kira (Pastor Alemão)',
      },
    });

    // 1. EntityIdentityBlock
    builder.addEntityIdentity({
      title: 'Kira — Pastor Alemão',
      subtitle: 'K9 Titular de Patrulhamento',
      statusLabel: 'Operacional',
      statusTone: 'positive',
      fields: [
        { label: 'Microchip', value: '981098102938475', isMonospace: true },
        { label: 'Condutor', value: 'GCM Silva - Matr. 1234' },
        { label: 'Nascimento', value: '14/03/2021', isMonospace: true },
      ],
    });

    // 2. SummaryCard
    builder.addSummary({
      title: 'Resumo da Operação',
      description: 'Emprego com indicação positiva e localização de substâncias ilícitas.',
      bulletItems: [
        'Área de busca: Terreno baldio perimetral',
        'Comportamento do K9: Foco imediato e indicação passiva (sentar)',
      ],
      tone: 'positive',
    });

    // 3. InformationSection & Timeline
    builder.addInformationSection('Cronologia dos Fatos', () => {
      builder.addTimeline([
        {
          timeLabel: '09:15',
          title: 'Chegada ao local',
          description: 'Isolamento da área pela guarnição de apoio.',
          tone: 'info',
        },
        {
          timeLabel: '09:34',
          title: 'Alerta e indicação positiva',
          description: 'K9 adota postura passiva junto ao muro dos fundos.',
          tone: 'positive',
        },
      ]);
    });

    // 4. DataTable
    builder.addDataTable({
      columns: [
        { header: 'Item', key: 'item', alignment: 'left' },
        { header: 'Tipo', key: 'type', alignment: 'left' },
        { header: 'Hora', key: 'time', alignment: 'center', isMonospace: true },
        { header: 'Peso (g)', key: 'weight', alignment: 'right', isMonospace: true },
      ],
      rows: [
        { item: 'Invólucro 01', type: 'Maconha', time: '09:34', weight: '142.5' },
        { item: 'Invólucro 02', type: 'Cocaína', time: '09:36', weight: '48.0' },
      ],
    });

    // 5. EvidenceBlock
    // Imagem 1x1 base64 PNG
    const dummyPng =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    builder.addEvidence({
      image: { base64: dummyPng, format: 'PNG' },
      caption: 'Registro fotográfico da indicação passiva do K9.',
      timestamp: '06/10/2026 09:35',
      metadata: 'Câmera Corporal VTR-02',
    });

    // 6. Observations
    builder.addObservations({
      text: 'O K9 apresentou excelente vigor físico e foco durante todo o trabalho.',
    });

    // 7. Signatures
    builder.addSignatures([
      { name: 'GCM Silva', role: 'Condutor K9', identifier: 'Matr. 1234' },
      { name: 'Inspetor Santos', role: 'Encarregado de Equipe', identifier: 'Matr. 5678' },
    ]);

    // 8. AuditBlock
    builder.addAudit({
      verificationUrl: 'https://k9ops.com/verificar?doc=RO-K9-2026-0042',
      hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      algorithm: 'SHA-256',
      documentId: 'RO-K9-2026-0042',
    });

    const buffer = builder.getBuffer();
    expect(buffer).toBeInstanceOf(Uint8Array);
    expect(buffer.length).toBeGreaterThan(1000);

    // Validação de cabeçalho PDF (%PDF)
    const headerStr = String.fromCharCode(...buffer.slice(0, 4));
    expect(headerStr).toBe('%PDF');
  });

  it('Gera PDF para arquétipo Tabular em orientação Paisagem (landscape)', () => {
    const builder = ReportTemplateBuilder.forArchetype('tabular', {
      title: 'Inventário Geral de Efetivo K9',
      metadata: { generatedAt: new Date('2026-10-06') },
    });

    builder.addDataTable({
      columns: [
        { header: 'Nome K9', key: 'name', alignment: 'left' },
        { header: 'Raça', key: 'breed', alignment: 'left' },
        { header: 'Condutor', key: 'handler', alignment: 'left' },
      ],
      rows: [
        { name: 'Kira', breed: 'Pastor Alemão', handler: 'GCM Silva' },
        { name: 'Thor', breed: 'Pastor Belga Malinois', handler: 'GCM Souza' },
      ],
    });

    const buffer = builder.getBuffer();
    const headerStr = String.fromCharCode(...buffer.slice(0, 4));
    expect(headerStr).toBe('%PDF');
  });

  it('Gera PDF para arquétipo Institucional com cabeçalho formal', () => {
    const builder = ReportTemplateBuilder.forArchetype('institutional', {
      title: 'Laudo Pericial de Aptidão Operacional',
      organization: 'Prefeitura Municipal de Limeira · Secretaria de Segurança Pública',
      metadata: {
        generatedAt: new Date('2026-10-06'),
        documentId: 'LAUDO-2026-88',
      },
    });

    builder.addObservations({
      title: 'Conclusão Técnica',
      text: 'O semovente atende plenamente aos critérios de aptidão operacional.',
    });

    builder.addSignatures([
      { name: 'Dra. Fernandes', role: 'Médica Veterinária', identifier: 'CRMV-SP 43210' },
    ]);

    const buffer = builder.getBuffer();
    const headerStr = String.fromCharCode(...buffer.slice(0, 4));
    expect(headerStr).toBe('%PDF');
  });
});

describe('F70 Design System V1 — Aspect Ratio & Contain (FINDING-01)', () => {
  it('Deriva aspect ratio a partir de width e height quando aspectRatio é omitido', () => {
    const derived = resolveImageAspectRatio({ width: 1600, height: 1200 });
    expect(derived).toBeCloseTo(4 / 3, 5);

    const wide = resolveImageAspectRatio({ width: 1920, height: 1080 });
    expect(wide).toBeCloseTo(16 / 9, 5);

    const portrait = resolveImageAspectRatio({ width: 600, height: 1200 });
    expect(portrait).toBe(0.5);
  });

  it('Usa aspectRatio explícito com precedência sobre width e height', () => {
    const ar = resolveImageAspectRatio({
      aspectRatio: 2.5,
      width: 100,
      height: 100,
    });
    expect(ar).toBe(2.5);
  });

  it('Aplica fallback neutro seguro quando nem aspectRatio nem dimensões são fornecidos', () => {
    const fallbackDefault = resolveImageAspectRatio(null, 1.0);
    expect(fallbackDefault).toBe(1.0);

    const fallback43 = resolveImageAspectRatio({}, 4 / 3);
    expect(fallback43).toBeCloseTo(4 / 3, 5);
  });

  it('Aplica fórmula canônica de contain para aspect ratio panorâmico extremo (4:1) sem esticar', () => {
    const maxW = 90;
    const maxH = 55;
    const dims = fitDimensionsContain(maxW, maxH, 4.0);

    // maxW / ar = 90 / 4 = 22.5 <= 55 -> renderW = 90, renderH = 22.5
    expect(dims.renderW).toBe(90);
    expect(dims.renderH).toBe(22.5);
    expect(dims.renderW / dims.renderH).toBe(4.0);
    expect(dims.renderW).toBeLessThanOrEqual(maxW);
    expect(dims.renderH).toBeLessThanOrEqual(maxH);
  });

  it('Aplica fórmula canônica de contain para aspect ratio vertical extremo (1:4) sem esticar', () => {
    const maxW = 90;
    const maxH = 55;
    const dims = fitDimensionsContain(maxW, maxH, 0.25);

    // maxW / ar = 90 / 0.25 = 360 > 55 -> renderH = 55, renderW = 55 * 0.25 = 13.75
    expect(dims.renderH).toBe(55);
    expect(dims.renderW).toBe(13.75);
    expect(dims.renderW / dims.renderH).toBe(0.25);
    expect(dims.renderW).toBeLessThanOrEqual(maxW);
    expect(dims.renderH).toBeLessThanOrEqual(maxH);
  });

  it('calculateContainedDimensions integra derivação de dimensões e contain sem distorção', () => {
    // Imagem sem aspectRatio, com width e height fornecidos (16:9)
    const dims = calculateContainedDimensions(90, 55, {
      width: 1920,
      height: 1080,
    });
    expect(dims.renderW).toBe(90);
    expect(dims.renderH).toBeCloseTo(50.625, 3);
    expect(dims.renderW / dims.renderH).toBeCloseTo(16 / 9, 3);
  });
});

describe('F70 Design System V1 — Cross-Runtime Parity & Empty Image Handling (FINDING-02)', () => {
  const dummyPng =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  it('Omite renderEvidenceBlock graciosamente se item.image não tiver dataUrl nem base64', () => {
    const doc = new jsPDF();
    const ctx = new ReportRenderContext(doc);
    const initialY = ctx.y;

    const addImageSpy = vi.spyOn(doc, 'addImage');
    const rectSpy = vi.spyOn(doc, 'roundedRect');

    // Sem payload de imagem (apenas dimensões sem bytes)
    renderEvidenceBlock(ctx, {
      image: { width: 800, height: 600 },
      caption: 'Evidência sem payload',
    });

    expect(addImageSpy).not.toHaveBeenCalled();
    expect(rectSpy).not.toHaveBeenCalled();
    expect(ctx.y).toBe(initialY);
  });

  it('Renderiza renderEvidenceBlock normalmente quando base64 está presente', () => {
    const doc = new jsPDF();
    const ctx = new ReportRenderContext(doc);
    const initialY = ctx.y;

    const addImageSpy = vi.spyOn(doc, 'addImage');
    const rectSpy = vi.spyOn(doc, 'roundedRect');

    renderEvidenceBlock(ctx, {
      image: { base64: dummyPng, width: 800, height: 600 },
      caption: 'Evidência válida com dimensões derivadas',
    });

    expect(addImageSpy).toHaveBeenCalledTimes(1);
    expect(rectSpy).toHaveBeenCalledTimes(1);
    expect(ctx.y).toBeGreaterThan(initialY);
  });
});

describe('F70 Design System V1 — Safe Area & Fallback Textual Alignment (FINDING-03)', () => {
  const dummyPng =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  it('renderProductMark desconta safeAreaMm da área útil e aplica offset de posição', () => {
    const doc = new jsPDF();
    const ctx = new ReportRenderContext(doc);
    const addImageSpy = vi.spyOn(doc, 'addImage');

    const maxW = REPORT_PAGE_METRICS.brandingSlots.productMark.maxWidthMm; // 28
    const maxH = REPORT_PAGE_METRICS.brandingSlots.productMark.maxHeightMm; // 12
    const safeArea = REPORT_PAGE_METRICS.brandingSlots.productMark.safeAreaMm; // 2
    const usableW = maxW - safeArea * 2; // 24
    const usableH = maxH - safeArea * 2; // 8

    const posX = 15;
    const posY = 12;

    renderProductMark(ctx, posX, posY, {
      productMarkImage: {
        base64: dummyPng,
        aspectRatio: 3.0,
      },
    });

    expect(addImageSpy).toHaveBeenCalledTimes(1);
    const callArgs = (addImageSpy.mock.calls as unknown as Array<[string, string, number, number, number, number]>)[0];
    const [, , x, y, w, h] = callArgs;

    expect(x).toBe(posX + safeArea);
    expect(y).toBe(posY + safeArea);
    expect(w).toBeLessThanOrEqual(usableW);
    expect(h).toBeLessThanOrEqual(usableH);
  });

  it('renderInstitutionalIssuerMark desconta safeAreaMm e aplica offset de posição', () => {
    const doc = new jsPDF();
    const ctx = new ReportRenderContext(doc);
    const addImageSpy = vi.spyOn(doc, 'addImage');

    const maxW = REPORT_PAGE_METRICS.brandingSlots.institutionalIssuerMark.maxWidthMm; // 18
    const maxH = REPORT_PAGE_METRICS.brandingSlots.institutionalIssuerMark.maxHeightMm; // 18
    const safeArea = REPORT_PAGE_METRICS.brandingSlots.institutionalIssuerMark.safeAreaMm; // 2
    const usableW = maxW - safeArea * 2; // 14
    const usableH = maxH - safeArea * 2; // 14

    const posX = 100;
    const posY = 12;

    renderInstitutionalIssuerMark(ctx, posX, posY, {
      institutionalIssuerMarkImage: {
        base64: dummyPng,
        aspectRatio: 1.0,
      },
    });

    expect(addImageSpy).toHaveBeenCalledTimes(1);
    const callArgs = (addImageSpy.mock.calls as unknown as Array<[string, string, number, number, number, number]>)[0];
    const [, , x, y, w, h] = callArgs;

    expect(x).toBe(posX + safeArea);
    expect(y).toBe(posY + safeArea);
    expect(w).toBeLessThanOrEqual(usableW);
    expect(h).toBeLessThanOrEqual(usableH);
  });

  it('renderProductMark alinha texto no centro vertical com compensação de baseline e safe area horizontal', () => {
    const doc = new jsPDF();
    const ctx = new ReportRenderContext(doc);
    const textSpy = vi.spyOn(doc, 'text');

    const maxH = REPORT_PAGE_METRICS.brandingSlots.productMark.maxHeightMm; // 12
    const safeArea = REPORT_PAGE_METRICS.brandingSlots.productMark.safeAreaMm; // 2
    const posX = 15;
    const posY = 12;
    const expectedX = posX + safeArea; // 15 + 2 = 17
    const expectedY = posY + maxH / 2 + 2; // 12 + 6 + 2 = 20

    renderProductMark(ctx, posX, posY, {
      textualFallback: 'K9 Ops Test',
    });

    expect(textSpy).toHaveBeenCalledWith('K9 Ops Test', expectedX, expectedY);
  });
});

describe('F70 Design System V1 — Non-finite & Invalid Aspect Ratio Robustness (FINDING-04)', () => {
  const invalidAspectRatios = [Infinity, -Infinity, 0, -1];

  it('resolveImageAspectRatio adota fallback 1.0 para valores não finitos ou <= 0', () => {
    for (const invalidAr of invalidAspectRatios) {
      expect(resolveImageAspectRatio({ aspectRatio: invalidAr })).toBe(1.0);
    }
  });

  it('resolveImageAspectRatio adota fallback limpo se width/height forem não finitos ou <= 0', () => {
    expect(resolveImageAspectRatio({ width: Infinity, height: 100 })).toBe(1.0);
    expect(resolveImageAspectRatio({ width: 100, height: -Infinity })).toBe(1.0);
    expect(resolveImageAspectRatio({ width: 0, height: 100 })).toBe(1.0);
    expect(resolveImageAspectRatio({ width: 100, height: 0 })).toBe(1.0);
    expect(resolveImageAspectRatio({ width: -100, height: 100 })).toBe(1.0);
    expect(resolveImageAspectRatio({ width: 100, height: -100 })).toBe(1.0);
  });

  it('fitDimensionsContain mantém dimensões rigorosamente contidas para Infinity, -Infinity, 0 e -1', () => {
    const maxW = 90;
    const maxH = 55;

    for (const invalidAr of invalidAspectRatios) {
      const dims = fitDimensionsContain(maxW, maxH, invalidAr);

      // Com fallback 1.0: maxW / 1.0 = 90 > 55 -> renderH = 55, renderW = 55
      expect(dims.renderW).toBeLessThanOrEqual(maxW);
      expect(dims.renderH).toBeLessThanOrEqual(maxH);
      expect(dims.renderW).toBe(55);
      expect(dims.renderH).toBe(55);
    }
  });

  it('fitDimensionsContain mantém layout contido em orientação vertical (maxW < maxH)', () => {
    const maxW = 40;
    const maxH = 80;

    for (const invalidAr of invalidAspectRatios) {
      const dims = fitDimensionsContain(maxW, maxH, invalidAr);

      // Com fallback 1.0: maxW / 1.0 = 40 <= 80 -> renderW = 40, renderH = 40
      expect(dims.renderW).toBeLessThanOrEqual(maxW);
      expect(dims.renderH).toBeLessThanOrEqual(maxH);
      expect(dims.renderW).toBe(40);
      expect(dims.renderH).toBe(40);
    }
  });

  it('calculateContainedDimensions mantém containment estrito para imagens com aspect ratio inválido', () => {
    const maxW = 70;
    const maxH = 50;

    for (const invalidAr of invalidAspectRatios) {
      const dims = calculateContainedDimensions(maxW, maxH, {
        aspectRatio: invalidAr,
      });

      expect(dims.renderW).toBeLessThanOrEqual(maxW);
      expect(dims.renderH).toBeLessThanOrEqual(maxH);
      expect(Number.isFinite(dims.renderW)).toBe(true);
      expect(Number.isFinite(dims.renderH)).toBe(true);
      expect(dims.renderW).toBeGreaterThan(0);
      expect(dims.renderH).toBeGreaterThan(0);
    }
  });
});
