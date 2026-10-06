/**
 * Tokens visuais canônicos do K9 Ops Report Design System V1.
 *
 * Imutáveis, compartilhados e independentes de domínio específico.
 */

export const REPORT_COLORS = {
  surface: '#FFFFFF',
  surfaceSubtle: '#F8FAFC',
  textPrimary: '#0F172A',
  textSecondary: '#334155',
  textMuted: '#64748B',
  borderSoft: '#E2E8F0',
  borderStrong: '#94A3B8',
  accent: '#0A8E9D',
} as const;

export type ReportColorKey = keyof typeof REPORT_COLORS;

/**
 * Converte cor hex (#RRGGBB) para tupla RGB [r, g, b].
 */
export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/**
 * Cores em formato RGB para APIs diretas do jsPDF (setTextColor, setFillColor, setDrawColor).
 */
export const REPORT_COLORS_RGB: Record<ReportColorKey, [number, number, number]> = {
  surface: hexToRgb(REPORT_COLORS.surface),
  surfaceSubtle: hexToRgb(REPORT_COLORS.surfaceSubtle),
  textPrimary: hexToRgb(REPORT_COLORS.textPrimary),
  textSecondary: hexToRgb(REPORT_COLORS.textSecondary),
  textMuted: hexToRgb(REPORT_COLORS.textMuted),
  borderSoft: hexToRgb(REPORT_COLORS.borderSoft),
  borderStrong: hexToRgb(REPORT_COLORS.borderStrong),
  accent: hexToRgb(REPORT_COLORS.accent),
};

/**
 * 6 tons genéricos de status do Design System V1.
 *
 * REQUISITO ESTRITO: As primitivas NUNCA devem conhecer enums de domínio
 * (ex: OPERACIONAL, INAPTO, etc.). Apenas estes 6 tons genéricos.
 */
export type ReportTone =
  | 'positive'
  | 'attention'
  | 'critical'
  | 'neutral'
  | 'info'
  | 'unknown';

export interface ReportToneColors {
  background: string;
  border: string;
  text: string;
  accent: string;
}

export const REPORT_TONE_COLORS: Record<ReportTone, ReportToneColors> = {
  positive: {
    background: '#F0FDF4',
    border: '#BBF7D0',
    text: '#166534',
    accent: '#22C55E',
  },
  attention: {
    background: '#FFFBEB',
    border: '#FDE68A',
    text: '#92400E',
    accent: '#F59E0B',
  },
  critical: {
    background: '#FEF2F2',
    border: '#FECACA',
    text: '#991B1B',
    accent: '#EF4444',
  },
  neutral: {
    background: '#F1F5F9',
    border: '#CBD5E1',
    text: '#475569',
    accent: '#64748B',
  },
  info: {
    background: '#F0F9FF',
    border: '#BAE6FD',
    text: '#075985',
    accent: '#0284C7',
  },
  unknown: {
    background: '#F8FAFC',
    border: '#E2E8F0',
    text: '#64748B',
    accent: '#94A3B8',
  },
};

/**
 * Escala tipográfica em pontos (pt) com fallback robusto sem dependência
 * de rede runtime (Google Fonts).
 */
export const REPORT_TYPOGRAPHY = {
  fontFamilies: {
    sans: "IBM Plex Sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    mono: "IBM Plex Mono, SFMono-Regular, Menlo, Monaco, Consolas, 'Courier New', monospace",
    pdfSans: 'helvetica',
    pdfMono: 'courier',
  },
  fontSizes: {
    caption: 7.5,
    label: 8,
    body: 9.5,
    bodyBold: 9.5,
    subheading: 11,
    sectionTitle: 13,
    title: 16,
    largeTitle: 20,
    kpiValue: 22,
  },
  lineHeights: {
    tight: 1.15,
    normal: 1.35,
    relaxed: 1.5,
  },
} as const;

/**
 * Escala de espaçamento em pontos (pt).
 */
export const REPORT_SPACING = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/**
 * Métricas de página e slots segundo as diretrizes de impressão A4.
 */
export const REPORT_PAGE_METRICS = {
  portrait: {
    widthMm: 210,
    heightMm: 297,
    marginsMm: {
      left: 15,
      top: 12,
      right: 12,
      bottom: 12,
    },
  },
  landscape: {
    widthMm: 297,
    heightMm: 210,
    marginsMm: {
      left: 12,
      top: 12,
      right: 12,
      bottom: 12,
    },
  },
  brandingSlots: {
    productMark: {
      maxWidthMm: 28,
      maxHeightMm: 12,
      safeAreaMm: 2,
    },
    institutionalIssuerMark: {
      maxWidthMm: 18,
      maxHeightMm: 18,
      safeAreaMm: 2,
    },
  },
} as const;
