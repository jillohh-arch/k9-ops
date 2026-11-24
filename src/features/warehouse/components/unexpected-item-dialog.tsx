"use client";

import React, { useState } from "react";
import { ConsumableMaterial, StockBatch, WarehouseLocation } from "../domain/contracts";
import { WarehouseService } from "../data/warehouse-service";

interface UnexpectedItemDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  sessionId: string;
  materials: ConsumableMaterial[];
  batches: StockBatch[];
  locations: WarehouseLocation[];
}

export function UnexpectedItemDialog({
  isOpen,
  onClose,
  onSuccess,
  sessionId,
  materials,
  batches,
  locations,
}: UnexpectedItemDialogProps) {
  const [materialId, setMaterialId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [countedQuantity, setCountedQuantity] = useState("");
  const [discrepancyReason, setDiscrepancyReason] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const activeMaterials = materials.filter((m) => m.active);
  const availableBatches = batches.filter((b) => b.material_id === materialId);
  const activeLocations = locations.filter((l) => l.active);
  const selectedMaterial = materials.find((m) => m.id === materialId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const qty = parseFloat(countedQuantity);
    if (isNaN(qty) || qty <= 0) {
      setErrorMessage("Quantidade física encontrada deve ser um número maior que zero.");
      return;
    }

    if (!materialId || !batchId || !locationId) {
      setErrorMessage("Material, Lote e Local físico são obrigatórios.");
      return;
    }

    if (!discrepancyReason.trim()) {
      setErrorMessage("Justificativa obrigatória para inclusão de item inesperado.");
      return;
    }

    setIsSubmitting(true);
    try {
      await WarehouseService.addUnexpectedCount({
        session_id: sessionId,
        material_id: materialId,
        batch_id: batchId,
        location_id: locationId,
        counted_quantity: qty,
        discrepancy_reason: discrepancyReason.trim(),
      });

      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || "Falha ao incluir item inesperado.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-xl">
        <header className="mb-4">
          <h2 className="text-lg font-bold text-white">Incluir Item Físico Inesperado</h2>
          <p className="mt-1 text-xs text-slate-400">
            Adicione um lote físico encontrado no local que não constava na listagem esperada do sistema.
          </p>
        </header>

        {errorMessage && (
          <div role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="unexpected-material-select" className="block text-xs font-medium text-slate-300 mb-1">
              Material <span className="text-red-400">*</span>
            </label>
            <select
              id="unexpected-material-select"
              required
              value={materialId}
              onChange={(e) => {
                setMaterialId(e.target.value);
                setBatchId("");
              }}
              className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
            >
              <option value="">Selecione o material...</option>
              {activeMaterials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.unit})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="unexpected-batch-select" className="block text-xs font-medium text-slate-300 mb-1">
              Lote Encontrado <span className="text-red-400">*</span>
            </label>
            <select
              id="unexpected-batch-select"
              required
              disabled={!materialId}
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none disabled:opacity-50"
            >
              <option value="">
                {materialId ? "Selecione o lote..." : "Primeiro selecione o material"}
              </option>
              {availableBatches.map((b) => (
                <option key={b.id} value={b.id}>
                  Lote {b.lot_number} (Val: {b.expiration_date})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="unexpected-location-select" className="block text-xs font-medium text-slate-300 mb-1">
              Local Físico Encontrado <span className="text-red-400">*</span>
            </label>
            <select
              id="unexpected-location-select"
              required
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
            >
              <option value="">Selecione o local...</option>
              {activeLocations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Quantidade Física Apurada {selectedMaterial ? `(${selectedMaterial.unit})` : ""}{" "}
              <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              step="any"
              min="0.001"
              required
              placeholder="Ex: 5"
              value={countedQuantity}
              onChange={(e) => setCountedQuantity(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Justificativa do Item Inesperado <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={2}
              required
              placeholder="Explique a origem provável do material encontrado (ex: transferência física sem registro, guarda incorreta)"
              value={discrepancyReason}
              onChange={(e) => setDiscrepancyReason(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="rounded-lg border border-white/10 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
            >
              {isSubmitting ? "Incluindo..." : "Adicionar Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
