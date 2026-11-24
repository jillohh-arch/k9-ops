"use client";

import React, { useState } from "react";
import { ConsumableMaterial, WarehouseLocation } from "../domain/contracts";
import { generateWarehouseIdempotencyKey, WarehouseService } from "../data/warehouse-service";
import { defaultBusinessClock } from "../domain/business-clock";

interface EntryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  materials: ConsumableMaterial[];
  locations: WarehouseLocation[];
  preselectedMaterialId?: string;
}

export function EntryDialog({
  isOpen,
  onClose,
  onSuccess,
  materials,
  locations,
  preselectedMaterialId,
}: EntryDialogProps) {
  const [materialId, setMaterialId] = useState(preselectedMaterialId || materials[0]?.id || "");
  const [destinationLocationId, setDestinationLocationId] = useState(locations[0]?.id || "");
  const [lotNumber, setLotNumber] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("Aquisição / Recebimento de compra");
  const [supplierName, setSupplierName] = useState("");
  const [invoiceReference, setInvoiceReference] = useState("");
  const [notes, setNotes] = useState("");

  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    generateWarehouseIdempotencyKey("entry", preselectedMaterialId),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const selectedMaterial = materials.find((m) => m.id === (materialId || preselectedMaterialId));
  const activeLocations = locations.filter((loc) => loc.active);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const qtyNum = parseFloat(quantity);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setErrorMessage("Quantidade de entrada deve ser estritamente maior que zero.");
      return;
    }

    if (!lotNumber.trim()) {
      setErrorMessage("Número do lote é obrigatório.");
      return;
    }

    if (!expirationDate || !/^\d{4}-\d{2}-\d{2}$/.test(expirationDate)) {
      setErrorMessage("Data de validade deve estar no formato AAAA-MM-DD.");
      return;
    }

    const [y, m, d] = expirationDate.split("-").map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d));
    if (dateObj.getUTCFullYear() !== y || dateObj.getUTCMonth() + 1 !== m || dateObj.getUTCDate() !== d) {
      setErrorMessage("Data de validade inválida no calendário.");
      return;
    }

    const today = defaultBusinessClock.today();
    if (expirationDate <= today) {
      setErrorMessage("Não é permitida a entrada de lotes já vencidos.");
      return;
    }

    if (!destinationLocationId) {
      setErrorMessage("Local de destino é obrigatório.");
      return;
    }

    if (!reason.trim()) {
      setErrorMessage("Motivo da entrada é obrigatório.");
      return;
    }

    setIsSubmitting(true);
    try {
      const destLocation = locations.find((l) => l.id === destinationLocationId);
      await WarehouseService.registerEntry({
        material_id: selectedMaterial?.id || materialId,
        destination_location_id: destinationLocationId,
        destination_location_name: destLocation?.name || destinationLocationId,
        lot_number: lotNumber.trim(),
        expiration_date: expirationDate,
        quantity: qtyNum,
        reason: reason.trim(),
        supplier_name: supplierName.trim() || null,
        invoice_reference: invoiceReference.trim() || null,
        notes: notes.trim() || null,
        idempotency_key: idempotencyKey,
      });

      // Renew idempotency key on success
      setIdempotencyKey(generateWarehouseIdempotencyKey("entry"));
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Erro ao registrar entrada.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="entry-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl text-white">
        <header className="mb-4">
          <h2 id="entry-dialog-title" className="text-xl font-bold">
            Entrada de Estoque / Novo Lote
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Registra recebimento físico de lote com rastreabilidade completa e vinculação a uma posição inicial.
          </p>
        </header>

        {errorMessage && (
          <div role="alert" className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="entry-material" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Material *
            </label>
            {preselectedMaterialId ? (
              <div className="mt-1 rounded-xl border border-white/10 bg-slate-800/60 p-2 text-sm text-cyan-300 font-medium">
                {selectedMaterial?.name} ({selectedMaterial?.unit})
              </div>
            ) : (
              <select
                id="entry-material"
                value={materialId}
                onChange={(e) => setMaterialId(e.target.value)}
                disabled={isSubmitting}
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
              >
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.unit})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="entry-lot" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Número do Lote *
              </label>
              <input
                id="entry-lot"
                type="text"
                required
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                disabled={isSubmitting}
                placeholder="Ex: LT-2026-X1"
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="entry-exp" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Validade (AAAA-MM-DD) *
              </label>
              <input
                id="entry-exp"
                type="date"
                required
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                disabled={isSubmitting}
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="entry-qty" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Quantidade ({selectedMaterial?.unit || "unidade"}) *
              </label>
              <input
                id="entry-qty"
                type="number"
                min="0.001"
                step="any"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={isSubmitting}
                placeholder="0.00"
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="entry-loc" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Local de Destino *
              </label>
              <select
                id="entry-loc"
                value={destinationLocationId}
                onChange={(e) => setDestinationLocationId(e.target.value)}
                disabled={isSubmitting}
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
              >
                {activeLocations.length > 0 ? (
                  activeLocations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))
                ) : (
                  <option value="loc-principal">Almoxarifado Central</option>
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="entry-supplier" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Fornecedor
              </label>
              <input
                id="entry-supplier"
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                disabled={isSubmitting}
                placeholder="Ex: Distribuidora Pet"
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="entry-invoice" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Nota Fiscal / Ref
              </label>
              <input
                id="entry-invoice"
                type="text"
                value={invoiceReference}
                onChange={(e) => setInvoiceReference(e.target.value)}
                disabled={isSubmitting}
                placeholder="Ex: NF 12345"
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="entry-reason" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Motivo da Entrada *
            </label>
            <input
              id="entry-reason"
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isSubmitting}
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
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
              {isSubmitting ? "Registrando..." : "Confirmar Entrada"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
