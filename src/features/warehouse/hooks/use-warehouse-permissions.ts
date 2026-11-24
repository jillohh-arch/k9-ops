/**
 * Permissoes de UI do Almoxarifado derivadas do perfil v7 (modulo `inventory`).
 *
 * Isto e apenas affordance de interface: o backend (callables + Firestore Rules)
 * continua sendo a autoridade definitiva e rejeita fail-closed.
 *
 * Mapeamento espelha o `requireAccessPermission` de cada callable F60:
 * - create : entrada, consumo, transferencia, perda, abertura de cautela, novos cadastros
 * - edit   : edicao de cadastro, atualizacao de situacao, cancelamento de cautela
 * - archive: arquivar material, baixar/aposentar equipamento
 * - audit  : sessoes de inventario fisico
 * - export : exportacao de relatorios
 * - returnCustody: devolucao aceita `create` ou `edit` (ver adminWarehouseReturnCustody)
 */
export interface WarehousePermissions {
  canCreate: boolean;
  canEdit: boolean;
  canArchive: boolean;
  canAudit: boolean;
  canExport: boolean;
  canReturnCustody: boolean;
}

export const READONLY_WAREHOUSE_PERMISSIONS: WarehousePermissions = {
  canCreate: false,
  canEdit: false,
  canArchive: false,
  canAudit: false,
  canExport: false,
  canReturnCustody: false,
};

export function resolveWarehousePermissions(
  permissions?: WarehousePermissions,
): WarehousePermissions {
  return permissions ?? READONLY_WAREHOUSE_PERMISSIONS;
}
