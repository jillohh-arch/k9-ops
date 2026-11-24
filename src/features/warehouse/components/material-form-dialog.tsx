"use client";

import React, { useState } from "react";
import { ConsumableMaterial } from "../domain/contracts";
import { WarehouseService, uploadWarehousePhoto } from "../data/warehouse-service";
import { WarehousePhotoField } from "./warehouse-photo-field";

interface MaterialFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  materialToEdit?: ConsumableMaterial | null;
  categories: Array<{ id: string; name: string }>;
}

function MaterialFormDialogModal({
  onClose,
  onSuccess,
  materialToEdit,
  categories,
}: Omit<MaterialFormDialogProps, "isOpen">) {
  const isEditing = !!materialToEdit;

  const [name, setName] = useState(materialToEdit?.name || "");
  const [categoryId, setCategoryId] = useState(materialToEdit?.category_id || categories[0]?.id || "");
  const [unit, setUnit] = useState(materialToEdit?.unit || "unidade");
  const [minimumQuantity, setMinimumQuantity] = useState<string>(
    materialToEdit ? String(materialToEdit.minimum_quantity) : "0",
  );
  const [brand, setBrand] = useState(materialToEdit?.brand || "");
  const [description, setDescription] = useState(materialToEdit?.description || "");
  const [notes, setNotes] = useState(materialToEdit?.notes || "");

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isPhotoRemoved, setIsPhotoRemoved] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const minQtyNum = parseFloat(minimumQuantity);
    if (isNaN(minQtyNum) || minQtyNum < 0) {
      setErrorMessage("Estoque mínimo deve ser um número válido maior ou igual a zero.");
      return;
    }

    if (!name.trim()) {
      setErrorMessage("O nome do material é obrigatório.");
      return;
    }

    const category = categories.find((c) => c.id === categoryId);
    const categoryName = category?.name || (isEditing ? materialToEdit?.category_name : "Geral") || "Geral";

    setIsSubmitting(true);
    try {
      let finalPhotoUrl = materialToEdit?.photo_url ?? null;
      let photoRemove = isPhotoRemoved;

      if (photoFile) {
        finalPhotoUrl = await uploadWarehousePhoto(
          "material",
          materialToEdit?.id || name.trim(),
          photoFile,
        );
        photoRemove = false;
      } else if (isPhotoRemoved) {
        finalPhotoUrl = null;
        photoRemove = true;
      }

      await WarehouseService.upsertMaterial({
        id: materialToEdit?.id,
        name: name.trim(),
        category_id: categoryId,
        category_name: categoryName,
        unit: unit.trim(),
        minimum_quantity: minQtyNum,
        brand: brand.trim() || null,
        description: description.trim() || null,
        notes: notes.trim() || null,
        photo_url: finalPhotoUrl,
        photo_remove: photoRemove,
      });

      onClose();
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Erro ao salvar material.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const currentCategoryName = selectedCategory?.name || (isEditing ? materialToEdit?.category_name : "Geral") || "Geral";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="material-form-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto"
    >
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl text-white my-8">
        <header className="mb-4">
          <h2 id="material-form-title" className="text-xl font-bold">
            {isEditing ? "Editar Metadados do Material" : "Cadastrar Novo Material"}
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {isEditing
              ? "Edite especificações, foto e estoque mínimo. Saldos físicos só são alterados via movimentações registradas."
              : "Defina os dados cadastrais do item e fotografia de identificação. Nenhum saldo inicial é cadastrado diretamente aqui."}
          </p>
        </header>

        {errorMessage && (
          <div role="alert" className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <WarehousePhotoField
              inputId="material-photo-input"
              label="Foto do Material"
              categoryName={currentCategoryName}
              currentPhotoUrl={materialToEdit?.photo_url}
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
              <div>
                <label htmlFor="material-name" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Nome do Material *
                </label>
                <input
                  id="material-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="Ex: Ração Super Premium Adulto 15kg"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="material-category" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Categoria *
                  </label>
                  <select
                    id="material-category"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    disabled={isSubmitting}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                  >
                    {categories.length > 0 ? (
                      categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))
                    ) : (
                      <option value="cat-geral">Geral</option>
                    )}
                  </select>
                </div>

                <div>
                  <label htmlFor="material-unit" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Unidade *
                  </label>
                  <select
                    id="material-unit"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    disabled={isSubmitting}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                  >
                    <option value="unidade">unidade</option>
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="pacote">pacote</option>
                    <option value="caixa">caixa</option>
                    <option value="frasco">frasco</option>
                    <option value="dose">dose</option>
                    <option value="comprimido">comprimido</option>
                    <option value="litro">litro</option>
                    <option value="ml">ml</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="material-min-qty" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Estoque Mínimo *
              </label>
              <input
                id="material-min-qty"
                type="number"
                min="0"
                step="any"
                required
                value={minimumQuantity}
                onChange={(e) => setMinimumQuantity(e.target.value)}
                disabled={isSubmitting}
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="material-brand" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Marca / Fabricante
              </label>
              <input
                id="material-brand"
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                disabled={isSubmitting}
                placeholder="Ex: Premier Pet"
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="material-description" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Descrição / Especificações
            </label>
            <textarea
              id="material-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              placeholder="Detalhes técnicos ou operacionais..."
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="material-notes" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Observações Adicionais
            </label>
            <input
              id="material-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isSubmitting}
              placeholder="Instruções internas..."
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <footer className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? "Salvando..." : isEditing ? "Salvar Alterações" : "Criar Material"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

export function MaterialFormDialog(props: MaterialFormDialogProps) {
  if (!props.isOpen) return null;
  return (
    <MaterialFormDialogModal
      key={props.materialToEdit?.id ?? "new"}
      onClose={props.onClose}
      onSuccess={props.onSuccess}
      materialToEdit={props.materialToEdit}
      categories={props.categories}
    />
  );
}
