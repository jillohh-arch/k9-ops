"use client";

import Image from "next/image";
import { ChangeEvent } from "react";
import { Camera, ImagePlus } from "lucide-react";

/**
 * Único controle de foto do cadastro. A ação e o preview compartilham o
 * mesmo quadro para que a foto tenha presença de perfil, sem duplicar affordances.
 */
export function K9CreatePhoto({
  error,
  hasPhoto,
  onPhotoChange,
  previewUrl,
}: {
  error?: string;
  hasPhoto: boolean;
  onPhotoChange: (event: ChangeEvent<HTMLInputElement>) => void;
  previewUrl: string;
}) {
  return (
    <div>
      <label
        className="group relative block aspect-[4/5] w-full cursor-pointer overflow-hidden rounded-2xl border border-cyan-200/16 bg-[radial-gradient(circle_at_50%_18%,rgba(77,208,225,0.12),transparent_40%),#081521] shadow-[0_20px_50px_rgba(0,0,0,0.22)] transition hover:border-cyan-300/35 focus-within:ring-2 focus-within:ring-cyan-300/60"
        htmlFor="k9-create-photo"
      >
        {previewUrl ? (
          <Image
            alt="Preview da foto do K9"
            className="object-cover transition duration-300 group-hover:scale-[1.025]"
            fill
            src={previewUrl}
            unoptimized={previewUrl.startsWith("blob:")}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-200 shadow-[0_12px_28px_rgba(0,0,0,0.16)]">
              <Camera aria-hidden className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm font-bold text-slate-200">Foto do K9</p>
              <p className="mt-1 text-[11px] text-slate-500">Opcional no cadastro</p>
            </div>
          </div>
        )}

        <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 border-t border-white/10 bg-[#07131b]/88 px-3 py-3 text-xs font-bold text-cyan-100 backdrop-blur-sm transition group-hover:bg-[#07131b]/96">
          <ImagePlus aria-hidden className="h-4 w-4 text-cyan-300" />
          {hasPhoto ? "Trocar foto" : "Adicionar foto"}
        </span>

        <input
          accept="image/png,image/jpeg,image/webp"
          aria-describedby="k9-create-photo-help"
          className="sr-only"
          id="k9-create-photo"
          onChange={onPhotoChange}
          type="file"
        />
      </label>

      <p className="mt-2 text-center text-[11px] text-slate-500" id="k9-create-photo-help">
        PNG, JPG ou WEBP · até 5 MB
      </p>
      {error ? (
        <p className="mt-2 text-center text-[11px] text-red-300" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
