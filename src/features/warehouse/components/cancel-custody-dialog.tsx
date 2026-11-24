"use client";

import React, { useState } from "react";
import { EquipmentCustody } from "../domain/contracts";
import { generateWarehouseIdempotencyKey, WarehouseService } from "../data/warehouse-service";

interface CancelCustodyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  custody: EquipmentCustody;
}

export function CancelCustodyDialog({
  isOpen,
  onClose,
  onSuccess,
  custody,
}: CancelCustodyDialogProps) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!reason.trim()) {
      setErrorMessage("Justificativa de cancelamento é obrigatória.");
      return;
    }

    setIsSubmitting(true);
    try {
      const idempotencyKey = generateWarehouseIdempotencyKey("cancel-custody", custody.id);
      await WarehouseService.cancelCustody({
        custody_id: custody.id,
        reason: reason.trim(),
        idempotency_key: idempotencyKey,
      });

      onClose();
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Erro ao cancelar cautela.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-custody-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl text-white my-8">
        <header className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Cancelamento Administrativo</p>
          <h2 id="cancel-custody-title" className="text-xl font-bold text-amber-200">
            Cancelar Cautela
          </h2>
          <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
            <span className="font-semibold text-white">{custody.equipment_name}</span>
            <span className="text-slate-400 ml-2">({custody.equipment_code})</span>
            <div className="mt-1 text-xs text-slate-300">
              Responsável: <strong className="text-slate-100">{custody.borrower_name}</strong> (RA {custody.borrower_ra})
            </div>
          </div>
        </header>

        {errorMessage && (
          <div role="alert" className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="cancel-reason" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Motivo do Cancelamento *
            </label>
            <textarea
              id="cancel-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Lançamento em duplicidade, saída não concretizada..."
              required
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10 transition"
            >
              Voltar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-amber-600 px-5 py-2 text-sm font-bold text-slate-950 hover:bg-amber-500 transition disabled:opacity-50"
            >
              {isSubmitting ? "Cancelando..." : "Confirmar Cancelamento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
