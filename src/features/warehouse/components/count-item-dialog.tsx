"use client";

import React, { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { InventoryItemCount } from "../domain/contracts";
import { calculateDiscrepancy, validateCountPayload } from "../domain/inventory";
import { WarehouseService } from "../data/warehouse-service";

interface CountItemDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  count: InventoryItemCount;
}

export function CountItemDialog({
  isOpen,
  onClose,
  onSuccess,
  count,
}: CountItemDialogProps) {
  const [countedQuantity, setCountedQuantity] = useState<string>(
    count.counted_quantity !== null && count.counted_quantity !== undefined
      ? String(count.counted_quantity)
      : "",
  );
  const [discrepancyReason, setDiscrepancyReason] = useState<string>(
    count.discrepancy_reason || "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const countedNum = countedQuantity === "" ? null : Number(countedQuantity);
  const discrepancy =
    countedNum !== null ? calculateDiscrepancy(count.expected_quantity, countedNum) : null;
  const hasDiscrepancy = discrepancy !== null && discrepancy !== 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const validation = validateCountPayload({
      session_id: count.session_id,
      count_id: count.id,
      counted_quantity: countedNum,
      expected_quantity: count.expected_quantity,
      discrepancy_reason: discrepancyReason,
    });

    if (Object.keys(validation).length > 0) {
      setErrorMessage(Object.values(validation)[0]);
      return;
    }

    setIsSubmitting(true);
    try {
      await WarehouseService.recordInventoryCount({
        session_id: count.session_id,
        count_id: count.id,
        counted_quantity: countedNum as number,
        discrepancy_reason: hasDiscrepancy ? discrepancyReason.trim() : null,
      });

      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || "Falha ao registrar contagem física.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-xl">
        <header className="mb-4">
          <h2 className="text-lg font-bold text-white">Conferência Física de Posição</h2>
          <p className="mt-1 text-xs text-slate-400">
            {count.material_name} · Lote: <span className="font-mono text-cyan-300">{count.lot_number}</span>
          </p>
          <p className="text-xs text-slate-400">
            Local: {count.location_name}
          </p>
        </header>

        {errorMessage && (
          <div role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            {errorMessage}
          </div>
        )}

        <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3 text-xs">
          <div className="flex justify-between items-center text-slate-300">
            <span>Saldo Esperado (Sistema):</span>
            <span className="text-sm font-semibold text-white">
              {count.expected_quantity} {count.unit}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-medium text-slate-300">
                Quantidade Física Contada ({count.unit}) <span className="text-red-400">*</span>
              </label>
              <button
                type="button"
                onClick={() => setCountedQuantity("0")}
                className="rounded border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-300 hover:bg-red-500/20"
              >
                Contado Zero (0)
              </button>
            </div>
            <input
              type="number"
              step="any"
              min="0"
              required
              autoFocus
              placeholder={`Digite o total apurado fisicamente (${count.unit})`}
              value={countedQuantity}
              onChange={(e) => setCountedQuantity(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
            />
          </div>

          {discrepancy !== null && (
            <div
              className={`rounded-xl border p-3 text-xs ${
                discrepancy === 0
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : discrepancy < 0
                  ? "border-red-500/30 bg-red-500/10 text-red-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-300"
              }`}
            >
              <p className="font-semibold flex items-center gap-1">
                {discrepancy === 0 ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Saldo físico coincide exatamente com o esperado.</span>
                  </>
                ) : discrepancy < 0 ? (
                  `Falta apurada: ${discrepancy} ${count.unit}`
                ) : (
                  `Sobra apurada: +${discrepancy} ${count.unit}`
                )}
              </p>
            </div>
          )}

          {hasDiscrepancy && (
            <div>
              <label className="block text-xs font-medium text-amber-200 mb-1">
                Justificativa da Divergência <span className="text-red-400">*</span>
              </label>
              <textarea
                rows={2}
                required
                placeholder="Explique o motivo da diferença física (ex: quebra, avaria, consumo não lançado, sobra de embalagem)"
                value={discrepancyReason}
                onChange={(e) => setDiscrepancyReason(e.target.value)}
                className="w-full rounded-lg border border-amber-500/30 bg-slate-800 px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
              />
            </div>
          )}

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
              {isSubmitting ? "Salvando..." : "Confirmar Contagem"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
