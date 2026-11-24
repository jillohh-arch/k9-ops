"use client";

import React, { useState } from "react";
import { Equipment, EquipmentCondition, WarehouseLocation } from "../domain/contracts";
import { WarehouseService, uploadWarehousePhoto } from "../data/warehouse-service";
import { validateEquipmentPayload } from "../domain/validation";
import { WarehousePhotoField } from "./warehouse-photo-field";

interface EquipmentFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  equipmentToEdit?: Equipment | null;
  categories: Array<{ id: string; name: string }>;
  locations: WarehouseLocation[];
}

const CONDITIONS: Array<{ value: EquipmentCondition; label: string }> = [
  { value: "new", label: "Novo (sem uso)" },
  { value: "good", label: "Bom (ótimo estado)" },
  { value: "fair", label: "Regular (desgaste natural de uso)" },
  { value: "damaged", label: "Danificado (requer reparo/vistoria)" },
];

function EquipmentFormDialogModal({
  onClose,
  onSuccess,
  equipmentToEdit,
  categories,
  locations,
}: Omit<EquipmentFormDialogProps, "isOpen">) {
  const isEditing = !!equipmentToEdit;

  const [name, setName] = useState(equipmentToEdit?.name || "");
  const [identifierCode, setIdentifierCode] = useState(equipmentToEdit?.identifier_code || "");
  const [categoryId, setCategoryId] = useState(
    equipmentToEdit?.category_id || categories[0]?.id || "",
  );
  const [condition, setCondition] = useState<EquipmentCondition>(
    equipmentToEdit?.condition || "good",
  );
  const [locationId, setLocationId] = useState(
    equipmentToEdit?.current_location_id || locations[0]?.id || "",
  );
  const [brand, setBrand] = useState(equipmentToEdit?.brand || "");
  const [model, setModel] = useState(equipmentToEdit?.model || "");
  const [serialNumber, setSerialNumber] = useState(equipmentToEdit?.serial_number || "");
  const [size, setSize] = useState(equipmentToEdit?.size || "");
  const [color, setColor] = useState(equipmentToEdit?.color || "");
  const [assignedDogName, setAssignedDogName] = useState(equipmentToEdit?.assigned_dog_name || "");
  const [assignedVehiclePrefix, setAssignedVehiclePrefix] = useState(
    equipmentToEdit?.assigned_vehicle_prefix || "",
  );
  const [notes, setNotes] = useState(equipmentToEdit?.notes || "");

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isPhotoRemoved, setIsPhotoRemoved] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const validationErrors = validateEquipmentPayload({
      name,
      identifier_code: identifierCode,
      category_id: categoryId,
      condition,
      current_location_id: locationId,
    });

    if (Object.keys(validationErrors).length > 0) {
      setErrorMessage(Object.values(validationErrors)[0]);
      return;
    }

    const selectedCategory = categories.find((c) => c.id === categoryId);
    const categoryName = selectedCategory?.name || equipmentToEdit?.category_name || "Geral";

    const selectedLocation = locations.find((l) => l.id === locationId);
    const locationName = selectedLocation?.name || equipmentToEdit?.current_location_name || "Almoxarifado";

    setIsSubmitting(true);
    try {
      let finalPhotoUrl = equipmentToEdit?.photo_url ?? null;
      let photoRemove = isPhotoRemoved;

      if (photoFile) {
        finalPhotoUrl = await uploadWarehousePhoto(
          "equipment",
          equipmentToEdit?.id || identifierCode.trim() || name.trim(),
          photoFile,
        );
        photoRemove = false;
      } else if (isPhotoRemoved) {
        finalPhotoUrl = null;
        photoRemove = true;
      }

      await WarehouseService.upsertEquipment({
        id: equipmentToEdit?.id,
        name: name.trim(),
        identifier_code: identifierCode.trim(),
        category_id: categoryId,
        category_name: categoryName,
        condition,
        current_location_id: locationId,
        current_location_name: locationName,
        brand: brand.trim() || null,
        model: model.trim() || null,
        serial_number: serialNumber.trim() || null,
        size: size.trim() || null,
        color: color.trim() || null,
        assigned_dog_name: assignedDogName.trim() || null,
        assigned_vehicle_prefix: assignedVehiclePrefix.trim() || null,
        notes: notes.trim() || null,
        photo_url: finalPhotoUrl,
        photo_remove: photoRemove,
      });

      onClose();
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Erro ao salvar equipamento.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const currentCategoryName = selectedCategory?.name || equipmentToEdit?.category_name || "Equipamentos";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="equipment-form-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl text-white my-8">
        <header className="mb-4">
          <h2 id="equipment-form-title" className="text-xl font-bold">
            {isEditing ? "Editar Equipamento" : "Cadastrar Novo Equipamento"}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {isEditing
              ? "Edite os metadados cadastrais, fotografia e detalhes do equipamento. O código patrimonial não pode ser alterado após o registro inicial."
              : "Cadastre um bem patrimoniado ou operacional do canil com identificação fotográfica."}
          </p>
        </header>

        {errorMessage && (
          <div role="alert" className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <WarehousePhotoField
              inputId="equipment-photo-input"
              label="Foto do Equipamento"
              categoryName={currentCategoryName}
              currentPhotoUrl={equipmentToEdit?.photo_url}
              selectedFile={photoFile}
              isRemoved={isPhotoRemoved}
              onFileSelect={(file) => {
                setPhotoFile(file);
                setIsPhotoRemoved(false);
                setPhotoError(null);
              }}
              onRemove={() => {
                setPhotoFile(null);
                setIsPhotoRemoved(true);
                setPhotoError(null);
              }}
              disabled={isSubmitting}
              error={photoError}
              onErrorChange={setPhotoError}
            />

            <div className="flex-1 w-full space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="eq-name" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Nome do Equipamento *
                  </label>
                  <input
                    id="eq-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Peitoral Tático Modular"
                    required
                    disabled={isSubmitting}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="eq-identifier" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Código Patrimonial / Tag *
                  </label>
                  <input
                    id="eq-identifier"
                    type="text"
                    value={identifierCode}
                    onChange={(e) => setIdentifierCode(e.target.value)}
                    disabled={isEditing || isSubmitting}
                    placeholder="Ex: EQP-K9-001 (sem barras)"
                    required
                    className={`w-full rounded-xl border border-white/10 px-3 py-2 text-sm text-white focus:outline-none ${
                      isEditing ? "bg-white/10 cursor-not-allowed text-slate-400" : "bg-white/5 focus:border-cyan-400"
                    }`}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="eq-category" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Categoria *
                  </label>
                  <select
                    id="eq-category"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    required
                    disabled={isSubmitting}
                    className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                  >
                    {categories.length > 0 ? (
                      categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))
                    ) : (
                      <option value="equipment_general">Geral Equipamentos</option>
                    )}
                  </select>
                </div>

                <div>
                  <label htmlFor="eq-condition" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Condição Física *
                  </label>
                  <select
                    id="eq-condition"
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as EquipmentCondition)}
                    required
                    disabled={isSubmitting}
                    className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                  >
                    {CONDITIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="eq-location" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Local de Armazenamento *
                  </label>
                  <select
                    id="eq-location"
                    value={locationId}
                    onChange={(e) => setLocationId(e.target.value)}
                    required
                    disabled={isSubmitting}
                    className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                  >
                    {locations.length > 0 ? (
                      locations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))
                    ) : (
                      <option value="loc-main">Almoxarifado Principal</option>
                    )}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="eq-brand" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Marca
              </label>
              <input
                id="eq-brand"
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Ex: Julius-K9"
                disabled={isSubmitting}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="eq-model" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Modelo
              </label>
              <input
                id="eq-model"
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Ex: IDC Power"
                disabled={isSubmitting}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="eq-serial" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Número de Série
              </label>
              <input
                id="eq-serial"
                type="text"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="Ex: SN-2024881"
                disabled={isSubmitting}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="eq-size" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Tamanho
              </label>
              <input
                id="eq-size"
                type="text"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                placeholder="Ex: G / XL / 10m"
                disabled={isSubmitting}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="eq-color" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Cor
              </label>
              <input
                id="eq-color"
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="Ex: Preto / Camuflado"
                disabled={isSubmitting}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="eq-dog" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Cão Vinculado (Opcional)
              </label>
              <input
                id="eq-dog"
                type="text"
                value={assignedDogName}
                onChange={(e) => setAssignedDogName(e.target.value)}
                placeholder="Ex: Thor"
                disabled={isSubmitting}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="eq-vehicle" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Viatura Vinculada (Opcional)
              </label>
              <input
                id="eq-vehicle"
                type="text"
                value={assignedVehiclePrefix}
                onChange={(e) => setAssignedVehiclePrefix(e.target.value)}
                placeholder="Ex: VTR-09"
                disabled={isSubmitting}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="eq-notes" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Observações
            </label>
            <textarea
              id="eq-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instruções de conservação, histórico, etc."
              disabled={isSubmitting}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-cyan-500 px-5 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-400 transition disabled:opacity-50"
            >
              {isSubmitting ? "Salvando..." : isEditing ? "Salvar Alterações" : "Cadastrar Equipamento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function EquipmentFormDialog(props: EquipmentFormDialogProps) {
  if (!props.isOpen) return null;
  return (
    <EquipmentFormDialogModal
      key={props.equipmentToEdit?.id ?? "new"}
      onClose={props.onClose}
      onSuccess={props.onSuccess}
      equipmentToEdit={props.equipmentToEdit}
      categories={props.categories}
      locations={props.locations}
    />
  );
}
