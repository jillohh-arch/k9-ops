import type { ConsumableMaterial, WarehouseCategory } from "./contracts";

/**
 * F07: deriva as categorias reais para inventario `by_category` a partir dos materiais ativos.
 * O backend (`executeStartInventorySession`) escopa por `material.category_id`, portanto o
 * `id` retornado aqui e exatamente o `scope_ref_id` esperado. Nunca retorna dados ficticios.
 */
export function deriveInventoryCategories(
  materials: ReadonlyArray<Pick<ConsumableMaterial, "active" | "category_id" | "category_name">>,
): WarehouseCategory[] {
  const map = new Map<string, string>();
  for (const material of materials) {
    if (material.active === false) continue;
    if (!material.category_id || !material.category_name) continue;
    map.set(material.category_id, material.category_name);
  }
  return Array.from(map.entries())
    .map(([id, name]) => ({ id, name, target_type: "consumable" as const, active: true }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
