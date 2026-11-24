"use client";

import React, { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { generateWarehouseIdempotencyKey, WarehouseService } from "../data/warehouse-service";
import { InventorySession } from "../domain/contracts";

interface HomologateConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  session: InventorySession;
}

export function HomologateConfirmDialog({
  isOpen,
  onClose,
  onSuccess,
  session,
}: HomologateConfirmDialogProps) {
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await WarehouseService.homologateInventorySession({
        session_id: session.id,
        idempotency_key: generateWarehouseIdempotencyKey("homologate-inventory", session.id),
        notes: notes.trim() || null,
      });

      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || "Falha ao homologar inventário.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-emerald-500/30 bg-slate-900 p-6 shadow-xl">
        <header className="mb-4">
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <h2 className="text-lg font-bold text-white">Homologar Sessão de Inventário</h2>
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

        <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200 space-y-2">
          <p className="font-semibold text-amber-100">
            Atenção: Ação Definitiva de Ajuste de Saldo
          </p>
          <ul className="list-disc pl-4 space-y-1 text-amber-200/90">
            <li>Movimentações de ajuste contábil (<code className="text-amber-300 font-mono">inventory_adjustment</code>) serão emitidas automaticamente para todas as divergências.</li>
            <li>Os saldos físicos (<code className="text-amber-300 font-mono">ON-HAND</code>) das posições serão imediatamente atualizados.</li>
            <li>O bloqueio operacional sobre os locais e categorias inventariados será liberado.</li>
            <li>A sessão será encerrada e arquivada como documento oficial de auditoria.</li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Parecer / Observações Finais de Homologação (Opcional)
            </label>
            <textarea
              rows={3}
              placeholder="Ex: Divergências de consumo pontual justificadas pelo encarregado do canil. Ajustes homologados."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none"
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
              className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              {isSubmitting ? "Homologando..." : "Confirmar e Homologar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
