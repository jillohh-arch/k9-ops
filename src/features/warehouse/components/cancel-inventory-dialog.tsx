"use client";

import React, { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { WarehouseService } from "../data/warehouse-service";
import { InventorySession } from "../domain/contracts";

interface CancelInventoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  session: InventorySession;
}

export function CancelInventoryDialog({
  isOpen,
  onClose,
  onSuccess,
  session,
}: CancelInventoryDialogProps) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!reason.trim()) {
      setErrorMessage("Motivo do cancelamento é obrigatório.");
      return;
    }

    setIsSubmitting(true);
    try {
      await WarehouseService.cancelInventorySession({
        session_id: session.id,
        reason: reason.trim(),
      });

      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || "Falha ao cancelar sessão de inventário.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-slate-900 p-6 shadow-xl">
        <header className="mb-4">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
            <h2 className="text-lg font-bold text-white">Cancelar Sessão de Inventário</h2>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {session.title}
          </p>
        </header>

        {errorMessage && (
          <div role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            {errorMessage}
          </div>
        )}

        <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-200">
          <p>
            O cancelamento anulará todas as contagens pendentes ou realizadas nesta sessão. Nenhum saldo será alterado e as travas de movimentação de estoque serão removidas.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Motivo do Cancelamento <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={3}
              required
              autoFocus
              placeholder="Explique o motivo do cancelamento da sessão de conferência física..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-red-500/30 bg-slate-800 px-3 py-2 text-sm text-white focus:border-red-400 focus:outline-none"
            />
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="rounded-lg border border-white/10 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-white/5"
            >
              Voltar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
            >
              {isSubmitting ? "Cancelando..." : "Confirmar Cancelamento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
