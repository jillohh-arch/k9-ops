import {
  callAdminArchiveInventoryCategory,
  callAdminArchiveInventoryItem,
  callAdminCreateInventoryMovement,
  callAdminSeedInventoryDefaults,
  callAdminUpsertInventoryCategory,
  callAdminUpsertInventoryItem,
} from "@/lib/firebase/functions";

export type InventoryItemFormValues = {
  active: boolean;
  brand: string;
  categoryId: string;
  categoryName: string;
  description: string;
  documentUrl: string;
  expirationDate: string;
  initialQuantity: string;
  lot: string;
  minimumQuantity: string;
  name: string;
  notes: string;
  photoUrl: string;
  storageLocation: string;
  supplierName: string;
  unit: string;
};

export type InventoryCategoryFormValues = {
  active: boolean;
  description: string;
  name: string;
};

export type InventoryMovementFormValues = {
  expirationDate: string;
  itemId: string;
  lot: string;
  notes: string;
  quantity: string;
  reason: string;
  relatedDogId: string;
  relatedDogName: string;
  relatedOccurrenceId: string;
  relatedTrainingSessionId: string;
  relatedUserName: string;
  relatedUserRa: string;
  type: string;
  unit: string;
};

export const emptyInventoryItemFormValues: InventoryItemFormValues = {
  active: true,
  brand: "",
  categoryId: "alimentacao",
  categoryName: "Alimentação",
  description: "",
  documentUrl: "",
  expirationDate: "",
  initialQuantity: "",
  lot: "",
  minimumQuantity: "0",
  name: "",
  notes: "",
  photoUrl: "",
  storageLocation: "",
  supplierName: "",
  unit: "unidade",
};

export const emptyInventoryCategoryFormValues: InventoryCategoryFormValues = {
  active: true,
  description: "",
  name: "",
};

export const emptyInventoryMovementFormValues: InventoryMovementFormValues = {
  expirationDate: "",
  itemId: "",
  lot: "",
  notes: "",
  quantity: "",
  reason: "",
  relatedDogId: "",
  relatedDogName: "",
  relatedOccurrenceId: "",
  relatedTrainingSessionId: "",
  relatedUserName: "",
  relatedUserRa: "",
  type: "entrada",
  unit: "unidade",
};

export async function seedInventoryDefaults() {
  const response = await callAdminSeedInventoryDefaults({});
  return response.data.seeded ?? 0;
}

export async function saveInventoryCategory(
  mode: "create" | "edit",
  values: InventoryCategoryFormValues,
  id?: string,
) {
  const response = await callAdminUpsertInventoryCategory({
    id,
    mode,
    payload: values,
  });
  return response.data.id ?? id ?? values.name;
}

export async function archiveInventoryCategory(id: string, reason: string) {
  await callAdminArchiveInventoryCategory({ id, reason });
}

export async function saveInventoryItem(
  mode: "create" | "edit",
  values: InventoryItemFormValues,
  id?: string,
) {
  const response = await callAdminUpsertInventoryItem({
    id,
    mode,
    profile: values,
  });
  return response.data.id ?? id ?? values.name;
}

export async function archiveInventoryItem(id: string, reason: string) {
  await callAdminArchiveInventoryItem({ id, reason });
}

export async function createInventoryMovement(
  values: InventoryMovementFormValues,
) {
  const response = await callAdminCreateInventoryMovement({
    payload: values,
  });
  return response.data;
}
