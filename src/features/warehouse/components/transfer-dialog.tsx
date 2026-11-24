"use client";

import React, { useState } from "react";
import { ConsumableMaterial, StockBatch, StockPosition, WarehouseLocation } from "../domain/contracts";
import { generateWarehouseIdempotencyKey, WarehouseService } from "../data/warehouse-service";

interface TransferDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  material: ConsumableMaterial;
  batches: StockBatch[];
  positions: StockPosition[];
  locations: WarehouseLocation[];
}

export function TransferDialog({
  isOpen,
  onClose,
  onSuccess,
  material,
  batches,
  positions,
  locations,
}: TransferDialogProps) {
  const materialBatches = batches.filter((b) => b.material_id === material.id);
  const materialPositions = positions.filter((p) => p.material_id === material.id);

  // Locations that have positive stock for this material
  const originCandidates = locations.filter((loc) =>
    materialPositions.some((pos) => pos.location_id === loc.id && pos.quantity > 0),
  );

  const [originLocationId, setOriginLocationId] = useState(originCandidates[0]?.id || "");
  const [destinationLocationId, setDestinationLocationId] = useState(
    locations.find((l) => l.id !== originCandidates[0]?.id)?.id || "",
  );
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("Transferência entre setores / viaturas");
  const [notes, setNotes] = useState("");

  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    generateWarehouseIdempotencyKey("transfer", material.id),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Batches at selected origin
  const batchesAtOrigin = materialBatches.filter((b) =>
    materialPositions.some(
      (pos) => pos.batch_id === b.id && pos.location_id === originLocationId && pos.quantity > 0,
    ),
  );

  // Active destination candidates (excluding origin)
  const destinationCandidates = locations.filter(
    (loc) => loc.active && loc.id !== originLocationId,
  );

  // Current batch position at origin
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
      setErrorMessage("Selecione um lote disponível na origem.");
      return;
    }

    if (!originLocationId) {
      setErrorMessage("Selecione o local de origem.");
      return;
    }

    if (!destinationLocationId) {
      setErrorMessage("Selecione o local de destino.");
      return;
    }

    if (originLocationId === destinationLocationId) {
      setErrorMessage("O local de destino deve ser estritamente diferente do local de origem.");
      return;
    }

    const qtyNum = parseFloat(quantity);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setErrorMessage("Quantidade de transferência deve ser maior que zero.");
      return;
    }

    if (qtyNum > maxAvailable) {
      setErrorMessage(
        `Quantidade informada (${qtyNum}) excede o saldo físico no local de origem (${maxAvailable}).`,
      );
      return;
    }

    if (!reason.trim()) {
      setErrorMessage("Motivo da transferência é obrigatório.");
      return;
    }

    setIsSubmitting(true);
    try {
      const destLocation = locations.find((l) => l.id === destinationLocationId);
      await WarehouseService.registerTransfer({
        material_id: material.id,
        batch_id: activeBatchId,
        origin_location_id: originLocationId,
        destination_location_id: destinationLocationId,
        destination_location_name: destLocation?.name || destinationLocationId,
        quantity: qtyNum,
        reason: reason.trim(),
        notes: notes.trim() || null,
        idempotency_key: idempotencyKey,
      });

      setIdempotencyKey(generateWarehouseIdempotencyKey("transfer", material.id));
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Erro ao registrar transferência.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="transfer-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl text-white">
        <header className="mb-4">
          <h2 id="transfer-dialog-title" className="text-xl font-bold">
            Transferência entre Locais Físicos
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Material: <span className="font-semibold text-cyan-300">{material.name}</span> · O saldo global ON-HAND é conservado (delta zero).
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
              <label htmlFor="transfer-origin" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Local de Origem *
              </label>
              <select
                id="transfer-origin"
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

            <div>
              <label htmlFor="transfer-dest" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Local de Destino *
              </label>
              <select
                id="transfer-dest"
                value={destinationLocationId}
                onChange={(e) => setDestinationLocationId(e.target.value)}
                disabled={isSubmitting}
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
              >
                {destinationCandidates.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="transfer-batch" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Lote a Transferir *
            </label>
            <select
              id="transfer-batch"
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
                    Lote {b.lot_number} (Val: {b.expiration_date}) — Saldo na Origem: {pos?.quantity ?? 0} {material.unit}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="transfer-qty" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Quantidade a Transferir ({material.unit}) *
              </label>
              <input
                id="transfer-qty"
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
              <label htmlFor="transfer-reason" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Motivo da Transferência *
              </label>
              <input
                id="transfer-reason"
                type="text"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isSubmitting}
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="transfer-notes" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Observações Adicionais
            </label>
            <input
              id="transfer-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isSubmitting}
              placeholder="Ex: Guia de remessa interna..."
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
              className="rounded-xl bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? "Transferindo..." : "Confirmar Transferência"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
