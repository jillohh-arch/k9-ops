"use client";

import React, { useState } from "react";
import { ConsumableMaterial } from "../domain/contracts";
import { WarehouseService } from "../data/warehouse-service";

interface ArchiveMaterialDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  material: ConsumableMaterial;
}

export function ArchiveMaterialDialog({
  isOpen,
  onClose,
  onSuccess,
  material,
}: ArchiveMaterialDialogProps) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const hasStock = material.current_quantity > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (hasStock) {
      setErrorMessage(
        `Não é possível arquivar este material porque ainda existe saldo físico em estoque (${material.current_quantity} ${material.unit}). Realize consumo, perda ou descarte prévio de todos os lotes antes de arquivar o catálogo.`,
      );
      return;
    }

    if (!reason.trim()) {
      setErrorMessage("Justificativa de arquivamento é obrigatória.");
      return;
    }

    setIsSubmitting(true);
    try {
      await WarehouseService.archiveMaterial({
        material_id: material.id,
        reason: reason.trim(),
      });

      onClose();
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Erro ao arquivar material.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="archive-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl text-white">
        <header className="mb-4">
          <h2 id="archive-dialog-title" className="text-xl font-bold text-rose-400">
            Arquivar Material do Catálogo
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Item: <span className="font-semibold text-white">{material.name}</span>
          </p>
        </header>

        {hasStock ? (
          <div role="alert" className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
            <strong>Bloqueio de Integridade:</strong> O item possui{" "}
            <span className="font-bold underline">{material.current_quantity} {material.unit}</span> em estoque físico ativo (ON-HAND). Para desativar o catálogo, o saldo de todos os lotes deve ser zerado previamente.
          </div>
        ) : (
          <p className="mb-4 text-xs text-slate-300">
            Ao arquivar este item, ele deixará de aparecer para novas entradas ou consumos, preservando integralmente o histórico de movimentações anteriores.
          </p>
        )}

        {errorMessage && (
          <div role="alert" className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="archive-reason" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Motivo do Arquivamento *
            </label>
            <textarea
              id="archive-reason"
              rows={3}
              required
              disabled={isSubmitting || hasStock}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Item descontinuado pela fabricante, substituído pelo modelo Y..."
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-800 p-2 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none disabled:opacity-50"
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
              disabled={isSubmitting || hasStock}
              className="rounded-xl bg-rose-600 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? "Arquivando..." : "Confirmar Arquivamento"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
