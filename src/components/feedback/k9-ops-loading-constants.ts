/**
 * Contrato de apresentação do loading oficial do K9 Ops (Web).
 *
 * Este módulo é **puro**: não importa React, providers ou Firebase. Ele define
 * os estágios visuais, a copy oficial, os marcos de progresso e uma função de
 * derivação que recebe os estados técnicos **explicitamente como argumentos**.
 *
 * Motivo do desacoplamento: na árvore atual, `AuthGate` (que conhece
 * `authStatus`) renderiza acima de `AccessControlProvider` (que conhece
 * `accessStatus`). Não existe hoje um ponto único que enxergue os dois estados
 * simultaneamente. Por isso, a derivação não assume acesso a nenhum contexto —
 * o ponto de integração correto será decidido na próxima fase.
 */

/** Estágios visuais do loading Web. */
export type K9LoadingStage =
  | "validatingAccess"
  | "loadingPermissions"
  | "syncingModules"
  | "ready"
  | "error";

/** Estado técnico da autenticação (espelho de `AuthProvider`). */
export type AuthLoadingStatus = "loading" | "authenticated" | "unauthenticated";

/** Estado técnico do controle de acesso (espelho de `AccessControlProvider`). */
export type AccessLoadingStatus = "loading" | "fallback" | "ready";

/** Etapa exibida na checklist do loading Web. */
export interface K9LoadingStep {
  readonly stage: K9LoadingStage;
  readonly label: string;
  readonly detail: string;
}

/** Copy oficial das etapas Web (spec: 3 etapas). */
export const K9_LOADING_STEPS: readonly K9LoadingStep[] = [
  {
    stage: "validatingAccess",
    label: "Validando acesso",
    detail: "Conexão segura estabelecida",
  },
  {
    stage: "loadingPermissions",
    label: "Carregando permissões",
    detail: "Verificando níveis de autorização",
  },
  {
    stage: "syncingModules",
    label: "Sincronizando módulos",
    detail: "Inicializando componentes",
  },
] as const;

/** Título principal oficial (Web). */
export const K9_LOADING_TITLE = "PREPARANDO PAINEL OPERACIONAL...";

/** Footer institucional oficial. */
export const K9_LOADING_FOOTER = "K9 OPS • INTELLIGENCE IN MOTION";

/**
 * Teto de progresso seguro por estágio (0.0–1.0).
 *
 * O progresso jamais atinge 1.0 (100%) antes do estágio `ready` real. Entre marcos,
 * a camada de integração pode interpolar suavemente até o teto do estágio
 * atual, mas somente o estado técnico real libera o próximo marco.
 */
export const K9_STAGE_PROGRESS_CEILING: Record<K9LoadingStage, number> = {
  validatingAccess: 0.3,
  loadingPermissions: 0.7,
  syncingModules: 0.95,
  ready: 1.0,
  error: 0.0,
} as const;

/**
 * Tempo mínimo de exibição (ms) para evitar flash visual em boots rápidos.
 *
 * Apenas referência para a fase de integração. Não é aplicado nesta fase
 * estrutural — o componente não inicia timers próprios.
 */
export const K9_LOADING_MIN_DURATION_MS = 1400;

/**
 * Deriva o estágio visual a partir dos estados técnicos reais.
 *
 * Recebe os estados explicitamente — não acessa nenhum contexto. Regra:
 *
 * - auth ainda resolvendo → `validatingAccess`;
 * - autenticado + acesso carregando → `loadingPermissions`;
 * - autenticado + acesso resolvido (`ready`/`fallback`) → `ready`;
 * - não autenticado → `validatingAccess` (transitório; o redirect é do AuthGate).
 *
 * `syncingModules` é um marco de finalização visual que a camada de integração
 * pode exibir entre a resolução de permissões e a prontidão real; ele não é
 * produzido diretamente por esta derivação, mas faz parte do contrato do
 * componente.
 */
export function deriveK9LoadingStage(input: {
  authStatus: AuthLoadingStatus;
  accessStatus: AccessLoadingStatus;
}): K9LoadingStage {
  const { authStatus, accessStatus } = input;

  if (authStatus === "loading") {
    return "validatingAccess";
  }

  if (authStatus === "unauthenticated") {
    // Transitório: o AuthGate redireciona para /login. Mantém o primeiro marco
    // sem inventar significado técnico adicional.
    return "validatingAccess";
  }

  // authStatus === "authenticated"
  if (accessStatus === "loading") {
    return "loadingPermissions";
  }

  return "ready";
}

/** Índice ordinal de um estágio na sequência de etapas Web. */
export function stageOrder(stage: K9LoadingStage): number {
  switch (stage) {
    case "validatingAccess":
      return 0;
    case "loadingPermissions":
      return 1;
    case "syncingModules":
      return 2;
    case "ready":
      return 3;
    case "error":
      return -1;
  }
}
