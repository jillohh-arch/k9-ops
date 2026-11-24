"use client";

import React, { useEffect, useState } from "react";
import { ConsumableMaterial, StockBatch, StockPosition, WarehouseLocation } from "../domain/contracts";
import { generateWarehouseIdempotencyKey, WarehouseService } from "../data/warehouse-service";
import { suggestFefoBatch, validateFefoOverride } from "../domain/fefo";
import { defaultBusinessClock } from "../domain/business-clock";

interface ConsumptionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  material: ConsumableMaterial;
  batches: StockBatch[];
  positions: StockPosition[];
  locations: WarehouseLocation[];
}

export function ConsumptionDialog({
  isOpen,
  onClose,
  onSuccess,
  material,
  batches,
  positions,
  locations,
}: ConsumptionDialogProps) {
  const today = defaultBusinessClock.today();
  const materialBatches = batches.filter((b) => b.material_id === material.id);
  const materialPositions = positions.filter((p) => p.material_id === material.id);

  // Available locations that have positive stock of this material
  const locationsWithStock = locations.filter((loc) =>
    materialPositions.some((pos) => pos.location_id === loc.id && pos.quantity > 0),
  );

  const [originLocationId, setOriginLocationId] = useState(locationsWithStock[0]?.id || "");
  // The operator's explicit batch choice belongs to the origin it was made in.
  // A batch id alone is not enough: the same batch can hold stock in two
  // locations, so keeping only the id would silently re-attach the old choice
  // after the origin changes back (or points at a location with no stock of it).
  const [rawSelection, setRawSelection] = useState<{ batchId: string; locationId: string }>({
    batchId: "",
    locationId: "",
  });
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("Consumo operacional de rotina");
  const [fefoOverrideReason, setFefoOverrideReason] = useState("");
  const [relatedDogName, setRelatedDogName] = useState("");
  const [relatedUserName, setRelatedUserName] = useState("");
  const [notes, setNotes] = useState("");

  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    generateWarehouseIdempotencyKey("consumption", material.id),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Batches available at the selected location
  const batchesAtLocation = materialBatches.filter((b) =>
    materialPositions.some(
      (pos) => pos.batch_id === b.id && pos.location_id === originLocationId && pos.quantity > 0,
    ),
  );

  // FEFO suggested batch at this location
  const recommendedBatch = suggestFefoBatch(materialBatches, today, {
    locationId: originLocationId,
    positions: materialPositions,
  });

  // Derive the effective batch on every render instead of syncing state in an
  // effect. A stored choice is honoured ONLY while its origin is still the
  // selected origin AND the batch still has stock there; otherwise the FEFO
  // suggestion for the new origin wins.
  const rawSelectionApplies =
    rawSelection.locationId === originLocationId &&
    batchesAtLocation.some((b) => b.id === rawSelection.batchId);
  const selectedBatchId = rawSelectionApplies
    ? rawSelection.batchId
    : (recommendedBatch?.id ?? batchesAtLocation[0]?.id ?? "");

  if (!isOpen) return null;

  const currentBatch = materialBatches.find((b) => b.id === selectedBatchId);
  const currentPos = materialPositions.find(
    (p) => p.batch_id === selectedBatchId && p.location_id === originLocationId,
  );
  const maxAvailable = currentPos ? currentPos.quantity : 0;

  const isOverride = recommendedBatch && selectedBatchId && selectedBatchId !== recommendedBatch.id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const qtyNum = parseFloat(quantity);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setErrorMessage("Quantidade de consumo deve ser estritamente maior que zero.");
      return;
    }

    if (qtyNum > maxAvailable) {
      setErrorMessage(
        `Quantidade informada (${qtyNum} ${material.unit}) excede o saldo físico disponível neste lote e local (${maxAvailable} ${material.unit}).`,
      );
      return;
    }

    if (!selectedBatchId) {
      setErrorMessage("Selecione um lote para a saída.");
      return;
    }

    if (!originLocationId) {
      setErrorMessage("Selecione o local de origem do estoque.");
      return;
    }

    if (!reason.trim()) {
      setErrorMessage("Motivo do consumo é obrigatório.");
      return;
    }

    // FEFO Override validation
    if (isOverride) {
      const overrideCheck = validateFefoOverride({
        selectedBatchId,
        recommendedBatchId: recommendedBatch.id,
        overrideReason: fefoOverrideReason,
      });
      if (!overrideCheck.valid) {
        setErrorMessage(overrideCheck.error || "Justificativa de override FEFO inválida.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await WarehouseService.registerConsumption({
        material_id: material.id,
        batch_id: selectedBatchId,
        origin_location_id: originLocationId,
        quantity: qtyNum,
        reason: reason.trim(),
        fefo_override_reason: isOverride ? fefoOverrideReason.trim() : null,
        related_dog_name: relatedDogName.trim() || null,
        related_user_name: relatedUserName.trim() || null,
        notes: notes.trim() || null,
        idempotency_key: idempotencyKey,
      });

      setIdempotencyKey(generateWarehouseIdempotencyKey("consumption", material.id));
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Erro ao registrar consumo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="consumption-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl text-white">
        <header className="mb-4">
          <h2 id="consumption-dialog-title" className="text-xl font-bold">
            Registrar Saída / Consumo
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Material: <span className="font-semibold text-cyan-300">{material.name}</span> · Regra FEFO recomendada
          </p>
        </header>

        {errorMessage && (
          <div role="alert" className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="consume-origin" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Local de Origem *
            </label>
            <select
              id="consume-origin"
              value={originLocationId}
              onChange={(e) => {
                setOriginLocationId(e.target.value);
                setRawSelection({ batchId: "", locationId: "" });
              }}
              disabled={isSubmitting}
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
            >
              {locationsWithStock.length > 0 ? (
                locationsWithStock.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))
              ) : (
                <option value="">Nenhum local com saldo disponível</option>
              )}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="consume-batch" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Lote de Saída *
              </label>
              {recommendedBatch && (
                <span className="text-xs text-cyan-400">
                  Sugerido FEFO: Lote {recommendedBatch.lot_number} (Vence {recommendedBatch.expiration_date})
                </span>
              )}
            </div>
            <select
              id="consume-batch"
              value={selectedBatchId}
              onChange={(e) => setRawSelection({ batchId: e.target.value, locationId: originLocationId })}
              disabled={isSubmitting}
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
            >
              {batchesAtLocation.map((b) => {
                const pos = materialPositions.find(
                  (p) => p.batch_id === b.id && p.location_id === originLocationId,
                );
                const isRec = recommendedBatch?.id === b.id;
                return (
                  <option key={b.id} value={b.id}>
                    {isRec ? "★ [RECOMENDADO FEFO] " : ""}Lote {b.lot_number} (Val: {b.expiration_date}) — Saldo: {pos?.quantity ?? 0} {material.unit}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Alert and required justification when FEFO recommendation is overridden */}
          {isOverride && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
              <p className="font-semibold text-amber-300">Atenção: Desvio da regra FEFO</p>
              <p className="mt-1 text-slate-300">
                Você selecionou um lote com validade mais distante que a menor validade disponível.
                Informe obrigatoriamente a justificativa operacional:
              </p>
              <textarea
                rows={2}
                value={fefoOverrideReason}
                onChange={(e) => setFefoOverrideReason(e.target.value)}
                disabled={isSubmitting}
                placeholder="Ex: Lote reservado para treinamento externo..."
                className="mt-2 w-full rounded-lg border border-amber-500/40 bg-slate-800 p-2 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="consume-qty" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Quantidade a Consumir ({material.unit}) *
              </label>
              <input
                id="consume-qty"
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
              <label htmlFor="consume-reason" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Motivo / Destinação *
              </label>
              <input
                id="consume-reason"
                type="text"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isSubmitting}
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="consume-dog" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Cão Vinculado (Opcional)
              </label>
              <input
                id="consume-dog"
                type="text"
                value={relatedDogName}
                onChange={(e) => setRelatedDogName(e.target.value)}
                disabled={isSubmitting}
                placeholder="Ex: Thor"
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="consume-user" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Condutor / Solicitante (Opcional)
              </label>
              <input
                id="consume-user"
                type="text"
                value={relatedUserName}
                onChange={(e) => setRelatedUserName(e.target.value)}
                disabled={isSubmitting}
                placeholder="Ex: GCM Silva"
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              />
            </div>
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
              {isSubmitting ? "Registrando..." : "Confirmar Saída"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
