import type { ReportImageSlot } from './report-types';

let cachedLogo: ReportImageSlot | null = null;

export const OFFICIAL_LOGO_PATH = 'public/brand/logo-app.png';

/**
 * Carrega o slot oficial do K9 Ops ProductMark existente no repositório.
 * Preserva estritamente proporção (818 x 952) e formato PNG oficial.
 */
export async function loadOfficialLogo(): Promise<ReportImageSlot | null> {
  if (cachedLogo) return cachedLogo;

  const isNode = typeof process !== 'undefined' && Boolean(process.versions?.node);

  if (isNode) {
    try {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const candidates = [
        path.resolve(process.cwd(), 'public/brand/logo-app.png'),
        path.resolve('C:/Projetos/k9-ops/public/brand/logo-app.png'),
      ];

      for (const p of candidates) {
        try {
          const buf = await fs.readFile(p);
          cachedLogo = {
            base64: buf.toString('base64'),
            format: 'PNG',
            width: 818,
            height: 952,
            aspectRatio: 818 / 952,
          };
          return cachedLogo;
        } catch {
          // continue
        }
      }
    } catch {
      // ignore
    }
  }

  if (typeof window !== 'undefined' && typeof fetch === 'function') {
    // Browser environment
    try {
      const resp = await fetch('/brand/logo-app.png');
      if (resp.ok) {
        const blob = await resp.blob();
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const res = reader.result as string;
            const b64 = res.split(',')[1] ?? res;
            resolve(b64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        cachedLogo = {
          base64,
          format: 'PNG',
          width: 818,
          height: 952,
          aspectRatio: 818 / 952,
        };
        return cachedLogo;
      }
    } catch {
      // ignore
    }
  }

  return cachedLogo;
}

export function setCachedOfficialLogo(slot: ReportImageSlot | null): void {
  cachedLogo = slot;
}

export function getCachedOfficialLogo(): ReportImageSlot | null {
  return cachedLogo;
}
