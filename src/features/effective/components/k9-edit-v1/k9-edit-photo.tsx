"use client";

import Image from "next/image";
import { ChangeEvent } from "react";
import { Camera, ImagePlus, Trash2 } from "lucide-react";

/**
 * Photo control for Edit V1.
 *
 * Mirrors the Create V1 frame so the photo keeps profile presence, and adds the
 * logical removal affordance Edit needs (Create has nothing to remove yet).
 * Removal is a *reference* clear — the adapter turns it into
 * clearFields:["profileImageUrl"], never a null and never a Storage delete.
 */
export function K9EditPhoto({
  error,
  onPhotoChange,
  onRemove,
  previewUrl,
}: {
  error?: string;
  onPhotoChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
  previewUrl: string;
}) {
  const hasPhoto = Boolean(previewUrl);

  return (
    <div>
      <label
        className="group relative block aspect-[4/5] w-full cursor-pointer overflow-hidden rounded-2xl border border-cyan-200/16 bg-[radial-gradient(circle_at_50%_18%,rgba(77,208,225,0.12),transparent_40%),#081521] shadow-[0_20px_50px_rgba(0,0,0,0.22)] transition hover:border-cyan-300/35 focus-within:ring-2 focus-within:ring-cyan-300/60"
        htmlFor="k9-edit-photo"
      >
        {hasPhoto ? (
          <Image
            alt="Foto do K9"
            className="object-cover transition duration-300 group-hover:scale-[1.025]"
            fill
            src={previewUrl}
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-200 shadow-[0_12px_28px_rgba(0,0,0,0.16)]">
              <Camera aria-hidden className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm font-bold text-slate-200">Foto do K9</p>
              <p className="mt-1 text-[11px] text-slate-500">Sem foto definida</p>
            </div>
          </div>
        )}

        <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 border-t border-white/10 bg-[#07131b]/88 px-3 py-3 text-xs font-bold text-cyan-100 backdrop-blur-sm transition group-hover:bg-[#07131b]/96">
          <ImagePlus aria-hidden className="h-4 w-4 text-cyan-300" />
          {hasPhoto ? "Trocar foto" : "Adicionar foto"}
        </span>

        <input
          accept="image/png,image/jpeg,image/webp"
          aria-describedby="k9-edit-photo-help"
          className="sr-only"
          id="k9-edit-photo"
          onChange={onPhotoChange}
          type="file"
        />
      </label>

      <p className="mt-2 text-center text-[11px] text-slate-500" id="k9-edit-photo-help">
        PNG, JPG ou WEBP · até 5 MB
      </p>

      {hasPhoto ? (
        <button
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-[11px] font-bold text-slate-400 transition hover:border-red-300/30 hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
          onClick={onRemove}
          type="button"
        >
          <Trash2 aria-hidden className="h-3.5 w-3.5" />
          Remover foto
        </button>
      ) : null}

      {error ? (
        <p className="mt-2 text-center text-[11px] text-red-300" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
