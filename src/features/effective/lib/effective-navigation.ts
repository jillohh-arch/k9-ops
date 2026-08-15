import type { AccessModuleId } from "@/lib/permissions/access-control";
import { paths } from "@/lib/routes/paths";

export type EffectiveChild = {
  href: string;
  label: string;
  moduleId: AccessModuleId;
};

/**
 * Núcleos do Efetivo, na ordem canônica da sidebar.
 *
 * `Efetivo K9` vem primeiro deliberadamente: é o destino preferencial do
 * redirecionamento de `/effective` (seção 6 do prompt de implementação).
 */
export const effectiveChildren: readonly EffectiveChild[] = [
  { href: paths.k9, label: "Efetivo K9", moduleId: "k9" },
  { href: paths.humans, label: "Efetivo Humano", moduleId: "humans" },
  { href: paths.binomials, label: "Binômios", moduleId: "binomials" },
  { href: paths.vehicles, label: "Viaturas", moduleId: "vehicles" },
] as const;

export const effectiveModuleIds = effectiveChildren.map(
  (child) => child.moduleId,
);

/** Prefixos que fazem o grupo `Efetivo` contar como ativo. */
export const effectiveActivePrefixes = [
  paths.effective,
  ...effectiveChildren.map((child) => child.href),
];

export function allowedEffectiveChildren(
  canView: (moduleId: AccessModuleId) => boolean,
): EffectiveChild[] {
  return effectiveChildren.filter((child) => canView(child.moduleId));
}

/**
 * Destino de `/effective`. Como `k9` é o primeiro da lista canônica, ele é
 * escolhido sempre que `k9/view` estiver liberado; caso contrário cai no
 * primeiro núcleo permitido. Retorna `null` quando nenhum núcleo está
 * liberado — o chamador deve manter o estado fail-closed, nunca redirecionar.
 */
export function resolveEffectiveRedirect(
  canView: (moduleId: AccessModuleId) => boolean,
): string | null {
  return allowedEffectiveChildren(canView)[0]?.href ?? null;
}

export function isEffectivePath(pathname: string) {
  return effectiveActivePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
