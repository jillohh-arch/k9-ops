"use client";

import React, { useState } from "react";
import { ConsumableMaterial, StockBatch, StockPosition, WarehouseLocation } from "../domain/contracts";
import { generateWarehouseIdempotencyKey, WarehouseService } from "../data/warehouse-service";

interface LossDisposalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  material: ConsumableMaterial;
  batches: StockBatch[];
  positions: StockPosition[];
  locations: WarehouseLocation[];
}

export function LossDisposalDialog({
  isOpen,
  onClose,
  onSuccess,
  material,
  batches,
  positions,
  locations,
}: LossDisposalDialogProps) {
  const materialBatches = batches.filter((b) => b.material_id === material.id);
  const materialPositions = positions.filter((p) => p.material_id === material.id);

  // Locations that have stock for this material
  const originCandidates = locations.filter((loc) =>
    materialPositions.some((pos) => pos.location_id === loc.id && pos.quantity > 0),
  );

  const [type, setType] = useState<"loss" | "disposal">("disposal");
  const [originLocationId, setOriginLocationId] = useState(originCandidates[0]?.id || "");
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    generateWarehouseIdempotencyKey("loss-disposal", material.id),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Batches at selected origin
  const batchesAtOrigin = materialBatches.filter((b) =>
    materialPositions.some(
      (pos) => pos.batch_id === b.id && pos.location_id === originLocationId && pos.quantity > 0,
    ),
  );

  const currentPos = materialPositions.find(
    (p) => p.batch_id === (selectedBatchId || batchesAtOrigin[0]?.id) && p.location_id === originLocationId,
  );
  const maxAvailable = currentPos ? currentPos.quantity : 0;

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const activeBatchId = selectedBatchId || batchesAtOrigin[0]?.id;
    if (!activeBatchId) {
      setErrorMessage("Selecione um lote.");
      return;
    }

    if (!originLocationId) {
      setErrorMessage("Selecione o local de estoque.");
      return;
    }

    const qtyNum = parseFloat(quantity);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setErrorMessage("Quantidade deve ser maior que zero.");
      return;
    }

    if (qtyNum > maxAvailable) {
      setErrorMessage(
        `Quantidade informada (${qtyNum}) excede o saldo físico no local (${maxAvailable}).`,
      );
      return;
    }

    if (!reason.trim()) {
      setErrorMessage("Motivo da baixa é obrigatório (ex: produto vencido, avaria física, laudo veterinário).");
      return;
    }

    setIsSubmitting(true);
    try {
      await WarehouseService.registerLossDisposal({
        material_id: material.id,
        batch_id: activeBatchId,
        origin_location_id: originLocationId,
        type,
        quantity: qtyNum,
        reason: reason.trim(),
        notes: notes.trim() || null,
        idempotency_key: idempotencyKey,
      });

      setIdempotencyKey(generateWarehouseIdempotencyKey("loss-disposal", material.id));
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Erro ao registrar perda ou descarte.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="loss-disposal-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl text-white">
        <header className="mb-4">
          <h2 id="loss-disposal-dialog-title" className="text-xl font-bold">
            Baixa por Perda ou Descarte
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Material: <span className="font-semibold text-cyan-300">{material.name}</span> · Registra baixa irreversível no estoque físico.
          </p>
        </header>

        {errorMessage && (
          <div role="alert" className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="loss-type" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Tipo de Baixa *
              </label>
              <select
                id="loss-type"
                value={type}
                onChange={(e) => setType(e.target.value as "loss" | "disposal")}
                disabled={isSubmitting}
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
              >
                <option value="disposal">Descarte (Vencido / Inutilizado)</option>
                <option value="loss">Perda (Extravio / Avaria física)</option>
              </select>
            </div>

            <div>
              <label htmlFor="loss-origin" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Local de Origem *
              </label>
              <select
                id="loss-origin"
                value={originLocationId}
                onChange={(e) => {
                  setOriginLocationId(e.target.value);
                  setSelectedBatchId("");
                }}
                disabled={isSubmitting}
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
              >
                {originCandidates.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="loss-batch" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Lote Afetado *
            </label>
            <select
              id="loss-batch"
              value={selectedBatchId || batchesAtOrigin[0]?.id || ""}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              disabled={isSubmitting}
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
            >
              {batchesAtOrigin.map((b) => {
                const pos = materialPositions.find(
                  (p) => p.batch_id === b.id && p.location_id === originLocationId,
                );
                return (
                  <option key={b.id} value={b.id}>
                    Lote {b.lot_number} (Val: {b.expiration_date}) — Saldo: {pos?.quantity ?? 0} {material.unit}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="loss-qty" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Quantidade ({material.unit}) *
              </label>
              <input
                id="loss-qty"
                type="number"
                min="0.001"
                max={maxAvailable > 0 ? maxAvailable : undefined}
                step="any"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={isSubmitting}
                placeholder={`Máx: ${maxAvailable}`}
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="loss-reason" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Motivo / Justificativa *
              </label>
              <input
                id="loss-reason"
                type="text"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isSubmitting}
                placeholder="Ex: Produto avariado no transporte"
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="loss-notes" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Observações / Laudo
            </label>
            <input
              id="loss-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isSubmitting}
              placeholder="Ex: Auto de constatação nº 45/2026..."
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
              disabled={isSubmitting || maxAvailable <= 0}
              className="rounded-xl bg-rose-600 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? "Registrando..." : "Confirmar Baixa"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
