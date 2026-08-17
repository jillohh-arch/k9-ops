"use client";

import { Input } from "@/components/ui/input";

export function K9CreateComplementary({
  color,
  microchip,
  notes,
  onColorChange,
  onMicrochipChange,
  onNotesChange,
  onSizeChange,
  size,
}: {
  color: string;
  microchip: string;
  notes: string;
  onColorChange: (value: string) => void;
  onMicrochipChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSizeChange: (value: string) => void;
  size: string;
}) {
  return (
    <section className="rounded-2xl border border-cyan-200/12 bg-[#0b1628]/82 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
          Informações complementares
        </h2>
        <p className="text-[11px] text-slate-500">Todos opcionais</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block" htmlFor="k9-create-color">
          <span className="mb-2 block text-xs font-semibold text-slate-300">
            Cor / Pelagem
          </span>
          <Input
            id="k9-create-color"
            placeholder="Ex.: Caramelo"
            onChange={(e) => onColorChange(e.target.value)}
            value={color}
          />
        </label>

        <label className="block" htmlFor="k9-create-size">
          <span className="mb-2 block text-xs font-semibold text-slate-300">
            Porte
          </span>
          <Input
            id="k9-create-size"
            placeholder="Ex.: Grande"
            onChange={(e) => onSizeChange(e.target.value)}
            value={size}
          />
        </label>

        <label className="block" htmlFor="k9-create-microchip">
          <span className="mb-2 block text-xs font-semibold text-slate-300">
            Microchip
          </span>
          <Input
            id="k9-create-microchip"
            inputMode="numeric"
            placeholder="Número do microchip"
            onChange={(e) => onMicrochipChange(e.target.value)}
            value={microchip}
          />
        </label>

        <label className="block sm:col-span-2" htmlFor="k9-create-notes">
          <span className="mb-2 block text-xs font-semibold text-slate-300">
            Observações
          </span>
          <textarea
            aria-describedby="k9-create-notes-counter"
            className="min-h-28 w-full rounded-xl border border-cyan-300/15 bg-slate-950/70 p-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10"
            id="k9-create-notes"
            maxLength={800}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Informações administrativas adicionais"
            value={notes}
          />
          <span
            className="mt-1 block text-right text-[11px] text-slate-500"
            id="k9-create-notes-counter"
          >
            {notes.length}/800
          </span>
        </label>
      </div>
    </section>
  );
}
