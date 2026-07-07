"use client";

import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";

import { db } from "@/lib/firebase/client";

type RawRecord = Record<string, unknown> & { _id: string };

export type InventoryCategory = {
  active: boolean;
  description: string | null;
  id: string;
  name: string;
};

export type InventoryItemStatus =
  | "active"
  | "low_stock"
  | "out_of_stock"
  | "expired"
  | "inactive"
  | string;

export type InventoryItem = {
  active: boolean;
  brand: string | null;
  categoryId: string;
  categoryName: string;
  currentQuantity: number;
  description: string | null;
  documentUrl: string | null;
  expirationDate: Date | null;
  expirationDateText: string | null;
  id: string;
  lastMovementAt: Date | null;
  lot: string | null;
  minimumQuantity: number;
  name: string;
  photoUrl: string | null;
  status: InventoryItemStatus;
  storageLocation: string | null;
  supplierName: string | null;
  unit: string;
  updatedAt: Date | null;
};

export type InventoryMovement = {
  balanceAfter: number | null;
  balanceBefore: number | null;
  categoryName: string | null;
  delta: number;
  dogName: string | null;
  id: string;
  itemId: string;
  itemName: string;
  notes: string | null;
  performedAt: Date | null;
  performedByName: string | null;
  quantity: number;
  reason: string;
  relatedUserName: string | null;
  type: string;
  unit: string;
};

type CollectionState = {
  error: string | null;
  loading: boolean;
  records: RawRecord[];
};

const initialState: CollectionState = {
  error: null,
  loading: true,
  records: [],
};

export const fallbackInventoryCategories: InventoryCategory[] = [
  {
    active: true,
    description: "Ração, petiscos e insumos alimentares.",
    id: "alimentacao",
    name: "Alimentação",
  },
  {
    active: true,
    description: "Medicamentos, suplementos e materiais veterinários.",
    id: "saúde",
    name: "Saúde",
  },
  {
    active: true,
    description: "Mordedores, mangas, trajes e materiais de treino.",
    id: "treinamento",
    name: "Treinamento",
  },
  {
    active: true,
    description: "Guias, coleiras, focinheiras, EPIs e acessorios.",
    id: "equipamento",
    name: "Equipamento",
  },
  {
    active: true,
    description: "Produtos de higiene, limpeza e manutenção do canil.",
    id: "limpeza",
    name: "Limpeza",
  },
  {
    active: true,
    description: "Documentos, materiais administrativos e apoio.",
    id: "administrativo",
    name: "Administrativo",
  },
];

function text(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" || typeof value === "number") {
      const parsed = String(value).trim();
      if (parsed) return parsed;
    }
  }
  return null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalized(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function booleanValue(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const parsed = normalized(value);
  if (["true", "1", "sim", "ativo", "active"].includes(parsed)) return true;
  if (["false", "0", "nao", "inativo", "inactive"].includes(parsed)) {
    return false;
  }
  return fallback;
}

function dateValue(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (value && typeof value === "object" && "toDate" in value) {
    const toDate = (value as { toDate?: unknown }).toDate;
    if (typeof toDate === "function") {
      const parsed = toDate.call(value);
      return parsed instanceof Date && !Number.isNaN(parsed.getTime())
        ? parsed
        : null;
    }
  }
  return null;
}

function isDeleted(record: Record<string, unknown>) {
  return (
    record.deleted_at != null ||
    record.deletedAt != null ||
    record.archived_at != null ||
    booleanValue(record.deleted, false)
  );
}

function mapCategory(record: RawRecord): InventoryCategory {
  return {
    active: booleanValue(record.active, true) && !isDeleted(record),
    description: text(record.description),
    id: text(record.id, record._id) ?? record._id,
    name: text(record.name) ?? record._id,
  };
}

function mapItem(record: RawRecord): InventoryItem {
  return {
    active: booleanValue(record.active, true) && !isDeleted(record),
    brand: text(record.brand),
    categoryId: text(record.category_id, record.categoryId) ?? "sem_categoria",
    categoryName:
      text(record.category_name, record.categoryName) ?? "Sem categoria",
    currentQuantity: numberValue(record.current_quantity) ?? 0,
    description: text(record.description, record.notes),
    documentUrl: text(record.document_url, record.documentUrl),
    expirationDate: dateValue(record.expiration_date ?? record.expirationDate),
    expirationDateText: text(record.expiration_date, record.expirationDate),
    id: text(record.id, record._id) ?? record._id,
    lastMovementAt: dateValue(record.last_movement_at ?? record.lastMovementAt),
    lot: text(record.lot, record.lote),
    minimumQuantity: numberValue(record.minimum_quantity) ?? 0,
    name: text(record.name) ?? "Item sem nome",
    photoUrl: text(record.photo_url, record.photoUrl),
    status: text(record.status) ?? "active",
    storageLocation: text(record.storage_location, record.storageLocation),
    supplierName: text(record.supplier_name, record.supplierName),
    unit: text(record.unit) ?? "unidade",
    updatedAt: dateValue(record.updated_at ?? record.updatedAt),
  };
}

function mapMovement(record: RawRecord): InventoryMovement {
  return {
    balanceAfter: numberValue(record.balance_after),
    balanceBefore: numberValue(record.balance_before),
    categoryName: text(record.category_name, record.categoryName),
    delta: numberValue(record.delta) ?? 0,
    dogName: text(record.related_dog_name, record.relatedDogName),
    id: text(record.id, record._id) ?? record._id,
    itemId: text(record.item_id, record.itemId) ?? "",
    itemName: text(record.item_name, record.itemName) ?? "Item",
    notes: text(record.notes),
    performedAt: dateValue(record.performed_at ?? record.created_at),
    performedByName: text(record.performed_by_name, record.performedByName),
    quantity: numberValue(record.quantity) ?? 0,
    reason: text(record.reason) ?? "Movimentação",
    relatedUserName: text(record.related_user_name, record.relatedUserName),
    type: text(record.type) ?? "movimento",
    unit: text(record.unit) ?? "unidade",
  };
}

function subscribeCollection(
  path: string,
  setter: React.Dispatch<React.SetStateAction<CollectionState>>,
  ordered = false,
  maxResults?: number,
) {
  const constraints = [];
  if (ordered) constraints.push(orderBy("created_at", "desc"));
  if (maxResults) constraints.push(limit(maxResults));
  const ref = constraints.length
    ? query(collection(db, path), ...constraints)
    : collection(db, path);
  return onSnapshot(
    ref,
    (snapshot) => {
      setter({
        error: null,
        loading: false,
        records: snapshot.docs.map((item) => ({
          ...item.data(),
          _id: item.id,
        })),
      });
    },
    (error) => {
      setter({ error: error.message, loading: false, records: [] });
    },
  );
}

export function useInventoryData() {
  const [categoriesState, setCategoriesState] =
    useState<CollectionState>(initialState);
  const [itemsState, setItemsState] = useState<CollectionState>(initialState);
  const [movementsState, setMovementsState] =
    useState<CollectionState>(initialState);

  useEffect(() => {
    const unsubscribes = [
      subscribeCollection("inventory_categories", setCategoriesState),
      subscribeCollection("inventory_items", setItemsState),
      subscribeCollection("inventory_movements", setMovementsState, true, 500),
    ];
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, []);

  const categories = useMemo(() => {
    const fromFirestore = categoriesState.records
      .filter((record) => !isDeleted(record))
      .map(mapCategory)
      .filter((category) => category.active)
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return fromFirestore.length ? fromFirestore : fallbackInventoryCategories;
  }, [categoriesState.records]);

  const items = useMemo(
    () =>
      itemsState.records
        .filter((record) => !isDeleted(record))
        .map(mapItem)
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [itemsState.records],
  );

  const movements = useMemo(
    () =>
      movementsState.records
        .filter((record) => !isDeleted(record))
        .map(mapMovement)
        .sort(
          (a, b) =>
            (b.performedAt?.getTime() ?? 0) - (a.performedAt?.getTime() ?? 0),
        ),
    [movementsState.records],
  );

  const summary = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAhead = new Date(now);
    thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30);
    const activeItems = items.filter((item) => item.active);
    const criticalItems = activeItems.filter((item) =>
      ["low_stock", "out_of_stock", "expired"].includes(item.status),
    );
    const expiringItems = activeItems.filter((item) => {
      if (!item.expirationDate) return false;
      return item.expirationDate >= now && item.expirationDate <= thirtyDaysAhead;
    });
    const outgoingLast30 = movements
      .filter((movement) => {
        if (!movement.performedAt || movement.performedAt < thirtyDaysAgo) {
          return false;
        }
        return movement.delta < 0;
      })
      .reduce((total, movement) => total + Math.abs(movement.delta), 0);
    return {
      activeItems,
      criticalItems,
      expiringItems,
      outgoingLast30,
    };
  }, [items, movements]);

  return {
    categories,
    error: categoriesState.error ?? itemsState.error ?? movementsState.error,
    items,
    loading:
      categoriesState.loading || itemsState.loading || movementsState.loading,
    movements,
    summary,
  };
}

export function inventoryStatusLabel(status: string) {
  const labels: Record<string, string> = {
    active: "Regular",
    expired: "Vencido",
    inactive: "Inativo",
    low_stock: "Estoque baixo",
    out_of_stock: "Sem saldo",
  };
  return labels[status] ?? status;
}

export function inventoryMovementLabel(type: string) {
  const labels: Record<string, string> = {
    ajuste: "Ajuste",
    descarte: "Descarte",
    entrada: "Entrada",
    perda: "Perda",
    saida: "Saída",
    vencimento: "Vencimento",
  };
  return labels[type] ?? type;
}
