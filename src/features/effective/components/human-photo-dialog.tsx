"use client";

import { Camera, ImageUp, LoaderCircle, UserRound, X } from "lucide-react";
import Image from "next/image";
import { useState, type ChangeEvent, type FormEvent } from "react";

import { patchHumanPhoto } from "@/features/effective/data/human-admin-service";

export function HumanPhotoDialog({
  callsign,
  currentPhotoUrl,
  onClose,
  onSuccess,
  ra,
}: {
  callsign?: string;
  currentPhotoUrl?: string | null;
  onClose: () => void;
  onSuccess?: (photoUrl: string) => void;
  ra: string;
}) {
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>(currentPhotoUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    const isImageExtension = ["jpg", "jpeg", "png", "webp"].includes(extension);
    const isImageType =
      file.type.startsWith("image/") ||
      ["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(file.type);

    if (!isImageType && !isImageExtension) {
      setError("Selecione uma imagem PNG, JPG ou WEBP.");
      setPhotoFile(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("A foto deve ter no máximo 5 MB.");
      setPhotoFile(null);
      return;
    }

    setError(null);
    setPhotoFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!photoFile) {
      setError("Selecione uma foto para salvar.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const result = await patchHumanPhoto(ra, photoFile);
      onSuccess?.(result.photoUrl);
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Falha ao atualizar a foto do integrante.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
    >
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl border border-cyan-200/16 bg-[#091525] p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
              <Camera className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Foto do integrante</h2>
              <p className="text-xs text-slate-400">
                {callsign ? `${callsign} · RA ${ra}` : `RA ${ra}`}
              </p>
            </div>
          </div>
          <button
            aria-label="Fechar"
            className="rounded-lg border border-white/10 p-2 text-slate-400 hover:text-white"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="mt-5 space-y-5" onSubmit={handleSubmit}>
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="relative flex h-44 w-36 items-center justify-center overflow-hidden rounded-2xl border border-cyan-200/20 bg-slate-900 shadow-inner">
              {previewUrl ? (
                <Image
                  alt="Prévia da foto"
                  className="h-full w-full object-cover"
                  height={176}
                  src={previewUrl}
                  unoptimized={previewUrl.startsWith("blob:")}
                  width={144}
                />
              ) : (
                <UserRound className="h-16 w-16 text-slate-600" />
              )}
            </div>

            <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-cyan-300/30 bg-cyan-300/[0.04] p-3 text-center text-xs font-semibold text-cyan-200 transition hover:bg-cyan-300/[0.08]">
              <ImageUp className="h-4 w-4" />
              <span>
                {photoFile ? photoFile.name : "Selecionar foto (PNG, JPG ou WEBP)"}
              </span>
              <input
                accept=".jpg,.jpeg,.png,.webp,image/*"
                className="hidden"
                disabled={saving}
                onChange={handleFileChange}
                type="file"
              />
            </label>
          </div>

          {error ? (
            <p className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-xs font-semibold text-red-200">
              {error}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-white/5"
              disabled={saving}
              onClick={onClose}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-5 py-2.5 text-xs font-bold text-slate-950 shadow-[0_0_20px_rgba(77,208,225,0.25)] hover:bg-cyan-200 disabled:opacity-50"
              disabled={saving || !photoFile}
              type="submit"
            >
              {saving ? (
                <>
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar foto"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
